import { stillBlock, type ContentSources, type StillBlock, type StillDoc, type TextNode } from "@still/shared/still-doc";
import type { Suggestion } from "./suggestion-write";

// What accepting a suggestion does to the document (SPEC §9.4 편집 제안). The spec fixes the effect, not
// the proposal shape; these are the shapes used (target is always {node}: a top-level node id, or for text edits a paragraph id inside a quote or list):
//   TEXT_EXTRACTION_FIX        {text}          node text becomes `text`; scrap-marked substrings still found keep their mark
//   PUNCTUATION_CONSISTENCY    {from, to}      every `from` in the node's text becomes `to`, marks kept
//   STRUCTURE_LEVEL            {level: 2|3}    the paragraph or heading becomes a heading of that level
//   MISSING_HEADING            {text, level}   a new heading is inserted before the node
//   SPLIT_FOR_MOBILE           {offsets[]}     the paragraph splits at those character offsets; sources ranges split too
//   GUIDE_SENTENCE_CANDIDATE   {sentence}      the first occurrence of `sentence` in the node gets a scrap mark
// Any other kind, or a suggestion missing what it needs, changes nothing (the same `doc` comes back).

type Char = { ch: string; mark: TextNode["marks"] };
type Edit = (doc: StillDoc, node: string, proposal: Record<string, unknown>, sources: ContentSources) => { doc: StillDoc; sources?: ContentSources } | null;

const toChars = (runs: TextNode[] = []): Char[] => runs.flatMap((r) => [...r.text].map((ch) => ({ ch, mark: r.marks })));
// Consecutive characters with the same mark become one text node.
const toRuns = (chars: Char[]): TextNode[] => {
  const runs: TextNode[] = [];
  for (const { ch, mark } of chars) {
    const last = runs[runs.length - 1];
    if (last && JSON.stringify(last.marks) === JSON.stringify(mark)) last.text += ch;
    else runs.push({ type: "text", text: ch, ...(mark ? { marks: mark } : {}) });
  }
  return runs;
};
const withRuns = (b: StillBlock, chars: Char[]): StillBlock => ({ ...b, content: toRuns(chars) }) as StillBlock;
const isTextBlock = (b: StillBlock) => b.type === "paragraph" || b.type === "heading";
const find = (doc: StillDoc, id: string) => doc.content.findIndex((b) => b.attrs.id === id);
const replaceAt = (doc: StillDoc, i: number, ...blocks: StillBlock[]): StillDoc => ({ ...doc, content: doc.content.flatMap((b, j) => (j === i ? blocks : [b])) });
const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const newId = () => crypto.randomUUID();

// Edits of the target's characters. The target is a top-level text block, or a paragraph nested in a quote or list item.
const onChars = (change: (chars: Char[], proposal: Record<string, unknown>) => Char[] | null): Edit => (doc, node, proposal) => {
  const i = find(doc, node);
  const block = doc.content[i];
  if (block) {
    if (!isTextBlock(block)) return null;
    const chars = change(toChars((block as { content?: TextNode[] }).content), proposal);
    return chars && { doc: replaceAt(doc, i, withRuns(block, chars)) };
  }
  // Nested: rewrite the paragraph carrying the id, wherever it sits inside a container block.
  let changed = false;
  const inParagraph = (p: { attrs?: { id?: string }; content?: TextNode[] }) => {
    const chars = p.attrs?.id === node ? change(toChars(p.content), proposal) : null;
    if (!chars) return p;
    changed = true;
    return { ...p, content: toRuns(chars) };
  };
  const content = doc.content.map((b) => {
    if (b.type === "blockquote") return { ...b, content: b.content.map(inParagraph) };
    if (b.type === "bulletList" || b.type === "orderedList") {
      return { ...b, content: b.content.map((item) => ({ ...item, content: item.content.map(inParagraph) })) };
    }
    return b;
  }) as StillBlock[];
  return changed ? { doc: { ...doc, content } } : null;
};

