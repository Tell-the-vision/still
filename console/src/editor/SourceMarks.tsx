import { useEffect, useState } from "react";
import { api, type BlockSource, type ContentItem } from "../api";
import { useWorkspace } from "../store";

// SPEC §9.4 원문 대조 표시, §10.8: whether a block still is its source is computed, never stored.
const squash = (text: string) => text.replace(/\s+/g, "");
const labelOf = ({ text, sourceText }: BlockSource) => (sourceText === null ? "No source" : squash(text) === squash(sourceText) ? "Source" : "Edited");

/** One label per text block of the item, and "Revert to source" for the edited ones. */
export function SourceMarks({ item }: { item: ContentItem }) {
  const { revertBlock } = useWorkspace();
  const editable = item.reviewStatus !== "REJECTED"; // a rejected item is final (SPEC §10.8)
  const [blocks, setBlocks] = useState<BlockSource[]>([]);
  const [busy, setBusy] = useState(false);
  // item.text changes whenever a block is saved, so the marks are read again then.
  useEffect(() => {
    let current = true;
    api.listBlockSources(item.id).then((list) => current && setBlocks(list), () => current && setBlocks([]));
    return () => { current = false; };
  }, [item.id, item.text]);

  if (blocks.length === 0) return null;
  const revert = async (nodeId: string) => {
    setBusy(true);
    try { await revertBlock(item.id, nodeId); } finally { setBusy(false); }
  };
  return (
    <section className="source-marks" aria-label="Source comparison">
      <p className="field__label">Source comparison</p>
      <ul className="source-marks__list" aria-live="polite">
        {blocks.map((block) => {
          const label = labelOf(block);
          return (
            <li key={block.nodeId} className="source-marks__row">
              <span className="source-marks__label" data-mark={label}>{label}</span>
              <span className="source-marks__text" title={block.text}>{block.text || "(empty)"}</span>
              {label === "Edited" && editable && (
                <button type="button" className="link-btn" disabled={busy} onClick={() => revert(block.nodeId)}>Revert to source</button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
