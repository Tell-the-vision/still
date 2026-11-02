/**
 * Artist studio domain logic (server-only): exhibitions an artist owns.
 * Admins may call everything here on any exhibition.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  AUDIO_PROVIDER,
  audioConfigurations,
  exhibitions,
  guideSentences,
  THEME_FONT,
  users,
  type AudioProvider,
  type Exhibition,
  type ThemeFont,
  type User,
} from "@/db/schema";
import { HttpError, isAdmin, isArtist } from "./api";
import { HEX_COLOR } from "./keepsake-templates";

export const LIMITS = {
  title: 80,
  subtitle: 120,
  venue: 120,
  description: 2000,
  sectionTitle: 60,
  sentence: 300,
  sentencesPerExhibition: 200,
  artistName: 40,
  artistBio: 600,
} as const;

// ------------------------------------------------------------ artist apply
export async function applyAsArtist(
  user: User,
  input: { artistName?: unknown; artistBio?: unknown; artistPortfolioUrl?: unknown },
) {
  if (user.role === "ADMIN") throw new HttpError("CONFLICT", "관리자 계정은 아티스트 신청이 필요 없습니다.");
  if (user.artistStatus === "PENDING") throw new HttpError("CONFLICT", "이미 심사 중인 신청이 있습니다.");
  if (user.artistStatus === "APPROVED") throw new HttpError("CONFLICT", "이미 승인된 아티스트입니다.");

  const artistName = String(input.artistName ?? "").trim();
  const artistBio = String(input.artistBio ?? "").trim();
  const portfolio = String(input.artistPortfolioUrl ?? "").trim();
  if (!artistName) throw new HttpError("VALIDATION_FAILED", "아티스트 이름을 입력해 주세요.");
  if (artistName.length > LIMITS.artistName)
    throw new HttpError("VALIDATION_FAILED", `아티스트 이름은 ${LIMITS.artistName}자 이내여야 합니다.`);
  if (artistBio.length > LIMITS.artistBio)
    throw new HttpError("VALIDATION_FAILED", `소개는 ${LIMITS.artistBio}자 이내여야 합니다.`);
  if (portfolio && !/^https?:\/\//i.test(portfolio))
    throw new HttpError("VALIDATION_FAILED", "포트폴리오 링크는 http(s)로 시작해야 합니다.");

  const [updated] = await db
    .update(users)
    .set({
      artistStatus: "PENDING",
      artistName,
      artistBio: artistBio || null,
      artistPortfolioUrl: portfolio || null,
      artistAppliedAt: new Date(),
      artistReviewedAt: null,
      artistReviewNote: null,
    })
    .where(eq(users.id, user.id))
    .returning();
  return updated;
}

// ---------------------------------------------------------------- access
export function canManageExhibition(user: User, ex: Pick<Exhibition, "ownerId">) {
  if (isAdmin(user)) return true;
  return isArtist(user) && ex.ownerId === user.id;
}

export async function getManagedExhibition(user: User, id: string) {
  const row = await db.query.exhibitions.findFirst({
    where: eq(exhibitions.id, id),
    with: {
      owner: { columns: { id: true, displayName: true, artistName: true, email: true, status: true } },
      audioConfig: true,
    },
  });
  if (!row || row.status === "DELETED")
    throw new HttpError("RESOURCE_NOT_FOUND", "전시를 찾을 수 없습니다.");
  if (!canManageExhibition(user, row)) throw new HttpError("FORBIDDEN", "이 전시를 관리할 권한이 없습니다.");
  return row;
}

// ------------------------------------------------------------------ slug
function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/[^a-z0-9\s-]/g, "") // keep ASCII only so QR URLs stay short
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(title: string) {
  let base = slugify(title);
  if (base.length < 3) base = `ex-${Math.random().toString(36).slice(2, 8)}`;
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const hit = await db.query.exhibitions.findFirst({
      where: eq(exhibitions.slug, slug),
      columns: { id: true },
    });
    if (!hit) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ------------------------------------------------------------- validation
export type ExhibitionInput = {
  title?: unknown;
  subtitle?: unknown;
  venue?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  description?: unknown;
  coverImageUrl?: unknown;
  guide?: unknown; // { section: string; sentences: string[] }[]
  audio?: unknown; // { provider, playlistUrl, playlistTitle, playlistDescription, ambienceEnabled }
  theme?: unknown; // { bg, fg, accent: "#RRGGBB", font: "sans" | "serif" | "display" }
};

type GuideSectionInput = { section: string | null; sentences: string[] };
type AudioInput = {
  audioProvider: AudioProvider;
  playlistUrl: string | null;
  playlistTitle: string | null;
  playlistDescription: string | null;
  ambienceEnabled: boolean;
};

const str = (v: unknown, max: number, label: string, required = false) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new HttpError("VALIDATION_FAILED", `${label}을(를) 입력해 주세요.`);
  if (s.length > max) throw new HttpError("VALIDATION_FAILED", `${label}은(는) ${max}자 이내여야 합니다.`);
  return s || null;
};

const isoDate = (v: unknown, label: string) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s).getTime()))
    throw new HttpError("VALIDATION_FAILED", `${label} 형식이 올바르지 않습니다 (YYYY-MM-DD).`);
  return s;
};

function parseGuide(v: unknown): GuideSectionInput[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new HttpError("VALIDATION_FAILED", "guide 형식이 올바르지 않습니다.");
  let total = 0;
  const out: GuideSectionInput[] = [];
  for (const sec of v as Array<{ section?: unknown; sentences?: unknown }>) {
    const section = str(sec?.section, LIMITS.sectionTitle, "섹션 제목");
    const raw = Array.isArray(sec?.sentences) ? (sec.sentences as unknown[]) : [];
    const sentences = raw
      .map((s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : ""))
      .filter(Boolean);
    for (const s of sentences)
      if (s.length > LIMITS.sentence)
        throw new HttpError("VALIDATION_FAILED", `해설 문장은 ${LIMITS.sentence}자 이내여야 합니다.`);
    total += sentences.length;
    if (sentences.length) out.push({ section, sentences });
  }
  if (total > LIMITS.sentencesPerExhibition)
    throw new HttpError("VALIDATION_FAILED", `해설 문장은 최대 ${LIMITS.sentencesPerExhibition}개까지입니다.`);
  return out;
}

function parseAudio(v: unknown): AudioInput | undefined {
  if (v === undefined) return undefined;
  const a = (v ?? {}) as Record<string, unknown>;
  const provider = typeof a.provider === "string" ? a.provider : "NONE";
  if (!(AUDIO_PROVIDER as readonly string[]).includes(provider))
    throw new HttpError("VALIDATION_FAILED", "오디오 제공자가 올바르지 않습니다.");
  const playlistUrl = str(a.playlistUrl, 500, "플레이리스트 링크");
  if (provider !== "NONE") {
    if (!playlistUrl) throw new HttpError("VALIDATION_FAILED", "플레이리스트 링크를 입력해 주세요.");
    const ok =
      (provider === "SPOTIFY" && /^https:\/\/open\.spotify\.com\//i.test(playlistUrl)) ||
      (provider === "APPLE_MUSIC" && /^https:\/\/music\.apple\.com\//i.test(playlistUrl));
    if (!ok)
      throw new HttpError(
        "VALIDATION_FAILED",
        provider === "SPOTIFY"
          ? "Spotify 링크는 https://open.spotify.com/ 으로 시작해야 합니다."
          : "Apple Music 링크는 https://music.apple.com/ 으로 시작해야 합니다.",
      );
  }
  return {
    audioProvider: provider as AudioProvider,
    playlistUrl: provider === "NONE" ? null : playlistUrl,
    playlistTitle: provider === "NONE" ? null : str(a.playlistTitle, 120, "플레이리스트 제목"),
    playlistDescription: provider === "NONE" ? null : str(a.playlistDescription, 300, "플레이리스트 설명"),
    ambienceEnabled: a.ambienceEnabled === undefined ? true : Boolean(a.ambienceEnabled),
  };
}

function parseBase(input: ExhibitionInput, partial: boolean) {
  const out: Partial<typeof exhibitions.$inferInsert> = {};
  if (!partial || input.title !== undefined) out.title = str(input.title, LIMITS.title, "전시명", true)!;
  if (!partial || input.subtitle !== undefined) out.subtitle = str(input.subtitle, LIMITS.subtitle, "부제");
  if (!partial || input.venue !== undefined) out.venue = str(input.venue, LIMITS.venue, "장소");
  if (!partial || input.startDate !== undefined) out.startDate = isoDate(input.startDate, "시작일");
  if (!partial || input.endDate !== undefined) out.endDate = isoDate(input.endDate, "종료일");
  if (!partial || input.description !== undefined)
    out.description = str(input.description, LIMITS.description, "전시 소개");
  if (!partial || input.coverImageUrl !== undefined) {
    const url = str(input.coverImageUrl, 500, "대표 이미지");
    if (url && !(url.startsWith("/") || /^https?:\/\//i.test(url)))
      throw new HttpError("VALIDATION_FAILED", "대표 이미지는 URL 또는 업로드한 이미지여야 합니다.");
    out.coverImageUrl = url;
  }
  if (out.startDate && out.endDate && out.startDate > out.endDate)
    throw new HttpError("VALIDATION_FAILED", "종료일은 시작일보다 빠를 수 없습니다.");
  if (input.theme !== undefined) {
    const t = (input.theme ?? {}) as Record<string, unknown>;
    const color = (v: unknown, label: string) => {
      const str = typeof v === "string" ? v.trim().toUpperCase() : "";
      if (!HEX_COLOR.test(str)) throw new HttpError("VALIDATION_FAILED", `${label} 색상은 #RRGGBB 형식이어야 합니다.`);
      return str;
    };
    if (!(THEME_FONT as readonly string[]).includes(String(t.font ?? "sans")))
      throw new HttpError("VALIDATION_FAILED", "서체는 sans / serif / display 중 하나여야 합니다.");
    out.themeBg = color(t.bg ?? "#FFFFFF", "배경");
    out.themeFg = color(t.fg ?? "#000000", "글자");
    out.themeAccent = color(t.accent ?? "#000000", "포인트");
    out.themeFont = String(t.font ?? "sans") as ThemeFont;
  }
  return out;
}

// -------------------------------------------------------------- mutations
export async function createExhibition(owner: User, input: ExhibitionInput) {
  const base = parseBase(input, false);
  const guide = parseGuide(input.guide) ?? [];
  const audio = parseAudio(input.audio) ?? {
    audioProvider: "NONE" as const,
    playlistUrl: null,
    playlistTitle: null,
    playlistDescription: null,
    ambienceEnabled: true,
  };
  const slug = await uniqueSlug(base.title!);
  const [row] = await db
    .insert(exhibitions)
    .values({ ...base, title: base.title!, slug, ownerId: owner.id, status: "DRAFT" })
    .returning();
  await db.update(exhibitions).set({ qrCodeUrl: `/api/exhibitions/${slug}/qr` }).where(eq(exhibitions.id, row.id));
  await replaceGuide(row.id, guide);
  await db.insert(audioConfigurations).values({ exhibitionId: row.id, ...audio, ambienceType: "PINK_NOISE" });
  return row;
}

export async function updateExhibition(ex: Exhibition, input: ExhibitionInput) {
  const base = parseBase(input, true);
  const guide = parseGuide(input.guide);
  const audio = parseAudio(input.audio);
  if (Object.keys(base).length) await db.update(exhibitions).set(base).where(eq(exhibitions.id, ex.id));
  if (guide) await replaceGuide(ex.id, guide);
  if (audio) {
    const existing = await db.query.audioConfigurations.findFirst({
      where: eq(audioConfigurations.exhibitionId, ex.id),
    });
    if (existing) await db.update(audioConfigurations).set(audio).where(eq(audioConfigurations.id, existing.id));
    else await db.insert(audioConfigurations).values({ exhibitionId: ex.id, ...audio, ambienceType: "PINK_NOISE" });
  }
  return (await db.query.exhibitions.findFirst({ where: eq(exhibitions.id, ex.id) }))!;
}

/**
 * Replace the guide while keeping the ids of sentences whose text is
 * unchanged, so existing scraps stay linked (their snapshot survives either way).
 */
