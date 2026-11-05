import type { ReactNode } from "react";
import type { NewExhibition } from "./api";
import { NewExhibitionButton } from "./NewExhibition";

export type Tone = "green" | "amber" | "gray" | "neutral";

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
