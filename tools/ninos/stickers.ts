// The ninos' sticker versions (components-v2.md F1; the user's canvas comment #86, D-u): each brand doodle
// (brand/ninos/figures/nino-<pose>.svg, black outline on white) becomes a game-style sticker in
// packages/ui/assets/ninos/: the figure's body in one flat palette colour, its details (eyes, props) in white, an
// ink outline (#17132B) at the doodle's own two weights (32 body, 24 details), and a white sticker border round
// everything (76 / 68, so 22 px of white shows beyond the outline), on a canvas grown 40 px each side for it. The
// screens add the drop shadow (--sticker-drop) and the tint (hue-rotate) in CSS.
//
// This is the treatment the first nine stickers had (made by hand on 24 Nov). It also keeps the files small: each
// path is written once in <defs> and drawn twice by <use> (border, then ink), and coordinates keep one decimal
// (invisible at a ~700-unit figure). Run it again after changing the list:
//
//   node tools/ninos/stickers.ts          # writes packages/ui/assets/ninos/*.svg
//   node tools/ninos/stickers.ts --check  # fails if a sticker is out of date
//
// Never nino-sexe; not the drinking ones (nino-beguda*, nino-paracaigudes-cervesa, nino-helicopter-gin): brand/ninos'
// README. Which poses ship, and their colours, is the list below; which moment shows which is NINO_FOR
// (packages/ui/concepts.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIGURES = `${ROOT}brand/ninos/figures/`;
const OUT = `${ROOT}packages/ui/assets/ninos/`;
const INK = '#17132B';
const WHITE = '#FFFFFF';
const PAD = 40;

/** The palette's fills (packages/ui/tokens.css), by name. */
const FILL = {
  orange: '#FF8200',
  red: '#E8363D',
  green: '#23A55A',
  gold: '#FFC531',
  cyan: '#5CC8FF',
  purple: '#B57BFF',
  pink: '#FF4FA3',
  live: '#3EE07F',
} as const;

/** How a detail path is filled: white (eyes, props: the default), none (an open line that would fill a wedge), ink. */
type DetailFill = 'white' | 'none' | 'ink';

interface StickerSpec {
  /** The body's colour (every 32-weight path). */
  readonly color: keyof typeof FILL;
  /** Detail paths (24-weight, by their order in the doodle, 0-based) filled otherwise than white. */
  readonly details?: Readonly<Record<number, DetailFill>>;
  /** 32-weight paths (0-based, in order) that are props, not the body: drawn white like details. */
  readonly props?: readonly number[];
}

/**
 * The poses that ship. The first nine are the stickers of 24 Nov (same colours); the rest came with #86. The brand
 * files carry Figma layer numbers, which give the order the doodles were drawn in: the first set (Vector 8–45: alt-1…3,
 * cabezon, mans-adalt, salt-cames-obertes, sentat, xocantla…: plain blobs), a second (Vector 126–197: caiguent,
 * basket, confeti, peix, mag, snorkel…: with props) and the newest (Vector 216+: bikini, capita, cuiner, angel,
 * dimoni, meditant, afro, ballet, sardana, astronauta, rosa, espatxarrat-efecte…: lighter, more detailed). The user
 * prefers the newest (#86), so they're all here bar the drinking ones and the skier (a tiny figure in a huge scene).
 */
export const STICKERS: Readonly<Record<string, StickerSpec>> = {
  // the first nine (24 Nov)
  'alt-2': { color: 'gold' },
  confeti: { color: 'gold' },
  'fent-una-torre': { color: 'orange' },
  'mans-adalt': { color: 'orange' },
  meditant: { color: 'cyan' },
  'salt-cames-obertes': { color: 'red' },
  sardana: { color: 'red' },
  sentat: { color: 'green' },
  xocantla: { color: 'green' },
  // moved from apps/stage/assets (the failed Check's squashed nino, D72)
  espatxarrat: { color: 'cyan' },
  // the newest set (#86)
  afro: { color: 'purple' },
  angel: { color: 'cyan', props: [2] },
  astronauta: { color: 'orange' },
  ballet: { color: 'pink' },
  'ballet-2': { color: 'purple' },
  bikini: { color: 'orange' },
  capita: { color: 'cyan' },
  cuiner: { color: 'green' },
  dimoni: { color: 'red' },
  'espatxarrat-efecte': { color: 'pink' },
  rosa: { color: 'gold' },
  'sardana-alt': { color: 'purple' },
  // the second set's best (#86)
  basket: { color: 'orange' },
  caiguent: { color: 'cyan' },
  mag: { color: 'purple' },
  peix: { color: 'cyan' },
  snorkel: { color: 'gold' },
};

