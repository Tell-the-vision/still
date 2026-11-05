import { useEffect, useState } from "react";
import { api, type EditSuggestion } from "../api";
import { useWorkspace } from "../store";

// The open edit suggestions of one item (SPEC §9.4 편집 제안). Accepting applies the proposal text to its node;
// dismissing only records the decision. Either way the item is reloaded: its text and status can change.
export function Suggestions({ itemId, editable, flash }: { itemId: string; editable: boolean; flash: (msg: string) => void }) {
  const { exhibition, reloadExhibitionData, reportError } = useWorkspace();
  const [open, setOpen] = useState<EditSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const exhibitionId = exhibition?.id;

  useEffect(() => {
    if (!exhibitionId) return;
    api.listSuggestions(exhibitionId)
      .then((all) => setOpen(all.filter((s) => s.contentId === itemId && s.status === "OPEN")))
      .catch(reportError);
  }, [exhibitionId, itemId]); // eslint-disable-line react-hooks/exhaustive-deps -- reportError is not stable and must not refetch

  const decide = async (suggestion: EditSuggestion, status: "ACCEPTED" | "DISMISSED") => {
    setBusy(true);
    try {
      await api.decideSuggestion(suggestion, status);
      setOpen((list) => list.filter((x) => x.id !== suggestion.id));
      flash(status === "ACCEPTED" ? "Suggestion accepted" : "Suggestion dismissed");
      await reloadExhibitionData();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!open.length) return null;
  return (
    <section className="suggestions" aria-label="Suggestions">
      {open.map((s) => (
        <div key={s.id} className="suggestion">
          <p className="suggestion__kind">{s.kind.replaceAll("_", " ").toLowerCase()}</p>
          {s.rationale && <p>{s.rationale}</p>}
          {s.proposalText && <p className="suggestion__proposal">Proposed text: {s.proposalText}</p>}
          {editable && (
            <div className="notice__actions">
              <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => decide(s, "ACCEPTED")}>Accept</button>
              <button type="button" className="link-btn" disabled={busy} onClick={() => decide(s, "DISMISSED")}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
