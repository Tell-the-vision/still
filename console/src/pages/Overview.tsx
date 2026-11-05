import { useNavigate } from "react-router-dom";
import type { EventStatus } from "../api";
import { formatTime } from "../format";
import { useWorkspace } from "../store";
import { Badge, EmptyState, NoExhibition, StatCard, StatusText, Stepper, type Tone } from "../ui";

const EVENT_LABEL: Record<EventStatus, [string, Tone]> = {
  COMPLETE: ["Complete", "green"],
  IN_PROGRESS: ["In progress", "amber"],
  PENDING: ["Pending", "gray"],
  FAILED: ["Failed", "amber"],
};

export default function Overview() {
  const { exhibition, counts, files, events, createExhibition } = useWorkspace();
  const navigate = useNavigate();

  if (!exhibition) return <NoExhibition title="Overview" onCreate={createExhibition} />;

  const published = exhibition.status === "PUBLISHED";
  const step = published ? 4 : !files.length ? 1 : counts.needReview > 0 || !counts.total ? 2 : 3;
  const next =
    step === 1 ? { label: "Upload materials", to: "/materials" }
    : step === 2 ? { label: "Continue review", to: "/materials/review" }
    : step === 3 ? { label: "Preview guide", to: "/materials/preview" }
    : { label: "View publication", to: "/materials/published" };

  return (
    <>
      <Stepper current={step} />
      <p className="eyebrow">Exhibition workspace</p>
      <div className="page-head">
        <div className="page-head__main">
          <h1 className="h1 h1--xl">{exhibition.title}</h1>
          <p className="lede lede--tight">
            {[exhibition.subtitle, exhibition.venueName.toUpperCase()].filter(Boolean).join(" · ")}
          </p>
          <div className="page-head__badge">
            {published ? <Badge tone="green">Published</Badge> : <Badge>{step === 1 ? "Draft" : "In review"}</Badge>}
          </div>
        </div>
        <div className="page-head__actions page-head__actions--bottom">
          <button type="button" className="btn btn--primary btn--wide" onClick={() => navigate(next.to)}>{next.label}</button>
        </div>
      </div>
      <hr className="rule" />

      <p className="eyebrow">Content overview</p>
      <div className="stats stats--4">
        <StatCard value={counts.total} label="Extracted items" />
        <StatCard value={counts.approved} label="Approved" />
        <StatCard value={counts.needReview} label="Need review" />
        <StatCard value={files.length} label="Source files" />
      </div>

      <section className="section">
        <h2 className="h2 section__title">Processing history</h2>
        {events.length === 0 ? (
          <EmptyState title="Nothing processed yet" body="Upload materials and start analysis to see progress here." />
        ) : (
          <div className="table-wrap">
            <table className="table table--history">
              <tbody>
                {events.map((h) => (
                  <tr key={h.id}>
                    <td className="muted">{formatTime(h.at)}</td>
                    <td className="strong">{h.title}</td>
                    <td className="muted">{h.detail}</td>
                    <td><StatusText tone={EVENT_LABEL[h.status][1]}>{EVENT_LABEL[h.status][0]}</StatusText></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="footer-row">
        <p className="muted">Once all required items are approved, preview the visitor guide and prepare publication.</p>
        <button type="button" className="btn btn--secondary btn--wide" onClick={() => navigate("/materials/preview")}>Open guide preview</button>
      </div>
    </>
  );
}
