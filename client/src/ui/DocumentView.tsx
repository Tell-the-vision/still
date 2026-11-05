import type { ReactNode } from "react";
import type { ExpandedDocument } from "@still/shared/document";
import { StillDocView, isStillDoc, type KeepableSentence, type StillDoc } from "./StillDocView";

// Renders a served document (SPEC §9, §11.8). Every served document is a STILL document now; the old
// `blocks` form is no longer produced by the server, so there is nothing else to render.
export function DocumentView({
  document,
  renderSentence,
}: {
  document: ExpandedDocument | StillDoc | null;
  renderSentence?: (sentence: KeepableSentence, quote: ReactNode) => ReactNode;
}) {
  if (!isStillDoc(document)) return null;
  return <StillDocView document={document} renderSentence={renderSentence} />;
}
