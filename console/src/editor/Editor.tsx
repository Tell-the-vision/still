import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import UniqueID from "@tiptap/extension-unique-id";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import FileHandler from "@tiptap/extension-file-handler";
import { Placeholder } from "@tiptap/extensions";
import { ApiError } from "../api/errors";
import { useWorkspace } from "../store";
import { InlineSuggestions } from "./InlineSuggestions";
import { insertPictures, PICTURE_STORED, PICTURE_TYPES, StillImage } from "./StillImage";
import { Playlist } from "./Playlist";
import { SlashMenu } from "./SlashMenu";

// A full document editor: rich text, headings, alignment, colour, lists and to-dos, tables, dividers, code and
// pictures: a picture file chosen, pasted or dropped becomes an image of the exhibition (StillImage.tsx), while one
// pasted from a web page stays a resizable picture in the editor only. Wider than the STILL schema of SPEC §9.4 on
// purpose; the server's schema check has to follow before this saves there.
const Scrap = Mark.create({
  name: "scrap",
  addAttributes: () => ({ sentenceId: { default: null } }),
  parseHTML: () => [{ tag: "mark[data-scrap]" }],
  renderHTML: ({ HTMLAttributes }) => ["mark", mergeAttributes(HTMLAttributes, { "data-scrap": "" }), 0],
});

// A picture with a width (share of the column) the editor can change.
const Picture = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // A share of the column at most: a picture is never drawn larger than its own pixels.
      width: { default: "100%", parseHTML: (el) => el.style.maxWidth || el.style.width || "100%", renderHTML: (a) => ({ style: `max-width: ${a.width}` }) },
    };
  },
}).configure({ allowBase64: true });

// Alt+↑ / Alt+↓ move the block the caret is in, as in other document editors.
const MoveBlock = Extension.create({
  name: "moveBlock",
  addKeyboardShortcuts() {
    const move = (dir: -1 | 1) => () => {
      const { state, view } = this.editor;
      const { $from } = state.selection;
      if ($from.depth < 1) return false;
      const index = $from.index(0);
      const target = index + dir;
      if (target < 0 || target >= state.doc.childCount) return false;
      const node = state.doc.child(index);
      const other = state.doc.child(target);
      const start = $from.before(1);
      const offset = $from.pos - start;
      const tr = state.tr;
      if (dir === -1) {
        const from = start - other.nodeSize;
        tr.replaceWith(from, start + node.nodeSize, Fragment.fromArray([node, other]));
        tr.setSelection(TextSelection.near(tr.doc.resolve(from + offset)));
      } else {
        tr.replaceWith(start, start + node.nodeSize + other.nodeSize, Fragment.fromArray([other, node]));
        tr.setSelection(TextSelection.near(tr.doc.resolve(start + other.nodeSize + offset)));
      }
      view.dispatch(tr.scrollIntoView());
      return true;
    };
    return { "Alt-ArrowUp": move(-1), "Alt-ArrowDown": move(1) };
  },
});

// Typefaces: the brand's text and display faces first (Noto Sans KR carries Hangul in each), then serif and mono.
const FONTS: { label: string; value: string | null }[] = [
  { label: "Text", value: null },
  { label: "Display", value: 'Futura, "Futura PT", Montserrat, "Noto Sans KR Variable", sans-serif' },
  { label: "Serif", value: 'Georgia, "Noto Serif KR", "Nanum Myeongjo", serif' },
  { label: "Mono", value: 'ui-monospace, Menlo, "Noto Sans KR Variable", monospace' },
];
const SIZES = ["12px", "14px", "16px", "20px", "24px", "32px"];

const BLOCKS = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "taskList", "codeBlock", "horizontalRule", "table", "image", "stillImage", "playlist"];
const AUTOSAVE_MS = 1000;


// Fixed to the viewport and appended to <body>, so the bubble sits over the selection whatever the page layout. Kept
// outside the component: new objects on every render would make the BubbleMenu register its plugin again.
const BUBBLE_OPTIONS = { strategy: "fixed", placement: "top", offset: 8 } as const;
const toBody = () => document.body;

