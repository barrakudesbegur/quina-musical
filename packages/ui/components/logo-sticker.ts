// G4 · a sponsor's logo made into its die-cut sticker in the browser (D287): the logo's own fallback image (its PNG or
// JPEG, never its JPEG XL, which not every canvas reads) drawn into a canvas, cut by die-cut.ts, kept as an object URL
// with the cut's shape for the collage's packing. Each logo once per page (memoised by its path); the logo's pixels are never changed, only
// the white backing is added (the Orchestrator's rule, 28 Nov). Admin's /media/ paths are same-origin on the cloud and
// on the relay, so the canvas may read them.
import { dieCut, type Point } from './die-cut.ts';

export interface LogoSticker {
  /** The sticker as an image (object URL of a PNG). */
  url: string;
  /** Its width ÷ height. */
  aspect: number;
  /** The cut's convex hull in its box, 0–1 (the collage packs by it). */
  hull: Point[];
}

const made = new Map<string, Promise<LogoSticker | null>>();

/** The sticker for a logo path (`/media/<key>.png`, or a data URL), made once; null if the logo can't be read. */
export function logoSticker(src: string): Promise<LogoSticker | null> {
  let job = made.get(src);
  if (!job) {
    job = make(src).catch(() => null);
    made.set(src, job);
  }
  return job;
}

async function make(src: string): Promise<LogoSticker | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) return null;
  const canvas = new OffscreenCanvas(w, h);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(img, 0, 0);
  const cut = dieCut(context.getImageData(0, 0, w, h));
  if (!cut.pixels.width) return null;
  const out = new OffscreenCanvas(cut.pixels.width, cut.pixels.height);
  out.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(cut.pixels.data), cut.pixels.width, cut.pixels.height), 0, 0);
  const blob = await out.convertToBlob({ type: 'image/png' });
  return { url: URL.createObjectURL(blob), aspect: cut.pixels.width / cut.pixels.height, hull: cut.hull };
}
