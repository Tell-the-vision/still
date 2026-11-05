import type { ReactNode } from "react";
import { PlaylistRow } from "../audio/GuidePlaylist";
import { KeepsakePresence } from "../keepsake/KeepsakePresence";
import { DocumentView } from "../../ui/DocumentView";
import { Rule } from "../../ui/Rule";
import type { KeepableSentence, StillDoc } from "../../ui/StillDocView";
import { JournalLink } from "./JournalLink";
import { keepsakePageOf } from "./pages";

type Exhibition = Parameters<typeof KeepsakePresence>[0]["exhibition"];
/**
 * One page of a guide: a single document standing on its own, under its own title (an artwork, an artist, anything
 * the museum writes), with a "+" beside each line to keep and any playlist the museum put in it. Below it, the
 * page's keepsake (made from its own lines and picture) and the journal.
 * Visitors open it from the QR posted beside the work (/e/{code}/{page}); the console's phone preview draws the same.
 */
export function GuidePage({ code, page, exhibition, document, renderSentence }: {
  code: string;
  /** The first 8 characters of the page's content id. */
  page: string;
  exhibition: Exhibition;
  document: StillDoc;
  renderSentence: (sentence: KeepableSentence, quote: ReactNode) => ReactNode;
}) {
  return (
    <>
      <DocumentView
        document={document}
        renderSentence={renderSentence}
        renderPlaylist={(playlist) => <PlaylistRow code={code} playlist={{ ...playlist, provider: playlist.url.startsWith("https://open.spotify.com/") ? "SPOTIFY" : "APPLE_MUSIC" }} />}
      />
      <Rule />
      <KeepsakePresence code={code} exhibition={exhibition} hasGuide page={keepsakePageOf(document, page)} />
      <JournalLink code={code} />
    </>
  );
}
