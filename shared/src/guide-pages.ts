// The pages of a published guide: each artwork has its own address, /e/{code}/{page}, where {page} is 8 hex
// characters. A guide published from the console names every block "{first 8 characters of its content id}-…", so a
// page is the blocks sharing that prefix. A guide imported whole (the seed) has plain block ids; there each level-2
// heading starts a page, as do blocks with no page before them, named by a short hash of the first block's id.
// Section titles (level 1) belong to no page.

type Block = { type: string; attrs?: { id?: unknown; level?: unknown } };

const PREFIX = /^([0-9a-f]{8})-/;

// FNV-1a over a block's id: 8 hex characters, the same on the server and in the app.
function shortHash(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// The page a block belongs to, given the page of the block before it (null: none).
function pageOfBlock(block: Block, previous: string | null): string | null {
  const id = typeof block.attrs?.id === "string" ? block.attrs.id : "";
  const prefix = PREFIX.exec(id)?.[1];
  if (prefix) return prefix;
  const level = block.type === "heading" ? Number(block.attrs?.level) : null;
  if (level === 1) return null;
  if (level === 2 || previous === null) return shortHash(id);
  return previous;
}

export function guidePages<B extends Block>(blocks: B[]): { page: string; blocks: B[] }[] {
  const pages = new Map<string, B[]>();
  let page: string | null = null;
  for (const block of blocks) {
    page = pageOfBlock(block, page);
    if (page) pages.set(page, [...(pages.get(page) ?? []), block]);
  }
  return [...pages].map(([page, blocks]) => ({ page, blocks }));
}
