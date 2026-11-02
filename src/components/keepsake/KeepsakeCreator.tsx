"use client";

/**
 * Screen 06 — Digital Keepsake: template → preview → Save Web Card.
 *
 * Guests can preview (User Flow 7.4); saving requires login and resumes
 * automatically afterwards. The saved card is a frozen snapshot
 * (KeepsakeContent) so later journal edits do not change it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { KeepsakeCard } from "@/components/KeepsakeCard";
import { Button, Notice, cx } from "@/components/ui";
import type { Exhibition, Journal, Scrap } from "@/db/schema";
import { track } from "@/lib/client/analytics";
import { clearKeepsakeDraft, loadKeepsakeDraft, saveKeepsakeDraft } from "@/lib/client/drafts";
import { api, errorMessage } from "@/lib/client/fetcher";
import { consumePendingAction } from "@/lib/client/pending-action";
import { useRequireLogin } from "@/lib/client/use-require-login";
import { excerpt, formatDate, periodLabel } from "@/lib/format";
import {
  KEEPSAKE_LIMITS,
  KEEPSAKE_TEMPLATES,
  getTemplate,
  isTemplateId,
  themeOf,
  type KeepsakeContent,
  type KeepsakeTemplateId,
} from "@/lib/keepsake-templates";

type Detail = {
  archive: { id: string; scraps: Scrap[]; journal: Journal | null; keepsakes: { id: string; templateId: string }[] };
};

export function KeepsakeCreator({ exhibition }: { exhibition: Exhibition }) {
  const router = useRouter();
  const { status } = useSession();
  const { requireLogin, isLoggedIn } = useRequireLogin();

  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [existing, setExisting] = useState<{ id: string; templateId: string } | null>(null);
  const [templateId, setTemplateId] = useState<KeepsakeTemplateId>("sentence");
  const [sentence, setSentence] = useState<string>("");
  const [journalExcerpt, setJournalExcerpt] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const resumeRef = useRef(false);
  const initialisedRef = useRef(false);

  // Load personal records when logged in (scraps → sentence picker, journal → excerpt).
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      const d = loadKeepsakeDraft(exhibition.slug);
      if (d && isTemplateId(d.templateId)) {
        setTemplateId(d.templateId);
        setSentence(d.sentence ?? "");
        setJournalExcerpt(d.journalExcerpt ?? "");
      }
      setLoaded(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { archive } = await api<{ archive: { id: string } }>("/api/archives", {
          method: "POST",
          body: { exhibitionId: exhibition.id },
        });
        if (!alive) return;
        setArchiveId(archive.id);
        const detail = await api<Detail>(`/api/archives/${archive.id}`);
        if (!alive) return;
        setScraps(detail.archive.scraps);
        setJournal(detail.archive.journal);
        setExisting(detail.archive.keepsakes[0] ?? null);

        const draft = loadKeepsakeDraft(exhibition.slug);
        const pending = consumePendingAction("keepsake", exhibition.slug);
        if (draft && isTemplateId(draft.templateId)) {
          setTemplateId(draft.templateId);
          setSentence(draft.sentence ?? "");
          setJournalExcerpt(draft.journalExcerpt ?? "");
          if (pending) resumeRef.current = true;
        } else if (!initialisedRef.current) {
          setSentence(detail.archive.scraps[0]?.sentenceContentSnapshot ?? "");
          setJournalExcerpt(detail.archive.journal ? excerpt(detail.archive.journal.content, KEEPSAKE_LIMITS.journalExcerptMax) : "");
        }
        initialisedRef.current = true;
      } catch (err) {
        if (alive) setError(errorMessage(err, "기록을 불러오지 못했습니다."));
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, exhibition.id, exhibition.slug]);

  const template = getTemplate(templateId)!;

  const content = useMemo<KeepsakeContent>(
    () => ({
      theme: themeOf(exhibition),
      exhibitionTitle: exhibition.title,
      exhibitionSubtitle: exhibition.subtitle,
      venue: exhibition.venue,
      periodLabel: periodLabel(exhibition.startDate, exhibition.endDate),
      savedDateLabel: formatDate(new Date()),
      coverImageUrl: exhibition.coverImageUrl,
      sentence: template.uses.sentence ? sentence || null : null,
      journalExcerpt: template.uses.journalExcerpt ? journalExcerpt || null : null,
    }),
    [exhibition, template, sentence, journalExcerpt],
  );

  const save = useCallback(async () => {
    saveKeepsakeDraft(exhibition.slug, { templateId, sentence: sentence || null, journalExcerpt: journalExcerpt || null });
    if (!requireLogin({ type: "keepsake", exhibitionSlug: exhibition.slug, templateId })) return;
    if (!archiveId) return;
    setSaving(true);
    setError(null);
    try {
      const { keepsake } = await api<{ keepsake: { id: string } }>(`/api/archives/${archiveId}/keepsakes`, {
        method: "POST",
        body: { templateId, content },
      });
      clearKeepsakeDraft(exhibition.slug);
      track("keepsake_save", { archive_id: archiveId, template_id: templateId });
      router.push(`/keepsake/${keepsake.id}`);
    } catch (err) {
      setError(errorMessage(err, "웹카드를 저장하지 못했습니다."));
      setSaving(false);
    }
  }, [archiveId, content, exhibition.slug, journalExcerpt, requireLogin, router, sentence, templateId]);

  useEffect(() => {
    if (resumeRef.current && archiveId) {
      resumeRef.current = false;
      void save();
    }
  }, [archiveId, save]);

  // Fit the 360px card inside narrow viewports.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (Math.min(window.innerWidth, 390) - 82) / 360));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="px-6 pb-12">
      {/* Figma 06 - "Keep this moment." */}
      <header className="pt-6">
        <h1 className="screen-title">Keep this moment.</h1>
        <p className="label mt-1.5">Digital Keepsake / Web Card</p>
      </header>

      {/* Preview inside a 1px black frame (Figma) */}
      <div className="mt-6 border border-ink p-4 flex justify-center">
        <div className="overflow-hidden" style={{ width: 360 * scale, height: 480 * scale }}>
          <KeepsakeCard templateId={templateId} content={content} scale={scale} />
        </div>
      </div>

      <p className="text-[13px] font-medium mt-6 mb-3">Choose a layout</p>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Template">
        {KEEPSAKE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={t.id === templateId}
            onClick={() => setTemplateId(t.id)}
            className={cx(
              "h-14 border border-ink text-[12px] font-medium tracking-[0.02em]",
              t.id === templateId ? "bg-ink text-paper" : "bg-paper text-ink",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
      <p className="text-muted text-[12px] mt-2">{template.description}</p>

      {template.uses.sentence && (
        <>
          <p className="label mt-8 mb-2">Sentence</p>
          {isLoggedIn && scraps.length > 0 ? (
            <select
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              className="w-full h-12 border-b border-ink text-[14px]"
              aria-label="저장한 문장 선택"
            >
              <option value="">(문장 없음)</option>
              {scraps.map((s) => (
                <option key={s.id} value={s.sentenceContentSnapshot}>
                  {s.sentenceContentSnapshot}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-muted text-[13px] leading-5">
              {isLoggedIn ? "아직 저장한 문장이 없습니다. " : "로그인하면 저장한 문장을 카드에 넣을 수 있습니다. "}
              <Link href={`/e/${exhibition.slug}`} className="underline underline-offset-4 text-ink">
                가이드에서 문장 저장하기
              </Link>
            </p>
          )}
        </>
      )}

      {template.uses.journalExcerpt && (
        <>
          <p className="label mt-8 mb-2">Journal Excerpt</p>
          <textarea
            value={journalExcerpt}
            onChange={(e) => setJournalExcerpt(e.target.value.slice(0, KEEPSAKE_LIMITS.journalExcerptMax))}
            rows={4}
            placeholder={journal ? "" : "Journal을 작성하면 자동으로 채워집니다. 직접 입력할 수도 있어요."}
            className="w-full border border-ink px-4 py-3 text-[14px] leading-6 resize-none placeholder:text-muted placeholder:text-[13px]"
            aria-label="Journal 발췌"
          />
          <p className="label text-right mt-1">
            {journalExcerpt.length} / {KEEPSAKE_LIMITS.journalExcerptMax}
          </p>
        </>
      )}

      {error && (
        <div className="mt-4">
          <Notice tone="error" action={<Button variant="text" onClick={() => void save()}>Retry</Button>}>
            {error}
          </Notice>
        </div>
      )}

      {existing && (
        <div className="mt-6">
          <Notice
            action={
              <Link href={`/keepsake/${existing.id}`} className="text-[12px] underline underline-offset-4 shrink-0">
                기존 카드 보기
              </Link>
            }
          >
            이 전시의 웹카드는 1개만 보관됩니다. 저장하면 기존 카드를 대체합니다.
          </Notice>
        </div>
      )}

      <div className="mt-8">
        <Button full onClick={() => void save()} loading={saving} disabled={!loaded}>
          {isLoggedIn ? (existing ? "Replace Web Card" : "Save Web Card") : "Log in & Save Web Card"}
        </Button>
        <p className="text-[13px] mt-4 flex gap-2">
          <span aria-hidden>↓</span>
          <span>저장하면 PNG로 다운로드할 수 있어요 · 전시당 웹카드 1장</span>
        </p>
      </div>
    </div>
  );
}
