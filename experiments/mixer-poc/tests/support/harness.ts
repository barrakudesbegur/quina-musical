// A show state machine on a fake clock with seeded randomness, over the real analysis data. Shared by the
// show and journal tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeCommand } from '@quina/protocol';
import type { CommandArgs, CommandName, GameRecord, GameSettings } from '@quina/protocol';
import { Show } from '../../engine/src/show/show.ts';
import type { Effect, Env } from '../../engine/src/show/show.ts';
import { seededRandom } from '../../engine/src/rng.ts';
import type { Analysis } from '../../engine/src/analysis.ts';
import type { Card } from '../../engine/src/game/cards.ts';
import type { DecoyConfig } from '../../engine/src/config.ts';

/** The analysis files hold more than the engine reads; the tests also pick song pairs by tempo stability. */
export type SongAnalysis = Analysis & { tempo: { isStable: boolean } };
type IndexEntry = { id: number; title: string; artist: string; excluded: boolean };

const DIR = path.join(import.meta.dirname, '../../data/analysis');
/** Test data from disk, typed by the contract of whatever wrote it (analysis/analyze.py, the card generator). */
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8'));
const index = readJson<{ songs: IndexEntry[] }>(path.join(DIR, 'index.json')).songs.filter((s) => !s.excluded);
export const analyses = new Map(index.map((s) => [s.id, readJson<SongAnalysis>(path.join(DIR, `${s.id}.json`))]));
export const songs = index.map((s) => ({ id: s.id, title: s.title, artist: s.artist }));
export const allCards = readJson<Card[]>(path.join(import.meta.dirname, '../../../../card-generator/dist/cards.json'));

export function seededShuffle(seed: number) {
  const rnd = seededRandom(seed);
  return (ids: number[]) => {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
}

export interface SetupOptions {
  seed?: number;
  decoded?: (songId: number) => boolean;
  settings?: Partial<GameSettings>;
  cards?: Card[];
  cardsInPlay?: string;
  /** Resume this Game (a restarted show page). */
  restore?: GameRecord | null;
  /** Start the fake audio clock here (a restarted page's clock starts again near 0). */
  startSec?: number;
  /** Epoch ms at audio-clock 0. */
  epochMs?: number;
  /** Extra runtime hooks (Signatures, Blend renders, a stub planner). */
  env?: Partial<Env>;
  /** The Decoys experiment's settings. */
  decoys?: Partial<DecoyConfig>;
}

export function setup({ seed = 1, decoded = () => true, settings = {}, cards = [], cardsInPlay = '', restore = null, startSec = 10, epochMs = 1_700_000_000_000, env: extra = {}, decoys = {} }: SetupOptions = {}) {
  const clock = { t: startSec };
  const env: Env = {
    now: () => clock.t,
    nowMs: () => epochMs + clock.t * 1000,
    toEpochMs: (ctx) => epochMs + ctx * 1000,
    analysis: (id) => (decoded(id) ? analyses.get(id) ?? null : null),
    isDecoded: (id) => decoded(id),
    random: seededRandom(seed),
    shuffle: seededShuffle(seed),
    ...extra,
  };
  const show = new Show({ env, songs, settings, cards, cardsInPlay, restore, decoys });
  const log: Effect[] = [...show.flush()];
  // Any message, as a remote might send it.
  const dispatch = (message: unknown) => {
    const out = show.command(message);
    log.push(...out);
    return out;
  };
  const send = <C extends CommandName>(cmd: C, ...args: CommandArgs<C>) => dispatch(makeCommand(cmd, ...args));
  // Advance the clock in 25 ms ticks, like the runtime.
  const advance = (seconds: number) => {
    const out: Effect[] = [];
    const end = clock.t + seconds;
    while (clock.t < end - 1e-9) {
      clock.t = Math.min(end, clock.t + 0.025);
      out.push(...show.tick());
    }
    log.push(...out);
    return out;
  };
  const until = (predicate: () => boolean, maxSec = 120) => {
    const out: Effect[] = [];
    for (let n = 0; n < maxSec / 0.025 && !predicate(); n++) {
      clock.t += 0.025;
      out.push(...show.tick());
    }
    log.push(...out);
    assert.ok(predicate(), 'condition never met');
    return out;
  };
  return { show, clock, env, send, dispatch, advance, until, log };
}
export type Harness = ReturnType<typeof setup>;
