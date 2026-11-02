"use client";

/**
 * Screen 05 — Journal (one per exhibition, CORE-04).
 *
 * States (spec §5.5): Empty → Editing → Saving → Saved / Error, plus
 * "Existing" when a journal already exists for this archive.
 *
 * Draft handling (JOURNAL-05): the text is mirrored to localStorage while
 * typing, so it survives the Google login round-trip, a reload, and short
 * offline periods. Guests can write; saving triggers login and the save is
 * resumed automatically afterwards.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAudio, type AudioMode } from "@/components/audio/AudioProvider";
import { AudioOptions, useAudioInfo } from "@/components/audio/AudioOptions";
import { Button, Notice, SectionTitle } from "@/components/ui";
import type { Exhibition, Journal } from "@/db/schema";
import { track } from "@/lib/client/analytics";
import { clearJournalDraft, loadJournalDraft, saveJournalDraft } from "@/lib/client/drafts";
import { api, errorMessage } from "@/lib/client/fetcher";
import { consumePendingAction } from "@/lib/client/pending-action";
import { useRequireLogin } from "@/lib/client/use-require-login";
import { formatDateTime } from "@/lib/format";

export const JOURNAL_MAX = 2000;

type SaveState = "idle" | "saving" | "saved" | "error";

export function JournalEditor({ exhibition }: { exhibition: Exhibition }) {
  const { status } = useSession();
  const { requireLogin, isLoggedIn } = useRequireLogin();
  const audio = useAudio();
  const { info: audioInfo } = useAudioInfo(exhibition.slug);

  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [content, setContent] = useState("");
  const [audioType, setAudioType] = useState<AudioMode>("NONE");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [restorable, setRestorable] = useState<string | null>(null);
  const resumeRef = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Guests: start from the local draft (if any) right away.
  useEffect(() => {
    if (status !== "unauthenticated") return;
    const d = loadJournalDraft(exhibition.slug);
    if (d) {
      setContent(d.content);
      setAudioType(d.audioType as AudioMode);
      setDirty(Boolean(d.content));
    }
    setLoaded(true);
  }, [status, exhibition.slug]);

  // 2) Logged in: register archive, load the existing journal, reconcile draft.
  useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;
    (async () => {
      try {
        const { archive } = await api<{ archive: { id: string } }>("/api/archives", {
          method: "POST",
          body: { exhibitionId: exhibition.id },
        });
        if (!alive) return;
        setArchiveId(archive.id);
        const { journal: j } = await api<{ journal: Journal | null }>(`/api/archives/${archive.id}/journal`);
        if (!alive) return;
        setJournal(j);
        const draft = loadJournalDraft(exhibition.slug);
        const pending = consumePendingAction("journal", exhibition.slug);

        if (pending && draft?.content.trim()) {
          // Resume the interrupted save (User Flow 7.3).
          setContent(draft.content);
          setAudioType(draft.audioType as AudioMode);
          resumeRef.current = true;
        } else if (j) {
          setContent(j.content);
          setAudioType(j.audioType as AudioMode);
          if (draft && draft.content !== j.content && draft.updatedAt > new Date(j.updatedAt).getTime()) {
            setRestorable(draft.content);
          } else if (draft) {
            clearJournalDraft(exhibition.slug);
          }
        } else if (draft?.content) {
          setContent(draft.content);
          setAudioType(draft.audioType as AudioMode);
          setDirty(true);
        }
      } catch (err) {
        if (alive) setError(errorMessage(err, "Journal을 불러오지 못했습니다."));
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, exhibition.id, exhibition.slug]);

  // Mirror edits into the local draft (debounced).
  const onChange = (next: string) => {
    if (next.length > JOURNAL_MAX) next = next.slice(0, JOURNAL_MAX);
    setContent(next);
    setDirty(true);
    setSaveState("idle");
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveJournalDraft(exhibition.slug, { content: next, audioType }), 300);
  };

  // Unsaved-changes guard (JOURNAL-05): reload / close, and in-app link clicks.
  // (The draft is also mirrored to localStorage, so nothing is lost either way.)
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (a && !window.confirm("저장하지 않은 Journal이 있습니다. 이 페이지를 나갈까요? (임시 저장본은 유지됩니다)")) {
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

  const save = useCallback(async () => {
    if (!content.trim()) {
      setError("Journal 내용을 입력해 주세요.");
      setSaveState("error");
      return;
    }
    // Persist the draft first so nothing is lost if login is needed.
    saveJournalDraft(exhibition.slug, { content, audioType });
    if (!requireLogin({ type: "journal", exhibitionSlug: exhibition.slug })) return;
    if (!archiveId) return;
    setSaveState("saving");
    setError(null);
    try {
      const { journal: j, created } = await api<{ journal: Journal; created: boolean }>(
        `/api/archives/${archiveId}/journal`,
        { method: "PUT", body: { content, audioType } },
      );
      setJournal(j);
      setDirty(false);
      setSaveState("saved");
      clearJournalDraft(exhibition.slug);
      setRestorable(null);
      track(created ? "journal_create" : "journal_update", { archive_id: archiveId });
    } catch (err) {
      setSaveState("error");
      setError(errorMessage(err, "저장에 실패했습니다. 입력한 내용은 유지됩니다."));
    }
  }, [content, audioType, archiveId, exhibition.slug, requireLogin]);

  // Fire the resumed save once the archive is ready.
  useEffect(() => {
    if (resumeRef.current && archiveId && content.trim()) {
      resumeRef.current = false;
      void save();
    }
  }, [archiveId, content, save]);

  const period = journal ? `마지막 수정 ${formatDateTime(journal.updatedAt)}` : "아직 Journal이 없습니다.";

  return (
    <div className="px-5 pb-10">
      <header className="pt-2 pb-4">
        <h1 className="font-display text-xl">{exhibition.title}</h1>
        <p className="text-muted text-xs mt-1">{loaded ? period : "Loading…"}</p>
      </header>

      {restorable !== null && (
        <div className="mb-4">
          <Notice
            action={
              <span className="flex gap-3 shrink-0">
                <Button
                  variant="text"
                  onClick={() => {
                    setContent(restorable);
                    setDirty(true);
                    setRestorable(null);
                  }}
                >
                  복구
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    clearJournalDraft(exhibition.slug);
                    setRestorable(null);
                  }}
                >
                  버리기
                </Button>
              </span>
            }
          >
            저장되지 않은 임시 작성 내용이 있습니다.
          </Notice>
        </div>
      )}

      <label htmlFor="journal" className="sr-only">
        Journal
      </label>
      <textarea
        id="journal"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={!loaded || saveState === "saving"}
        placeholder="전시를 보며 떠오른 생각과 감정을 적어 보세요."
        rows={12}
        className="w-full text-[15px] leading-7 resize-none border-b border-line py-2"
        maxLength={JOURNAL_MAX}
      />
      <div className="flex items-center justify-between text-xs text-muted mt-2">
        <span>
          {saveState === "saved" && "Saved"}
          {saveState === "saving" && "Saving…"}
          {saveState === "idle" && dirty && "수정 중 (임시 저장됨)"}
        </span>
        <span>
          {content.length} / {JOURNAL_MAX}
        </span>
      </div>

      {error && (
        <div className="mt-3">
          <Notice tone="error" action={<Button variant="text" onClick={() => void save()}>Retry</Button>}>
            {error}
          </Notice>
        </div>
      )}

      <SectionTitle>Audio</SectionTitle>
      <AudioOptions
        info={audioInfo}
        compact
        onModeChange={(m) => {
          setAudioType(m);
          setDirty(true);
          saveJournalDraft(exhibition.slug, { content, audioType: m });
        }}
      />
      <p className="text-muted text-xs mt-1">
        현재 선택: {audioType === "EXTERNAL_PLAYLIST" ? "External Playlist" : audioType === "AMBIENCE" ? "STILL Ambience" : "No Audio"}
        {audio.ambience === "on" ? " · 재생 중" : ""}
      </p>

      <div className="mt-8">
        <Button full onClick={() => void save()} loading={saveState === "saving"} disabled={!loaded}>
          {isLoggedIn ? "Save Journal" : "Login & Save Journal"}
        </Button>
        <p className="text-center mt-4">
          <Link href={`/e/${exhibition.slug}`} className="text-xs text-muted underline underline-offset-4">
            전시 가이드로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
