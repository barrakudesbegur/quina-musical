// Images, as the user decided: JPEG XL where the browser reads it, with a PNG (logos, pictures) or JPEG
// (covers) fallback, and never WebP. Media uploaded through Admin live at `/media/<key>.png|.jpg`, and
// `/media/<key>.jxl` always answers (the JPEG XL, or the fallback's own bytes when there is none), so a
// `<picture>` built from these sources never breaks. Pure.

export interface ImageSources {
  /** The JPEG XL to offer first (`<source type="image/jxl">`), or null when there is none to offer. */
  jxl: string | null;
  /** The fallback every browser reads (`<img src>`). */
  src: string;
}

/** The sources for a stored image path. Only uploaded media get a JPEG XL; anything else (a data URL during
 * editing, an older path) is shown as it is. */
export function imageSources(path: string): ImageSources {
  const media = /^(\/media\/[^/?#]+)\.(png|jpe?g)$/i.exec(path);
  return { jxl: media ? `${media[1]}.jxl` : null, src: path };
}
