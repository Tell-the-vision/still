// Fixed UI vocabularies from the Figma frames. Move to the server if curators need to edit them.
export const MATERIAL_TAGS = ["Exhibition text", "Artwork list", "Wall labels", "Audio script", "Press kit"];
export const THEME_OPTIONS = ["Overview", "Life & Death", "Science & Medicine", "Beauty & Fragility", "Faith & Belief"];
export const CONTENT_TYPE_OPTIONS = ["Guide sentence", "Section text", "Artwork caption", "Narration", "Editorial copy"];
// Initial upload formats from the developer handoff (2. End-to-end workflow, Bulk upload).
// HWP/HWPX and web URLs need technical validation before they are offered. The server must check
// the type too; `accept` only filters the file picker, not drag and drop.
export const UPLOAD_EXTENSIONS = ["pdf", "docx", "xlsx", "csv", "txt", "md"];
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",");
export const UPLOAD_FORMATS_LABEL = "PDF, DOCX, XLSX, CSV, TXT";
export const UPLOAD_MAX_BYTES = 100e6;
