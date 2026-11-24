// The logo clean-up's browser side: decode an uploaded image into pixels, and turn cleaned pixels into a
// resized PNG data URL (its JPEG XL is made when it's uploaded). The pixel work itself is pure, in
// logic/logo-pixels.ts.
import { makePixels, type Pixels } from '../logic/logo-pixels.ts';
import { base64Bytes } from '../logic/plan-check.ts';
import { LOGO_CONFIG } from '../config.ts';

/** Logos are PNG: the fallback next to their JPEG XL (never WebP, the user's rule). */
export type LogoFormat = 'image/png';

export interface EncodedLogo {
  dataUrl: string;
  format: LogoFormat;
  /** Decoded size in bytes. */
  bytes: number;
  width: number;
  height: number;
}

function canvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, width);
  c.height = Math.max(1, height);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  return { canvas: c, ctx };
}

/** Decode an image file into RGBA pixels, scaled down first when its longest side is over `maxSide`. */
export async function readImageFile(file: Blob, maxSide: number = LOGO_CONFIG.maxSourceSide): Promise<Pixels> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const { ctx } = canvas(width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    return makePixels(width, height, image.data);
  } finally {
    bitmap.close();
  }
}

/** Pixels → a canvas of their own size. */
function toCanvas(p: Pixels): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(p.width, p.height);
  const image = ctx.createImageData(p.width, p.height);
  image.data.set(p.data);
  ctx.putImageData(image, 0, 0);
  return c;
}

/** Resize in halving steps (sharper than one big jump), then draw at the exact target size. */
function resized(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  let current = source;
  while (current.width / 2 >= width && current.height / 2 >= height) {
    const { canvas: half, ctx } = canvas(Math.round(current.width / 2), Math.round(current.height / 2));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  if (current.width === width && current.height === height) return current;
  const { canvas: out, ctx } = canvas(width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, 0, 0, width, height);
  return out;
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality));

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });

/** Cleaned pixels → a PNG data URL at `size` (its JPEG XL is made when it's uploaded). */
export async function encodeLogo(p: Pixels, size: { width: number; height: number }): Promise<EncodedLogo> {
  const out = resized(toCanvas(p), size.width, size.height);
  const blob = await toBlob(out, 'image/png');
  if (!blob) throw new Error('canvas could not encode the logo');
  const dataUrl = await toDataUrl(blob);
  const format: LogoFormat = 'image/png';
  return { dataUrl, format, bytes: base64Bytes(dataUrl.slice(dataUrl.indexOf(',') + 1)), width: out.width, height: out.height };
}
