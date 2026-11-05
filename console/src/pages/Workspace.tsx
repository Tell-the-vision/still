import { useNavigate } from "react-router-dom";
import { formatPeriod, formatUpdated, libraryStatus, type LibraryStatus } from "../format";
import { useWorkspace } from "../store";
import { Arrow, Badge, EmptyState, PageHead, StatCard, type Tone } from "../ui";

const pad = (n: number) => String(n).padStart(2, "0");
const TONE: Record<LibraryStatus, Tone> = { live: "green", scheduled: "amber", ended: "gray", draft: "gray" };

/** WORKSPACE home: the institution's exhibitions (A8, console.exhibition.list), issue #61. */
export default function Workspace() {
  const { workspace, exhibitions, selectExhibition, createExhibition } = useWorkspace();
  const navigate = useNavigate();

  const statuses = exhibitions.map((e) => libraryStatus(e));
  const count = (s: LibraryStatus) => statuses.filter((x) => x === s).length;
  const recent = [...exhibitions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const open = (id: string) => {
    selectExhibition(id);
    navigate("/overview");
  };
  const create = async () => {
    try {
      await createExhibition();
      navigate("/materials");
    } catch { /* error banner */ }
  };

  return (
    <>
      <PageHead
        eyebrow="Museum workspace"
        title={workspace?.institutionName ?? "Workspace"}
        lede="Your exhibitions, newest changes first."
        actions={<button type="button" className="btn btn--primary btn--xwide" onClick={create}>+ New exhibition</button>}
      />
      <hr className="rule" />

      <p className="eyebrow">At a glance</p>
      <div className="stats stats--4">
        <StatCard value={pad(count("live"))} label="Live guides" />
        <StatCard value={pad(count("scheduled"))} label="Scheduled" />
        <StatCard value={pad(count("draft"))} label="Drafts in progress" />
        <StatCard value={pad(count("ended"))} label="Ended" />
      </div>

      <section className="section">
        <div className="section__head section__head--plain">
          <h2 className="h2">Exhibitions</h2>
          <span className="caption">{exhibitions.length} exhibitions</span>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No exhibitions yet" body="Create the first exhibition to start building a visitor guide." />
        ) : (
          <ul className="next-list next-list--exhibitions">
            {recent.map((e) => (
              <li key={e.id}>
                <span className="strong">{e.title}</span>
                <span className="caption-sm">{formatPeriod(e.startDate, e.endDate)} · updated {formatUpdated(e.updatedAt)}</span>
                <Badge tone={TONE[libraryStatus(e)]} className="badge--status">{libraryStatus(e)}</Badge>
                <button type="button" className="open-link link-btn" onClick={() => open(e.id)}>Open <Arrow /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
