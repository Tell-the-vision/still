import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import UniqueID from "@tiptap/extension-unique-id";
import { api } from "../api";
import { ApiError } from "../api/errors";
import { useWorkspace } from "../store";
import { InlineSuggestions } from "./InlineSuggestions";
import { SourceGutter } from "./SourceGutter";
import { ImagePicker, StillImage } from "./StillImage";

// SPEC §9.4 편집기: the STILL schema only. Nothing outside it can be typed, pasted or toggled.
const Scrap = Mark.create({
  name: "scrap",
  addAttributes: () => ({ sentenceId: { default: null } }),
  parseHTML: () => [{ tag: "mark[data-scrap]" }],
  renderHTML: ({ HTMLAttributes }) => ["mark", mergeAttributes(HTMLAttributes, { "data-scrap": "" }), 0],
});

const BLOCKS = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "stillImage"];
const AUTOSAVE_MS = 1000;

type Saved = "idle" | "saving" | "saved";

export function Editor({ itemId, exhibitionId, doc, editable, onChange }: { itemId: string; exhibitionId: string; doc: JSONContent; editable: boolean; onChange?: (doc: JSONContent) => void }) {
  const [state, setState] = useState<Saved>("idle");
  const [error, setError] = useState<string | null>(null);
  const { reloadExhibitionData, reportError } = useWorkspace();
  const [saves, setSaves] = useState(0); // counts finished saves, so source marks refresh
  const timer = useRef<number>(0);
  // The latest edit that has not been sent yet; flushed on unmount instead of dropped.
  const pending = useRef<JSONContent | null>(null);

  const editor = useEditor({
    editable,
    content: doc,
    editorProps: { attributes: { "aria-label": "Item text", role: "textbox", "aria-multiline": "true" } },
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bold: false, italic: false, strike: false, code: false, link: false, underline: false,
        horizontalRule: false, codeBlock: false, dropcursor: false, gapcursor: false,
      }),
      StillImage,
      Scrap,
      UniqueID.configure({ types: BLOCKS, attributeName: "id" }),
    ],
    onUpdate: ({ editor: ed }) => {
      window.clearTimeout(timer.current);
      setState("saving");
      pending.current = ed.getJSON();
      onChange?.(pending.current);
      timer.current = window.setTimeout(async () => {
        try {
          pending.current = null;
          await api.saveContentDoc(itemId, ed.getJSON());
          setError(null);
          setState("saved");
          setSaves((n) => n + 1);
        } catch (e) {
          if (e instanceof ApiError && e.appCode === "REVISION_MISMATCH") {
            // SPEC §9.4: load the latest version; the new revision remounts this editor with it.
            await reloadExhibitionData();
            reportError(new Error("This item changed elsewhere. The latest version is loaded."));
            return;
          }
          setError(e instanceof Error ? e.message : "Could not save.");
          setState("idle");
        }
      }, AUTOSAVE_MS);
    },
  });
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (pending.current) void api.saveContentDoc(itemId, pending.current).catch(() => {});
  }, [itemId]);
  if (!editor) return null;

  const tools: { label: string; active: boolean; run: () => void }[] = [
    { label: "Paragraph", active: editor.isActive("paragraph"), run: () => editor.chain().focus().setParagraph().run() },
    { label: "H2", active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", active: editor.isActive("heading", { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Quote", active: editor.isActive("blockquote"), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Bullets", active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbers", active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    {
      label: "Scrap",
      active: editor.isActive("scrap"),
      run: () => editor.chain().focus().toggleMark("scrap", { sentenceId: crypto.randomUUID() }).run(),
    },
  ];

  return (
    <div className="still-editor">
      {editable && (
        <div className="still-editor__bar" role="toolbar" aria-label="Text formatting">
          {tools.map((t) => (
            <button key={t.label} type="button" className="btn" aria-pressed={t.active} onClick={t.run}>{t.label}</button>
          ))}
          <ImagePicker editor={editor} exhibitionId={exhibitionId} />
        </div>
      )}
      <SourceGutter editor={editor} itemId={itemId} editable={editable} version={saves}>
        <EditorContent editor={editor} className="input input--lg still-editor__body" />
      </SourceGutter>
      <InlineSuggestions editor={editor} itemId={itemId} editable={editable} />
      <p className="caption-sm" role="status" aria-live="polite">
        {error ?? (state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "")}
      </p>
    </div>
  );
}
