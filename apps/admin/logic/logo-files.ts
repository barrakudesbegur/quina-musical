// A folder of cleaned logos (the logo tool's PNG + JXL pairs, or plain PNGs) turned into uploads: each
// `<slug>.png` (or .jpg) goes with its `<slug>.jxl` when there is one. Anything else is skipped and named, and a
// JXL without its fallback is skipped too (the cloud needs the fallback first). Pure.

export interface LogoPair<F> {
  /** The file name without its extension: the library name. */
  slug: string;
  fallback: F;
  jxl: F | null;
}

export interface Paired<F> {
  pairs: LogoPair<F>[];
  /** Files that won't be uploaded, by name. */
  skipped: string[];
}

const FALLBACK = /\.(png|jpe?g)$/i;
const JXL = /\.jxl$/i;

export function pairLogoFiles<F extends { name: string }>(files: readonly F[]): Paired<F> {
  const fallbacks = new Map<string, F>();
  const jxls = new Map<string, F>();
  const skipped: string[] = [];
  for (const f of files) {
    const base = f.name.replace(/^.*[\\/]/, '');
    if (FALLBACK.test(base)) fallbacks.set(base.replace(FALLBACK, ''), f);
    else if (JXL.test(base)) jxls.set(base.replace(JXL, ''), f);
    else skipped.push(base);
  }
  for (const slug of jxls.keys()) if (!fallbacks.has(slug)) skipped.push(`${slug}.jxl`);
  const pairs = [...fallbacks].map(([slug, fallback]) => ({ slug, fallback, jxl: jxls.get(slug) ?? null })).sort((a, b) => a.slug.localeCompare(b.slug));
  return { pairs, skipped };
}
