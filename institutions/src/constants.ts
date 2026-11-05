// Fixed UI vocabularies from the Figma frames. Move to the server if curators need to edit them.
export const MATERIAL_TAGS = ["Exhibition text", "Artwork list", "Wall labels", "Audio script", "Press kit"];
export const THEME_OPTIONS = ["Overview", "Life & Death", "Science & Medicine", "Beauty & Fragility", "Faith & Belief"];
export const CONTENT_TYPE_OPTIONS = ["Guide sentence", "Section text", "Artwork caption", "Narration", "Editorial copy"];
// Upload formats of SPEC §9.4 (mirrors DOCUMENT_FORMATS in shared/src/console.ts; this bundle does not import
// the server package). CSV and MD are not in the SPEC (미결정 27); ZIP needs browser-side unpacking that is not
// built yet. HWP/HWPX and web URLs are not supported. The server checks the type too; `accept` only filters
// the file picker, not drag and drop.
export const UPLOAD_FORMATS: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};
export const UPLOAD_EXTENSIONS = Object.keys(UPLOAD_FORMATS);
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",");
export const UPLOAD_FORMATS_LABEL = "PDF, DOCX, XLSX, PPTX, TXT, JPG, PNG, TIFF, WebP";
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

// Optional convenience only (handoff 4.1): museums never have to use it.
export const ARTWORK_TEMPLATE_CSV =
  "title,artist,year,medium,dimensions,credit_line,description,image_file,copyright_holder,usage_permission,usage_scope,permission_expires\n" +
  "Untitled,Artist Name,2024,Oil on canvas,100 x 80 cm,Collection of the artist,Short description for the guide.,artwork-01.jpg,Artist Name,granted,Digital guide during the exhibition,2027-03-28\n";
