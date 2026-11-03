import type { ContentPackage } from "../../src/server/db/seed/content";
import { keptSentence, softDeleteExhibition } from "./content-soft-delete";

const pkg: ContentPackage = {
  institution: { code: "still-museum", name: "Still Museum" },
  venues: [{ code: "seoul-hall", name: "Seoul Hall", city: "Seoul" }],
  exhibitions: [softDeleteExhibition([keptSentence])],
};

export default pkg;
