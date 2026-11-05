import { router } from "../../init";
import { consoleAnalysisRouter } from "./analysis";
import { consoleContentRouter } from "./content";
import { consoleDocumentRouter } from "./document";
import { consoleDocumentUploadRouter } from "./documentUpload";
import { consoleDraftRouter } from "./draft";
import { consoleExhibitionRouter } from "./exhibition";
import { consoleImageRouter } from "./image";
import { consolePreviewRouter } from "./preview";
import { consolePublicationRouter } from "./publication";
import { consoleSessionRouter } from "./session";
import { consoleSuggestionRouter } from "./suggestion";
import { consoleVenueRouter } from "./venue";

// Institution console: an institution's staff build and publish their own exhibitions (SPEC §9.3–9.5).
export const consoleRouter = router({
  analysis: consoleAnalysisRouter,
  content: consoleContentRouter,
  document: consoleDocumentRouter,
  documentUpload: consoleDocumentUploadRouter,
  draft: consoleDraftRouter,
  exhibition: consoleExhibitionRouter,
  image: consoleImageRouter,
  preview: consolePreviewRouter,
  publication: consolePublicationRouter,
  session: consoleSessionRouter,
  suggestion: consoleSuggestionRouter,
  venue: consoleVenueRouter,
});
