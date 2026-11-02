"use client";

/**
 * Screen 04 — Exhibition Guide.
 *  - Readable by guests (CORE-01).
 *  - Logged-in users get an archive registered on entry (ARCHIVE flow 8.2).
 *  - Every guide sentence has a Scrap action with the states of spec §4.4.
 *  - Guest scrap → login → resume on the same sentence (GUIDE-03).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AudioOptions, useAudioInfo } from "@/components/audio/AudioOptions";
import { LikeReportBar } from "@/components/exhibition/LikeReportBar";
import { Button, LinkButton, Notice, SectionTitle, cx } from "@/components/ui";
import type { Exhibition, GuideSentence, Scrap } from "@/db/schema";
import { track } from "@/lib/client/analytics";
import { api, errorMessage } from "@/lib/client/fetcher";
import { consumePendingAction } from "@/lib/client/pending-action";
import { useRequireLogin } from "@/lib/client/use-require-login";
import { periodLabel } from "@/lib/format";

type Section = { section: string | null; sentences: GuideSentence[] };
type ScrapState = "idle" | "saving" | "saved" | "failed";

export function ExhibitionGuide({
  exhibition,
  sections,
  preview = false,
  isOwner = false,
}: {
  exhibition: Exhibition;
  sections: Section[];
  /** Owner/admin viewing a non-public exhibition: no archive, no saves. */
  preview?: boolean;
  isOwner?: boolean;
}) {
  const { status } = useSession();
  const { requireLogin, isLoggedIn } = useRequireLogin();
  const { info: audioInfo } = useAudioInfo(exhibition.slug);

  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [scrapBySentence, setScrapBySentence] = useState<Record<string, Scrap>>({});
  const [states, setStates] = useState<Record<string, ScrapState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const resumedRef = useRef(false);

  useEffect(() => {
    track("exhibition_view", { exhibition_id: exhibition.id });
  }, [exhibition.id]);

  // Archive registration + saved-state sync (ARCHIVE-01 / GUIDE-04)
  useEffect(() => {
    if (status !== "authenticated" || preview) return;
    let alive = true;
    (async () => {
      try {
        const { archive } = await api<{ archive: { id: string } }>("/api/archives", {
          method: "POST",
          body: { exhibitionId: exhibition.id },
        });
        if (!alive) return;
        setArchiveId(archive.id);
        const { scraps } = await api<{ scraps: Scrap[] }>(`/api/archives/${archive.id}/scraps`);
        if (!alive) return;
        const map: Record<string, Scrap> = {};
        for (const s of scraps) if (s.guideSentenceId) map[s.guideSentenceId] = s;
        setScrapBySentence(map);
      } catch (err) {
        if (alive) setArchiveError(errorMessage(err, "Archive를 준비하지 못했습니다."));
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, exhibition.id, preview]);

  const setState = (id: string, s: ScrapState) => setStates((p) => ({ ...p, [id]: s }));

  const save = useCallback(
    async (sentence: GuideSentence, targetArchiveId: string) => {
      setState(sentence.id, "saving");
      setErrors((p) => ({ ...p, [sentence.id]: "" }));
      try {
        const { scrap } = await api<{ scrap: Scrap; created: boolean }>(`/api/archives/${targetArchiveId}/scraps`, {
          method: "POST",
          body: { guideSentenceId: sentence.id },
        });
        setScrapBySentence((p) => ({ ...p, [sentence.id]: scrap }));
        setState(sentence.id, "saved");
        track("scrap_save", { exhibition_id: exhibition.id, sentence_id: sentence.id });
      } catch (err) {
        setState(sentence.id, "failed");
        setErrors((p) => ({ ...p, [sentence.id]: errorMessage(err, "문장을 저장하지 못했습니다.") }));
      }
    },
    [exhibition.id],
  );

  const remove = useCallback(
    async (sentence: GuideSentence, targetArchiveId: string) => {
      const scrap = scrapBySentence[sentence.id];
      if (!scrap) return;
      setState(sentence.id, "saving");
      try {
        await api(`/api/archives/${targetArchiveId}/scraps/${scrap.id}`, { method: "DELETE" });
        setScrapBySentence((p) => {
          const n = { ...p };
          delete n[sentence.id];
          return n;
        });
        setState(sentence.id, "idle");
        track("scrap_remove", { exhibition_id: exhibition.id, sentence_id: sentence.id });
      } catch (err) {
        setState(sentence.id, "failed");
        setErrors((p) => ({ ...p, [sentence.id]: errorMessage(err, "저장 해제에 실패했습니다.") }));
      }
    },
    [exhibition.id, scrapBySentence],
  );

  // Resume after login: finish the scrap the guest asked for (GUIDE-03 step 4–5).
  useEffect(() => {
    if (!archiveId || resumedRef.current) return;
    const pending = consumePendingAction("scrap", exhibition.slug);
    if (!pending) return;
    resumedRef.current = true;
    const sentence = sections.flatMap((s) => s.sentences).find((s) => s.id === pending.guideSentenceId);
    if (!sentence) return;
    document.getElementById(`sentence-${sentence.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (!scrapBySentence[sentence.id]) void save(sentence, archiveId);
  }, [archiveId, exhibition.slug, sections, save, scrapBySentence]);

  const onScrap = (sentence: GuideSentence) => {
    if (preview) return;
    if (!requireLogin({ type: "scrap", exhibitionSlug: exhibition.slug, guideSentenceId: sentence.id })) return;
    if (!archiveId) return; // archive still registering — button is disabled meanwhile
    if (scrapBySentence[sentence.id]) void remove(sentence, archiveId);
    else void save(sentence, archiveId);
  };

  const period = periodLabel(exhibition.startDate, exhibition.endDate);

  return (
    <article className="px-5 pb-10">
      {/* Exhibition information (GUIDE-01) */}
      <header className="text-center pt-2 pb-6">
        <h1 className="font-display text-2xl leading-snug">{exhibition.title}</h1>
        {exhibition.subtitle && <p className="text-muted text-sm mt-1">{exhibition.subtitle}</p>}
        <p className="text-muted text-xs mt-4">
          {exhibition.venue}
          {period && ` · ${period}`}
        </p>
      </header>

      {preview && (
        <div className="mb-4">
          <Notice>
            {exhibition.status === "DRAFT" && "비공개 초안 미리보기 — 공개하기 전까지 방문자에게 보이지 않습니다."}
            {exhibition.status === "HIDDEN" && "관리자가 숨긴 전시입니다. 방문자에게 보이지 않습니다."}
            {exhibition.status === "DELETED" && "삭제된 전시입니다."}
            {exhibition.status === "ACTIVE" && "소유자 미리보기 — 아티스트 계정이 정지되어 방문자에게 보이지 않습니다."}
          </Notice>
        </div>
      )}

      {exhibition.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={exhibition.coverImageUrl}
          alt={`${exhibition.title} 대표 이미지`}
          className="w-full aspect-[4/5] object-cover bg-line"
          loading="eager"
        />
      )}

      {exhibition.description && (
        <p className="text-[15px] leading-7 mt-6 whitespace-pre-line">{exhibition.description}</p>
      )}

      <LikeReportBar
        exhibitionId={exhibition.id}
        exhibitionSlug={exhibition.slug}
        isOwner={isOwner}
        disabled={preview}
      />

      {archiveError && (
        <div className="mt-4">
          <Notice tone="error">{archiveError}</Notice>
        </div>
      )}

      {/* Commentary guide (GUIDE-02 / 03) */}
      <SectionTitle>Commentary Guide</SectionTitle>
      {!isLoggedIn && (
        <p className="text-muted text-xs mb-3">
          문장을 저장하려면 로그인이 필요합니다. 가이드는 로그인 없이 읽을 수 있습니다.
        </p>
      )}
      <div>
        {sections.map((sec, i) => (
          <section key={i} className="mb-6">
            {sec.section && <h3 className="font-display text-sm mb-2">{sec.section}</h3>}
            <ol className="space-y-1">
              {sec.sentences.map((s) => {
                const saved = Boolean(scrapBySentence[s.id]);
                const st = states[s.id] ?? (saved ? "saved" : "idle");
                const label = preview
                  ? "Save this sentence"
                  : !isLoggedIn
                    ? "Login to save"
                    : st === "saving"
                      ? "…"
                      : saved
                        ? "Saved"
                        : "Save this sentence";
                return (
                  <li key={s.id} id={`sentence-${s.id}`} className="py-2">
                    <p className={cx("text-[15px] leading-7", saved && "underline underline-offset-4")}>{s.content}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        type="button"
                        onClick={() => onScrap(s)}
                        disabled={preview || st === "saving" || (isLoggedIn && !archiveId)}
                        aria-pressed={saved}
                        className={cx(
                          "text-xs tracking-wide",
                          saved ? "text-ink font-medium" : "text-muted",
                          "disabled:opacity-50",
                        )}
                      >
                        {label}
                      </button>
                      {st === "failed" && errors[s.id] && (
                        <span className="text-xs text-muted">
                          {errors[s.id]}{" "}
                          <button type="button" className="underline" onClick={() => onScrap(s)}>
                            Retry
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      {/* Audio (spec §6; exposure policy TBD-05 → shown here and on Journal) */}
      <SectionTitle>Audio</SectionTitle>
      <AudioOptions info={audioInfo} compact />

      {/* Personal records */}
      {!preview && <SectionTitle>Your Record</SectionTitle>}
      {!preview && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <LinkButton href={`/e/${exhibition.slug}/journal`} variant="secondary" full>
              Journal
            </LinkButton>
            <LinkButton href={`/e/${exhibition.slug}/keepsake`} variant="secondary" full>
              Keepsake
            </LinkButton>
          </div>
          {isLoggedIn && archiveId && (
            <p className="text-center mt-4">
              <Link href={`/archive/${archiveId}`} className="text-xs text-muted underline underline-offset-4">
                이 전시의 Archive 보기
              </Link>
            </p>
          )}
          {!isLoggedIn && (
            <div className="mt-6">
              <Button
                variant="text"
                onClick={() => requireLogin({ type: "archive-register", exhibitionSlug: exhibition.slug })}
              >
                로그인하고 이 전시를 Archive에 담기
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