const edits: Record<string, Edit> = {
  TEXT_EXTRACTION_FIX: onChars((old, p) => {
    const text = str(p.text);
    if (!text) return null;
    // Characters outside the changed stretch keep their marks. The changed stretch takes the mark around it,
    // so a fix inside a scrap sentence keeps the sentence and its sentenceId (SPEC §9.7).
    const next = [...text];
    let pre = 0;
    while (pre < old.length && pre < next.length && old[pre].ch === next[pre]) pre++;
    let suf = 0;
    while (suf < old.length - pre && suf < next.length - pre && old[old.length - 1 - suf].ch === next[next.length - 1 - suf]) suf++;
    const same = (a: Char["mark"], b: Char["mark"]) => JSON.stringify(a) === JSON.stringify(b);
    const before = pre > 0 ? old[pre - 1].mark : undefined;
    const after = suf > 0 ? old[old.length - suf].mark : undefined;
    const replaced = old.slice(pre, old.length - suf);
    const mark = before && same(before, after) ? before : replaced.length && replaced.every((c) => same(c.mark, replaced[0].mark)) ? replaced[0].mark : undefined;
    return [...old.slice(0, pre), ...next.slice(pre, next.length - suf).map((ch) => ({ ch, mark })), ...old.slice(old.length - suf)];
  }),
  PUNCTUATION_CONSISTENCY: onChars((old, p) => {
    const from = str(p.from);
    if (!from || typeof p.to !== "string") return null;
    // Compared in code points throughout (the old version mixed them with UTF-16 offsets around emoji).
    const fromChars = [...from];
    const out: Char[] = [];
    for (let i = 0; i < old.length; ) {
      if (old.slice(i, i + fromChars.length).map((c) => c.ch).join("") === from) { out.push(...[...p.to].map((ch) => ({ ch, mark: old[i].mark }))); i += fromChars.length; }
      else out.push(old[i++]);
    }
    return out;
  }),
  GUIDE_SENTENCE_CANDIDATE: onChars((old, p) => {
    const sentence = str(p.sentence);
    const at = sentence ? old.map((c) => c.ch).join("").indexOf(sentence) : -1;
    if (!sentence || at < 0) return null;
    const mark = [{ type: "scrap" as const, attrs: { sentenceId: null } }];
    const first = [...old.map((c) => c.ch).join("").slice(0, at)].length;
    return old.map((c, i) => (i >= first && i < first + [...sentence].length ? { ...c, mark } : c));
  }),
  STRUCTURE_LEVEL: (doc, node, p) => {
    const i = find(doc, node);
    const block = doc.content[i];
    if ((p.level !== 2 && p.level !== 3) || !block || !isTextBlock(block)) return null;
    return { doc: replaceAt(doc, i, { ...block, type: "heading", attrs: { id: node, level: p.level } } as StillBlock) };
  },
  MISSING_HEADING: (doc, node, p) => {
    const i = find(doc, node);
    const text = str(p.text);
    if (i < 0 || !text || (p.level !== 2 && p.level !== 3)) return null;
    const heading: StillBlock = { type: "heading", attrs: { id: newId(), level: p.level }, content: [{ type: "text", text }] };
    return { doc: replaceAt(doc, i, heading, doc.content[i]) };
  },
  SPLIT_FOR_MOBILE: (doc, node, p, sources) => {
    const i = find(doc, node);
    const block = doc.content[i];
    if (!block || block.type !== "paragraph" || !Array.isArray(p.offsets)) return null;
    const chars = toChars(block.content);
    const cuts = [0, ...[...new Set(p.offsets as number[])].filter((o) => Number.isInteger(o) && o > 0 && o < chars.length).sort((a, b) => a - b), chars.length];
    if (cuts.length < 3) return null;
    const ranges = cuts.slice(1).map((end, k) => [cuts[k], end] as const);
    const parts = ranges.map(([a, b], k) => ({ ...withRuns(block, chars.slice(a, b)), attrs: { id: k === 0 ? node : newId() } }) as StillBlock);
    const own = sources[node];
    const split = own && Object.fromEntries(parts.map((part, k) => [part.attrs.id, { ...own, start: own.start + ranges[k][0], end: k === parts.length - 1 ? own.end : own.start + ranges[k][1] }]));
    return { doc: replaceAt(doc, i, ...parts), sources: split ? { ...sources, ...split } : sources };
  },
};

export function applySuggestion(doc: StillDoc, sources: ContentSources, s: Suggestion): { doc: StillDoc; sources: ContentSources } {
  const node = s.target?.node;
  const result = node && edits[s.kind]?.(doc, node, s.proposal ?? {}, sources);
  if (!result) return { doc, sources };
  result.doc.content.forEach((b) => stillBlock.parse(b));
  return { doc: result.doc, sources: result.sources ?? sources };
}
