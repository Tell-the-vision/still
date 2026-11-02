/**
 * Client-side PNG export of a keepsake card (KEEPSAKE-04 / 05).
 * Uses html-to-image so the PNG is a faithful raster of the DOM card.
 */
import { toPng } from "html-to-image";
import { KEEPSAKE_CARD } from "@/lib/keepsake-templates";

async function waitForFonts() {
  try {
    await document.fonts?.ready;
  } catch {
    /* ignore */
  }
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

export async function renderCardToPng(node: HTMLElement): Promise<string> {
  await waitForFonts();
  await waitForImages(node);
  return toPng(node, {
    pixelRatio: KEEPSAKE_CARD.exportPixelRatio,
    width: KEEPSAKE_CARD.width,
    height: KEEPSAKE_CARD.height,
    // No `backgroundColor` option: html-to-image would paint it over the
    // card's own (theme) background and dark themes would export white.
    cacheBust: true,
    // The node may be displayed scaled down; export at its intrinsic size.
    style: { transform: "none" },
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function keepsakeFilename(title: string, date: string) {
  const safe = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "keepsake";
  return `STILL-${safe}-${date.replaceAll(".", "")}.png`;
}
