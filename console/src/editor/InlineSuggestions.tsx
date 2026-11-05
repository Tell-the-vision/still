import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { api, type EditSuggestion } from "../api";
import { useWorkspace } from "../store";

// Open suggestions that point at a block sit in a right gutter, level with that block (SPEC §9.4 편집 제안 표시).
// Deciding reloads the item, which reopens the editor on the new document (the store's docVersion).
export function InlineSuggestions({ editor, itemId, editable }: { editor: Editor; itemId: string; editable: boolean }) {
  const { exhibition, reloadExhibitionData, reportError } = useWorkspace();
  const [open, setOpen] = useState<EditSuggestion[]>([]);
  const [tops, setTops] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const exhibitionId = exhibition?.id;

  useEffect(() => {
    if (!exhibitionId) return;
    api.listSuggestions(exhibitionId)
      .then((all) => setOpen(all.filter((s) => s.contentId === itemId && s.status === "OPEN" && s.node)))
      .catch(reportError);
  }, [exhibitionId, itemId]); // eslint-disable-line react-hooks/exhaustive-deps -- reportError is not stable and must not refetch

  // Each card's top is its block's top, measured again whenever the text changes.
  useEffect(() => {
    const measure = () => {
      const frame = editor.view.dom.closest(".still-editor")?.getBoundingClientRect().top ?? 0;
      const next: Record<string, number> = {};
      for (const s of open) {
        const block = editor.view.dom.querySelector(`[data-id="${s.node}"]`);
        if (block) next[s.id] = block.getBoundingClientRect().top - frame;
      }
      setTops(next);
    };
    measure();
    editor.on("update", measure);
    // The editor's own size changes with the window and when the gutter opens.
    const resized = new ResizeObserver(measure);
    resized.observe(editor.view.dom);
    return () => { editor.off("update", measure); resized.disconnect(); };
  }, [editor, open]);

  const decide = async (suggestion: EditSuggestion, status: "ACCEPTED" | "DISMISSED") => {
    setBusy(true);
    try {
      await api.decideSuggestion(suggestion, status, exhibitionId);
      setOpen((list) => list.filter((x) => x.id !== suggestion.id));
      await reloadExhibitionData();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open.map((s) => (
        <aside key={s.id} className="suggestion suggestion--inline" style={{ top: tops[s.id] }} aria-label="Suggestion">
          <p className="suggestion__kind">{s.kind.replaceAll("_", " ").toLowerCase()}</p>
          {s.rationale && <p>{s.rationale}</p>}
          {s.proposalText && <p className="suggestion__proposal">Proposed text: {s.proposalText}</p>}
          {editable && (
            <div className="notice__actions">
              <button type="button" className="btn btn--secondary" data-accept={s.id} disabled={busy} onClick={() => decide(s, "ACCEPTED")}>Accept</button>
              <button type="button" className="link-btn" disabled={busy} onClick={() => decide(s, "DISMISSED")}>Dismiss</button>
            </div>
          )}
        </aside>
      ))}
    </>
  );
}
