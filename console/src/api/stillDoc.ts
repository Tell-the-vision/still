// The editor writes a richer Tiptap document than the server stores. The server keeps the STILL schema
// (shared/src/still-doc.ts, SPEC §9.4): plain text with the `scrap` mark, paragraphs, headings 2–3, quotes,
// lists, exhibition images and playlists. Before a save this reduces the editor's document to that schema:
// formatting marks and alignment are dropped, task lists become bullet lists, code and table rows become
// paragraphs, and blocks the guide cannot show (dividers, pictures without an exhibition image) are left out.

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };
type Text = { type: "text"; text: string; marks?: { type: "scrap"; attrs: { sentenceId: string | null } }[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLAYLIST_URL = /^https:\/\/(open\.spotify\.com|music\.apple\.com)\/\S+$/;
const IMAGE_DISPLAYS = ["HERO", "GALLERY", "INLINE", "PORTRAIT"];

const idOf = (node: Node) => (typeof node.attrs?.id === "string" && node.attrs.id ? node.attrs.id : crypto.randomUUID());

/** The text nodes inside a node, in order; line breaks become "\n", the scrap mark is the only mark kept. */
function inline(node: Node): Text[] {
  const out: Text[] = [];
  const walk = (n: Node) => {
    if (n.type === "text" && n.text) {
      const scrap = n.marks?.find((m) => m.type === "scrap");
      const sentenceId = typeof scrap?.attrs?.sentenceId === "string" && UUID.test(scrap.attrs.sentenceId) ? scrap.attrs.sentenceId : null;
      out.push(scrap ? { type: "text", text: n.text, marks: [{ type: "scrap", attrs: { sentenceId } }] } : { type: "text", text: n.text });
    } else if (n.type === "hardBreak") {
      out.push({ type: "text", text: "\n" });
    } else {
      n.content?.forEach(walk);
    }
  };
  walk(node);
  return out;
}

const paragraph = (id: string, content: Text[]) => (content.length ? { type: "paragraph", attrs: { id }, content } : { type: "paragraph", attrs: { id } });
const nested = (content: Text[]) => (content.length ? { type: "paragraph", content } : { type: "paragraph" });

/** One editor block as zero or more STILL blocks. */
function block(node: Node): unknown[] {
  const id = idOf(node);
  switch (node.type) {
    case "paragraph":
    case "codeBlock":
      return [paragraph(id, inline(node))];
    case "heading": {
      // Level 1 is a guide section title, added at publishing (SPEC §11.8); an item's title is level 2.
      const level = Math.min(3, Math.max(2, Number(node.attrs?.level) || 2));
      const content = inline(node);
      return [content.length ? { type: "heading", attrs: { id, level }, content } : { type: "heading", attrs: { id, level } }];
    }
    case "blockquote": {
      const parts = (node.content ?? []).map((child) => nested(inline(child)));
      return [{ type: "blockquote", attrs: { id }, content: parts.length ? parts : [nested([])] }];
    }
    case "bulletList":
    case "orderedList":
    case "taskList": {
      const items = (node.content ?? []).map((item) => {
        const parts = (item.content ?? []).filter((c) => c.type !== "bulletList" && c.type !== "orderedList" && c.type !== "taskList").map((c) => nested(inline(c)));
        return { type: "listItem", content: parts.length ? parts : [nested([])] };
      });
      return items.length ? [{ type: node.type === "orderedList" ? "orderedList" : "bulletList", attrs: { id }, content: items }] : [];
    }
    case "table":
      // Each row reads as one line, its cells joined.
      return (node.content ?? []).map((row) => {
        const cells = (row.content ?? []).map((cell) => inline(cell).map((t) => t.text).join("")).filter(Boolean);
        return paragraph(crypto.randomUUID(), cells.length ? [{ type: "text", text: cells.join(" · ") }] : []);
      });
    case "stillImage": {
      const imageId = node.attrs?.imageId;
      if (typeof imageId !== "string" || !UUID.test(imageId)) return [];
      const display = IMAGE_DISPLAYS.includes(String(node.attrs?.display)) ? node.attrs!.display : "INLINE";
      const caption = typeof node.attrs?.caption === "string" && node.attrs.caption ? node.attrs.caption : null;
      return [{ type: "stillImage", attrs: { id, imageId, display, caption } }];
    }
    case "playlist": {
      // Only a link to the service itself is kept (a half-pasted one waits in the editor).
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
      const title = typeof node.attrs?.title === "string" ? node.attrs.title.trim().slice(0, 200) : "";
      return PLAYLIST_URL.test(url) ? [{ type: "playlist", attrs: { id, url, title } }] : [];
    }
    default:
      return [];
  }
}

/** The editor's document in the server's STILL schema. */
export function toStillDoc(doc: unknown): { type: "doc"; content: unknown[] } {
  const content = ((doc as Node | null)?.content ?? []).flatMap(block);
  return { type: "doc", content };
}
