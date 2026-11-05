import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatPeriod, formatUpdated, libraryStatus, type LibraryStatus } from "../format";
import { useWorkspace } from "../store";
import { Badge, EmptyState, PageHead, StatCard, type Tone } from "../ui";

const FILTERS: ("all" | LibraryStatus)[] = ["all", "live", "scheduled", "ended", "draft"];
const TONE: Record<LibraryStatus, Tone> = { live: "green", scheduled: "amber", ended: "gray", draft: "gray" };
const pad = (n: number) => String(n).padStart(2, "0");

export default function Exhibitions() {
  const { exhibitions, selectExhibition, createExhibition, can } = useWorkspace();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);

  const withStatus = useMemo(() => exhibitions.map((e) => ({ ...e, lib: libraryStatus(e) })), [exhibitions]);
  const count = (s: LibraryStatus) => withStatus.filter((e) => e.lib === s).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withStatus
      .filter((e) => filter === "all" || e.lib === filter)
      .filter((e) => !q || `${e.title} ${e.subtitle ?? ""} ${e.venueName}`.toLowerCase().includes(q))
      .sort((a, b) => (oldestFirst ? 1 : -1) * a.updatedAt.localeCompare(b.updatedAt));
  }, [withStatus, filter, query, oldestFirst]);

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
        eyebrow="Museum content library"
        title="Published exhibitions"
        lede="Manage live visitor guides, review publication status and return to an exhibition workspace."
        actions={can("edit") && <button type="button" className="btn btn--primary btn--xwide" onClick={create}>+ New exhibition</button>}
      />
      <hr className="rule" />

      <div className="library-top">
        <div className="stats stats--3">
          <StatCard value={pad(count("live"))} label="Live guides" />
          <StatCard value={pad(count("scheduled"))} label="Scheduled" />
          <StatCard value={pad(count("ended"))} label="Ended" />
        </div>
        <label className="field search">
          <span className="field__label">Search exhibitions</span>
          <input className="input input--tall" type="search" placeholder="Search by exhibition title or venue…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="filterbar filterbar--tabs">
        <div className="tabs" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={`tab${filter === f ? " is-active" : ""}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <button type="button" className="sort" onClick={() => setOldestFirst((s) => !s)}>
          Sort: {oldestFirst ? "Oldest updated" : "Recently updated"} <span aria-hidden>▾</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={exhibitions.length ? "No exhibitions match" : "No exhibitions yet"}
          body={exhibitions.length ? "Try another filter or search." : "Create the first exhibition to start building a visitor guide."}
          action={!exhibitions.length && can("edit") && <button type="button" className="btn btn--primary btn--xwide" onClick={create}>+ New exhibition</button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table table--library">
            <thead>
              <tr><th>Exhibition</th><th>Venue</th><th>Exhibition period</th><th>Status</th><th>Updated</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="row-link" onClick={() => open(e.id)}>
                  <td>
                    <p className="strong">{e.title}</p>
                    {e.subtitle && <p className="caption-sm">{e.subtitle}</p>}
                  </td>
                  <td className="strong-light">{e.venueName}</td>
                  <td className="muted">{formatPeriod(e.startDate, e.endDate)}</td>
                  <td><Badge tone={TONE[e.lib]} className="badge--status">{e.lib}</Badge></td>
                  <td className="muted">{formatUpdated(e.updatedAt)}</td>
                  <td className="cell-action">
                    <button type="button" className="more" aria-label={`More actions for ${e.title}`} onClick={(ev) => ev.stopPropagation()}>•••</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pager">
        <span className="caption-sm">Showing {rows.length ? `1–${rows.length}` : 0} of {rows.length} exhibitions</span>
        <span className="pager__nav caption-sm"><span aria-hidden>‹</span> 1 <span aria-hidden>›</span></span>
      </div>
    </>
  );
}
