import { stillBlock, type ContentSources, type StillBlock, type StillDoc, type TextNode } from "@still/shared/still-doc";
import type { Suggestion } from "./suggestion-write";

// What accepting a suggestion does to the document (SPEC §9.4 편집 제안). The spec fixes the effect, not
// the proposal shape; these are the shapes used (target is always {node}, a top-level node id):
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

// Edits of the target's characters; null when the target is not a text block.
const onChars = (change: (chars: Char[], proposal: Record<string, unknown>) => Char[] | null): Edit => (doc, node, proposal) => {
  const i = find(doc, node);
  const block = doc.content[i];
  if (!block || !isTextBlock(block)) return null;
  const chars = change(toChars((block as { content?: TextNode[] }).content), proposal);
  return chars && { doc: replaceAt(doc, i, withRuns(block, chars)) };
};

const edits: Record<string, Edit> = {
  TEXT_EXTRACTION_FIX: onChars((old, p) => {
    const text = str(p.text);
    if (!text) return null;
    const chars: Char[] = [...text].map((ch) => ({ ch, mark: undefined }));
    // Each old scrap-marked stretch is found again by its text.
    for (let a = 0; a < old.length; ) {
      if (!old[a].mark) { a++; continue; }
      let b = a;
      while (b < old.length && JSON.stringify(old[b].mark) === JSON.stringify(old[a].mark)) b++;
      const at = [...text].join("").indexOf(old.slice(a, b).map((c) => c.ch).join(""));
      if (at >= 0) for (let k = 0; k < b - a; k++) chars[[...text.slice(0, at)].length + k].mark = old[a].mark;
      a = b;
    }
    return chars;
  }),
  PUNCTUATION_CONSISTENCY: onChars((old, p) => {
    const from = str(p.from);
    if (!from || typeof p.to !== "string") return null;
    const text = old.map((c) => c.ch).join("");
    const out: Char[] = [];
    for (let i = 0; i < old.length; ) {
      if (text.startsWith(from, i)) { out.push(...[...p.to].map((ch) => ({ ch, mark: old[i].mark }))); i += [...from].length; }
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
