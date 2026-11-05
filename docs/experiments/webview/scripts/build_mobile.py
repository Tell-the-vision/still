"""build_mobile.py — design-preserving MOBILE reflow of a PDF (no model).

  python3 build_mobile.py <extract out dir> <out.html> [fonts dir]

Not a page copy. The page is re-laid-out for a phone, but it keeps what the PDF's design says:
  - text verbatim, in column-aware reading order (columns left→right, lines top→bottom)
  - the document's own colours per role (accent colour of headings/quotes, grey small print, white-on-photo)
  - serif vs sans from the embedded font names; size hierarchy as ratios to the body size
  - photos as full-width figures; text that sat on a photo becomes its overlay caption
  - "year  entry" lines become a list; wrapped entries are joined
"""
import base64, collections, html, json, os, re, sys

ext_dir, out_html = sys.argv[1], sys.argv[2]
fonts_dir = sys.argv[3] if len(sys.argv) > 3 else None
P = json.load(open(f"{ext_dir}/pages.json"))["pages"]
esc = html.escape
YEAR = re.compile(r"^\s*((?:19|20)\d{2})\s*(?:[\t ]+(.*))?$")

# running headers/footers: same text on at least half of the pages → dropped
_per_page = collections.Counter()
for pg in P:
    for t in {l["text"].strip() for l in pg["lines"]}:
        _per_page[t] += 1
