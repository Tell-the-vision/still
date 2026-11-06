"""extract.py — pull everything a WebView reconstruction needs out of a PDF (no model involved).

  python3 extract.py <in.pdf> <out dir>

Writes:
  pages.json        per page: size, rotation, text lines with bbox/size/bold/text, vector drawings (rects/lines)
  svg/pNN.svg       the page as vector SVG (glyphs become paths: exact look, no fonts needed)
  png/pNN.png       raster at 144 dpi (reference for visual diff and for Gemini's eyes)
  text.txt          plain text in reading order (for fidelity checks)
"""
import json, os, sys, collections
import pymupdf

src, out = sys.argv[1], sys.argv[2]
os.makedirs(f"{out}/svg", exist_ok=True)
os.makedirs(f"{out}/png", exist_ok=True)
os.makedirs(f"{out}/img", exist_ok=True)
doc = pymupdf.open(src)

pages = []
plain = []
for i, p in enumerate(doc):
    d = p.get_text("dict")
    lines = []
    for b in d["blocks"]:
        if b["type"] != 0:
            continue
        for ln in b["lines"]:
            spans = [s for s in ln["spans"] if s["text"]]
            if not spans:
                continue
            main = max(spans, key=lambda s: len(s["text"].strip()))
            x0, y0, x1, y1 = ln["bbox"]
            lines.append({
                "x": round(x0, 2), "y": round(y0, 2), "w": round(x1 - x0, 2), "h": round(y1 - y0, 2),
                "size": round(main["size"], 2), "bold": bool(main["flags"] & 16),
                "color": "#%06x" % main["color"],
                "text": "".join(s["text"] for s in spans),
            })
    # duplicated layers (same text at same position) → keep once
    seen, uniq = set(), []
    for l in lines:
        k = (l["x"], l["y"], l["text"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(l)
    uniq.sort(key=lambda l: (round(l["y"]), l["x"]))

    draws = []
    for dr in p.get_drawings():
        r = dr.get("rect")
        if r is None:
            continue
        fill = dr.get("fill")
        stroke = dr.get("color")
        draws.append({
            "x": round(r.x0, 2), "y": round(r.y0, 2), "w": round(r.width, 2), "h": round(r.height, 2),
            "fill": ("#%02x%02x%02x" % tuple(int(c * 255) for c in fill)) if fill else None,
            "stroke": ("#%02x%02x%02x" % tuple(int(c * 255) for c in stroke)) if stroke else None,
            "width": round(dr.get("width") or 0, 2),
            "items": len(dr.get("items", [])),
        })
    # raster images: where they are placed on the page (+ the bytes, once per xref)
    images = []
    for info in p.get_image_info(xrefs=True):
        xref = info.get("xref")
        if not xref:
            continue
        x0, y0, x1, y1 = info["bbox"]
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        fname = f"img/x{xref}.{doc.extract_image(xref)['ext']}"
        if not os.path.exists(f"{out}/{fname}"):
            open(f"{out}/{fname}", "wb").write(doc.extract_image(xref)["image"])
        images.append({"x": round(x0, 2), "y": round(y0, 2), "w": round(x1 - x0, 2), "h": round(y1 - y0, 2),
                       "file": fname, "px": [info.get("width"), info.get("height")], "cs": info.get("colorspace")})
    pages.append({"n": i + 1, "w": round(p.rect.width, 2), "h": round(p.rect.height, 2), "rotation": p.rotation, "lines": uniq, "drawings": draws, "images": images})
    plain.append("\n".join(l["text"] for l in uniq))

    open(f"{out}/svg/p{i+1:02d}.svg", "w").write(p.get_svg_image(text_as_path=True))
    p.get_pixmap(dpi=144).save(f"{out}/png/p{i+1:02d}.png")

json.dump({"source": os.path.basename(src), "pages": pages}, open(f"{out}/pages.json", "w"), ensure_ascii=False, indent=1)
open(f"{out}/text.txt", "w").write("\n\n".join(plain))
sizes = collections.Counter(round(l["size"]) for pg in pages for l in pg["lines"])
svg_bytes = sum(os.path.getsize(f"{out}/svg/{f}") for f in os.listdir(f"{out}/svg"))
print(f"{len(pages)} pages · {sum(len(pg['lines']) for pg in pages)} lines · sizes {dict(sizes.most_common())} · "
      f"{sum(len(pg['drawings']) for pg in pages)} drawings · {sum(len(pg['images']) for pg in pages)} image placements · svg total {svg_bytes/1024:.0f} KB")
