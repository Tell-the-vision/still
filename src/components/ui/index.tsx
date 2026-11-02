"use client";

/**
 * Minimal UI primitives.
 *
 * UI 담당자에게: 화면 전체의 룩앤필은 이 파일(+ globals.css)만 바꿔도 대부분
 * 바뀝니다. 각 컴포넌트는 기능/상태만 책임지고 장식은 최소화했습니다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ButtonHTMLAttributes, type ReactNode, useEffect } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- Wordmark
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={cx("font-display tracking-[0.35em] font-medium", className)} aria-label="STILL">
      STILL
    </span>
  );
}

// ------------------------------------------------------------------ Button
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "text";
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
  const base =
    "inline-flex items-center justify-center h-12 px-6 text-[15px] font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-ink text-paper",
    secondary: "border border-ink text-ink bg-paper",
    text: "text-ink underline underline-offset-4 h-auto px-0",
  }[variant];
  return (
    <button
      className={cx(base, styles, full && "w-full", className)}
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
  variant?: "primary" | "secondary" | "text";
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const base = "inline-flex items-center justify-center h-12 px-6 text-[15px] font-medium";
  const styles = {
    primary: "bg-ink text-paper",
    secondary: "border border-ink text-ink bg-paper",
    text: "text-ink underline underline-offset-4 h-auto px-0",
  }[variant];
  return (
    <Link href={href} className={cx(base, styles, full && "w-full", className)}>
      {children}
    </Link>
  );
}

// -------------------------------------------------------------- PageHeader
export function PageHeader({
  title,
  back,
  right,
}: {
  title?: ReactNode;
  /** `true` = history back, string = href */
  back?: boolean | string;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="flex items-center justify-between h-14 px-4">
      <div className="w-16">
        {back === true && (
          <button type="button" onClick={() => router.back()} aria-label="뒤로" className="text-xl">
            ←
          </button>
        )}
        {typeof back === "string" && (
          <Link href={back} aria-label="뒤로" className="text-xl">
            ←
          </Link>
        )}
      </div>
      <div className="font-display text-sm tracking-widest uppercase text-center flex-1">
        {title}
      </div>
      <div className="w-16 flex justify-end">{right}</div>
    </header>
  );
}

// --------------------------------------------------------------- BottomNav
export function BottomNav({ active }: { active: "home" | "archive" | "account" }) {
  const item = (key: typeof active, href: string, label: string) => (
    <Link
      href={href}
      className={cx(
        "flex-1 text-center py-4 text-xs tracking-widest uppercase",
        active === key ? "text-ink font-medium" : "text-muted",
      )}
      aria-current={active === key ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <nav className="hairline flex sticky bottom-0 bg-paper" aria-label="Main">
      {item("home", "/", "Home")}
      {item("archive", "/archive", "Archive")}
      {item("account", "/account", "Account")}
    </nav>
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
        "text-sm px-4 py-3 border",
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
    <div className="text-center py-16 px-6">
      <p className="font-display text-base">{title}</p>
      {body && <p className="text-muted text-sm mt-2">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="text-muted text-sm text-center py-10" role="status">
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
        className="w-full max-w-[358px] bg-paper p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" className="font-display text-base">
          {title}
        </h2>
        {children && <div className="text-sm text-muted mt-3">{children}</div>}
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
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mt-8 mb-3">
      <h2 className="font-display text-xs tracking-[0.2em] uppercase text-muted">{children}</h2>
      {right}
    </div>
  );
}