async function replaceGuide(exhibitionId: string, sections: GuideSectionInput[]) {
  const existing = await db.query.guideSentences.findMany({
    where: eq(guideSentences.exhibitionId, exhibitionId),
  });
  const pool = new Map<string, string[]>(); // content → ids
  for (const s of existing) pool.set(s.content, [...(pool.get(s.content) ?? []), s.id]);

  const keep = new Set<string>();
  let sequence = 0;
  const inserts: { exhibitionId: string; section: string | null; content: string; sequence: number }[] = [];
  for (const sec of sections) {
    for (const content of sec.sentences) {
      const ids = pool.get(content);
      const reuse = ids?.shift();
      if (reuse) {
        keep.add(reuse);
        await db
          .update(guideSentences)
          .set({ section: sec.section, sequence })
          .where(eq(guideSentences.id, reuse));
      } else {
        inserts.push({ exhibitionId, section: sec.section, content, sequence });
      }
      sequence++;
    }
  }
  for (const s of existing) {
    if (!keep.has(s.id))
      await db.delete(guideSentences).where(and(eq(guideSentences.id, s.id), eq(guideSentences.exhibitionId, exhibitionId)));
  }
  if (inserts.length) await db.insert(guideSentences).values(inserts);
}

export async function setExhibitionStatus(
  ex: Exhibition,
  status: "DRAFT" | "ACTIVE" | "HIDDEN" | "DELETED",
) {
  if (status === "ACTIVE") {
    const count = await db.query.guideSentences.findMany({
      where: eq(guideSentences.exhibitionId, ex.id),
      columns: { id: true },
    });
    if (!ex.title) throw new HttpError("VALIDATION_FAILED", "전시명이 필요합니다.");
    if (count.length === 0)
      throw new HttpError("VALIDATION_FAILED", "해설 가이드 문장을 최소 1개 이상 등록해야 공개할 수 있습니다.");
  }
  const [row] = await db
    .update(exhibitions)
    .set({ status, publishedAt: status === "ACTIVE" && !ex.publishedAt ? new Date() : ex.publishedAt })
    .where(eq(exhibitions.id, ex.id))
    .returning();
  return row;
}

/** Hard delete (admin only) — removes user archives for it too (FK cascade). */
export async function hardDeleteExhibition(id: string) {
  await db.delete(exhibitions).where(eq(exhibitions.id, id));
}
