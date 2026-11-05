import { guidePages } from "@still/shared/guide-pages";
import type { StillDoc } from "../../ui/StillDocView";
import type { KeepsakePage } from "../keepsake/useGuideKeepsake";

type Node = StillDoc["content"][number];

// One page of a guide (each artwork has its own address, /e/{code}/{page}; see guidePages). Null when the guide has no
// such page.
export function pageOf(guide: unknown, page: string): StillDoc | null {
  const doc = guide as StillDoc | null;
  const content = guidePages(doc?.content ?? []).find((p) => p.page === page)?.blocks;
  return content?.length ? { version: 1, type: "doc", content } : null;
}

const textOf = (node: Node): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");

// What a page's keepsake is about: the page, its title (first heading), its first picture and the lines on it.
export function keepsakePageOf(document: StillDoc, page: string): KeepsakePage {
  const title = textOf(document.content.find((node) => node.type === "heading") ?? { type: "heading" }).trim();
  const picture = document.content.find((node) => node.type === "stillImage" && typeof node.attrs?.url === "string")?.attrs;
  const sentenceIds = new Set<string>();
  const collect = (node: Node) => {
    const id = node.marks?.find((m) => m.type === "scrap")?.attrs?.sentenceId;
    if (id) sentenceIds.add(id);
    node.content?.forEach(collect);
  };
  document.content.forEach(collect);
  return {
    page,
    title: title || "Untitled",
    image: picture ? { url: String(picture.url), altText: typeof picture.altText === "string" ? picture.altText : null, width: Number(picture.width), height: Number(picture.height) } : null,
    sentenceIds,
  };
}
