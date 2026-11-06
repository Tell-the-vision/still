"""build.py — three WebView reconstructions of the same PDF, no model involved.

  python3 build.py <extract out dir> <segments.json> <fonts dir> <build dir>

  A  view-raster.html  page raster (PNG) + invisible, selectable text layer   (what pdf.js does, no library)
  B  view-css.html     every text line absolutely positioned with CSS + a web font; rules/boxes from the
                       PDF's vector drawings                                  ("CSS만으로 복원" test)
  C  view-reflow.html  semantic, responsive page from the parser's segments with the e-book's type scale
                       (what the STILL guide actually consumes: headings / paragraphs / sentences)
  guide.json           STILL guide payload derived from segments (sections → sentences, verbatim)
"""
import base64, html, json, os, sys

ext_dir, seg_path, fonts_dir, out = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
P = json.load(open(f"{ext_dir}/pages.json"))["pages"]
SEG = json.load(open(seg_path))
esc = html.escape

font_css = ""
var = os.path.join(fonts_dir, "node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2")
if os.path.exists(var):
    b64 = base64.b64encode(open(var, "rb").read()).decode()
    font_css = f"@font-face{{font-family:'Pretendard';src:url(data:font/woff2;base64,{b64}) format('woff2');font-weight:45 920;font-display:block}}"
FONT_STACK = os.environ.get('FONT_STACK', "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif")

BASE_CSS = f"""{font_css}
html,body{{margin:0;background:#e9e9e9}}
.page{{position:relative;width:420px;height:595px;background:#fff;margin:16px auto;overflow:hidden;
  box-shadow:0 1px 6px rgba(0,0,0,.15);transform-origin:top left}}
.sheet{{margin:0 auto;width:max-content}}
@media (max-width:1500px){{ .sheet{{zoom:0.95}} }}
"""

# ---------------------------------------------------------------- A: raster + text layer
def view_raster():
    pages = []
    for pg in P:
        png = base64.b64encode(open(f"{ext_dir}/png/p{pg['n']:02d}.png", "rb").read()).decode()
        spans = "".join(
            f'<span style="left:{l["x"]}px;top:{l["y"]}px;font-size:{l["size"]}px;width:{l["w"]}px;height:{l["h"]}px">{esc(l["text"])}</span>'
            for l in pg["lines"])
        pages.append(f'<div class="page" data-page="{pg["n"]}" style="width:{pg["w"]}px;height:{pg["h"]}px"><img src="data:image/png;base64,{png}" alt=""><div class="textlayer">{spans}</div></div>')
    css = BASE_CSS + """
.page img{position:absolute;inset:0;width:100%;height:100%}
.textlayer span{position:absolute;color:transparent;white-space:pre;line-height:1;font-family:""" + FONT_STACK + """;
  transform-origin:0 0;user-select:text}
.textlayer span::selection{background:rgba(0,120,255,.35)}"""
    return doc("A · raster + text layer", css, pages)

# ---------------------------------------------------------------- B: CSS absolute
def view_css():
    pages = []
    for pg in P:
        parts = []
        for im in pg.get("images", []):
            mime = "image/jpeg" if im["file"].endswith(("jpg", "jpeg")) else "image/png"
            b64 = base64.b64encode(open(f"{ext_dir}/{im['file']}", "rb").read()).decode()
            parts.append(f'<img src="data:{mime};base64,{b64}" style="position:absolute;left:{im["x"]}px;top:{im["y"]}px;width:{im["w"]}px;height:{im["h"]}px;object-fit:fill" alt="">')
        for d in pg["drawings"]:
            if d["w"] >= pg["w"] - 1 and d["h"] >= pg["h"] - 1:
                continue  # page background
            if d["items"] > 20:
                continue  # glyph outlines (headings drawn as paths) — text layer covers them
            if d["fill"] and (d["h"] <= 2 or d["w"] <= 2):
                parts.append(f'<i class="rule" style="left:{d["x"]}px;top:{d["y"]}px;width:{max(d["w"],0.5)}px;height:{max(d["h"],0.5)}px;background:{d["fill"]}"></i>')
            elif d["fill"]:
                parts.append(f'<i class="box" style="left:{d["x"]}px;top:{d["y"]}px;width:{d["w"]}px;height:{d["h"]}px;background:{d["fill"]}"></i>')
        for l in pg["lines"]:
            weight = 700 if l["bold"] or l["size"] >= 40 else 500
            parts.append(
                f'<span data-w="{l["w"]}" style="left:{l["x"]}px;top:{l["y"]}px;font-size:{l["size"]}px;line-height:{l["h"]}px;'
                f'font-weight:{weight};color:{l["color"]}">{esc(l["text"])}</span>')
        pages.append(f'<div class="page" data-page="{pg["n"]}" style="width:{pg["w"]}px;height:{pg["h"]}px">{"".join(parts)}</div>')
    css = BASE_CSS + """
.page span{position:absolute;white-space:pre;font-family:""" + FONT_STACK + """;letter-spacing:0}
.page i{position:absolute;display:block}"""
    fit = """<script>
// Fit each line to the width it had in the PDF: the web font never has the same advance widths as the
// embedded one, so without this dense columns overflow into their neighbours (pdf2htmlEX does the same).
document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll('.page span[data-w]')) {
    const want = parseFloat(el.dataset.w), have = el.getBoundingClientRect().width / (el.closest('.page').getBoundingClientRect().width / el.closest('.page').offsetWidth);
    if (have > 0 && Math.abs(have - want) / want > 0.02) { el.style.transformOrigin = '0 0'; el.style.transform = `scaleX(${(want / have).toFixed(4)})`; }
  }
});
</script>"""
    return doc("B · CSS reconstruction", css, pages).replace("</body>", fit + "</body>")

