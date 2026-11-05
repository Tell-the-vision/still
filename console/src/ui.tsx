import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { NewExhibition } from "./api";
import { NewExhibitionButton } from "./NewExhibition";

export type Tone = "green" | "amber" | "gray" | "neutral";

export function Badge({ tone = "gray", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`badge badge--${tone} ${className}`}>{children}</span>;
}

export function StatusText({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`status-text status-text--${tone}`}>{children}</span>;
}

export function PageHead({
  eyebrow, title, lede, actions, actionsBottom, children,
}: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode; actionsBottom?: boolean; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head__main">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="h1">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children}
      </div>
      {/* actionsBottom: buttons line up with the status badge under the title (Figma 03–06). */}
      {actions && <div className={`page-head__actions${actionsBottom ? " page-head__actions--bottom" : ""}`}>{actions}</div>}
    </header>
  );
}

const STEPS = [
  { n: 1, label: "Upload", to: "/materials" },
  { n: 2, label: "Review", to: "/materials/review" },
  { n: 3, label: "Preview", to: "/materials/preview" },
  { n: 4, label: "Publish", to: "/materials/publish" },
];

export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav className="stepper" aria-label="Exhibition workflow">
      <p className="eyebrow">Exhibition workflow</p>
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.n}>
            {i > 0 && <span className="stepper__dash" aria-hidden>–</span>}
            <NavLink to={s.to} end className={`stepper__step${s.n === current ? " is-current" : ""}`} aria-current={s.n === current ? "step" : undefined}>
              {s.n} {s.label}
            </NavLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function StatCard({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export const Arrow = () => <span aria-hidden className="arrow">→</span>;

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="strong">{title}</p>
      {body && <p className="caption-sm">{body}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

/** Shown on exhibition-scoped screens when there is no exhibition yet. */
export function NoExhibition({ title, onCreate }: { title: string; onCreate: (input: NewExhibition) => Promise<unknown> }) {
  return (
    <>
      <PageHead eyebrow="Museum workspace" title={title} />
      <hr className="rule" />
      <EmptyState
        title="No exhibition yet"
        body="Create an exhibition to upload materials, review content and publish a visitor guide."
        action={<NewExhibitionButton onCreate={onCreate} />}
      />
    </>
  );
}
