import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NewExhibition } from "../api";
import { formatPeriod, formatUpdated, libraryStatus, visitorUrl, type LibraryStatus } from "../format";
import { NewExhibitionButton } from "../NewExhibition";
import { useWorkspace } from "../store";
import { Badge, EmptyState, PageHead, StatCard, type Tone } from "../ui";

const FILTERS: ("all" | LibraryStatus)[] = ["all", "live", "scheduled", "ended", "draft"];
const TONE: Record<LibraryStatus, Tone> = { live: "green", scheduled: "amber", ended: "gray", draft: "gray" };
const pad = (n: number) => String(n).padStart(2, "0");
// Handoff 4.8: sort by recently updated, start date or title.
const SORTS = {
  updated: { label: "Recently updated", cmp: (a: { updatedAt: string }, b: { updatedAt: string }) => b.updatedAt.localeCompare(a.updatedAt) },
  start: { label: "Start date", cmp: (a: { startDate: string | null }, b: { startDate: string | null }) => (b.startDate ?? "").localeCompare(a.startDate ?? "") },
  title: { label: "Title", cmp: (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title) },
} as const;
type SortKey = keyof typeof SORTS;

export default function Exhibitions() {
  const { exhibitions, selectExhibition, createExhibition, duplicateExhibition, unpublishExhibition, deleteExhibition, can } = useWorkspace();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");

  const withStatus = useMemo(() => exhibitions.map((e) => ({ ...e, lib: libraryStatus(e) })), [exhibitions]);
  const count = (s: LibraryStatus) => withStatus.filter((e) => e.lib === s).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withStatus
      .filter((e) => filter === "all" || e.lib === filter)
      .filter((e) => !q || `${e.title} ${e.subtitle ?? ""} ${e.venueName}`.toLowerCase().includes(q))
      .sort(SORTS[sort].cmp);
  }, [withStatus, filter, query, sort]);

  const open = (id: string) => {
    selectExhibition(id);
    navigate("/overview");
  };
  const show = (msg: string) => { setFlash(msg); window.setTimeout(() => setFlash(null), 2400); };
  const duplicate = async (id: string) => {
    setMenuId(null);
    try { const copy = await duplicateExhibition(id); show(`${copy.title} created as a draft`); } catch { /* error banner */ }
  };
  const unpublish = async (id: string) => {
    setConfirmUnpublish(null);
    setMenuId(null);
    try { await unpublishExhibition(id); show("Guide taken offline. Visitors can no longer open it."); } catch { /* error banner */ }
  };
  const remove = async (id: string) => {
    setConfirmDelete(null);
    setMenuId(null);
    try { await deleteExhibition(id); show("Draft deleted"); } catch { /* error banner */ }
  };
  // The dialog shows a failure itself and stays open.
  const create = async (input: NewExhibition) => {
    await createExhibition(input);
    navigate("/materials");
  };

  return (
    <>
      <PageHead
        eyebrow="Museum content library"
        title="Published exhibitions"
        lede="Manage live visitor guides, review publication status and return to an exhibition workspace."
        actions={can("edit") && <NewExhibitionButton onCreate={create} />}
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
        <label className="sort sort--select">
          Sort:{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort exhibitions">
            {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}
          </select>
        </label>
      </div>
      {flash && <p className="flash" role="status">{flash}</p>}

      {rows.length === 0 ? (
        <EmptyState
          title={exhibitions.length ? "No exhibitions match" : "No exhibitions yet"}
          body={exhibitions.length ? "Try another filter or search." : "Create the first exhibition to start building a visitor guide."}
          action={!exhibitions.length && can("edit") && <NewExhibitionButton onCreate={create} />}
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
                  <td className="cell-action" onClick={(ev) => ev.stopPropagation()}>
                    <div className="row-menu">
                      <button type="button" className="more" aria-haspopup="menu" aria-expanded={menuId === e.id} aria-label={`More actions for ${e.title}`} onClick={() => { setMenuId(menuId === e.id ? null : e.id); setConfirmUnpublish(null); setConfirmDelete(null); }}>•••</button>
                      {menuId === e.id && (
                        <div className="row-menu__panel" role="menu">
                          <button type="button" role="menuitem" onClick={() => open(e.id)}>Open workspace</button>
                          {e.lib === "live" && <a role="menuitem" href={`https://${visitorUrl(e.code)}`} target="_blank" rel="noreferrer">View live guide</a>}
                          {can("edit") && <button type="button" role="menuitem" onClick={() => duplicate(e.id)}>Duplicate as new draft</button>}
                          {can("publish") && e.status === "PUBLISHED" && (
                            confirmUnpublish === e.id ? (
                              <span className="row-menu__confirm">
                                <span className="caption-sm">Visitors will lose access.</span>
                                <button type="button" className="link-btn link-btn--danger" onClick={() => unpublish(e.id)}>Unpublish</button>
                                <button type="button" className="link-btn" onClick={() => setConfirmUnpublish(null)}>Cancel</button>
                              </span>
                            ) : (
                              <button type="button" role="menuitem" className="danger" onClick={() => setConfirmUnpublish(e.id)}>Unpublish…</button>
                            )
                          )}
                          {can("edit") && e.status === "DRAFT" && (
                            confirmDelete === e.id ? (
                              <span className="row-menu__confirm">
                                <span className="caption-sm">This draft and its uploads will be removed.</span>
                                <button type="button" className="link-btn link-btn--danger" onClick={() => remove(e.id)}>Delete draft</button>
                                <button type="button" className="link-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                              </span>
                            ) : (
                              <button type="button" role="menuitem" className="danger" onClick={() => setConfirmDelete(e.id)}>Delete draft…</button>
                            )
                          )}
                        </div>
                      )}
                    </div>
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
