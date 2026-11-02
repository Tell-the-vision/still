"use client";

/**
 * Screen 08 — Archive Detail: exhibition info, saved sentences, journal,
 * keepsakes, last visited, Delete Archive (cascade, DETAIL-05).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeepsakeCard } from "@/components/KeepsakeCard";
import { Artwork, Dialog, LinkButton, Notice, SectionTitle } from "@/components/ui";
import type { Exhibition, Journal, Scrap } from "@/db/schema";
import { track } from "@/lib/client/analytics";
import { api, errorMessage } from "@/lib/client/fetcher";
import { excerpt, formatDateTime } from "@/lib/format";
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

  const pad = (n: number) => String(n).padStart(2, "0");
  const place = [ex.venue, (ex.startDate ?? "").slice(0, 4)].filter(Boolean).join("  ·  ");
  const keepsake = archive.keepsakes[0];

  return (
    <div className="px-6 pb-12">
      {/* Figma 08 — exhibition information */}
      <header className="pt-6">
        <Link href={`/e/${ex.slug}`} className="block">
          <h1 className="font-display text-[30px] leading-[1.25] break-keep">{ex.title}</h1>
        </Link>
        {ex.subtitle && <p className="text-muted text-[13px] mt-1">{ex.subtitle}</p>}
        {place && <p className="label mt-2">{place}</p>}
      </header>

      <Link href={`/e/${ex.slug}`} className="block mt-6" aria-label="전시 가이드 열기">
        <Artwork src={ex.coverImageUrl} caption="Exhibition" />
      </Link>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {/* Your collection — summary (Figma 08) */}
      <section className="hairline mt-8 pt-5">
        <h2 className="label">Your Collection</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-6">
          <li>
            <a href="#scraps">{pad(archive.scraps.length)} saved guide sentences</a>
          </li>
          <li>
            <a href="#journal">{pad(archive.journal ? 1 : 0)} journal · editable</a>
          </li>
          <li>
            <a href="#keepsake">{pad(archive.keepsakes.length)} web card · PNG download</a>
          </li>
        </ul>
      </section>

      <section className="hairline mt-6 pt-5">
        <h2 className="label">Last Visited</h2>
        <p className="text-[13px] mt-2">{formatDateTime(archive.lastVisitedAt)}</p>
        <p className="text-muted text-[11px] mt-1">첫 방문 {formatDateTime(archive.firstVisitedAt)}</p>
      </section>

      {/* Saved sentences */}
      <div id="scraps" className="scroll-mt-4">
        <SectionTitle right={<span className="label">{pad(archive.scraps.length)}</span>}>Saved Sentences</SectionTitle>
      </div>
      {archive.scraps.length === 0 ? (
        <div className="pb-2">
          <p className="text-muted text-[13px]">저장한 문장이 없습니다. 전시 가이드에서 인상 깊은 문장을 저장해 보세요.</p>
          <LinkButton href={`/e/${ex.slug}`} variant="secondary" full className="mt-4">
            가이드 열기
          </LinkButton>
        </div>
      ) : (
        <ul>
          {archive.scraps.map((s) => (
            <li key={s.id} className="py-3 border-b border-line last:border-b-0">
              <p className="text-[15px] leading-7 break-keep">{s.sentenceContentSnapshot}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="label !normal-case !tracking-normal">{formatDateTime(s.createdAt)}</span>
                <button
                  type="button"
                  className="text-[12px] text-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
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
      <div id="journal" className="scroll-mt-4">
        <SectionTitle
          right={
            <Link href={`/e/${ex.slug}/journal`} className="text-[12px] underline underline-offset-4">
              {archive.journal ? "수정" : "작성"}
            </Link>
          }
        >
          Journal
        </SectionTitle>
      </div>
      {archive.journal ? (
        <Link href={`/e/${ex.slug}/journal`} className="block border border-ink px-4 py-4">
          <p className="text-[15px] leading-7 whitespace-pre-wrap break-keep">{excerpt(archive.journal.content, 280)}</p>
          <p className="label !normal-case !tracking-normal mt-3">마지막 수정 {formatDateTime(archive.journal.updatedAt)}</p>
        </Link>
      ) : (
        <div>
          <p className="text-muted text-[13px]">아직 Journal이 없습니다.</p>
          <LinkButton href={`/e/${ex.slug}/journal`} variant="secondary" full className="mt-4">
            Journal 작성
          </LinkButton>
        </div>
      )}

      {/* Digital Keepsake — one per exhibition (PO decision) */}
      <div id="keepsake" className="scroll-mt-4">
        <SectionTitle
          right={
            <Link href={`/e/${ex.slug}/keepsake`} className="text-[12px] underline underline-offset-4">
              {keepsake ? "다시 만들기" : "만들기"}
            </Link>
          }
        >
          Digital Keepsake
        </SectionTitle>
      </div>
      {!keepsake ? (
        <div>
          <p className="text-muted text-[13px]">저장한 웹카드가 없습니다. 전시당 웹카드 1장을 보관할 수 있습니다.</p>
          <LinkButton href={`/e/${ex.slug}/keepsake`} variant="secondary" full className="mt-4">
            Keepsake 만들기
          </LinkButton>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          <Link
            href={`/keepsake/${keepsake.id}`}
            aria-label="웹카드 열기"
            className="block border border-ink overflow-hidden shrink-0"
            style={{ width: 180, height: 240 }}
          >
            <KeepsakeCard templateId={keepsake.templateId} content={keepsake.content} scale={0.5} />
          </Link>
          <div className="text-[12px] leading-5 pt-1">
            <p className="text-muted">저장 {formatDateTime(keepsake.createdAt)}</p>
            <p className="mt-3">
              <Link href={`/keepsake/${keepsake.id}`} className="inline-flex gap-2">
                <span>열기 · PNG 다운로드</span>
                <span aria-hidden>→</span>
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Archive actions (Figma 08) */}
      <section className="hairline mt-10 pt-5">
        <p className="text-[13px] font-medium">Archive actions</p>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="inline-flex gap-2 text-[13px] text-muted hover:text-ink mt-3"
        >
          <span>Delete this Archive</span>
          <span aria-hidden>→</span>
        </button>
        <p className="text-muted text-[11px] mt-1">이 전시의 문장, Journal, 웹카드가 함께 삭제됩니다.</p>
      </section>

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
