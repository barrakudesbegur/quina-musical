// The Desgraciat's finale on the projector (D161, D166–D168, D180–D187; board Projector-Desgraciat-Final, ANIMATIONS.md ›
// The finale on stage › Projector): one nino per finalist on a stage under the drum, their number on a plate. The
// finalists' numbers and fates are public by design (D161); their cards' contents never leave this module (only
// whether a landing was «Salvats!»). The shared rules (packages/rules/finale.ts) decide order, looks and «Salvats!»; this
// adds the projector's time gating (nothing moves before its landing) and its layout (fewer ninos stand bigger). Pure.
import { DEFAULT_SIDE, type FinaleInfo, type ShowState } from '@quina/protocol';
import { finaleRow, finaleSaved, type FinalePose } from '../../../packages/rules/finale.ts';
import { catalogFace, type Catalog } from '../../../packages/ui/data/catalog.ts';

/** A nino's state on stage: up (standing), down (fell at the last landing: faded until the next Spin), the winner. */
export type NinoFate = 'up' | 'down' | 'win';

/** One finalist on stage. `number` is their card number, shown on their plate (public: they're on stage). */
export interface FinaleNino {
  number: number;
  fate: NinoFate;
  pose: FinalePose;
  hue: number;
  /** When the fate took effect (the landing that took them out or left them alone); null for one standing. */
  sinceMs: number | null;
}

export interface FinaleView {
  /** The finale's identity on screen (its round). */
  key: string;
  /** In ascending card order, as they line up on stage. */
  ninos: FinaleNino[];
  /** «Salvats!» (D181): when the landing that saved them landed; null otherwise. */
  savedAtMs: number | null;
}

/** The last counted landing, when it is the snapshot's position (null before the first, or right after a Back). */
export function lastLanding(state: Pick<ShowState, 'landings' | 'queue'>): { position: number; songId: number; atMs: number } | null {
  const l = state.landings.findLast((x) => !x.undone);
  return l && l.position === state.queue.position ? { position: l.position, songId: l.songId, atMs: l.atMs } : null;
}

/**
 * The finale as the projector draws it. `spinning`: a Spin or a Suspens has started since the last landing, so the
 * fallen have left. «Salvats!» is worked out from the printed cards on the round's side, which never come out.
 */
export function finaleView(state: Pick<ShowState, 'finale' | 'landings' | 'queue' | 'round'>, catalog: Catalog | null, spinning: boolean): FinaleView | null {
  const finale: FinaleInfo | null = state.finale ?? null;
  if (!finale) return null;
  const position = state.queue.position;
  const fallAt = new Map(finale.fallen.map((f) => [f.cardId, f.atMs]));
  const ninos = finaleRow(finale, { position, spinning }).map((spot): FinaleNino => {
    const fate: NinoFate = spot.fate === 'winner' ? 'win' : spot.fate === 'fallen' ? 'down' : 'up';
    const sinceMs = fate === 'win' ? (finale.winner?.atMs ?? null) : fate === 'down' ? (fallAt.get(spot.cardId) ?? null) : null;
    return { number: spot.cardId, fate, pose: spot.look.pose, hue: spot.look.hue, sinceMs };
  });
  const landing = lastLanding(state);
  const side = state.round.side ?? DEFAULT_SIDE;
  const songsOf = (id: number) => catalogFace(catalog, id, side)?.lines.flat() ?? null;
  return { key: `finale:${state.round.number}`, ninos, savedAtMs: landing && finaleSaved(finale, landing, songsOf) ? landing.atMs : null };
}

/** A nino's fate at `nowMs`: a fall or a win shows from its landing time, never before (motion never tells a secret). */
export const fateAt = (nino: FinaleNino, nowMs: number): NinoFate => (nino.sinceMs !== null && nowMs < nino.sinceMs ? 'up' : nino.fate);

/** Linear interpolation over `points` (sorted by x), clamped at both ends. */
function along(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

/** The board's row (1440 px box): spacing between ninos and their scale, by how many stand on stage (D184). */
const SPACING: readonly (readonly [number, number])[] = [[2, 700], [5, 240], [8, 170]];
const SCALE: readonly (readonly [number, number])[] = [[2, 1.3], [5, 1.15], [8, 1]];

export interface FinaleLayout {
  /** Each nino's centre across the box (px), in row order. */
  xs: number[];
  /** Their scale (1 at eight: a 220 px nino and a 62 px plate). */
  scale: number;
}

/** Where `count` ninos stand, centred on `centre`, and how big; more than eight fit in `width` (1360/n apart, 8/n). */
export function finaleLayout(count: number, centre = 720, width = 1360): FinaleLayout {
  const n = Math.max(0, Math.floor(count));
  const max = SPACING[SPACING.length - 1][0];
  const spacing = n > max ? width / n : along(SPACING, n);
  const scale = n > max ? max / n : along(SCALE, Math.max(2, n));
  return { xs: Array.from({ length: n }, (_, i) => Math.round(centre + (i - (n - 1) / 2) * spacing)), scale: Math.round(scale * 1000) / 1000 };
}
