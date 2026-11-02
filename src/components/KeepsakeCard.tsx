"use client";

/**
 * Digital Keepsake web card — the single source of truth for how a card
 * looks. The same component renders the preview, the saved card and the
 * node that html-to-image rasterises, so PNG === web card (KEEPSAKE-05).
 *
 * Geometry is fixed (360 × 480 CSS px, see globals.css .keepsake-card);
 * the PNG is exported at 3× → 1080 × 1440.
 *
 * UI 담당자에게: 템플릿 디자인은 이 파일에서만 수정하면 됩니다.
 * 색은 흑백만 사용하고, 폰트는 globals.css 토큰을 따릅니다.
 */
import { forwardRef } from "react";
import { type KeepsakeContent, type KeepsakeTemplateId } from "@/lib/keepsake-templates";

export type KeepsakeCardProps = {
  templateId: KeepsakeTemplateId | string;
  content: KeepsakeContent;
  /** Scale the fixed card down to fit a narrow container (CSS transform). */
  scale?: number;
};

function Wordmark() {
  return (
    <span className="font-display tracking-[0.4em] text-[11px] font-medium" aria-label="STILL">
      STILL
    </span>
  );
}

function Meta({ c }: { c: KeepsakeContent }) {
  return (
    <div className="text-[11px] leading-5 text-muted">
      <p className="text-ink font-medium text-[12px]">{c.exhibitionTitle}</p>
      {c.venue && <p>{c.venue}</p>}
      {c.periodLabel && <p>{c.periodLabel}</p>}
    </div>
  );
}

export const KeepsakeCard = forwardRef<HTMLDivElement, KeepsakeCardProps>(function KeepsakeCard(
  { templateId, content: c, scale = 1 },
  ref,
) {
  const style = scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "top left" } : undefined;

  let body: React.ReactNode;
  switch (templateId) {
    case "reflection":
      body = (
        <div className="flex flex-col h-full p-8">
          <Wordmark />
          <p className="font-display text-[13px] mt-10 text-muted tracking-widest uppercase">Reflection</p>
          <p className="mt-4 text-[16px] leading-7 whitespace-pre-wrap break-words grow overflow-hidden">
            {c.journalExcerpt || "—"}
          </p>
          <div className="mt-6 pt-4 border-t border-line flex items-end justify-between gap-4">
            <Meta c={c} />
            <p className="text-[11px] text-muted shrink-0">{c.savedDateLabel}</p>
          </div>
        </div>
      );
      break;

    case "cover":
      body = (
        <div className="flex flex-col h-full">
          <div className="h-[280px] bg-line overflow-hidden">
            {c.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.coverImageUrl}
                alt=""
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
                style={{ filter: "grayscale(1)" }}
              />
            ) : null}
          </div>
          <div className="flex flex-col grow p-7">
            <div className="flex items-center justify-between">
              <Wordmark />
              <span className="text-[11px] text-muted">{c.savedDateLabel}</span>
            </div>
            <p className="font-display text-[20px] leading-7 mt-4">{c.exhibitionTitle}</p>
            {c.exhibitionSubtitle && <p className="text-[12px] text-muted mt-1">{c.exhibitionSubtitle}</p>}
            <div className="mt-auto text-[11px] text-muted leading-5">
              {c.sentence ? <p className="text-ink italic mb-2 line-clamp-2">“{c.sentence}”</p> : null}
              {c.venue && <p>{c.venue}</p>}
              {c.periodLabel && <p>{c.periodLabel}</p>}
            </div>
          </div>
        </div>
      );
      break;

    case "sentence":
    default:
      body = (
        <div className="flex flex-col h-full p-8">
          <Wordmark />
          <div className="grow flex items-center">
            <p className="font-display text-[22px] leading-9 text-center w-full break-keep">
              {c.sentence ? `“${c.sentence}”` : "저장한 문장이 여기에 표시됩니다."}
            </p>
          </div>
          <div className="pt-4 border-t border-line flex items-end justify-between gap-4">
            <Meta c={c} />
            <p className="text-[11px] text-muted shrink-0">{c.savedDateLabel}</p>
          </div>
        </div>
      );
  }

  return (
    <div ref={ref} className="keepsake-card font-body" style={style} data-template={templateId}>
      {body}
    </div>
  );
});
