import { useEffect, useState } from "react";
import { api, type ContentItem, type Exhibition } from "./api";

/** An artwork's short id in addresses and QR codes: the first 8 characters of its content id (SPEC §1.2). */
export const short = (item: ContentItem) => item.id.slice(0, 8);

/**
 * The artworks live in each published guide: approved before its last publish. Read without touching the editor's
 * loaded items (peekContentItems). Keyed by exhibition id; an exhibition not read yet has no entry.
 */
export function useLiveArtworks(exhibitions: Exhibition[]): Record<string, ContentItem[]> {
  const [works, setWorks] = useState<Record<string, ContentItem[]>>({});
  const key = exhibitions.map((e) => `${e.id}:${e.publishedAt}`).join(",");
  useEffect(() => {
    let current = true;
    for (const e of exhibitions) {
      api.peekContentItems(e.id).then((items) => {
        const live = items.filter((i) => i.kind === "Artwork" && i.reviewStatus === "APPROVED" && !!e.publishedAt && !!i.approvedAt && i.approvedAt <= e.publishedAt);
        if (current) setWorks((w) => ({ ...w, [e.id]: live }));
      }, () => {});
    }
    return () => { current = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return works;
}
