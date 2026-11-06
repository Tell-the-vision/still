"""columns.py — column-aware reading order for multi-column PDF pages (fix for parse_pdf.py's y-sort).

  python3 columns.py <in.pdf> <out segments.json>

Blocks (PyMuPDF text blocks) are clustered into columns by their left edge; columns are read left→right,
blocks inside a column top→bottom. Roles come from font size like parse_pdf.py (most common size = body).
Output is parse_pdf.py-compatible: {"meta", "segments": [{id, page, role, size, text, sentences?}]}.
"""
import collections, json, re, sys
import pymupdf

SENT = re.compile(r"(?<=[.?!。])\s+")
src, out = sys.argv[1], sys.argv[2]
doc = pymupdf.open(src)

def block_lines(b):
    for ln in b["lines"]:
        spans = [s for s in ln["spans"] if s["text"]]
        if not spans:
            continue
        main = max(spans, key=lambda s: len(s["text"].strip()))
        yield round(main["size"], 1), "".join(s["text"] for s in spans), ln["bbox"]

# pass 1: sizes → roles (same rule family as parse_pdf.py)
sizes, on_pages = collections.Counter(), collections.defaultdict(set)
all_text = collections.Counter()
for pno, p in enumerate(doc, 1):
    page_texts = set()
    for b in p.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for size, text, _ in block_lines(b):
            if text.strip():
                sizes[size] += len(text.strip()); on_pages[size].add(pno); page_texts.add(text.strip())
    for t in page_texts:
        all_text[t] += 1  # count pages, not occurrences
running = {t for t, n in all_text.items() if n >= max(2, len(doc) // 2)}
body = max(sizes, key=sizes.get)
# mixed-script lines (Latin + CJK fonts) jitter by a fraction of a point: treat a ±0.6pt band as body
role = {s: "body" for s in sizes if abs(s - body) <= 0.6}
bigger = sorted((s for s in sizes if s > body + 0.6 and len(on_pages[s]) > 1), reverse=True)
for i, s in enumerate(bigger):
    role[s] = ("h1", "h2", "h3")[min(i, 2)]
for s in sizes:
    role.setdefault(s, "display" if s > body else "small")

segments = []
def emit(pno, r, size, text, col):
    text = re.sub(r"[  ]+", " ", text).strip()
    if not text:
        return
    sid = f"s{len(segments)+1:03d}"
    seg = {"id": sid, "page": pno, "col": col, "role": r, "size": size, "text": text}
    if r == "body":
        seg["sentences"] = [{"id": f"{sid}.{i}", "text": t.strip()} for i, t in enumerate(SENT.split(text), 1) if t.strip()]
    segments.append(seg)

for pno, p in enumerate(doc, 1):
    blocks = [b for b in p.get_text("dict")["blocks"] if b["type"] == 0]
    # cluster by left edge: sort x0, start a new column when the gap to the previous cluster is large
    blocks.sort(key=lambda b: b["bbox"][0])
    cols, gap = [], max(40, p.rect.width * 0.06)
    for b in blocks:
        if cols and b["bbox"][0] - cols[-1]["x1"] < gap and b["bbox"][0] - cols[-1]["x0"] < p.rect.width * 0.25:
            cols[-1]["blocks"].append(b); cols[-1]["x1"] = max(cols[-1]["x1"], b["bbox"][2])
        else:
            cols.append({"x0": b["bbox"][0], "x1": b["bbox"][2], "blocks": [b]})
    # a column that spans most of the page width (titles) is read before the narrow ones at the same height
    for ci, col in enumerate(cols):
        col["blocks"].sort(key=lambda b: (round(b["bbox"][1]), b["bbox"][0]))
        # flatten to lines, then paragraph by vertical gap + role change (block boundaries are unreliable:
        # InDesign often exports every line as its own block)
        lines = []
        for b in col["blocks"]:
            for size, text, bbox in block_lines(b):
                t = text.strip()
                if t and t not in running:
                    lines.append((size, text, bbox))
        lines.sort(key=lambda l: (round(l[2][1], 1), l[2][0]))
        buf, cur, prev_bbox = "", None, None
        for size, text, bbox in lines:
            key = (role[size], size)
            line_h = bbox[3] - bbox[1]
            gap = (bbox[1] - prev_bbox[3]) if prev_bbox else 0
            new_para = cur is not None and (key[0] != cur[0] or gap > max(line_h * 0.9, 3) or buf.rstrip().endswith("\n"))
            if new_para:
                emit(pno, cur[0], cur[1], buf, ci); buf = ""
            cur = key
            buf += text.rstrip("\n") if text.endswith((" ", "\n")) and not text.endswith("\n") else text.rstrip("\n") + " "
            prev_bbox = bbox
        if cur and buf.strip():
            emit(pno, cur[0], cur[1], buf, ci)

meta = {"source": src.split("/")[-1], "pages": len(doc), "body_size": body, "running_text_dropped": sorted(running),
        "roles": {str(k): v for k, v in sorted(role.items(), reverse=True)}, "segments": len(segments),
        "sentences": sum(len(s.get("sentences", [])) for s in segments), "characters": sum(len(s["text"]) for s in segments)}
json.dump({"meta": meta, "segments": segments}, open(out, "w"), ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False))
for s in segments[:14]:
    print(f"{s['id']} p{s['page']} c{s['col']} {s['role']:7} {s['text'][:90]}")
