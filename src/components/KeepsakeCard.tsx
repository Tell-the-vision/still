"use client";

/**
 * Digital Keepsake web card — the single source of truth for how a card
 * looks. The same component renders the preview, the saved card and the
 * node that html-to-image rasterises, so PNG === web card (KEEPSAKE-05).
 *
 * Templates are fixed; colors and typeface come from the exhibition's theme
 * (PO: "템플릿은 정해져 있고 전시에 따라서 색상이나 타이포가 바뀌는 형식").
 * The theme is frozen into `content.theme` when the card is saved.
 *
 * Geometry is fixed (360 × 480 CSS px, see globals.css .keepsake-card);
 * the PNG is exported at 3× → 1080 × 1440.
 *
 * UI 담당자에게: 템플릿 디자인은 이 파일에서만 수정하면 됩니다. 색은
 * --ks-bg / --ks-fg / --ks-accent, 서체는 --ks-font 변수로 들어옵니다.
 */
import { forwardRef, type CSSProperties } from "react";
import { DEFAULT_THEME, type KeepsakeContent, type KeepsakeTemplateId, type KeepsakeTheme } from "@/lib/keepsake-templates";

export type KeepsakeCardProps = {
  templateId: KeepsakeTemplateId | string;
  content: KeepsakeContent;
  /** Scale the fixed card down to fit a narrow container (CSS transform). */
  scale?: number;
};

export const THEME_FONT_STACK: Record<KeepsakeTheme["font"], string> = {
  sans: '"DM Sans", "Helvetica Neue", Arial, sans-serif',
  serif: '"Noto Serif KR", "Apple SD Gothic Neo", Georgia, serif',
  display: '"Montserrat", "Futura", "Helvetica Neue", Arial, sans-serif',
};

/** CSS variables for a theme (shared with the guide screen). */
export function themeVars(theme: KeepsakeTheme | null | undefined, prefix = "ks"): CSSProperties {
  const t = theme ?? DEFAULT_THEME;
  return {
    [`--${prefix}-bg`]: t.bg,
    [`--${prefix}-fg`]: t.fg,
    [`--${prefix}-accent`]: t.accent,
    [`--${prefix}-font`]: THEME_FONT_STACK[t.font],
  } as CSSProperties;
}

function Wordmark() {
  return (
    <span className="ks-accent font-display tracking-[0.4em] text-[11px] font-medium" aria-label="STILL">
      STILL
    </span>
  );
}

function Meta({ c }: { c: KeepsakeContent }) {
  return (
    <div className="text-[11px] leading-5 ks-muted">
      <p className="font-medium text-[12px]" style={{ opacity: 1 }}>
        {c.exhibitionTitle}
      </p>
      {c.venue && <p>{c.venue}</p>}
      {c.periodLabel && <p>{c.periodLabel}</p>}
    </div>
  );
}

export const KeepsakeCard = forwardRef<HTMLDivElement, KeepsakeCardProps>(function KeepsakeCard(
  { templateId, content: c, scale = 1 },
  ref,
) {
  const style: CSSProperties = {
    ...themeVars(c.theme),
    ...(scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "top left" } : {}),
  };

  let body: React.ReactNode;
  switch (templateId) {
    case "reflection":
      body = (
        <div className="flex flex-col h-full p-8">
          <Wordmark />
          <p className="ks-accent text-[13px] mt-10 tracking-widest uppercase">Reflection</p>
          <p className="mt-4 text-[16px] leading-7 whitespace-pre-wrap break-words grow overflow-hidden">
            {c.journalExcerpt || "—"}
          </p>
          <div className="ks-rule mt-6 pt-4 border-t flex items-end justify-between gap-4">
            <Meta c={c} />
            <p className="text-[11px] ks-muted shrink-0">{c.savedDateLabel}</p>
          </div>
        </div>
      );
      break;

    case "cover":
      body = (
        <div className="flex flex-col h-full">
          <div className="h-[280px] overflow-hidden" style={{ background: "var(--ks-accent)", opacity: c.coverImageUrl ? 1 : 0.15 }}>
            {c.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverImageUrl} alt="" crossOrigin="anonymous" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col grow p-7">
            <div className="flex items-center justify-between">
              <Wordmark />
              <span className="text-[11px] ks-muted">{c.savedDateLabel}</span>
            </div>
            <p className="text-[20px] leading-7 mt-4">{c.exhibitionTitle}</p>
            {c.exhibitionSubtitle && <p className="text-[12px] ks-muted mt-1">{c.exhibitionSubtitle}</p>}
            <div className="mt-auto text-[11px] ks-muted leading-5">
              {c.sentence ? (
                <p className="italic mb-2 line-clamp-2" style={{ opacity: 1 }}>
                  “{c.sentence}”
                </p>
              ) : null}
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
            <p className="text-[22px] leading-9 text-center w-full break-keep">
              {c.sentence ? `“${c.sentence}”` : "저장한 문장이 여기에 표시됩니다."}
            </p>
          </div>
          <div className="ks-rule pt-4 border-t flex items-end justify-between gap-4">
            <Meta c={c} />
            <p className="text-[11px] ks-muted shrink-0">{c.savedDateLabel}</p>
          </div>
        </div>
      );
  }

  return (
    <div ref={ref} className="keepsake-card" style={style} data-template={templateId}>
      {body}
    </div>
  );
});
