export type Piece = { kind: "same" | "del" | "ins"; text: string };

const words = (text: string) => text.match(/\s+|\S+/g) ?? [];

/** Word-level diff from the source to the current text (longest common subsequence). */
export function wordDiff(source: string, current: string): Piece[] {
  const a = words(source);
  const b = words(current);
  // lcs[i][j] = common length of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: Piece[] = [];
  const push = (kind: Piece["kind"], text: string) => {
    const last = out[out.length - 1];
    if (last?.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { push("same", a[i]); i++; j++; }
    else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) push("del", a[i++]);
    else push("ins", b[j++]);
  }
  return out;
}