RUNNING = {t for t, n in _per_page.items() if t and n >= max(2, len(P) // 2)}
for pg in P:
    # also drop page numbers: a bare number in the top/bottom 8% of the page
    def is_pagenum(l):
        t = l["text"].strip()
        bare = re.sub(r"(?i)\b(page|p\.|of|쪽|페이지)\b", " ", t)
        bare = re.sub(r"[\s\-–—/|.]+", " ", bare).strip()
        return bool(re.fullmatch(r"\d{1,3}( \d{1,3})?", bare)) and (l["y"] > pg["h"] * 0.85 or l["y"] + l["h"] < pg["h"] * 0.12)
    pg["lines"] = [l for l in pg["lines"] if l["text"].strip() not in RUNNING and not is_pagenum(l)]

# ---------------------------------------------------------------- design tokens from the PDF itself
lines_all = [l for pg in P for l in pg["lines"] if l["text"].strip()]
by_chars = collections.Counter()
for l in lines_all:
    by_chars[(round(l["size"] * 2) / 2, l["color"])] += len(l["text"].strip())
(body_size, body_color), _ = by_chars.most_common(1)[0]
def lum(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
# accent = most used non-body colour that is dark enough to read on white (page-number greys are not accents)
colors = collections.Counter(l["color"] for l in lines_all if l["color"] not in (body_color, "#ffffff") and lum(l["color"]) < 0.55)
accent = colors.most_common(1)[0][0] if colors else body_color
fonts_meta = json.load(open(f"{ext_dir}/fonts.json")) if os.path.exists(f"{ext_dir}/fonts.json") else []
serif = any(re.search(r"garamond|mincho|myungjo|serif|times|batang|song|ming", f, re.I) for f in fonts_meta)
stack = "'Noto Serif KR','Noto Serif CJK KR','Noto Serif CJK JP','Source Han Serif',Georgia,serif" if serif else "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif"
font_css = ""
if fonts_dir and not serif:
    var = os.path.join(fonts_dir, "node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2")
    if os.path.exists(var):
        font_css = "@font-face{font-family:'Pretendard';src:url(data:font/woff2;base64,%s) format('woff2');font-weight:45 920}" % base64.b64encode(open(var, "rb").read()).decode()

def role_of(l):
    r = l["size"] / body_size
    if l["color"] == "#ffffff": return "overlay"
    if r >= 1.5: return "h1"
    if r >= 1.25: return "h2"
    if r >= 1.08: return "h3"
    if r <= 0.92: return "small"
    return "body"

# ---------------------------------------------------------------- reading order: columns by x
def columns(lines, page_w):
    ls = sorted(lines, key=lambda l: l["x"])
    cols, gap = [], max(40, page_w * 0.06)
    for l in ls:
        if cols and l["x"] - cols[-1]["x0"] < page_w * 0.22 and l["x"] - cols[-1]["x1"] < gap:
            cols[-1]["lines"].append(l); cols[-1]["x1"] = max(cols[-1]["x1"], l["x"] + l["w"])
        else:
            cols.append({"x0": l["x"], "x1": l["x"] + l["w"], "lines": [l]})
    for c in cols: c["lines"].sort(key=lambda l: (round(l["y"]), l["x"]))
    return cols

# ---------------------------------------------------------------- blocks
def blocks_of(col_lines):
    """group lines → blocks: heading / para / quote / list, joining wrapped lines"""
    out, cur = [], None
    def flush():
        nonlocal cur
        if cur: out.append(cur); cur = None
    prev = None
    for l in col_lines:
        t = l["text"].rstrip("\n")
        if not t.strip(): continue
        r = role_of(l)
        m = YEAR.match(t)
        gap = (l["y"] - (prev["y"] + prev["h"])) if prev else 0
        if m:
            if not cur or cur["type"] != "list": flush(); cur = {"type": "list", "items": [], "role": r, "y": l["y"]}
            cur["items"].append([m.group(1), (m.group(2) or "").strip()])
        elif cur and cur["type"] == "list" and r == cur["role"] and gap < l["h"] * 0.9 and not t.strip()[:1].isupper() * 0:
            # wrapped continuation of the last list entry (same style, no gap) — but a new heading-like line starts a block
            if r in ("h1", "h2", "h3"): flush(); cur = {"type": r, "text": t.strip(), "color": l["color"], "y": l["y"]}; flush()
            else: cur["items"][-1][1] += ("\n" if cur["items"][-1][1] else "") + t.strip()  # one line per entry
        elif r in ("h1", "h2", "h3"):
            flush(); cur = {"type": r, "text": t.strip(), "color": l["color"], "y": l["y"]}; flush()
        else:
            quote = t.strip().startswith(("“", '"', "「")) or (cur and cur.get("quote"))
            same = cur and cur["type"] in ("p",) and cur["role"] == r and gap < l["h"] * 0.9 and cur["color"] == l["color"]
            if same:
                cur["text"] += ("" if cur["text"].endswith(" ") else " ") + t.strip()
            else:
                flush(); cur = {"type": "p", "role": r, "text": t.strip(), "color": l["color"], "quote": quote, "y": l["y"]}
        prev = l
    flush()
    return out

def render_block(b):
    if b["type"] in ("h1", "h2", "h3"):
        return f'<{b["type"]} style="color:{b.get("color", body_color)}">{esc(b["text"])}</{b["type"]}>'
    if b["type"] == "list":
        return "<dl>" + "".join(f"<dt>{esc(y)}</dt><dd>{esc(e).replace(chr(10), '<br>')}</dd>" for y, e in b["items"]) + "</dl>"
    cls = "quote" if b.get("quote") else ("small" if b["role"] == "small" else "")
    style = f' style="color:{b["color"]}"' if b["color"] not in (body_color, "#ffffff") and lum(b["color"]) < 0.55 else ""
    return f'<p class="{cls}"{style}>{esc(b["text"])}</p>'

# ---------------------------------------------------------------- pages → mobile flow
parts = []
for pg in P:
    big = [im for im in pg.get("images", []) if im["w"] * im["h"] >= pg["w"] * pg["h"] * 0.3]
    overlay = [l for l in pg["lines"] if role_of(l) == "overlay" and l["text"].strip()]
    rest = [l for l in pg["lines"] if role_of(l) != "overlay" and l["text"].strip()]
    for im in big:
        mime = "image/jpeg" if im["file"].endswith(("jpg", "jpeg")) else "image/png"
        b64 = base64.b64encode(open(f"{ext_dir}/{im['file']}", "rb").read()).decode()
        cap = ""
        if overlay:
            ov = sorted(overlay, key=lambda l: (round(l["y"]), l["x"]))
            cap = "<figcaption>" + "".join(f'<span style="font-size:{max(0.8, l["size"]/body_size):.2f}em">{esc(l["text"].strip())}</span>' for l in ov) + "</figcaption>"
            overlay = []
        parts.append(f'<figure class="photo"><img src="data:{mime};base64,{b64}" alt="">{cap}</figure>')
    small_imgs = [im for im in pg.get("images", []) if im not in big and im["w"] >= 20 and im["h"] >= 20]
    cols = columns(rest, pg["w"])
    for col in cols:
        col["blocks"] = blocks_of(col["lines"])
    # give every small image to the column it overlaps most; it is rendered just before the first block below it
    for im in small_imgs:
        best = max(cols, key=lambda c: min(im["x"] + im["w"], c["x1"]) - max(im["x"], c["x0"])) if cols else None
        if best is None:
            continue
        mime = "image/jpeg" if im["file"].endswith(("jpg", "jpeg")) else "image/png"
        b64 = base64.b64encode(open(f"{ext_dir}/{im['file']}", "rb").read()).decode()
        best["blocks"].append({"type": "img", "y": im["y"] - 0.01, "html": f'<img class="inline" style="width:{min(100, round(im["w"] / pg["w"] * 220))}%;max-width:{round(im["w"]*2)}px" src="data:{mime};base64,{b64}" alt="">'})
    for col in cols:
        col["blocks"].sort(key=lambda b: b.get("y", 0))
        parts.append('<section class="col">' + "".join(b["html"] if b["type"] == "img" else render_block(b) for b in col["blocks"]) + "</section>")

css = f"""{font_css}
html,body{{margin:0;background:#fff;color:{body_color}}}
body{{font-family:{stack};font-size:17px;line-height:1.85;word-break:keep-all;padding:0 0 80px}}
.col{{padding:8px 20px;max-width:680px;margin:0 auto}}
h1,h2,h3{{font-weight:600;line-height:1.3;margin:1.6em 0 .6em}} h1{{font-size:1.9em}} h2{{font-size:1.5em}} h3{{font-size:1.15em;letter-spacing:.02em}}
p{{margin:0 0 1em}} .small{{font-size:.8em;line-height:1.6;color:#555}}
.quote{{font-size:1.25em;line-height:1.5;font-style:italic;color:{accent};margin:1.4em 0;padding-left:.8em;border-left:2px solid {accent}}}
dl{{margin:0 0 1.2em;display:grid;grid-template-columns:3.6em 1fr;column-gap:.6em;row-gap:.35em}} dt{{font-variant-numeric:tabular-nums;color:#555}} dd{{margin:0}}
figure.photo{{margin:0 0 1.2em;position:relative;background:#111}} figure.photo img{{width:100%;height:auto;display:block}}
figure.photo figcaption{{position:absolute;left:20px;bottom:20px;right:20px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6);line-height:1.5;display:flex;flex-direction:column;gap:2px}}
figure.photo figcaption span:first-child{{font-weight:600;letter-spacing:.05em}}
img.inline{{display:block;height:auto;margin:1.2em 0 .6em;border-radius:2px}}
"""
open(out_html, "w").write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mobile reflow</title><style>{css}</style></head><body>{"".join(parts)}</body></html>')
print(f"body {body_size}pt {body_color} · accent {accent} · serif={serif} · {len(parts)} parts → {out_html} ({os.path.getsize(out_html)//1024} KB)")
