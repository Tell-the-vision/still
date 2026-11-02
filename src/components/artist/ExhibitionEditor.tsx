"use client";

/**
 * Artist studio — create / edit an exhibition.
 *
 * Sections:  basic info · cover image · commentary guide (sections → one
 * sentence per line) · audio (organiser playlist or STILL Ambience) ·
 * publish / preview / QR · delete.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/artist/ImageUpload";
import { THEME_FONT_STACK } from "@/components/KeepsakeCard";
import { Button, Dialog, Loading, Notice, SectionTitle, cx } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { api, errorMessage } from "@/lib/client/fetcher";
import { formatDateTime } from "@/lib/format";

type Form = {
  title: string;
  subtitle: string;
  venue: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImageUrl: string;
};
type GuideSection = { section: string; text: string };
type Audio = {
  provider: "NONE" | "SPOTIFY" | "APPLE_MUSIC";
  playlistUrl: string;
  playlistTitle: string;
  playlistDescription: string;
  ambienceEnabled: boolean;
};
type Theme = { bg: string; fg: string; accent: string; font: "sans" | "serif" | "display" };
type Loaded = {
  theme: Theme;
  exhibition: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    venue: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
    coverImageUrl: string | null;
    status: "DRAFT" | "ACTIVE" | "HIDDEN" | "DELETED";
    publishedAt: string | null;
    updatedAt: string;
    likeCount: number;
    owner: { id: string; displayName: string; artistName: string | null } | null;
  };
  guide: { section: string | null; sentences: string[] }[];
  audio: { provider: Audio["provider"]; playlistUrl: string | null; playlistTitle: string | null; playlistDescription: string | null; ambienceEnabled: boolean };
};

const EMPTY_FORM: Form = { title: "", subtitle: "", venue: "", startDate: "", endDate: "", description: "", coverImageUrl: "" };
const EMPTY_AUDIO: Audio = { provider: "NONE", playlistUrl: "", playlistTitle: "", playlistDescription: "", ambienceEnabled: true };
const DEFAULT_THEME_FORM: Theme = { bg: "#FFFFFF", fg: "#000000", accent: "#000000", font: "sans" };
const THEME_PRESETS: { name: string; theme: Theme }[] = [
  { name: "STILL 기본", theme: { bg: "#FFFFFF", fg: "#000000", accent: "#000000", font: "sans" } },
  { name: "따뜻한 종이", theme: { bg: "#F4F1EA", fg: "#1F1D1A", accent: "#8A6A3D", font: "serif" } },
  { name: "밤의 전시", theme: { bg: "#0E0E10", fg: "#F2F2F2", accent: "#E0B458", font: "sans" } },
  { name: "에디토리얼", theme: { bg: "#FFFFFF", fg: "#111111", accent: "#C0392B", font: "display" } },
];

const STATUS_LABEL = { DRAFT: "비공개 초안", ACTIVE: "공개 중", HIDDEN: "관리자 숨김", DELETED: "삭제됨" } as const;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block mb-5">
      <span className="block text-xs text-muted mb-1">{label}</span>
      {children}
      {hint && <span className="block text-muted text-xs mt-1">{hint}</span>}
    </label>
  );
}
const input = "w-full h-11 border-b border-line text-[15px]";

export function ExhibitionEditor({ exhibitionId, backHref = "/artist" }: { exhibitionId?: string; backHref?: string }) {
  const router = useRouter();
  const isNew = !exhibitionId;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [guide, setGuide] = useState<GuideSection[]>([{ section: "Introduction", text: "" }]);
  const [audio, setAudio] = useState<Audio>(EMPTY_AUDIO);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME_FORM);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin), []);

  const load = useCallback(async () => {
    if (!exhibitionId) return;
    setLoading(true);
    try {
      const d = await api<Loaded>(`/api/artist/exhibitions/${exhibitionId}`);
      setLoaded(d);
      setForm({
        title: d.exhibition.title ?? "",
        subtitle: d.exhibition.subtitle ?? "",
        venue: d.exhibition.venue ?? "",
        startDate: d.exhibition.startDate ?? "",
        endDate: d.exhibition.endDate ?? "",
        description: d.exhibition.description ?? "",
        coverImageUrl: d.exhibition.coverImageUrl ?? "",
      });
      setGuide(d.guide.length ? d.guide.map((g) => ({ section: g.section ?? "", text: g.sentences.join("\n") })) : [{ section: "Introduction", text: "" }]);
      setAudio({
        provider: d.audio.provider,
        playlistUrl: d.audio.playlistUrl ?? "",
        playlistTitle: d.audio.playlistTitle ?? "",
        playlistDescription: d.audio.playlistDescription ?? "",
        ambienceEnabled: d.audio.ambienceEnabled,
      });
      setTheme(d.theme ?? DEFAULT_THEME_FORM);
      setDirty(false);
    } catch (err) {
      setError(errorMessage(err, "전시를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [exhibitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Unsaved-changes guards (reload/close + in-app link clicks)
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (a && !window.confirm("저장하지 않은 변경 사항이 있습니다. 이 페이지를 나갈까요?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const setA = <K extends keyof Audio>(k: K, v: Audio[K]) => {
    setAudio((a) => ({ ...a, [k]: v }));
    setDirty(true);
  };
  const setT = <K extends keyof Theme>(k: K, v: Theme[K]) => {
    setTheme((t) => ({ ...t, [k]: v }));
    setDirty(true);
  };

  const payload = useMemo(
    () => ({
      ...form,
      guide: guide.map((g) => ({ section: g.section.trim() || null, sentences: g.text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) })),
      audio,
      theme,
    }),
    [form, guide, audio, theme],
  );
  const sentenceCount = payload.guide.reduce((n, g) => n + g.sentences.length, 0);

  const save = async (): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const { exhibition } = await api<{ exhibition: { id: string } }>("/api/artist/exhibitions", { method: "POST", body: payload });
        track("artist_exhibition_create", { exhibition_id: exhibition.id });
        setDirty(false);
        router.replace(`/artist/exhibitions/${exhibition.id}`);
        return exhibition.id;
      }
      await api(`/api/artist/exhibitions/${exhibitionId}`, { method: "PUT", body: payload });
      setDirty(false);
      setSavedAt(new Date());
      await load();
      return exhibitionId!;
    } catch (err) {
      setError(errorMessage(err, "저장에 실패했습니다."));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: "ACTIVE" | "DRAFT") => {
    if (!exhibitionId) return;
    if (dirty) {
      const id = await save();
      if (!id) return;
    }
    setPublishing(true);
    setError(null);
    try {
      await api(`/api/artist/exhibitions/${exhibitionId}/status`, { method: "POST", body: { status } });
      if (status === "ACTIVE") track("artist_exhibition_publish", { exhibition_id: exhibitionId });
      await load();
    } catch (err) {
      setError(errorMessage(err, "상태를 변경하지 못했습니다."));
    } finally {
      setPublishing(false);
    }
  };

  const remove = async () => {
    if (!exhibitionId) return;
    setDeleting(true);
    try {
      await api(`/api/artist/exhibitions/${exhibitionId}`, { method: "DELETE" });
      setDirty(false);
      router.replace(backHref);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "삭제하지 못했습니다."));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return <Loading />;
  if (!isNew && !loaded) return <div className="px-5">{error && <Notice tone="error">{error}</Notice>}</div>;

  const ex = loaded?.exhibition;
  const publicUrl = ex ? `${origin}/e/${ex.slug}` : "";

  return (
    <div className="px-5 pb-12">
      {ex && (
        <div className="hairline pt-4 pb-2 flex items-center justify-between text-xs">
          <span className={cx("px-2 py-1 border", ex.status === "ACTIVE" ? "border-ink" : "border-line text-muted")}>{STATUS_LABEL[ex.status]}</span>
          <span className="text-muted">
            ♥ {ex.likeCount} · 수정 {formatDateTime(ex.updatedAt)}
          </span>
        </div>
      )}

      {ex?.status === "HIDDEN" && (
        <div className="mt-3">
          <Notice tone="error">관리자가 이 전시를 숨겼습니다. 수정은 가능하지만 다시 공개하려면 관리자에게 문의해 주세요.</Notice>
        </div>
      )}

      <SectionTitle>기본 정보</SectionTitle>
      <Field label="전시명 *">
        <input className={input} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={80} required />
      </Field>
      <Field label="부제">
        <input className={input} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={120} />
      </Field>
      <Field label="장소">
        <input className={input} value={form.venue} onChange={(e) => set("venue", e.target.value)} maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="시작일">
          <input type="date" className={input} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="종료일">
          <input type="date" className={input} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </Field>
      </div>
      <Field label="전시 소개" hint={`${form.description.length} / 2000`}>
        <textarea className="w-full border-b border-line text-[15px] leading-7 resize-none py-2" rows={5} value={form.description} onChange={(e) => set("description", e.target.value.slice(0, 2000))} />
      </Field>

      <SectionTitle>대표 이미지</SectionTitle>
      <ImageUpload value={form.coverImageUrl} onChange={(url) => set("coverImageUrl", url)} />

      <SectionTitle right={<span className="text-xs text-muted">{sentenceCount} 문장</span>}>해설 가이드</SectionTitle>
      <p className="text-muted text-xs mb-3">섹션(작품/챕터)별로 해설을 적어 주세요. 한 줄이 한 문장이 되고, 관람객은 문장 단위로 저장(Scrap)합니다.</p>
      {guide.map((g, i) => (
        <div key={i} className="border border-line p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              className="flex-1 h-9 border-b border-line text-sm"
              placeholder="섹션 제목 (예: Room 1 — Objects)"
              value={g.section}
              maxLength={60}
              onChange={(e) => {
                setGuide((gs) => gs.map((x, j) => (j === i ? { ...x, section: e.target.value } : x)));
                setDirty(true);
              }}
            />
            <button
              type="button"
              className="text-xs text-muted underline underline-offset-4"
              onClick={() => {
                setGuide((gs) => (gs.length > 1 ? gs.filter((_, j) => j !== i) : [{ section: "", text: "" }]));
                setDirty(true);
              }}
            >
              섹션 삭제
            </button>
          </div>
          <textarea
            className="w-full text-sm leading-6 resize-none"
            rows={5}
            placeholder={"한 줄에 한 문장씩 입력\n예) 낡은 컵의 손잡이에는 수천 번의 아침이 쌓여 있다."}
            value={g.text}
            onChange={(e) => {
              setGuide((gs) => gs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)));
              setDirty(true);
            }}
          />
        </div>
      ))}
      <Button type="button" variant="secondary" className="h-10 text-xs" onClick={() => { setGuide((gs) => [...gs, { section: "", text: "" }]); setDirty(true); }}>
        + 섹션 추가
      </Button>

      <SectionTitle>전시 아이덴티티 (웹카드 색상 · 서체)</SectionTitle>
      <p className="text-muted text-xs mb-3">
        Keepsake 템플릿은 공통이고, 색상과 서체만 전시마다 바뀝니다. 가이드 화면에서도 제목 서체와 포인트 컬러로 반영됩니다.
      </p>
      <div className="flex gap-2 flex-wrap mb-4">
        {THEME_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => {
              setTheme(p.theme);
              setDirty(true);
            }}
            className="text-xs px-2 py-1 border border-line flex items-center gap-2"
          >
            <span className="inline-block w-3 h-3 border border-line" style={{ background: p.theme.bg }} aria-hidden />
            <span className="inline-block w-3 h-3" style={{ background: p.theme.accent }} aria-hidden />
            {p.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["bg", "배경"],
            ["fg", "글자"],
            ["accent", "포인트"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-xs text-muted">
            {label}
            <span className="flex items-center gap-2 mt-1">
              <input type="color" value={theme[key]} onChange={(e) => setT(key, e.target.value.toUpperCase())} aria-label={`${label} 색상`} className="w-9 h-9 border border-line p-0" />
              <input
                type="text"
                value={theme[key]}
                onChange={(e) => setT(key, e.target.value.toUpperCase())}
                maxLength={7}
                className="w-full h-9 border-b border-line text-xs font-mono text-ink"
                aria-label={`${label} 색상 코드`}
              />
            </span>
          </label>
        ))}
      </div>
      <Field label="서체">
        <select className={input} value={theme.font} onChange={(e) => setT("font", e.target.value as Theme["font"])}>
          <option value="sans">Sans — DM Sans (기본)</option>
          <option value="serif">Serif — Noto Serif KR</option>
          <option value="display">Display — Montserrat</option>
        </select>
      </Field>
      <div
        className="border border-line p-4 text-sm mb-2"
        style={{ background: theme.bg, color: theme.fg, fontFamily: THEME_FONT_STACK[theme.font as keyof typeof THEME_FONT_STACK] ?? THEME_FONT_STACK.sans }}
        aria-label="테마 미리보기"
      >
        <span style={{ color: theme.accent }} className="tracking-[0.3em] text-[10px]">STILL</span>
        <p className="mt-2 text-base">{form.title || "전시명"}</p>
        <p className="text-xs mt-1" style={{ opacity: 0.6 }}>{form.venue || "장소"}</p>
      </div>

      <SectionTitle>오디오</SectionTitle>
      <Field label="기관 제공 플레이리스트">
        <select className={input} value={audio.provider} onChange={(e) => setA("provider", e.target.value as Audio["provider"])}>
          <option value="NONE">없음 — STILL Ambience(Pink Noise) 제공</option>
          <option value="SPOTIFY">Spotify</option>
          <option value="APPLE_MUSIC">Apple Music</option>
        </select>
      </Field>
      {audio.provider !== "NONE" && (
        <>
          <Field label="플레이리스트 링크 *" hint={audio.provider === "SPOTIFY" ? "https://open.spotify.com/playlist/…" : "https://music.apple.com/…/playlist/…"}>
            <input className={input} type="url" value={audio.playlistUrl} onChange={(e) => setA("playlistUrl", e.target.value)} />
          </Field>
          <Field label="플레이리스트 제목">
            <input className={input} value={audio.playlistTitle} onChange={(e) => setA("playlistTitle", e.target.value)} maxLength={120} />
          </Field>
          <Field label="설명">
            <input className={input} value={audio.playlistDescription} onChange={(e) => setA("playlistDescription", e.target.value)} maxLength={300} />
          </Field>
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={audio.ambienceEnabled} onChange={(e) => setA("ambienceEnabled", e.target.checked)} />
        STILL Ambience(Pink Noise) 옵션 허용
      </label>

      {error && (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <Button full onClick={() => void save()} loading={saving} disabled={!form.title.trim()}>
          {isNew ? "초안 저장" : dirty ? "변경 사항 저장" : "저장됨"}
        </Button>
        {!isNew && savedAt && !dirty && <p className="text-muted text-xs text-center">저장 {formatDateTime(savedAt)}</p>}
        {ex && ex.status !== "HIDDEN" && ex.status !== "DELETED" && (
          <Button variant="secondary" full onClick={() => void setStatus(ex.status === "ACTIVE" ? "DRAFT" : "ACTIVE")} loading={publishing}>
            {ex.status === "ACTIVE" ? "비공개로 전환" : "공개하기 (QR 활성화)"}
          </Button>
        )}
      </div>

      {ex && (
        <>
          <SectionTitle>QR · 공개 주소</SectionTitle>
          <div className="flex gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/exhibitions/${ex.slug}/qr`} alt="전시 QR" width={120} height={120} className="border border-line shrink-0" />
            <div className="text-xs min-w-0">
              <p className="break-all">
                <Link href={`/e/${ex.slug}`} className="underline underline-offset-4">
                  {publicUrl}
                </Link>
              </p>
              <p className="text-muted mt-2">
                {ex.status === "ACTIVE" ? "QR을 인쇄해 전시장에 비치하세요." : "공개하기 전까지 이 주소는 방문자에게 열리지 않습니다 (소유자 미리보기만 가능)."}
              </p>
              <p className="mt-2">
                <a href={`/api/exhibitions/${ex.slug}/qr?format=png`} download={`STILL-QR-${ex.slug}.png`} className="underline underline-offset-4">
                  QR PNG 다운로드
                </a>
                {" · "}
                <Link href={`/e/${ex.slug}`} className="underline underline-offset-4">
                  미리보기
                </Link>
              </p>
            </div>
          </div>

          <SectionTitle>삭제</SectionTitle>
          <Button variant="text" className="text-muted" onClick={() => setConfirmDelete(true)}>
            이 전시 삭제
          </Button>
          <p className="text-muted text-xs mt-1">방문자가 이미 저장한 기록은 유지되며, 전시는 더 이상 공개되지 않습니다.</p>
          <Dialog open={confirmDelete} title="전시를 삭제할까요?" confirmLabel="삭제" onConfirm={() => void remove()} onCancel={() => setConfirmDelete(false)} busy={deleting} destructive>
            QR이 더 이상 동작하지 않습니다. 이 작업은 되돌릴 수 없습니다.
          </Dialog>
        </>
      )}
    </div>
  );
}
