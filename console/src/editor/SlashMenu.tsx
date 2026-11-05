import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

// SPEC §9.4 편집기: "/" in an empty block opens the toolbar's nodes (STILL schema only).
const ITEMS: { label: string; run: (e: Editor) => void }[] = [
  { label: "Paragraph", run: (e) => e.chain().focus().setParagraph().run() },
  { label: "Heading 2", run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: "Heading 3", run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: "Quote", run: (e) => e.chain().focus().setBlockquote().run() },
  { label: "Bullets", run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbers", run: (e) => e.chain().focus().toggleOrderedList().run() },
  // The existing picker owns image choice; open it from its toolbar button.
  { label: "Image", run: (e) => e.view.dom.closest(".still-editor")?.querySelector<HTMLButtonElement>(".still-editor__picker button")?.click() },
];

export function SlashMenu({ editor }: { editor: Editor }) {
  const [at, setAt] = useState<{ pos: number; top: number; left: number } | null>(null);
  const [index, setIndex] = useState(0);

  // Open while the caret sits after a lone "/" in a block.
  useEffect(() => {
    const sync = () => {
      const { $from, empty } = editor.state.selection;
      if (!empty || $from.parent.textContent !== "/" || !$from.parent.isTextblock) return setAt(null);
      const box = editor.view.coordsAtPos($from.pos);
      const host = editor.view.dom.closest(".still-editor")!.getBoundingClientRect();
      setAt((old) => { if (!old) setIndex(0); return { pos: $from.pos, top: box.bottom - host.top + 4, left: box.left - host.left }; });
    };
    editor.on("update", sync);
    editor.on("selectionUpdate", sync);
    return () => { editor.off("update", sync); editor.off("selectionUpdate", sync); };
  }, [editor]);

  useEffect(() => {
    if (!at) return;
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : ITEMS.length - 1)) % ITEMS.length);
      else if (e.key === "Escape") setAt(null);
      else if (e.key === "Enter") { choose(index); }
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    dom.addEventListener("keydown", onKey, true);
    return () => dom.removeEventListener("keydown", onKey, true);
  });

  if (!at) return null;
  // Remove the "/" first, then apply the node.
  const choose = (i: number) => {
    editor.chain().focus().deleteRange({ from: at.pos - 1, to: at.pos }).run();
    setAt(null);
    ITEMS[i].run(editor);
  };
  return (
    <ul className="slash-menu" role="listbox" aria-label="Insert block" style={{ top: at.top, left: at.left }}>
      {ITEMS.map((item, i) => (
        <li key={item.label} role="option" aria-selected={i === index} onMouseDown={(e) => { e.preventDefault(); choose(i); }}>{item.label}</li>
      ))}
    </ul>
  );
}
