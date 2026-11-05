import { useEffect, useState } from "react";
import { api, type EditSuggestion } from "../api";
import { useWorkspace } from "../store";
import { useDecisionFocus } from "./useDecisionFocus";

// The open exhibition-wide suggestions (SPEC §10.8). Accepting fixes all their target items in one step,
// so the exhibition data is reloaded after either decision.
export function WideSuggestions({ editable, flash }: { editable: boolean; flash: (msg: string) => void }) {
  const { exhibition, reloadExhibitionData, reportError } = useWorkspace();
  const [open, setOpen] = useState<EditSuggestion[]>([]);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const { heading, before } = useDecisionFocus(open);
  const exhibitionId = exhibition?.id;

  const load = async (id: string) => {
    const wide = (await api.listSuggestions(id)).filter((s) => s.contentId === null && s.status === "OPEN");
    setOpen(wide);
    if (wide.length) setShown(true);
  };
  useEffect(() => {
    if (exhibitionId) load(exhibitionId).catch(reportError);
  }, [exhibitionId]); // eslint-disable-line react-hooks/exhaustive-deps -- reportError is not stable and must not refetch

  const decide = async (suggestion: EditSuggestion, status: "ACCEPTED" | "DISMISSED") => {
    setBusy(true);
    try {
      await api.decideSuggestion(suggestion, status, exhibitionId);
      before(suggestion.id);
      flash(status === "ACCEPTED" ? "Suggestion accepted" : "Suggestion dismissed");
      await reloadExhibitionData();
      await load(exhibitionId!); // the exhibition revision changed, so the others need the new one
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!shown) return null;
  return (
    <section className="suggestions" aria-labelledby="wide-suggestions">
      <h2 id="wide-suggestions" ref={heading} tabIndex={-1} className="suggestion__kind">Exhibition-wide suggestions</h2>
      {open.map((s) => (
        <div key={s.id} className="suggestion">
          <p className="suggestion__kind">{s.kind.replaceAll("_", " ").toLowerCase()}</p>
          {s.rationale && <p>{s.rationale}</p>}
          {s.proposalText && <p className="suggestion__proposal">Proposed text: {s.proposalText}</p>}
          {editable && (
            <div className="notice__actions">
              <button type="button" className="btn btn--secondary" data-accept={s.id} disabled={busy} onClick={() => decide(s, "ACCEPTED")}>Accept</button>
              <button type="button" className="link-btn" disabled={busy} onClick={() => decide(s, "DISMISSED")}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
