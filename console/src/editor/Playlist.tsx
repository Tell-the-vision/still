import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

// A playlist on the page (Spotify or Apple Music). Visitors see a row that opens it on its service; the link must be
// the service's own (shared/src/still-doc.ts PLAYLIST_URL), and the title may stay empty.
export const PLAYLIST_URL = /^https:\/\/(open\.spotify\.com|music\.apple\.com)\/\S+$/;
const serviceOf = (url: string) => (url.startsWith("https://open.spotify.com/") ? "Spotify" : "Apple Music");

function PlaylistView({ node, updateAttributes, editor }: NodeViewProps) {
  const { url, title } = node.attrs as { url: string; title: string };
  const valid = PLAYLIST_URL.test(url);
  return (
    <NodeViewWrapper className="still-playlist" data-still-playlist="" contentEditable={false}>
      <span className="still-playlist__play" aria-hidden />
      <span className="still-playlist__fields">
        <input className="still-playlist__title" value={title} placeholder="Playlist title (optional)" aria-label="Playlist title"
          readOnly={!editor.isEditable} onChange={(e) => updateAttributes({ title: e.target.value })} />
        <input className="still-playlist__url" value={url} placeholder="Paste a Spotify or Apple Music link" aria-label="Playlist link"
          readOnly={!editor.isEditable} onChange={(e) => updateAttributes({ url: e.target.value.trim() })} />
        <span className={`caption-sm${url && !valid ? " error" : ""}`}>
          {!url ? "Visitors get a row that opens it." : valid ? `Playlist on ${serviceOf(url)}` : "Use a link from Spotify or Apple Music."}
        </span>
      </span>
    </NodeViewWrapper>
  );
}

export const Playlist = Node.create({
  name: "playlist",
  group: "block",
  atom: true,
  addAttributes: () => ({ url: { default: "" }, title: { default: "" } }),
  parseHTML: () => [{ tag: "div[data-still-playlist]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-still-playlist": "" })],
  // Typing in its fields stays in the fields: the editor does not treat those keys as its own.
  addNodeView: () => ReactNodeViewRenderer(PlaylistView, { stopEvent: ({ event }) => event.target instanceof HTMLInputElement }),
});
