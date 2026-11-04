import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type WorkspaceSummary } from "../api";
import { formatTime, formatUpdated, libraryStatus } from "../format";
import { useWorkspace } from "../store";
import { Arrow, EmptyState, PageHead, StatCard } from "../ui";

const pad = (n: number) => String(n).padStart(2, "0");

/** WORKSPACE: museum-wide home, across all exhibitions. */
export default function Workspace() {
  const { workspace, exhibitions, selectExhibition, createExhibition, reportError } = useWorkspace();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);

  useEffect(() => {
    api.getWorkspaceSummary().then(setSummary).catch(reportError);
    // Reload when the exhibition list changes (new, published, ...).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exhibitions]);

  const statuses = exhibitions.map((e) => libraryStatus(e));
  const count = (s: string) => statuses.filter((x) => x === s).length;
  const pending = summary?.attention.reduce((n, a) => n + a.pendingCount, 0) ?? 0;

  const open = (id: string, to: string) => {
    selectExhibition(id);
    navigate(to);
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
        lede="Everything happening across your exhibitions, in one place."
        actions={<button type="button" className="btn btn--primary btn--xwide" onClick={create}>+ New exhibition</button>}
      />
      <hr className="rule" />

      <p className="eyebrow">At a glance</p>
      <div className="stats stats--4">
        <StatCard value={pad(count("live"))} label="Live guides" />
        <StatCard value={pad(count("draft"))} label="Drafts in progress" />
        <StatCard value={pending} label="Items need review" />
        <StatCard value={summary?.memberCount ?? "–"} label="Team members" />
      </div>

      <div className="split split--workspace">
        <section className="section">
          <div className="section__head section__head--plain">
            <h2 className="h2">Needs your attention</h2>
            <span className="caption">{summary?.attention.length ?? 0} exhibitions</span>
          </div>
          {!summary ? (
            <p className="loading">Loading…</p>
          ) : summary.attention.length === 0 ? (
            <EmptyState title="All caught up" body="No exhibition has items waiting for review." />
          ) : (
            <ul className="next-list next-list--attention">
              {summary.attention.map((a) => (
                <li key={a.exhibitionId}>
                  <span className="strong">{a.title}</span>
                  <span className="caption-sm tone-amber">{a.pendingCount} items need review</span>
                  <button type="button" className="open-link link-btn" onClick={() => open(a.exhibitionId, "/materials/review")}>Review <Arrow /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section">
          <div className="section__head section__head--plain">
            <h2 className="h2">Recent activity</h2>
          </div>
          {!summary ? (
            <p className="loading">Loading…</p>
          ) : summary.activity.length === 0 ? (
            <EmptyState title="No activity yet" body="Uploads, approvals and publications will show up here." />
          ) : (
            <ul className="activity">
              {summary.activity.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <span className="caption-sm">{formatUpdated(a.at)}, {formatTime(a.at)}</span>
                  <span className="activity__text"><span className="strong">{a.actor}</span> {a.text.replace(/^./, (c) => c.toLowerCase())}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="section">
        <h2 className="h2 section__title">Shortcuts</h2>
        <ul className="next-list">
          <li>
            <span className="strong">All exhibitions</span>
            <span className="caption-sm">Live, scheduled, ended and draft guides.</span>
            <Link to="/exhibitions" className="open-link">Open <Arrow /></Link>
          </li>
          <li>
            <span className="strong">Invite your team</span>
            <span className="caption-sm">Add curators and editors to this workspace.</span>
            <Link to="/settings" className="open-link">Open <Arrow /></Link>
          </li>
          <li>
            <span className="strong">Your account</span>
            <span className="caption-sm">Profile, notifications and sign-out.</span>
            <Link to="/account" className="open-link">Open <Arrow /></Link>
          </li>
        </ul>
      </section>
    </>
  );
}
