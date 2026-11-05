import { useEffect, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type Editor } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import { api, type ExhibitionImage } from "../api";

// SPEC §9.4 STILL 스키마: an image block points at one of the exhibition's images. The console has no
// image URLs yet, so the editor shows a placeholder box, the display mode and the caption.
function StillImageView({ node }: { node: { attrs: { display?: string; caption?: string | null } } }) {
  const { display, caption } = node.attrs;
  return (
    <NodeViewWrapper as="figure" className="still-image" data-still-image="">
      <span className="asset__thumb" aria-hidden>IMG</span>
      <span className="still-image__text">
        <span className="caption-sm">{display}</span>
        {caption && <span>{caption}</span>}
      </span>
    </NodeViewWrapper>
  );
}

export const StillImage = Node.create({
  name: "stillImage",
  group: "block",
  atom: true,
  addAttributes: () => ({ imageId: { default: null }, display: { default: "INLINE" }, caption: { default: null } }),
  parseHTML: () => [{ tag: "figure[data-still-image]" }],
  renderHTML: ({ HTMLAttributes }) => ["figure", mergeAttributes(HTMLAttributes, { "data-still-image": "" })],
  addNodeView: () => ReactNodeViewRenderer(StillImageView),
});

// Lists the exhibition's images; picking one inserts a stillImage after the current block.
export function ImagePicker({ editor, exhibitionId }: { editor: Editor; exhibitionId: string }) {
  const [images, setImages] = useState<ExhibitionImage[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) api.listImages(exhibitionId).then(setImages, () => setImages([]));
  }, [open, exhibitionId]);

  const insert = (imageId: string) => {
    const { $to } = editor.state.selection;
    const at = $to.depth > 0 ? $to.after(1) : $to.pos;
    editor.chain().focus().insertContentAt(at, { type: "stillImage", attrs: { imageId, display: "INLINE", caption: null } }).run();
    setOpen(false);
  };

  return (
    <span className="still-editor__picker" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>Image</button>
      {open && (
        <ul className="still-editor__images" aria-label="Exhibition images">
          {images === null && <li className="caption-sm">Loading…</li>}
          {images?.length === 0 && <li className="caption-sm">No images in this exhibition.</li>}
          {images?.map((img, i) => (
            <li key={img.id}>
              <button type="button" className="btn" onClick={() => insert(img.id)}>{img.altText || `Image ${i + 1} (${img.id.slice(0, 8)})`}</button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
