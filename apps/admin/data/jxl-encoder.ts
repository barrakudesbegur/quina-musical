// Admin's JPEG XL encoder, for the user's image rule: JPEG XL where the browser reads it, with a PNG
// fallback, never WebP. Browsers can't encode JPEG XL and the cloud's Worker can't either (its CPU limit), so
// Admin bundles Squoosh's WASM encoder (@jsquash/jxl) and loads it only when a logo is uploaded. It runs
// single-threaded (the page isn't cross-origin isolated), which is plenty for a 512 px logo. Never throws: it
// answers null when it can't, and the cloud then serves the PNG at the .jxl path too.

/** Lossy at this quality: logos are flat colour and text, so this stays crisp and well under the PNG's size. */
const QUALITY = 90;

/** A PNG (or JPEG) as a JPEG XL, or null when this browser can't do it. */
export async function encodeJxl(image: Blob): Promise<Blob | null> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    const bitmap = await createImageBitmap(image);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { default: encode } = await import('@jsquash/jxl/encode');
    const bytes = await encode(pixels, { quality: QUALITY });
    return bytes.byteLength ? new Blob([bytes], { type: 'image/jxl' }) : null;
  } catch {
    return null;
  }
}
