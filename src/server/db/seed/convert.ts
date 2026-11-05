import type { StoredDocument } from "@still/shared/document";
import type { StillBlock, StillDocument } from "@still/shared/still-doc";

// Blocks v1 (heading | paragraph | image | sentence) to the STILL document format (SPEC §11.8).
// Also used by migration 0007's SQL; keep the two mappings the same.
export function blocksToStill(doc: StoredDocument, sentenceText: (sentenceId: string) => string): StillDocument {
  const content = doc.blocks.map((b, i): StillBlock => {
    const id = `n${i + 1}`;
    const text = (t: string) => (t === "" ? undefined : [{ type: "text" as const, text: t }]);
    if (b.type === "heading") return { type: "heading", attrs: { id, level: 2 }, content: text(b.text) };
    if (b.type === "paragraph") return { type: "paragraph", attrs: { id }, content: text(b.text) };
    if (b.type === "image") return { type: "stillImage", attrs: { id, imageId: b.imageId, display: "INLINE", caption: null } };
    const marks = [{ type: "scrap" as const, attrs: { sentenceId: b.sentenceId } }];
    return { type: "paragraph", attrs: { id }, content: [{ type: "text", text: sentenceText(b.sentenceId), marks }] };
  });
  return { version: 1, type: "doc", content };
}
