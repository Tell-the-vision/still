import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { api, type BlockSource } from "../api";
import { useWorkspace } from "../store";
import { wordDiff } from "./wordDiff";

// SPEC §9.4 원문 대조 표시: a label left of each top-level block, computed like SourceMarks (§10.8).
const squash = (text: string) => text.replace(/\s+/g, "");
const labelOf = ({ text, sourceText }: BlockSource) => (sourceText === null ? "No source" : squash(text) === squash(sourceText) ? "Source" : "Edited");

type Props = { editor: Editor; itemId: string; editable: boolean; version: number; children: ReactNode };

/** Wraps the editor body: gutter labels beside the blocks, and the source panel of the chosen block below. */
export function SourceGutter({ editor, itemId, editable, version, children }: Props) {
  const { revertBlock } = useWorkspace();
  const [sources, setSources] = useState<Map<string, BlockSource>>(new Map());
  const [tops, setTops] = useState<{ id: string; top: number }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);

  // Read again after every save (version) and after a revert (the editor is remounted).
  useEffect(() => {
    let current = true;
    api.listBlockSources(itemId).then((list) => current && setSources(new Map(list.map((b) => [b.nodeId, b]))), () => current && setSources(new Map()));
    return () => { current = false; };
  }, [itemId, version]);

  // Each top-level block's offset inside the wrapper, kept in step with the document.
  useEffect(() => {
    if (!wrap) return;
    const measure = () => {
      const base = wrap.getBoundingClientRect().top;
      const next: { id: string; top: number }[] = [];
      editor.state.doc.forEach((node, _offset, index) => {
        const el = editor.view.dom.children[index];
        if (el && node.attrs.id) next.push({ id: node.attrs.id, top: el.getBoundingClientRect().top - base });
      });
      setTops(next);
    };
    measure();
    editor.on("update", measure);
    window.addEventListener("resize", measure);
    return () => { editor.off("update", measure); window.removeEventListener("resize", measure); };
  }, [editor, wrap, sources]);

  const chosen = open ? sources.get(open) : undefined;
  return (
    <>
      <div className="source-gutter" ref={setWrap}>
        <div className="source-gutter__marks">
          {tops.map(({ id, top }) => {
            const block = sources.get(id);
            if (!block) return null;
            const label = labelOf(block);
            return (
              <button key={id} type="button" className="source-gutter__label" data-mark={label} style={{ top }}
                aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>{label}</button>
            );
          })}
        </div>
        {children}
      </div>
      {chosen && open && (
        <div className="source-panel" role="region" aria-label="Source text">
          {chosen.sourceText === null ? <p className="source-panel__text">No source for this block.</p> : (
            <p className="source-panel__text">
              {wordDiff(chosen.sourceText, chosen.text).map((p, i) =>
                p.kind === "del" ? <del key={i}>{p.text}</del> : p.kind === "ins" ? <ins key={i}>{p.text}</ins> : p.text)}
            </p>
          )}
          {labelOf(chosen) === "Edited" && editable && (
            <button type="button" className="link-btn link-btn--strong" onClick={() => revertBlock(itemId, open)}>Revert to source</button>
          )}
        </div>
      )}
    </>
  );
}
