import { useEffect, useState, type FormEvent } from "react";
import { api, type Venue } from "../api";
import { useWorkspace } from "../store";
import { EmptyState, PageHead } from "../ui";

// Venues (/venues): the places where exhibitions are held, shared by every institution (SPEC §9.5 console.venue.*).
// Workspace settings, notifications and the team are not part of the console (issues #60, #61); accounts come from
// STILL Admin.
export default function Venues() {
  const { reportError } = useWorkspace();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    api.listVenues().then(setVenues).catch(reportError).finally(() => setLoading(false));
    // Load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = (msg: string) => { setFlash(msg); window.setTimeout(() => setFlash(null), 2200); };

  const add = async (v: Pick<Venue, "name" | "city">) => {
    try {
      const venue = await api.createVenue(v);
      setVenues((list) => [...list, venue]);
      show(`${venue.name} added`);
      return true;
    } catch (e) {
      reportError(e);
      return false;
    }
  };

  return (
    <>
      <PageHead title="Venues" lede="The galleries where your exhibitions take place. Venues are shared across STILL." />
      {flash && <p className="flash" role="status">{flash}</p>}
      <hr className="rule" />
      {loading ? <p className="loading">Loading…</p> : <VenueList venues={venues} onAdd={add} />}
    </>
  );
}

function VenueList({ venues, onAdd }: { venues: Venue[]; onAdd: (v: Pick<Venue, "name" | "city">) => Promise<boolean> }) {
  const [draft, setDraft] = useState({ name: "", city: "" });
  const valid = !!draft.name.trim() && !!draft.city.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (await onAdd({ name: draft.name.trim(), city: draft.city.trim() })) setDraft({ name: "", city: "" });
  };

  return (
    <section className="section">
      {venues.length === 0 ? (
        <EmptyState title="No venues yet" body="Add the galleries where your exhibitions take place." />
      ) : (
        <div className="table-wrap">
          <table className="table table--venues">
            <thead><tr><th>Venue</th><th>City</th><th>Code</th></tr></thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}><td className="strong">{v.name}</td><td className="muted">{v.city}</td><td className="muted mono">{v.code}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="inline-form" onSubmit={submit}>
        <label className="field"><span className="field__label">Venue name</span><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. MMCA Gwacheon" /></label>
        <label className="field"><span className="field__label">City</span><input className="input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="e.g. Gwacheon" /></label>
        <button type="submit" className="btn btn--secondary" aria-disabled={!valid}>+ Add venue</button>
      </form>
    </section>
  );
}
