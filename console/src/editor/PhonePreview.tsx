import { useEffect, useMemo, useRef, useState } from "react";
import type { StillDoc, VisitorDraft } from "../api";
import { toStillDoc } from "../api/stillDoc";

// SPEC §9.4 미리보기 모드: a 390-pixel-wide screen (390 × 844) drawn by the visitor renderer. The visitor app's
// /preview screen is that renderer (the guide's own components), below a status bar; the whole screen is scaled
// down to the phone drawn here.
const SCREEN_WIDTH = 390;
const STATUS_BAR = 47;

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };
type Images = VisitorDraft["images"];

// An image as the visitor's documents carry it: its URL and size in the node. One without a URL yet is left out,
// as the visitor renderer would leave it out.
function withImages(nodes: Node[], images: Images): Node[] {
  return nodes.flatMap((node) => {
    if (node.type !== "stillImage") return [node.content ? { ...node, content: withImages(node.content, images) } : node];
    const image = images[String(node.attrs?.imageId)];
    return image?.url ? [{ ...node, attrs: { ...node.attrs, url: image.url, altText: image.altText, width: image.width, height: image.height } }] : [];
  });
}

// Unsaved lines have no sentence id yet; each run of kept text gets one for this screen, so it shows its "+".
function withSentenceIds(block: Node): Node {
  let run = 0;
  let inRun = false;
  const content = block.content?.map((node) => {
    const scrap = node.marks?.find((m) => m.type === "scrap");
    if (!scrap) { inRun = false; return node; }
    if (!inRun) { run += 1; inRun = true; }
    return { ...node, marks: [{ type: "scrap", attrs: { sentenceId: scrap.attrs?.sentenceId ?? `preview-${String(block.attrs?.id)}-${run}` } }] };
  });
  return content ? { ...block, content } : block;
}

/**
 * The message the /preview screen draws: the page being edited, as it is being typed and on its own (each page has its
 * own address and QR), with the exhibition's details its playlist and keepsake need.
 */
function previewMessage(code: string, pageId: string, doc: unknown, draft: VisitorDraft) {
  const typed = (toStillDoc(doc).content as Node[]).map(withSentenceIds);
  return {
    type: "still-preview",
    code,
    page: pageId,
    exhibition: {
      ...draft.exhibition,
      // The keepsake card names the venue; a draft may have none yet.
      venue: draft.exhibition.venue ?? { name: "Venue to be set", city: "" },
    },
    document: { version: 1, type: "doc", content: withImages(typed, draft.images) },
  };
}

/**
 * The phone preview: the visitor renderer itself in an iPhone frame, showing the open page as visitors will see it
 * (the "+" beside each line to keep, the playlist, the keepsake). Edits reach it as they are typed, before autosave.
 */
export function PhonePreview({ code, pageId, doc, draft }: { code: string; pageId: string; doc: StillDoc | null; draft: VisitorDraft | null }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // How far the 390-pixel screen is scaled down, and its height at full size (it fills the phone's glass).
  const [size, setSize] = useState({ scale: 0.75, height: 844 });
  const message = useMemo(() => (doc && draft ? previewMessage(code, pageId, doc, draft) : null), [code, pageId, doc, draft]);

  // The screen says when it can take a draft, and again whenever it reloads.
  useEffect(() => {
    const ready = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.type === "still-preview-ready") setReady(true);
    };
    window.addEventListener("message", ready);
    return () => window.removeEventListener("message", ready);
  }, []);
  useEffect(() => {
    if (ready && message) frame.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [ready, message]);

  useEffect(() => {
    const el = screen.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const scale = entry.contentRect.width / SCREEN_WIDTH;
      if (scale > 0) setSize({ scale, height: entry.contentRect.height / scale });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="iphone">
      <div className="iphone__island" aria-hidden />
      <div className="iphone__screen" ref={screen}>
        <div className="iphone__device" style={{ width: SCREEN_WIDTH, height: size.height, transform: `scale(${size.scale})` }}>
          <p className="iphone__status" style={{ height: STATUS_BAR }} aria-hidden><span>9:41</span></p>
          <iframe ref={frame} className="iphone__app" src="/preview" title="Visitor preview" data-testid="visitor-preview" />
        </div>
      </div>
      <div className="iphone__home" aria-hidden />
    </div>
  );
}
