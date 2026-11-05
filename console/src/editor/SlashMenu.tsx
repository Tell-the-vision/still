import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

// "/" in an empty block opens every block the editor has.
const host = (e: Editor) => e.view.dom.closest(".still-editor");
const ITEMS: { label: string; run: (e: Editor) => void }[] = [
  { label: "Text", run: (e) => e.chain().focus().setParagraph().run() },
  { label: "Heading 1", run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { label: "Heading 2", run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: "Heading 3", run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: "Quote", run: (e) => e.chain().focus().setBlockquote().run() },
  { label: "Bullets", run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbers", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "To-do list", run: (e) => e.chain().focus().toggleTaskList().run() },
  { label: "Table", run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: "Divider", run: (e) => e.chain().focus().setHorizontalRule().run() },
  { label: "Playlist", run: (e) => e.chain().focus().insertContent({ type: "playlist" }).run() },
  { label: "Code block", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  // A picture from disk: it shows at once and is stored as an image of the exhibition (StillImage.tsx).
  { label: "Image", run: (e) => host(e)?.querySelector<HTMLInputElement>(".still-editor__upload")?.click() },
];

export function SlashMenu({ editor }: { editor: Editor }) {
  // `from`: where the typed "/…" starts; `query`: what follows the "/".
  const [at, setAt] = useState<{ from: number; pos: number; query: string; top: number; left: number } | null>(null);
  const [index, setIndex] = useState(0);
  const matches = at ? ITEMS.filter((item) => item.label.toLowerCase().includes(at.query.toLowerCase())) : [];

  // Open while the caret sits right after "/" or "/word" at the start of a block, filtering as one types.
  useEffect(() => {
    const sync = () => {
      const { $from, empty } = editor.state.selection;
      if (!empty || !$from.parent.isTextblock) return setAt(null);
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const typed = /^\/([\p{L}\d -]{0,24})$/u.exec(before);
      if (!typed || $from.parentOffset !== $from.parent.content.size) return setAt(null);
      const box = editor.view.coordsAtPos($from.pos);
      const host = editor.view.dom.closest(".still-editor")!.getBoundingClientRect();
      setAt((old) => {
        if (!old || old.query !== typed[1]) setIndex(0);
        return { from: $from.pos - before.length, pos: $from.pos, query: typed[1], top: box.bottom - host.top + 4, left: box.left - host.left };
      });
    };
    editor.on("update", sync);
    editor.on("selectionUpdate", sync);
    return () => { editor.off("update", sync); editor.off("selectionUpdate", sync); };
  }, [editor]);

  useEffect(() => {
    if (!at || matches.length === 0) return;
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
      else if (e.key === "Escape") setAt(null);
      else if (e.key === "Enter" || e.key === "Tab") { choose(index); }
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    dom.addEventListener("keydown", onKey, true);
    return () => dom.removeEventListener("keydown", onKey, true);
  });

  if (!at || matches.length === 0) return null;
  // Remove the typed "/…" first, then apply the block.
  const choose = (i: number) => {
    const item = matches[Math.min(i, matches.length - 1)];
    editor.chain().focus().deleteRange({ from: at.from, to: at.pos }).run();
    setAt(null);
    item.run(editor);
  };
  return (
    <ul className="slash-menu" role="listbox" aria-label="Insert block" style={{ top: at.top, left: at.left }}>
      {matches.map((item, i) => (
        <li key={item.label} role="option" aria-selected={i === index} onMouseDown={(e) => { e.preventDefault(); choose(i); }}>{item.label}</li>
      ))}
    </ul>
  );
}
