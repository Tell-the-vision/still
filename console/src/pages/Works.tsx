import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams } from "react-router-dom";
import { AccountMenu } from "../AccountMenu";
import { apiMode, type ContentItem, type Exhibition } from "../api";
import { qrSources } from "../api/qr";
import { formatPeriod, guideUrl, libraryStatus, visitorUrl, type LibraryStatus } from "../format";
import { short, useLiveArtworks } from "../liveArtworks";
import { useWorkspace } from "../store";

const STATUS_LABEL: Record<LibraryStatus, string> = { live: "Live", scheduled: "Scheduled", ended: "Ended", draft: "Draft" };

/** Where an exhibition is held: "Demo Hall, Seoul". */
const whereOf = (e: Exhibition) => [e.venueName, e.venueCity].filter(Boolean).join(", ") || "No venue yet";

/** /published, from before works were kept per exhibition: the current exhibition's works. */
export function PublishedRedirect() {
  const { exhibition } = useWorkspace();
  return <Navigate to={exhibition ? `/exhibitions/${exhibition.code}/works` : "/"} replace />;
}

/**
 * An exhibition's works (/exhibitions/{code}/works): where and when it is held, its theme below, then every artwork
 * live in its guide with its own QR (SPEC §1.2), which the organisers print and post beside each work by hand. Each
 * artwork stands on its own: opening one to edit takes it out of the guide. Print labels opens the label sheets
 * (Labels.tsx).
 */
export default function Works() {
  const { code } = useParams();
  const { exhibitions, exhibition: current, items, selectExhibition, unpublishArtwork } = useWorkspace();
  const exhibition = exhibitions.find((e) => e.code === code) ?? null;
  const published = exhibition?.status === "PUBLISHED";
  const works = useLiveArtworks(exhibition && published ? [exhibition] : []);
  const artworks = exhibition ? works[exhibition.id] : undefined;

  // The address names the exhibition: it becomes the one the editor works on, as on /exhibitions/{code}/{artwork}.
  useEffect(() => { if (exhibition && exhibition.id !== current?.id) selectExhibition(exhibition.id); }, [exhibition?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!exhibition) return exhibitions.length ? <Navigate to="/" replace /> : null;
  const status = libraryStatus(exhibition);
  // Taking an artwork out works on the editor's copy of it, which loads once the exhibition is the current one.
  const loaded = current?.id === exhibition.id ? new Set(items.map((i) => i.id)) : new Set<string>();

  return (
    <div className="published-page">
      <header className="published-page__head">
        <NavLink to="/" className="wordmark">STILL.</NavLink>
        <AccountMenu className="account-menu--rail" />
      </header>
      <main className="published-page__body">
        <NavLink to={`/exhibitions/${exhibition.code}`} className="published-page__back">← Editor</NavLink>
        <p className="published-page__status">
          <span className={`switcher__dot switcher__dot--${status}`} aria-hidden />
          {STATUS_LABEL[status]}
        </p>
        <h1 className="published-page__where">
          <span>{whereOf(exhibition)}</span>
          <span aria-hidden>·</span>
          <span>{formatPeriod(exhibition.startDate, exhibition.endDate)}</span>
        </h1>
        <div className="works-intro">
          {/* The exhibition's theme. */}
          <div>
            <p className="published-page__theme">{exhibition.title}</p>
            {exhibition.subtitle && <p className="published-page__subtitle">{exhibition.subtitle}</p>}
          </div>
          {!!artworks?.length && <Link className="btn btn--primary" to={`/exhibitions/${exhibition.code}/labels`}>Print labels</Link>}
        </div>

        {!published ? (
          <p className="published-page__empty">No artwork is live. Approve artworks in the editor and press Publish All; each one then gets its own QR here.</p>
        ) : (
          <section className="works-exhibition" aria-label="Published works">
            {artworks === undefined && <p className="published-page__empty">Loading…</p>}
            {artworks?.length === 0 && <p className="published-page__empty">No artwork is live in this guide yet.</p>}
            {!!artworks?.length && (
              <ul className="works-grid" aria-label={`Artworks live in ${exhibition.title}`}>
                {artworks.map((a) => (
                  <ArtworkQr key={a.id} exhibition={exhibition} artwork={a} onEdit={loaded.has(a.id) ? () => unpublishArtwork(a.id) : undefined} />
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * One artwork's QR: Print opens the label sheets with only this one, to reprint a lost label. Its title takes it out
 * of the guide and opens it in the editor, to edit it and publish it again (`onEdit`, absent until the editor's copy
 * of the artwork has loaded).
 */
function ArtworkQr({ exhibition, artwork, onEdit }: { exhibition: Exhibition; artwork: ContentItem; onEdit?: () => Promise<void> }) {
  const navigate = useNavigate();
  const [qr, setQr] = useState<{ png: string; svg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const id = short(artwork);
  const title = artwork.title || "Untitled artwork";
  const editorUrl = `/exhibitions/${exhibition.code}/${id}`;
  useEffect(() => {
    let current = true;
    qrSources(exhibition.code, guideUrl(exhibition.code, id), apiMode === "mock", id).then((q) => { if (current) setQr(q); }, () => {});
    return () => { current = false; };
  }, [exhibition.code, id]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(guideUrl(exhibition.code, id)); } catch { /* clipboard blocked */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  // A failure shows in the error banner and the artwork stays live.
  const edit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onEdit || leaving) return;
    setLeaving(true);
    try {
      await onEdit();
      navigate(editorUrl);
    } catch {
      setLeaving(false);
    }
  };

  return (
    <li className={`works-card${leaving ? " is-leaving" : ""}`} aria-busy={leaving}>
      {qr ? <img className="works-card__qr" src={qr.svg} alt={`QR code for ${title}`} /> : <span className="works-card__qr works-card__qr--loading" aria-label="Loading QR code" />}
      <Link className="works-card__title" to={editorUrl} onClick={edit} aria-disabled={!onEdit} title="Take it out of the guide and edit it">{title}</Link>
      <span className="works-card__url">{leaving ? "Taking it out of the guide…" : visitorUrl(exhibition.code, id)}</span>
      <span className="works-card__actions">
        <Link className="link-btn link-btn--strong" to={`/exhibitions/${exhibition.code}/labels?artwork=${id}`}>Print</Link>
        <a className="link-btn" href={qr?.png} download={`${exhibition.code}-${id}-qr.png`} aria-disabled={!qr}>PNG</a>
        <a className="link-btn" href={qr?.svg} download={`${exhibition.code}-${id}-qr.svg`} aria-disabled={!qr}>SVG</a>
        <button type="button" className="link-btn" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
      </span>
    </li>
  );
}
