// A show state machine on a fake clock with seeded randomness, over the real analysis data. Shared by the
// show and journal tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeCommand } from '@quina/protocol';
import type { CardTypeSides, CommandArgs, CommandName, GameRecord, GameSettings } from '@quina/protocol';
import { Show } from '../../engine/src/show/show.ts';
import type { Effect, Env, SongInfo } from '../../engine/src/show/show.ts';
import { seededRandom } from '../../engine/src/rng.ts';
import type { Analysis } from '../../engine/src/analysis.ts';
import { cardFace, type Card, type PrintedCard } from '../../engine/src/game/cards.ts';
import { OUT, REPO } from '../../relay/repertoire.ts';
import { HAS_DATA } from './data.ts';

/** The analysis files hold more than the engine reads; the tests also pick song pairs by tempo stability. */
export type SongAnalysis = Analysis & { tempo: { isStable: boolean } };
type IndexEntry = { id: number; title: string; artist: string; excluded: boolean };

const DIR = path.join(OUT, 'analysis');
/** Test data from disk, typed by the contract of whatever wrote it (tools/prep/analyze.py, the card generator). */
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8'));
// Without the prepared data (a fresh clone, CI) everything is empty and the tests that need it skip (support/data.ts).
const index = HAS_DATA ? readJson<{ songs: IndexEntry[] }>(path.join(DIR, 'index.json')).songs.filter((s) => !s.excluded) : [];
export const analyses = new Map(index.map((s) => [s.id, readJson<SongAnalysis>(path.join(DIR, `${s.id}.json`))]));
export const songs = index.map((s) => ({ id: s.id, title: s.title, artist: s.artist }));
/** The printed cards' side 1 (D178), as cards from before sides: what these tests' rounds play. */
export const allCards: Card[] = HAS_DATA ? readJson<PrintedCard[]>(path.join(REPO, 'apps/cards/dist/cards.json')).flatMap((c) => cardFace(c, 1) ?? []) : [];

export interface SetupOptions {
  seed?: number;
  decoded?: (songId: number) => boolean;
  settings?: Partial<GameSettings>;
  cards?: PrintedCard[];
  /** card-types.json's sides (D178). */
  cardTypes?: CardTypeSides[];
  /** The repertoire's songs (default: the test songs, all pool 1). */
  songs?: SongInfo[];
  cardsInPlay?: string;
  /** A fixed Queue (it bypasses the tie-free Shuffle). */
  fixedQueue?: number[] | null;
  /** Resume this Game (a restarted show page). */
  restore?: GameRecord | null;
  /** Start the fake audio clock here (a restarted page's clock starts again near 0). */
  startSec?: number;
  /** Epoch ms at audio-clock 0. */
  epochMs?: number;
  /** Extra runtime hooks (Signatures, Blend renders, a stub planner). */
  env?: Partial<Env>;
}

export function setup({ seed = 1, decoded = () => true, settings = {}, cards = [], cardTypes = [], songs: catalog = songs, cardsInPlay = '', fixedQueue = null, restore = null, startSec = 10, epochMs = 1_700_000_000_000, env: extra = {} }: SetupOptions = {}) {
  const clock = { t: startSec };
  const env: Env = {
    now: () => clock.t,
    nowMs: () => epochMs + clock.t * 1000,
    toEpochMs: (ctx) => epochMs + ctx * 1000,
    analysis: (id) => (decoded(id) ? analyses.get(id) ?? null : null),
    isDecoded: (id) => decoded(id),
    random: seededRandom(seed),
    ...extra,
  };
  const show = new Show({ env, songs: catalog, settings, cards, cardTypes, cardsInPlay, fixedQueue, restore });
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
  /** The last card's pass shows its plaque «Cartró correcte!» for a moment (FLOW.check.passPlaqueSec): until its
   * Celebration starts. */
  const throughPlaque = () => (show.check?.passAt != null ? until(() => show.check?.passAt == null, 10) : []);
  /** The presenter-paced Check (D107) on screen pressed through: each reveal, then its cue (and a last pass's plaque). */
  const pressCue = (claimId = show.check?.info.claimId) => {
    const out: Effect[] = [];
    for (let n = 0; n < 30; n++) {
      const run = show.check;
      if (!claimId || !run || run.info.claimId !== claimId || run.info.cue != null || run.info.reviewing) break;
      out.push(...send('checkNext', { claimId, step: run.info.revealed.length }));
    }
    out.push(...throughPlaque());
    return out;
  };
  /** Every Check of the claim pressed through, card after card, and the shared Celebration's press, until the scene
   * leaves `check` (or nothing more can be pressed). */
  const checkAll = () => {
    const out: Effect[] = [];
    for (let n = 0; n < 40 && show.scene === 'check'; n++) {
      const cn = show.celebrationNext;
      if (cn) {
        out.push(...send('checkNext', cn));
        continue;
      }
      const run = show.check;
      if (run && run.info.cue == null && !run.info.reviewing) {
        out.push(...pressCue(run.info.claimId));
        continue;
      }
      if (!show.claims.some((c) => c.status === 'queued')) break;
      out.push(...until(() => show.check != null && show.check.info.cue == null, 20));
    }
    return out;
  };
  return { show, clock, env, send, dispatch, advance, until, log, pressCue, throughPlaque, checkAll };
}
export type Harness = ReturnType<typeof setup>;
