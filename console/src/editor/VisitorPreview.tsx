import type { ReactNode } from "react";
import type { StillDoc, StillNode } from "../api";

export const VISITOR_PREVIEW_NOTICE =
  "The editor view may differ from what visitors see. The preview on the right is the visitor renderer.";

// SPEC §9.4 미리보기 모드, §11.8: the visitor's rules in a phone frame. Monochrome; images are never cropped
// (a gray box stands in until a URL exists); scrap runs carry a thin "+" keep affordance.

const Inline = ({ node }: { node: StillNode }) =>
  node.marks?.some((m) => m.type === "scrap") ? (
    <span className="vp__scrap">
      {node.text}
      <span className="vp__keep" aria-hidden="true">+</span>
    </span>
  ) : (
    <>{node.text}</>
  );

const Inlines = ({ nodes }: { nodes?: StillNode[] }) => (
  <>{(nodes ?? []).map((n, i) => <Inline key={i} node={n} />)}</>
);

function Block({ node }: { node: StillNode }): ReactNode {
  const children = node.content ?? [];
  switch (node.type) {
    case "heading":
      return node.attrs?.level === 3 ? <h3><Inlines nodes={children} /></h3> : <h2><Inlines nodes={children} /></h2>;
    case "paragraph":
      return <p><Inlines nodes={children} /></p>;
    case "blockquote":
      return <blockquote>{children.map((c, i) => <Block key={i} node={c} />)}</blockquote>;
    case "bulletList":
    case "orderedList": {
      const items = children.map((li, i) => <li key={i}>{(li.content ?? []).map((c, j) => <Inlines key={j} nodes={c.content} />)}</li>);
      return node.type === "bulletList" ? <ul>{items}</ul> : <ol>{items}</ol>;
    }
    case "stillImage":
      return (
        <figure className={`vp__fig vp__fig--${(node.attrs?.display ?? "INLINE").toLowerCase()}`}>
          <div className="vp__image" role="img" aria-label={node.attrs?.caption ?? "Image"} />
          {node.attrs?.caption && <figcaption>{node.attrs.caption}</figcaption>}
        </figure>
      );
    default:
      return null;
  }
}

const isGallery = (node?: StillNode) => node?.type === "stillImage" && node.attrs?.display === "GALLERY";

// Consecutive GALLERY images share one horizontally scrolling row, as in the visitor app.
function Blocks({ nodes }: { nodes: StillNode[] }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!isGallery(nodes[i])) { out.push(<Block key={i} node={nodes[i]} />); continue; }
    const start = i;
    while (isGallery(nodes[i + 1])) i++;
    out.push(<div key={start} className="vp__gallery">{nodes.slice(start, i + 1).map((n, j) => <Block key={j} node={n} />)}</div>);
  }
  return <>{out}</>;
}

export function VisitorPreview({ doc }: { doc: StillDoc }) {
  return (
    <div className="vp" data-testid="visitor-preview" role="region" aria-label="Visitor preview" tabIndex={0}>
      <Blocks nodes={doc.content} />
    </div>
  );
}
