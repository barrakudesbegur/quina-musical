// The sponsors' logos for an edition's plan (D235: "just make sure it at least shows something"; cleaning them is the
// user's, later): each file shrunk with sips to the cloud's limit, uploaded to the cloud's image store
// (POST /api/media, stored by content hash, so an upload twice is stored once), and its /media/ path put in the
// plan's sponsor. PNG stays PNG and JPEG stays JPEG; a file without an extension is recognised by its bytes.
// Where logos live for good is U71.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The cloud's limit for an uploaded fallback image (CLOUD.media.maxBytes). */
export const MAX_LOGO_BYTES = 300 * 1024;
/** Longest side tried in turn until the file fits: logos show at most a few hundred px wide. */
const SIZES_PX = [512, 384, 256] as const;

export type ImageType = 'image/png' | 'image/jpeg';

/** PNG or JPEG by the file's first bytes (some logos come without an extension), or null for anything else. */
export function imageType(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

export interface PreparedLogo {
  bytes: Uint8Array;
  type: ImageType;
  /** The longest side it was shrunk to (sips -Z only shrinks, so a smaller logo keeps its size). */
  sizePx: number;
}

/** The logo as the cloud takes it: at most MAX_LOGO_BYTES, its longest side at most 512 px. Null for an unknown type. */
export function prepareLogo(file: string): PreparedLogo | null {
  const original = new Uint8Array(fs.readFileSync(file));
  const type = imageType(original);
  if (!type) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-logo-'));
  try {
    const format = type === 'image/png' ? 'png' : 'jpeg';
    for (const size of SIZES_PX) {
      const out = path.join(dir, `logo-${size}.${format === 'png' ? 'png' : 'jpg'}`);
      const options = format === 'jpeg' ? ['-s', 'formatOptions', '82'] : [];
      // -Z only ever shrinks; sips reads the type from the bytes, so a name without an extension is fine.
      execFileSync('sips', ['-Z', String(size), '-s', 'format', format, ...options, file, '--out', out], { stdio: 'ignore' });
      const bytes = new Uint8Array(fs.readFileSync(out));
      if (bytes.length <= MAX_LOGO_BYTES) return { bytes, type, sizePx: size };
    }
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export interface LogoUpload {
  sponsorId: string;
  file: string;
  /** The /media/ path the plan names, once uploaded. */
  path: string | null;
  bytes: number;
  problem: string | null;
}

/**
 * Upload each sponsor's logo (`files`: sponsor id → file) and return the paths. Without `yes`, only prepares them
 * and says what would go up. `post` sends one image and answers its /media/ path.
 */
export async function uploadLogos(
  files: ReadonlyMap<string, string>,
  o: { yes: boolean; post: (bytes: Uint8Array, type: ImageType, name: string) => Promise<string>; log?: (line: string) => void },
): Promise<LogoUpload[]> {
  const log = o.log ?? console.log;
  const out: LogoUpload[] = [];
  for (const [sponsorId, file] of files) {
    if (!fs.existsSync(file)) {
      out.push({ sponsorId, file, path: null, bytes: 0, problem: 'no such file' });
      continue;
    }
    const logo = prepareLogo(file);
    if (!logo) {
      out.push({ sponsorId, file, path: null, bytes: 0, problem: `not a PNG or JPEG, or still over ${MAX_LOGO_BYTES / 1024} KB at 256 px` });
      continue;
    }
    const at = o.yes ? await o.post(logo.bytes, logo.type, sponsorId) : null;
    out.push({ sponsorId, file, path: at, bytes: logo.bytes.length, problem: null });
    log(`${o.yes ? 'uploaded' : 'would upload'} ${sponsorId}: ${path.basename(file)} → ${(logo.bytes.length / 1024).toFixed(0)} KB ${logo.type}${at ? ` at ${at}` : ''}`);
  }
  return out;
}
