// The Game plan's images (Admin's uploads: /media/<key>.png|.jpg, and each one's JPEG XL when there is one),
// copied into the link folder's media/ so the relay can serve them to the projector with no internet. Each file
// once: they are immutable. Used by the link (on every cloud.plan) and by `npm run media -- plan` (a laptop's
// setup, which fetches the plan without connecting as the show laptop).
import fs from 'node:fs';
import path from 'node:path';
import { LINK } from '../src/config.ts';

export interface PlanMediaOptions {
  /** The cloud's https origin. */
  base: string;
  headers: Record<string, string>;
  /** The link folder (data/link/); the images go in its media/. */
  dataDir: string;
  log: (line: string) => void;
}

/** The fallback paths (`/media/<key>.png|.jpg|.webp`) a plan uses, wherever they are in it. */
export function planMediaPaths(plan: unknown): string[] {
  return [...new Set(JSON.stringify(plan ?? null).match(/\/media\/[0-9a-f]{32}\.(?:png|jpg|webp)/g) ?? [])];
}

/** Fetch the images the plan uses that aren't here yet; answers how many files were fetched. */
export async function fetchPlanMedia(plan: unknown, o: PlanMediaOptions): Promise<number> {
  const dir = path.join(o.dataDir, 'media');
  let fetched = 0;
  for (const fallback of planMediaPaths(plan)) {
    const key = fallback.slice('/media/'.length, '/media/'.length + 32);
    for (const [url, name, type] of [[fallback, path.basename(fallback), null], [`/media/${key}.jxl`, `${key}.jxl`, 'image/jxl']] as const) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) continue;
      try {
        const res = await fetch(`${o.base}${url}`, { headers: o.headers, signal: AbortSignal.timeout(LINK.mediaFetchTimeoutMs) });
        // A .jxl with none uploaded yet answers with the fallback: keep only a real JPEG XL (the relay falls back too).
        if (!res.ok || (type && !(res.headers.get('content-type') ?? '').startsWith(type))) continue;
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${file}.tmp`, Buffer.from(await res.arrayBuffer()));
        fs.renameSync(`${file}.tmp`, file);
        fetched += 1;
      } catch (error) {
        o.log(`cloud: could not fetch ${url}: ${String(error)}`);
      }
    }
  }
  if (fetched > 0) o.log(`cloud: ${fetched} image(s) of the Game plan kept in ${dir}`);
  return fetched;
}
