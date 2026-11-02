"use client";

/**
 * UI primitives — STILL monochrome design system.
 * Source: Figma "STILL — Exhibition Experience MVP" (PRD/figma/specs.md).
 *
 * UI 담당자에게: 화면 전체의 룩앤필은 이 파일(+ globals.css)만 바꿔도 대부분
 * 바뀝니다. 각 컴포넌트는 기능/상태만 책임지고, 생김새는 Figma 기준입니다.
 *  - 상단: `STILL.` 워드마크 + 오른쪽 링크, 아래 1px 블랙 구분선 (PageHeader)
 *  - 하단: HOME · ARCHIVE · ACCOUNT 탭 (BottomNav)
 *  - 버튼: 52px 높이, 블랙 채움(primary) / 1px 블랙 테두리(secondary)
 *  - 구역: 1px 블랙 구분선 + 작은 대문자 라벨 (SectionTitle)
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ButtonHTMLAttributes, type ReactNode, useEffect } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- Wordmark
/** Figma: "STILL." — Futura 500, letter-spacing 25% of the font size. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={cx("font-display font-medium tracking-[0.25em] whitespace-nowrap", className)}
      aria-label="STILL"
    >
      STILL.
    </span>
  );
}

// ------------------------------------------------------------------ Button
type Variant = "primary" | "secondary" | "text";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 h-[52px] px-6 text-[13px] font-medium tracking-[0.02em] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed active:opacity-70";
const BUTTON_STYLES: Record<Variant, string> = {
  primary: "bg-ink text-paper",
  secondary: "border border-ink text-ink bg-paper",
  text: "text-ink underline underline-offset-4 !h-auto !px-0 font-normal",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  full?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  full,
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(BUTTON_BASE, BUTTON_STYLES[variant], full && "w-full", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? "Loading…" : children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  full,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(BUTTON_BASE, BUTTON_STYLES[variant], full && "w-full", className)}>
      {children}
    </Link>
  );
}

/** Text row link with a trailing arrow — Figma "Audio settings  →", "View all  →". */
export function ArrowLink({
  href,
  children,
  muted,
  className = "",
}: {
  href: string;
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx("inline-flex items-center gap-2 text-[14px]", muted ? "text-muted" : "text-ink", className)}
    >
      <span>{children}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}

// -------------------------------------------------------------- PageHeader
/**
 * Figma header: `STILL.` wordmark (links Home) + a small uppercase link on the
 * right, then a 1px black rule. When `back` is set, a "← BACK" row sits under
 * the rule with the screen label (`title`) on the right.
 */
export function PageHeader({
  title,
  back,
  backLabel = "Back",
  right,
}: {
  title?: ReactNode;
  /** `true` = history back, string = href */
  back?: boolean | string;
  backLabel?: string;
  right?: ReactNode;
}) {
  const router = useRouter();
  const backContent = (
    <>
      <span aria-hidden>←</span>
      <span>{backLabel}</span>
    </>
  );
  return (
    <header className="px-6">
      <div className="flex items-center justify-between h-[66px]">
        <Link href="/" aria-label="STILL 홈" className="text-[20px] leading-none">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4">
          {right ?? (
            <Link href="/archive" className="label hover:text-ink">
              My Archive
            </Link>
          )}
        </div>
      </div>
      <div className="hairline" />
      {(back || title) && (
        <div className="flex items-center justify-between pt-5">
          <div>
            {back === true && (
              <button type="button" onClick={() => router.back()} aria-label="뒤로" className="label inline-flex gap-2 hover:text-ink">
                {backContent}
              </button>
            )}
            {typeof back === "string" && (
              <Link href={back} aria-label="뒤로" className="label inline-flex gap-2 hover:text-ink">
                {backContent}
              </Link>
            )}
          </div>
          {title && <div className="label">{title}</div>}
        </div>
      )}
    </header>
  );
}

/** Large Futura screen title + optional label underneath (Figma 02–09). */
export function ScreenTitle({ children, sub, className = "" }: { children: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("pt-6", className)}>
      <h1 className="screen-title">{children}</h1>
      {sub && <p className="label mt-1.5">{sub}</p>}
    </div>
  );
}

// --------------------------------------------------------------- BottomNav
/** Figma tab bar: 1px rule + HOME · ARCHIVE · ACCOUNT (active = black). */
export function BottomNav({ active }: { active?: "home" | "archive" | "account" }) {
  const item = (key: "home" | "archive" | "account", href: string, label: string, align: string) => (
    <Link
      href={href}
      className={cx("label py-5", align, active === key ? "!text-ink" : "hover:text-ink")}
      aria-current={active === key ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <nav
      className="sticky bottom-0 bg-paper px-6 pb-[env(safe-area-inset-bottom)] z-10"
      aria-label="Main"
    >
      <div className="hairline grid grid-cols-3">
        {item("home", "/", "Home", "text-left pl-1.5")}
        {item("archive", "/archive", "Archive", "text-center")}
        {item("account", "/account", "Account", "text-right pr-1.5")}
      </div>
    </nav>
  );
}

// ------------------------------------------------------------------ Artwork
/**
 * Figma "Monochrome artwork": a #EDEDED mat with the artwork inset and a small
 * caption. Without an image it draws the black-field / white-form placeholder.
 */
export function Artwork({
  src,
  alt = "",
  caption,
  ratio = "260 / 156",
  className = "",
  eager,
}: {
  src?: string | null;
  alt?: string;
  caption?: ReactNode;
  /** CSS aspect-ratio of the inner artwork area. */
  ratio?: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <figure className={cx("relative bg-placeholder px-[12%] pt-6 pb-8", className)}>
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: ratio }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" loading={eager ? "eager" : "lazy"} />
        ) : (
          <div className="absolute inset-0 bg-ink flex items-center justify-center" aria-hidden>
            <div className="bg-paper h-[68%] w-[32%]" />
          </div>
        )}
      </div>
      {caption && <figcaption className="label !text-[9px] absolute left-3 bottom-2.5">{caption}</figcaption>}
    </figure>
  );
}

// ------------------------------------------------------------------ Notice
export function Notice({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "text-[13px] leading-5 px-4 py-3 border",
        tone === "error" ? "border-ink" : "border-line",
        tone === "success" && "text-muted",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{children}</span>
        {action}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- EmptyState
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="py-14">
      <p className="font-display text-[20px] leading-7">{title}</p>
      {body && <p className="text-muted text-[13px] leading-5 mt-2">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="label py-10" role="status">
      {label}
    </p>
  );
}

// ------------------------------------------------------------------ Dialog
export function Dialog({
  open,
  title,
  children,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
  busy,
  destructive,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  destructive?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-[358px] bg-paper border border-ink p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" className="font-display text-[22px] leading-7">
          {title}
        </h2>
        {children && <div className="text-[13px] leading-5 text-muted mt-3">{children}</div>}
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" full onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            full
            onClick={onConfirm}
            loading={busy}
            aria-describedby={destructive ? "dialog-title" : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- SectionTitle
/** Figma section: 1px black rule, then a small uppercase label. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="hairline flex items-baseline justify-between mt-10 pt-5 mb-4">
      <h2 className="label">{children}</h2>
      {right}
    </div>
  );
}
