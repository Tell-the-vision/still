import { useEffect, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router-dom";
import { apiMode, type ContentItem, type Exhibition } from "../api";
import { qrSources } from "../api/qr";
import { guideUrl, visitorUrl } from "../format";
import { short, useLiveArtworks } from "../liveArtworks";
import { useWorkspace } from "../store";

// Label sizes on an A4 sheet. Every label is posted beside its work by hand, so the sizes follow where it goes:
// large beside a big work, medium as a card, small as a sticker.
const SIZES = {
  large: { name: "Large", detail: "4 per sheet", columns: 2, rows: 2 },
  medium: { name: "Medium", detail: "6 per sheet", columns: 2, rows: 3 },
  small: { name: "Small", detail: "12 per sheet, as stickers", columns: 3, rows: 4 },
} as const;
type Size = keyof typeof SIZES;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Print labels (/exhibitions/{code}/labels): the label sheets of one published exhibition exactly as they print,
 * beside the few choices that matter when posting them by hand: the size, which artworks, and cut lines. Each label
 * carries its artwork's QR (SPEC §1.2). `?artwork=` (the first 8 characters of its id) starts with only that artwork,
 * to reprint one label.
 */
export default function Labels() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const { exhibitions } = useWorkspace();
  const exhibition = exhibitions.find((e) => e.code === code && e.status === "PUBLISHED") ?? null;
  const works = useLiveArtworks(exhibition ? [exhibition] : []);
  const artworks = exhibition ? works[exhibition.id] : undefined;
  const [size, setSize] = useState<Size>("medium");
  const [cutLines, setCutLines] = useState(true);
  const [chosen, setChosen] = useState<Set<string> | null>(null);

  // Every artwork to begin with, or only the one named in ?artwork=.
  useEffect(() => {
    if (!artworks || chosen) return;
    const one = params.get("artwork");
    setChosen(new Set(artworks.filter((a) => !one || short(a) === one).map((a) => a.id)));
  }, [artworks]); // eslint-disable-line react-hooks/exhaustive-deps

  // The browser names a saved PDF after the page title.
  useEffect(() => {
    if (!exhibition) return;
    const before = document.title;
    document.title = `Labels · ${exhibition.title}`;
    return () => { document.title = before; };
  }, [exhibition?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!exhibition) {
    // The workspace's exhibitions load first; only once they are in can "not published" be told.
    return exhibitions.length ? (
      <div className="labels-missing">
        <NavLink to={`/exhibitions/${code}/works`} className="labels-back">← Published works</NavLink>
        <p>This exhibition is not published, so its works have no QR labels yet.</p>
      </div>
    ) : null;
  }

  const picked = (artworks ?? []).filter((a) => chosen?.has(a.id));
  const { columns, rows } = SIZES[size];
  const perSheet = columns * rows;
  const sheets = Array.from({ length: Math.ceil(picked.length / perSheet) }, (_, n) => picked.slice(n * perSheet, (n + 1) * perSheet));
  const allChosen = !!artworks?.length && picked.length === artworks.length;
  const toggle = (id: string) => setChosen((now) => {
    const next = new Set(now);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="labels-page">
      <aside className="labels-side">
        <NavLink to={`/exhibitions/${code}/works`} className="labels-back">← Published works</NavLink>
        <div>
          <h1 className="labels-title">Print labels</h1>
          <p className="labels-subtitle">{exhibition.title}</p>
        </div>

        <fieldset className="labels-field">
          <legend>Size</legend>
          <div className="size-options">
            {(Object.keys(SIZES) as Size[]).map((key) => {
              const option = SIZES[key];
              return (
                <label key={key} className="size-option">
                  <input type="radio" name="label-size" value={key} checked={size === key} onChange={() => setSize(key)} />
                  {/* A small A4 with its grid of labels. */}
                  <span className="size-option__sheet" style={{ gridTemplateColumns: `repeat(${option.columns}, 1fr)` }} aria-hidden>
                    {Array.from({ length: option.columns * option.rows }, (_, n) => <span key={n} />)}
                  </span>
                  <span className="size-option__text">
                    <span className="size-option__name">{option.name}</span>
                    <span className="size-option__detail">{option.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="labels-field" role="group" aria-labelledby="labels-artworks">
          <div className="labels-field__head">
            <span id="labels-artworks" className="labels-field__label">Artworks</span>
            {!!artworks?.length && (
              <button type="button" className="labels-all" onClick={() => setChosen(new Set(allChosen ? [] : artworks.map((a) => a.id)))}>
                {allChosen ? "Clear" : "Select all"}
              </button>
            )}
          </div>
          <ul className="labels-list">
            {(artworks ?? []).map((a) => (
              <li key={a.id}>
                <label>
                  <input type="checkbox" checked={!!chosen?.has(a.id)} onChange={() => toggle(a.id)} />
                  <span>{a.title || "Untitled artwork"}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <label className="labels-check">
          <input type="checkbox" checked={cutLines} onChange={(e) => setCutLines(e.target.checked)} />
          <span>Cut lines</span>
        </label>

        <div className="labels-foot">
          <p className="labels-summary">{plural(picked.length, "label", "labels")} on {plural(sheets.length, "A4 sheet", "A4 sheets")}</p>
          <button type="button" className="btn btn--primary labels-print" disabled={!picked.length} onClick={() => window.print()}>
            {picked.length ? `Print ${plural(picked.length, "label", "labels")}` : "Choose an artwork to print"}
          </button>
          <p className="labels-hint">In the print dialog, choose A4 at 100% scale so every code keeps its size.</p>
        </div>
      </aside>

      <main className="labels-main" aria-label="Print preview">
        {artworks === undefined ? <p className="labels-loading">Loading…</p> : (
          <div className={`label-sheets label-sheets--${size}${cutLines ? " has-cut-lines" : ""}`}>
            {sheets.map((sheet, n) => (
              <section key={n} className="sheet" aria-label={`Sheet ${n + 1} of ${sheets.length}`}>
                {sheet.map((a) => <Label key={a.id} exhibition={exhibition} artwork={a} />)}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** One label: the exhibition, the artwork's title (so whoever posts it knows where it goes), its QR and its address. */
function Label({ exhibition, artwork }: { exhibition: Exhibition; artwork: ContentItem }) {
  const [src, setSrc] = useState<string | null>(null);
  const id = short(artwork);
  const title = artwork.title || "Untitled artwork";
  useEffect(() => {
    let current = true;
    qrSources(exhibition.code, guideUrl(exhibition.code, id), apiMode === "mock", id).then((q) => { if (current) setSrc(q.svg); }, () => {});
    return () => { current = false; };
  }, [exhibition.code, id]);
  return (
    <div className="label">
      <p className="label__exhibition">{exhibition.title}</p>
      <p className="label__title">{title}</p>
      {src ? <img className="label__qr" src={src} alt={`QR code for ${title}`} /> : <span className="label__qr" aria-hidden />}
      <p className="label__scan">Scan for this work's story</p>
      <p className="label__url">{visitorUrl(exhibition.code, id)}</p>
    </div>
  );
}
