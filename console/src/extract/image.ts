import { finish, type ExtractContext, type Extraction, type ManifestAsset } from "./manifest";

// The copy people see is an sRGB WebP whose long side is at most 2400 px, never larger than the original
// (SPEC §9.4 이미지 표시).
const DISPLAY_MAX_SIDE = 2400;

// A picture file (SPEC §9.4 추출, 이미지): the file itself, byte for byte, is its one asset, with the copy shown to
// people next to it. Drawing that copy applies the EXIF orientation and converts to sRGB. The picture is the file's
// single page, and it has no text.
export async function extractImage(file: File, mediaType: string, extension: string, context: ExtractContext): Promise<Extraction> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("This browser cannot read the picture. Save it as JPG or PNG and try again.");
  });
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, DISPLAY_MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const display = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!display) throw new Error("The picture could not be prepared for display.");

    const asset: ManifestAsset = {
      id: "a01",
      kind: "FILE",
      object: `assets/a01.${extension}`,
      display: "assets/a01.display.webp",
      format: mediaType,
      pixels: [width, height],
      sha256: context.sha256, // the asset is the file itself
      placements: [{ page: 1, bbox: [0, 0, width, height] }],
    };
    return {
      manifest: finish(context, mediaType, [{ page: 1, size: [width, height] }], [], [], [asset]),
      files: [{ name: asset.object, blob: file }, { name: asset.display, blob: display }],
    };
  } finally {
    bitmap.close();
  }
}
