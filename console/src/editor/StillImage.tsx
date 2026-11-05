import { useEffect, useSyncExternalStore } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type Editor, type NodeViewProps } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import { api, type ExhibitionImage } from "../api";
import { rightsIssue } from "../rules";
import { useWorkspace } from "../store";

// SPEC §9.4 STILL 스키마: an image block points at one of the exhibition's images, shown from the preview's image URL
// (published or not). A picture placed here is stored as a file of its own (SPEC §9.4 업로드): its block shows the
// local file at once (`src`, never saved) and points at the image the server made of it as soon as there is one. A
// block without an image yet is left out of saves (stillDoc.ts). Without a picture, a placeholder box stands in.

/** The pictures the editor takes: those the server stores as files and every browser can draw. */
export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Meta of the transaction that gives an uploaded picture's block its image: it is saved, but it is not an undo step. */
export const PICTURE_STORED = "pictureStored";

// The uploads started in this tab, by the local URL their block shows meanwhile.
type Upload = { state: "uploading" } | { state: "stored"; image: ExhibitionImage } | { state: "failed"; message: string; retry: () => void };
const uploads = new Map<string, Upload>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const setUpload = (src: string, upload: Upload) => {
  uploads.set(src, upload);
  listeners.forEach((listener) => listener());
};

function startUpload(src: string, exhibitionId: string, file: File) {
  setUpload(src, { state: "uploading" });
  api.uploadPicture(exhibitionId, file).then(
    (image) => setUpload(src, { state: "stored", image }),
    (e) => setUpload(src, { state: "failed", message: e instanceof Error ? e.message : String(e), retry: () => startUpload(src, exhibitionId, file) }),
  );
}

/**
 * Places picture files at `pos` (or the caret), in their order, each shown at once, and stores each as an image of
 * the exhibition.
 */
export function insertPictures(editor: Editor, exhibitionId: string, files: File[], pos?: number) {
  files.forEach((file, i) => {
    const src = URL.createObjectURL(file);
    const content = { type: "stillImage", attrs: { imageId: null, display: "INLINE", caption: null, src } };
    // The caret follows each inserted picture, so the next one goes after it.
    if (pos === undefined || i > 0) editor.chain().focus().insertContent(content).run();
    else editor.chain().focus().insertContentAt(pos, content).run();
    startUpload(src, exhibitionId, file);
  });
}

function StillImageView({ node, editor, getPos, deleteNode, extension }: NodeViewProps) {
  const { imageId, display, caption, src } = node.attrs as { imageId: string | null; display: string; caption: string | null; src: string | null };
  const { imageUrls, items, updateAsset } = useWorkspace();
  const upload = useSyncExternalStore(subscribe, () => (src ? uploads.get(src) : undefined));

  // The server has the picture: the block points at its image from now on.
  useEffect(() => {
    if (imageId || upload?.state !== "stored") return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    const block = editor.state.doc.nodeAt(pos);
    if (block?.type.name !== "stillImage" || block.attrs.imageId) return;
    editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "imageId", upload.image.id).setMeta("addToHistory", false).setMeta(PICTURE_STORED, true));
  }, [imageId, upload, editor, getPos]);

  const picture = src ?? (imageId ? imageUrls[imageId] : undefined);
  // SPEC §10.7: only an image with confirmed rights is published; the rail marks the artwork until then.
  const itemId = (extension.options as { itemId?: string }).itemId;
  const asset = imageId && itemId ? items.find((i) => i.id === itemId)?.assets.find((a) => a.id === imageId) : undefined;
  const issue = asset && rightsIssue(asset);
  return (
    <NodeViewWrapper as="figure" className={`still-image${picture ? " still-image--picture" : ""}${upload?.state === "uploading" ? " still-image--uploading" : ""}`} data-still-image="">
      {picture ? <img src={picture} alt="" /> : <span className="asset__thumb" aria-hidden>IMG</span>}
      <span className="still-image__text">
        {!picture && <span className="caption-sm">{display}</span>}
        {caption && <span>{caption}</span>}
        {!imageId && upload?.state === "uploading" && <span className="caption-sm" role="status">Uploading…</span>}
        {!imageId && upload?.state === "failed" && (
          <span className="caption-sm error" role="alert">
            {upload.message}{" "}
            <button type="button" className="link-btn link-btn--inline" onClick={upload.retry}>Try again</button>
            {" · "}
            <button type="button" className="link-btn link-btn--inline" onClick={deleteNode}>Remove</button>
          </span>
        )}
        {editor.isEditable && asset && issue && (
          <span className="caption-sm tone-amber">
            {issue}
            {asset.rights === "UNCONFIRMED" && (
              <>
                {" · "}
                <button type="button" className="link-btn link-btn--inline" title="The museum has permission to publish this picture"
                  onClick={() => void updateAsset(itemId!, asset.id, { rights: "CONFIRMED" }).catch(() => {})}>Confirm rights</button>
              </>
            )}
          </span>
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const StillImage = Node.create<{ itemId?: string }>({
  name: "stillImage",
  group: "block",
  atom: true,
  // The item the editor shows, for the image's rights.
  addOptions: () => ({ itemId: undefined }),
  addAttributes: () => ({
    imageId: { default: null },
    display: { default: "INLINE" },
    caption: { default: null },
    // The local picture shown while it uploads (an object URL): kept out of the HTML and of saves.
    src: { default: null, rendered: false },
  }),
  parseHTML: () => [{ tag: "figure[data-still-image]" }],
  renderHTML: ({ HTMLAttributes }) => ["figure", mergeAttributes(HTMLAttributes, { "data-still-image": "" })],
  addNodeView: () => ReactNodeViewRenderer(StillImageView),
});
