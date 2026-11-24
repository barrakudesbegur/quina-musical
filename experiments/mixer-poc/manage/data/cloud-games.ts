// The cloud's Games, for plan B (the Platform session's Worker, same origin, organizers only):
//   GET  /api/games   → { games: [{ gameId, seq, firstAtMs, lastAtMs, rounds, current, resumePoint }] }, newest first
//   POST /api/resume  { gameId } → { ok, gameId, seq, laptopOnline } | 404
// `resumePoint` is set for the current Game only. It holds the Shuffle's seed, so it is SECRET: the seed, the
// Pool and the cards in play give the whole Queue. Never show it on a shared screen.
import type { ResumePoint, RoundKind } from '@quina/protocol';
import type { FetchLike } from '../../ui/data/cloud-plan.ts';

export interface CloudGame {
  gameId: string;
  seq: number;
  firstAtMs: number;
  lastAtMs: number;
  rounds: number;
  current: boolean;
  resumePoint: ResumePoint | null;
}

export type GamesResult = { ok: true; games: CloudGame[] } | { ok: false; status: number };
export type ResumeResult = { ok: true; laptopOnline: boolean } | { ok: false; status: number };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function resumePointOf(v: unknown): ResumePoint | null {
  if (!isRec(v) || typeof v.round !== 'number' || typeof v.shuffleSeed !== 'number' || typeof v.position !== 'number') return null;
  return {
    round: v.round,
    kind: (v.kind === 'special' ? 'special' : 'normal') satisfies RoundKind,
    shuffleSeed: v.shuffleSeed,
    shuffleAttempts: num(v.shuffleAttempts),
    position: v.position,
    lastSongId: typeof v.lastSongId === 'number' ? v.lastSongId : null,
    lineConfirmedFrom: typeof v.lineConfirmedFrom === 'number' ? v.lineConfirmedFrom : null,
  };
}

/** Parse /api/games. Malformed entries are skipped, never thrown. */
export function parseGames(body: unknown): CloudGame[] {
  const list = isRec(body) && Array.isArray(body.games) ? body.games : [];
  const games: CloudGame[] = [];
  for (const g of list) {
    if (!isRec(g) || typeof g.gameId !== 'string') continue;
    games.push({
      gameId: g.gameId,
      seq: num(g.seq),
      firstAtMs: num(g.firstAtMs),
      lastAtMs: num(g.lastAtMs),
      rounds: num(g.rounds),
      current: g.current === true,
      resumePoint: resumePointOf(g.resumePoint),
    });
  }
  return games;
}

export async function fetchGames(fetchImpl: FetchLike): Promise<GamesResult> {
  try {
    const res = await fetchImpl('/api/games');
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, games: parseGames(await res.json()) };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function resumeGame(fetchImpl: FetchLike, gameId: string): Promise<ResumeResult> {
  try {
    const res = await fetchImpl('/api/resume', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gameId }) });
    if (!res.ok) return { ok: false, status: res.status };
    const body: unknown = await res.json().catch(() => null);
    return { ok: true, laptopOnline: isRec(body) && body.laptopOnline === true };
  } catch {
    return { ok: false, status: 0 };
  }
}