# ---------------------------------------------------------------- C: semantic reflow
def view_reflow():
    # images per page (data URIs, downscaled by the browser); a page that is mostly one image becomes a figure
    figs = {}
    for pg in P:
        for im in pg.get("images", []):
            if im["w"] * im["h"] < pg["w"] * pg["h"] * 0.08:
                continue  # small logos / thumbnails stay out of the reading flow
            mime = "image/jpeg" if im["file"].endswith(("jpg", "jpeg")) else "image/png"
            b64 = base64.b64encode(open(f"{ext_dir}/{im['file']}", "rb").read()).decode()
            figs.setdefault(pg["n"], []).append(f'<figure><img src="data:{mime};base64,{b64}" alt="" loading="lazy"></figure>')
    body, done_pages = [], set()
    def page_figs(n):
        if n in done_pages:
            return ""
        done_pages.add(n)
        return "".join(figs.get(n, []))
    for s in SEG["segments"]:
        body.append(page_figs(s["page"]))
        r, t = s["role"], esc(s["text"])
        if r == "display":
            body.append(f'<p class="display">{t}</p>')
        elif r in ("h1", "h2", "h3"):
            body.append(f'<{r} id="{s["id"]}">{t}</{r}>')
        elif r == "small":
            body.append(f'<p class="small">{t}</p>')
        else:
            sents = "".join(f'<span class="s" data-id="{x["id"]}">{esc(x["text"])}</span> ' for x in s.get("sentences", []))
            body.append(f'<p id="{s["id"]}">{sents or t}</p>')
    for n in sorted(figs):  # image-only pages with no text segments
        body.append(page_figs(n))
    css = f"""{font_css}
html,body{{margin:0;background:#fff;color:#000}}
body{{font-family:{FONT_STACK};font-weight:500;font-size:17px;line-height:2;word-break:keep-all;padding:32px 20px 80px;max-width:680px;margin:0 auto}}
.display{{font-size:1.6em;line-height:1.4;font-weight:600;letter-spacing:-.01em;margin:1.5em 0}}
h1{{font-size:1.9em;line-height:1.3;font-weight:500;border-bottom:1px solid #000;padding-bottom:.4em;margin:2.5em 0 1.2em}}
h2{{font-size:1.4em;line-height:1.4;font-weight:500;margin:2em 0 .8em}}
h3{{font-size:1.1em;font-weight:700;margin:1.5em 0 .5em}}
.small{{font-size:.75em;color:#444;line-height:1.6}}
p{{margin:0 0 1em}}
figure{{margin:1.5em -20px}} figure img{{width:100%;height:auto;display:block}}
.s:hover{{background:#f3f3f3}}"""
    return f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C · reflow</title><style>{css}</style></head><body>{"".join(body)}</body></html>'

def doc(title, css, pages):
    return (f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{title}</title><style>{css}</style></head><body><div class="sheet">{"".join(pages)}</div></body></html>')

# ---------------------------------------------------------------- STILL guide payload
def guide():
    sections, cur = [], None
    for s in SEG["segments"]:
        if s["role"] in ("h1", "h2"):
            cur = {"section": s["text"], "page": s["page"], "sentences": []}
            sections.append(cur)
        elif s["role"] == "body" and cur is not None:
            cur["sentences"] += [{"id": x["id"], "text": x["text"]} for x in s.get("sentences", [])]
    return {"source": SEG["meta"]["source"], "sections": [x for x in sections if x["sentences"]]}

open(f"{out}/view-raster.html", "w").write(view_raster())
open(f"{out}/view-css.html", "w").write(view_css())
open(f"{out}/view-reflow.html", "w").write(view_reflow())
json.dump(guide(), open(f"{out}/guide.json", "w"), ensure_ascii=False, indent=1)
for f in ("view-raster.html", "view-css.html", "view-reflow.html", "guide.json"):
    print(f"{f}: {os.path.getsize(f'{out}/{f}')/1024:.0f} KB")
g = guide()
print(f"guide.json: {len(g['sections'])} sections, {sum(len(s['sentences']) for s in g['sections'])} sentences")
