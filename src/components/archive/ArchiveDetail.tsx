"use client";

/**
 * Screen 08 — Archive Detail: exhibition info, saved sentences, journal,
 * keepsakes, last visited, Delete Archive (cascade, DETAIL-05).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeepsakeCard } from "@/components/KeepsakeCard";
import { Button, Dialog, EmptyState, LinkButton, Notice, SectionTitle } from "@/components/ui";
import type { Exhibition, Journal, Scrap } from "@/db/schema";
import { track } from "@/lib/client/analytics";
import { api, errorMessage } from "@/lib/client/fetcher";
import { excerpt, formatDateTime, periodLabel } from "@/lib/format";
import type { KeepsakeContent } from "@/lib/keepsake-templates";

export type ArchiveDetailDto = {
  id: string;
  exhibitionId: string;
  firstVisitedAt: string | Date;
  lastVisitedAt: string | Date;
  exhibition: Exhibition;
  scraps: Scrap[];
  journal: Journal | null;
  keepsakes: { id: string; templateId: string; content: KeepsakeContent; createdAt: string | Date }[];
};

export function ArchiveDetail({ archive: initial }: { archive: ArchiveDetailDto }) {
  const router = useRouter();
  const [archive, setArchive] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const ex = archive.exhibition;

  const deleteArchive = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api(`/api/archives/${archive.id}`, { method: "DELETE" });
      track("archive_delete", { archive_id: archive.id });
      router.replace("/archive");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Archive를 삭제하지 못했습니다. 기록은 그대로 유지됩니다."));
      setDeleting(false);
      setConfirm(false);
    }
  };

  const removeScrap = async (scrap: Scrap) => {
    setRemoving(scrap.id);
    try {
      await api(`/api/archives/${archive.id}/scraps/${scrap.id}`, { method: "DELETE" });
      setArchive((a) => ({ ...a, scraps: a.scraps.filter((s) => s.id !== scrap.id) }));
      track("scrap_remove", { exhibition_id: ex.id, sentence_id: scrap.guideSentenceId ?? null });
    } catch (err) {
      setError(errorMessage(err, "문장을 저장 해제하지 못했습니다."));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="px-5 pb-10">
      {/* Exhibition information */}
      <header className="pt-2 pb-5">
        <Link href={`/e/${ex.slug}`} className="block">
          {ex.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ex.coverImageUrl} alt="" className="w-full aspect-[4/3] object-cover bg-line" />
          )}
          <h1 className="font-display text-xl mt-4">{ex.title}</h1>
        </Link>
        {ex.subtitle && <p className="text-muted text-sm">{ex.subtitle}</p>}
        <p className="text-muted text-xs mt-2">
          {ex.venue}
          {periodLabel(ex.startDate, ex.endDate) ? ` · ${periodLabel(ex.startDate, ex.endDate)}` : ""}
        </p>
        <p className="text-muted text-xs mt-1">
          첫 방문 {formatDateTime(archive.firstVisitedAt)} · 마지막 방문 {formatDateTime(archive.lastVisitedAt)}
        </p>
      </header>

      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {/* Saved sentences */}
      <SectionTitle right={<span className="text-xs text-muted">{archive.scraps.length}</span>}>Saved Sentences</SectionTitle>
      {archive.scraps.length === 0 ? (
        <EmptyState
          title="저장한 문장이 없습니다"
          body="전시 가이드에서 인상 깊은 문장을 저장해 보세요."
          action={<LinkButton href={`/e/${ex.slug}`} variant="secondary">가이드 열기</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-line">
          {archive.scraps.map((s) => (
            <li key={s.id} className="py-3">
              <p className="text-[15px] leading-7">{s.sentenceContentSnapshot}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted">{formatDateTime(s.createdAt)}</span>
                <button
                  type="button"
                  className="text-xs text-muted underline underline-offset-4 disabled:opacity-50"
                  onClick={() => void removeScrap(s)}
                  disabled={removing === s.id}
                >
                  저장 해제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Journal */}
      <SectionTitle
        right={
          <Link href={`/e/${ex.slug}/journal`} className="text-xs underline underline-offset-4">
            {archive.journal ? "수정" : "작성"}
          </Link>
        }
      >
        Journal
      </SectionTitle>
      {archive.journal ? (
        <Link href={`/e/${ex.slug}/journal`} className="block">
          <p className="text-[15px] leading-7 whitespace-pre-wrap">{excerpt(archive.journal.content, 280)}</p>
          <p className="text-xs text-muted mt-2">마지막 수정 {formatDateTime(archive.journal.updatedAt)}</p>
        </Link>
      ) : (
        <EmptyState
          title="아직 Journal이 없습니다"
          action={<LinkButton href={`/e/${ex.slug}/journal`} variant="secondary">Journal 작성</LinkButton>}
        />
      )}

      {/* Digital Keepsake */}
      <SectionTitle
        right={
          <Link href={`/e/${ex.slug}/keepsake`} className="text-xs underline underline-offset-4">
            새 카드
          </Link>
        }
      >
        Digital Keepsake
      </SectionTitle>
      {archive.keepsakes.length === 0 ? (
        <EmptyState
          title="저장한 웹카드가 없습니다"
          action={<LinkButton href={`/e/${ex.slug}/keepsake`} variant="secondary">Keepsake 만들기</LinkButton>}
        />
      ) : (
        <ul className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
          {archive.keepsakes.map((k) => (
            <li key={k.id} className="shrink-0">
              <Link href={`/keepsake/${k.id}`} aria-label="웹카드 열기" className="block border border-line overflow-hidden" style={{ width: 180, height: 240 }}>
                <KeepsakeCard templateId={k.templateId} content={k.content} scale={0.5} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Archive management */}
      <SectionTitle>Archive Management</SectionTitle>
      <Button variant="secondary" full onClick={() => setConfirm(true)}>
        Delete Archive
      </Button>
      <p className="text-muted text-xs mt-2">이 전시의 문장, Journal, 웹카드가 함께 삭제됩니다.</p>

      <Dialog
        open={confirm}
        title="Archive를 삭제할까요?"
        confirmLabel="삭제"
        onConfirm={() => void deleteArchive()}
        onCancel={() => setConfirm(false)}
        busy={deleting}
        destructive
      >
        저장한 문장 {archive.scraps.length}개, Journal {archive.journal ? 1 : 0}개, 웹카드 {archive.keepsakes.length}개가 함께 삭제되며 복구할 수 없습니다.
      </Dialog>
    </div>
  );
}