interface SourcePath {
  readonly d: string;
  readonly weight: number;
  readonly black: boolean;
}

/** The doodle's paths in drawing order. The brand files are flat Figma exports: <path> only, no transforms. */
export function readPaths(svg: string): { width: number; height: number; paths: SourcePath[] } {
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!box) throw new Error('no 0-origin viewBox');
  if (/<(?:circle|ellipse|rect|line|polyline|polygon|image|use)\b|transform=/.test(svg)) throw new Error('unexpected element or transform');
  const paths = [...svg.matchAll(/<path\b([^>]*)\/?>/g)].map(([, attrs]) => {
    const d = / d="([^"]+)"/.exec(attrs)?.[1];
    const weight = Number(/stroke-width="([\d.]+)"/.exec(attrs)?.[1] ?? NaN);
    if (!d || !Number.isFinite(weight)) throw new Error(`path without d or stroke-width: ${attrs.slice(0, 80)}`);
    return { d, weight, black: /fill="black"/.test(attrs) };
  });
  return { width: Number(box[1]), height: Number(box[2]), paths };
}

/** One decimal, no trailing zeros, no leading zero: "12.30" → "12.3", "-0.5" → "-.5". */
export function roundPath(d: string): string {
  return d
    .replace(/-?\d*\.?\d+(?:e-?\d+)?/g, (n) => {
      const r = Math.round(Number(n) * 10) / 10;
      const s = String(Object.is(r, -0) ? 0 : r);
      return s.replace(/^(-?)0\./, '$1.');
    })
    .replace(/\s*([A-Za-z])\s*/g, '$1')
    .replace(/ -/g, '-');
}

export function sticker(svg: string, spec: StickerSpec): string {
  const { width, height, paths } = readPaths(svg);
  const fill = FILL[spec.color];
  const defs: string[] = [];
  const border: string[] = [];
  const ink: string[] = [];
  let detail = -1;
  let body = -1;
  paths.forEach((p, i) => {
    const id = i.toString(36);
    defs.push(`<path id="${id}" d="${roundPath(p.d)}"/>`);
    const isBody = p.weight >= 28 && !spec.props?.includes(++body);
    if (p.weight < 28) detail++;
    const how: DetailFill = p.black ? 'ink' : p.weight >= 28 ? 'white' : (spec.details?.[detail] ?? 'white');
    if (isBody) {
      border.push(`<use href="#${id}" fill="${WHITE}" stroke-width="${p.weight + 44}"/>`);
      ink.push(`<use href="#${id}" fill="${fill}" stroke-width="${p.weight}"/>`);
    } else {
      border.push(`<use href="#${id}" stroke-width="${p.weight + 44}"/>`);
      const f = how === 'white' ? WHITE : how === 'ink' ? INK : 'none';
      ink.push(`<use href="#${id}" fill="${f}" stroke-width="${p.weight}"/>`);
    }
  });
  const w = width + 2 * PAD;
  const h = height + 2 * PAD;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${PAD} -${PAD} ${w} ${h}" width="${w}" height="${h}">` +
    `<defs>${defs.join('')}</defs>` +
    `<g fill="none" stroke="${WHITE}" stroke-linecap="round" stroke-linejoin="round">${border.join('')}</g>` +
    `<g stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">${ink.join('')}</g>` +
    `</svg>\n`
  );
}

if (import.meta.main) {
  const check = process.argv.includes('--check');
  let stale = 0;
  let total = 0;
  for (const [pose, spec] of Object.entries(STICKERS)) {
    const out = sticker(readFileSync(`${FIGURES}nino-${pose}.svg`, 'utf8'), spec);
    total += out.length;
    const file = `${OUT}nino-${pose}.svg`;
    if (check) {
      let now = '';
      try {
        now = readFileSync(file, 'utf8');
      } catch {}
      if (now !== out) {
        stale++;
        console.error(`stale: ${file}`);
      }
    } else writeFileSync(file, out);
  }
  console.log(`${Object.keys(STICKERS).length} stickers, ${(total / 1024).toFixed(1)} KB${check ? (stale ? `, ${stale} stale` : ', up to date') : ''}`);
  if (stale) process.exit(1);
}