export function Editor({ itemId, exhibitionId, doc, editable, autoFocus = false, onChange }: { itemId: string; exhibitionId: string; doc: JSONContent; editable: boolean; autoFocus?: boolean | "end"; onChange?: (doc: JSONContent) => void }) {
  const [error, setError] = useState<string | null>(null);
  const { reloadExhibitionData, reportError, saveDoc } = useWorkspace();
  const timer = useRef<number>(0);
  const upload = useRef<HTMLInputElement>(null);
  // The latest edit that has not been sent yet; flushed on unmount instead of dropped.
  const pending = useRef<JSONContent | null>(null);

  const editor = useEditor({
    editable,
    content: doc,
    autofocus: autoFocus === "end" ? "end" : autoFocus ? "start" : false,
    editorProps: { attributes: { "aria-label": "Item text", role: "textbox", "aria-multiline": "true" } },
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Picture,
      FileHandler.configure({
        allowedMimeTypes: PICTURE_TYPES,
        onDrop: (ed, files, pos) => insertPictures(ed, exhibitionId, files, pos),
        onPaste: (ed, files) => insertPictures(ed, exhibitionId, files),
      }),
      Placeholder.configure({
        // The first heading is the artwork's name.
        placeholder: ({ editor: ed, node, pos }) => (node.type.name !== "heading" ? "Write, or press / for blocks" : pos === 0 && ed.state.doc.firstChild === node ? "Artwork title" : "Heading"),
      }),
      StillImage.configure({ itemId }),
      Playlist,
      Scrap,
      MoveBlock,
      UniqueID.configure({ types: BLOCKS, attributeName: "id" }),
    ],
    onUpdate: ({ editor: ed, transaction }) => {
      // Only a person's edits are saved. UniqueID gives blocks their ids on mount in a transaction kept out of the
      // history; saving that would mark every item edited (and send approved ones back to review) just by opening it.
      // An uploaded picture getting its image is kept out of the history too (undo removes the picture), but saved.
      if (transaction.getMeta("addToHistory") === false && !transaction.getMeta(PICTURE_STORED)) return;
      window.clearTimeout(timer.current);
      pending.current = ed.getJSON();
      onChange?.(pending.current);
      timer.current = window.setTimeout(async () => {
        try {
          pending.current = null;
          // The returned item replaces the old one: an approved item goes back to review when edited.
          await saveDoc(itemId, ed.getJSON());
          setError(null);
        } catch (e) {
          if (e instanceof ApiError && e.appCode === "REVISION_MISMATCH") {
            // SPEC §9.4: load the latest version; the reload remounts this editor with it.
            await reloadExhibitionData();
            reportError(new Error("This item changed elsewhere. The latest version is loaded."));
            return;
          }
          // A validation report from the server is not for people; a short sentence is.
          const message = e instanceof Error && !e.message.trimStart().startsWith("[") ? e.message : "Not saved. Try again in a moment.";
          setError(message);
        }
      }, AUTOSAVE_MS);
    },
  });
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    // The editor is gone, so the app-wide banner reports a failed last save instead of dropping it (#125).
    if (pending.current) {
      void saveDoc(itemId, pending.current).catch((e) =>
        reportError(new Error(`Your last edit was not saved: ${e instanceof Error ? e.message : String(e)}`)));
    }
  }, [itemId]);
  // What the toolbar shows for the selection (B, H1, Memorable, the typeface…). Tiptap v3 does not re-render on
  // transactions, so this re-renders the editor when, and only when, one of these values changes.
  const toolbar = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
        code: e.isActive("code"), link: e.isActive("link"),
        h1: e.isActive("heading", { level: 1 }), h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
        quote: e.isActive("blockquote"), highlight: e.isActive("highlight"), grey: e.isActive("textStyle", { color: "#666666" }),
        scrap: e.isActive("scrap"),
        font: FONTS.find((f) => f.value && e.isActive("textStyle", { fontFamily: f.value }))?.label ?? "Text",
        size: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "16px",
        align: (["center", "right"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        picture: e.state.selection instanceof NodeSelection && e.state.selection.node.type.name === "image",
        pictureWidth: e.getAttributes("image").width as string | undefined,
      };
    },
  });
  if (!editor || !toolbar) return null;

  const chain = () => editor.chain().focus();
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link address", previous ?? "https://");
    if (href === null) return;
    if (href === "") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href }).run();
  };
  const pictureSelected = toolbar.picture;

  // Formatting floats over the selection; a selected picture gets its own sizes.
  const text: { label: string; title: string; active: boolean; run: () => void }[][] = [
    [
      { label: "B", title: "Bold", active: toolbar.bold, run: () => chain().toggleBold().run() },
      { label: "I", title: "Italic", active: toolbar.italic, run: () => chain().toggleItalic().run() },
      { label: "U", title: "Underline", active: toolbar.underline, run: () => chain().toggleUnderline().run() },
      { label: "S", title: "Strikethrough", active: toolbar.strike, run: () => chain().toggleStrike().run() },
      { label: "</>", title: "Code", active: toolbar.code, run: () => chain().toggleCode().run() },
      { label: "Link", title: "Link", active: toolbar.link, run: setLink },
    ],
    [
      { label: "H1", title: "Heading 1", active: toolbar.h1, run: () => chain().toggleHeading({ level: 1 }).run() },
      { label: "H2", title: "Heading 2", active: toolbar.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: "H3", title: "Heading 3", active: toolbar.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
      { label: "Quote", title: "Quote", active: toolbar.quote, run: () => chain().toggleBlockquote().run() },
    ],
    [
      { label: "Mark", title: "Highlight", active: toolbar.highlight, run: () => chain().toggleHighlight({ color: "#fcf0dd" }).run() },
      { label: "Grey", title: "Grey text", active: toolbar.grey, run: () => (editor.isActive("textStyle", { color: "#666666" }) ? chain().unsetColor().run() : chain().setColor("#666666").run()) },
      // SPEC §4 Scrap: a memorable sentence visitors can keep with "+" in the guide.
      { label: "Memorable", title: "Memorable sentence: visitors can keep it with +", active: toolbar.scrap,
        // toggleMark only removes a mark whose attributes match, and every new sentence gets a new id, so it never
        // came off. A memorable sentence is kept whole by visitors, so it comes off whole: the mark's full range.
        run: () => (editor.isActive("scrap") ? chain().extendMarkRange("scrap").unsetMark("scrap") : chain().setMark("scrap", { sentenceId: crypto.randomUUID() })).run() },
    ],
  ];
  const sizes = ["25%", "50%", "75%", "100%"];

  return (
    <div className="still-editor">
      {editable && (
        <BubbleMenu editor={editor} appendTo={toBody} options={BUBBLE_OPTIONS} className="bubble-menu" role="toolbar" aria-label="Text formatting">
          {pictureSelected
            ? sizes.map((w) => (
              <button key={w} type="button" aria-pressed={toolbar.pictureWidth === w} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().updateAttributes("image", { width: w }).run()}>{w}</button>
            ))
            : [
              <span key="type" className="bubble-menu__group">
                <select
                  aria-label="Typeface"
                  className="bubble-menu__select"
                  value={toolbar.font}
                  onChange={(e) => {
                    const font = FONTS.find((f) => f.label === e.target.value);
                    if (font?.value) chain().setFontFamily(font.value).run();
                    else chain().unsetFontFamily().run();
                  }}
                >
                  {FONTS.map((f) => <option key={f.label}>{f.label}</option>)}
                </select>
                <select
                  aria-label="Text size"
                  className="bubble-menu__select"
                  value={toolbar.size}
                  onChange={(e) => (e.target.value === "16px" ? chain().unsetFontSize().run() : chain().setFontSize(e.target.value).run())}
                >
                  {SIZES.map((size) => <option key={size} value={size}>{parseInt(size, 10)}</option>)}
                </select>
                <select
                  aria-label="Alignment"
                  className="bubble-menu__select"
                  value={toolbar.align}
                  onChange={(e) => chain().setTextAlign(e.target.value).run()}
                >
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                  <option value="right">Right</option>
                </select>
              </span>,
              ...text.map((group, g) => (
              <span key={g} className="bubble-menu__group">
                {group.map((t) => (
                  <button key={t.title} type="button" title={t.title} aria-label={t.title} aria-pressed={t.active} onMouseDown={(e) => e.preventDefault()} onClick={t.run}>{t.label}</button>
                ))}
              </span>
            ))]}
        </BubbleMenu>
      )}
      {/* "Image" (in the "/" menu, or this button for the keyboard) opens the file chooser; the pictures go in at the caret. */}
      {editable && (
        <>
          <input ref={upload} className="still-editor__upload" type="file" accept={PICTURE_TYPES.join(",")} multiple hidden onChange={(e) => { insertPictures(editor, exhibitionId, [...(e.target.files ?? [])]); e.target.value = ""; }} />
          <button type="button" className="sr-only" onClick={() => upload.current?.click()}>Image</button>
        </>
      )}
      <EditorContent editor={editor} className="input input--lg still-editor__body" />
      <InlineSuggestions editor={editor} itemId={itemId} editable={editable} />
      {editable && <SlashMenu editor={editor} />}
      {(() => {
        // Saving is silent; only a save that failed is reported, at the foot of the rail.
        const status = (
          <span className={`caption-sm${error ? " error" : ""}`} role="status" aria-live="polite">
            {error}
          </span>
        );
        const slot = document.getElementById("editor-status");
        return slot ? createPortal(status, slot) : status;
      })()}
    </div>
  );
}
