// Typed sample snapshots for every scene, for demo mode (`?demo=<name>`), design review and tests.
// The story is "Quina 3": 24 songs in, Boig per tu just landed, card 57 and card 123 are 1 song from a Line.
// Song ids and titles are last year's pool (test material only).
import { PROTOCOL_VERSION, type IncomingEvent, type LandingInfo, type ShowState } from '@quina/protocol';
import type { FlowFields, FlowState } from '../flow.ts';

/** A snapshot with every show-flow field present (what the merged engine will send). */
export type FullState = ShowState & FlowFields;

/** id → [title, artist] for the songs the fixtures use. */
export const FIXTURE_SONGS: Record<number, [string, string]> = {
  1: ['All I Want for Christmas Is You', 'Mariah Carey'],
  2: ['All Night', 'Icona Pop'],
  3: ['Ave María', 'David Bisbal'],
  5: ['Barbie Girl', 'Aqua'],
  7: ['Boig Per Tu', 'Sau'],
  11: ['Breaking Free', 'Troy, Gabriella, Disney'],
  14: ['Como Camarón', 'Estopa'],
  15: ['Cuídate', 'La Oreja de Van Gogh'],
  16: ['Dancing in the Moonlight', 'Toploader'],
  17: ['Dancing Queen', 'ABBA'],
  18: ['Danza Kuduro', 'Don Omar, Lucenzo'],
  20: ['Elefants', 'Oques Grasses'],
  25: ['Gasolina', 'Daddy Yankee'],
  31: ['Just Dance', "Lady Gaga, Colby O'Donis"],
  35: ["L'Amour Toujours", "Gigi D'Agostino"],
  41: ['Limbo', 'Daddy Yankee'],
  45: ['Me Colé en una Fiesta', 'Mecano'],
  60: ['SUPERESTRELLA', 'Aitana'],
  62: ['Aserejé', 'Las Ketchup'],
  68: ['Titanium', 'David Guetta, Sia'],
  69: ['Tots Som Súpers', 'SX3'],
  74: ['Waka Waka', 'Shakira, Freshlyground'],
  75: ['YMCA', 'Village People'],
};

const song = (songId: number) => ({ songId, title: FIXTURE_SONGS[songId]?.[0] ?? `Cançó ${songId}`, artist: FIXTURE_SONGS[songId]?.[1] ?? '' });

/** The round's landings so far, oldest first (the last is the current song). */
export const FIXTURE_LANDED = [25, 2, 17, 41, 15, 31, 3, 68, 5, 75, 60, 62, 1, 16, 45, 35, 7];

function landings(now: number): LandingInfo[] {
  const ids = FIXTURE_LANDED;
  return ids.slice(-10).map((id, i, arr) => ({ ...song(id), position: ids.length - arr.length + i, atMs: now - (arr.length - 1 - i) * 14000, undone: false }));
}

/** Rounds 1 to `n` introduced, so their prizes are revealed. */
const revealedUpTo = (n: number): NonNullable<ShowState['prizes']> => ({ revealed: Array.from({ length: n }, (_, i) => ({ round: i + 1, by: 'intro' as const })) });

/** A complete `state` snapshot in play, with the show flow's fields set to their in-play values. */
export function baseState(now: number): FullState {
  const position = FIXTURE_LANDED.length - 1;
  const state: Omit<ShowState, keyof FlowFields> = {
    v: PROTOCOL_VERSION,
    type: 'state',
    seq: 1,
    atMs: now,
    status: 'playing',
    pending: null,
    hold: null,
    holdMusic: false,
    current: { ...song(7), hookId: 'h1', posSec: 6, endsAtMs: now + 60000 },
    next: song(74),
    queue: { position, length: 77 },
    round: { number: 3, kind: 'normal', startedAtMs: now - 8 * 60000, targetEndMs: now + 18 * 60000, lineConfirmed: false },
    game: {
      pace: 14,
      paceLocked: false,
      autoAdvance: true,
      autoAdvanceFinal: false,
      songsUntilWinner: 3,
      phaseOverride: null,
      roundsTotal: 8,
      holdMusicAfterSec: 45,
      nextRecipe: null,
      finalLapStinger: true,
    },
    phase: 'late',
    heat: 0.71,
    cards: { inPlay: '1-210, 400-440', inPlayCount: 251, validCount: 210, phaseSource: 'cards', climbingTo: 'line' },
    possibleWinners: { line: [], bingo: [] },
    pace: { sec: 14, locked: false, nudge: 1.05, slotSec: 14.7, spinSec: 7 },
    schedule: { roundEndMs: now + 27 * 60000, gameEndMs: now + 140 * 60000, roundDriftSec: 120, gameDriftSec: 300 },
    autoAtMs: now + 9000,
    transition: null,
    suspense: null,
    landings: landings(now),
    history: [],
    prizes: revealedUpTo(3),
  };
  const flow: FlowFields = {
    scene: 'play',
    pause: null,
    shuffle: null,
    intro: null,
    claims: [],
    check: null,
    celebration: null,
    interval: null,
    winners: [
      { round: 1, kind: 'line', cardId: 12, claimId: 'cl-1', winningSongId: 17, position: 14, atMs: now - 70 * 60000, name: 'Marta', notes: null },
      { round: 1, kind: 'bingo', cardId: 188, claimId: 'cl-2', winningSongId: 60, position: 48, atMs: now - 52 * 60000, name: null, notes: 'Recull el premi a la barra' },
      { round: 2, kind: 'line', cardId: 77, claimId: 'cl-3', winningSongId: 2, position: 17, atMs: now - 35 * 60000, name: null, notes: null },
      { round: 2, kind: 'bingo', cardId: 140, claimId: 'cl-4', winningSongId: 45, position: 51, atMs: now - 16 * 60000, name: 'Joan', notes: null },
    ],
  };
  return { ...state, ...flow };
}

export interface DemoScript {
  state: FlowState;
  /** Later events, relative to when the demo connects. */
  events?: { afterMs: number; event: IncomingEvent }[];
}

const withFlow = (s: FullState, patch: Partial<FullState>): FullState => ({ ...s, ...patch });


/** Every demo fixture by name. */
export const FIXTURES: Record<string, (now: number) => DemoScript> = {
  before: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'before',
        status: 'idle',
        current: null,
        next: null,
        queue: { position: -1, length: 0 },
        round: { ...s.round, number: 0, startedAtMs: 0, targetEndMs: 0 },
        landings: [],
        winners: [],
        autoAtMs: null,
        heat: null,
        prizes: { revealed: [] },
      }),
    };
  },
  roundStart: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, { scene: 'roundStart', status: 'idle', current: null, next: null, queue: { position: -1, length: 77 }, landings: [], autoAtMs: null, round: { ...s.round, number: 4 }, intro: { round: 4, kind: 'normal', sinceMs: now - 20000 }, prizes: revealedUpTo(4) }),
    };
  },
  shuffle: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'roundStart',
        status: 'idle',
        current: null,
        next: null,
        queue: { position: -1, length: 77 },
        landings: [],
        autoAtMs: null,
        round: { ...s.round, number: 4 },
        shuffle: { round: 4, startAtMs: now + 500, endAtMs: now + 9500 },
        prizes: revealedUpTo(4),
      }),
    };
  },
  play: (now) => ({ state: baseState(now) }),
  spin: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        status: 'transition',
        autoAtMs: null,
        transition: { id: 'tr-25', recipe: 'R7', phase: 'late', to: 74, landAtMs: now + 6000 },
      }),
    };
  },
  hold: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { status: 'hold', autoAtMs: null, hold: { sinceMs: now - 12000, reason: 'hold', holdMusic: false, holdMusicAtMs: now + 33000 } }) };
  },
  possibleWinners: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        possibleWinners: {
          line: [
            { cardId: 57, lines: [2], completedBy: 7 },
            { cardId: 204, lines: [1], completedBy: 7 },
          ],
          bingo: [],
        },
      }),
    };
  },
  check: (now) => {
    const s = baseState(now);
    const steps = [2, 62, 16, 20].map((songId, i) => ({ songId, landed: songId !== 20, atMs: now + 600 + i * 3000, durationMs: 2500 }));
    return {
      state: withFlow(s, {
        scene: 'check',
        status: 'hold',
        autoAtMs: null,
        hold: { sinceMs: now - 4000, reason: 'hold', holdMusic: true, holdMusicAtMs: null },
        claims: [
          { claimId: 'cl-5', round: 3, cardId: 57, kind: 'line', atMs: now - 4000, position: s.queue.position, status: 'checking', outcome: 'incomplete', completeSince: null, warnings: [] },
          { claimId: 'cl-6', round: 3, cardId: 204, kind: 'line', atMs: now - 2000, position: s.queue.position, status: 'queued', outcome: null, completeSince: null, warnings: ['notSold'] },
        ],
        check: { claimId: 'cl-5', cardId: 57, kind: 'line', outcome: 'incomplete', row: 2, otherRows: [], cardType: 'normal', steps, startAtMs: now + 600, endAtMs: now + 600 + 4 * 3000 },
      }),
    };
  },
  checkValid: (now) => {
    const s = baseState(now);
    // Card 123's top row (All Night, Dancing Queen, Limbo, Tots Som Súpers), as if Tots Som Súpers had just landed.
    const steps = [2, 17, 41, 69].map((songId, i) => ({ songId, landed: true, atMs: now - 13000 + i * 3000, durationMs: 2500 }));
    return {
      state: withFlow(s, {
        scene: 'check',
        status: 'hold',
        autoAtMs: null,
        hold: { sinceMs: now - 20000, reason: 'hold', holdMusic: true, holdMusicAtMs: null },
        claims: [{ claimId: 'cl-7', round: 3, cardId: 123, kind: 'line', atMs: now - 20000, position: s.queue.position, status: 'checked', outcome: 'complete', completeSince: s.queue.position, warnings: [] }],
        check: { claimId: 'cl-7', cardId: 123, kind: 'line', outcome: 'complete', row: 0, otherRows: [], cardType: 'normal', steps, startAtMs: now - 13000, endAtMs: now - 1000 },
      }),
    };
  },
  checkFailed: (now) => {
    // The same claim as `check`, over: Elefants didn't sound, so card 57 has no Line.
    const s = baseState(now);
    const steps = [2, 62, 16, 20].map((songId, i) => ({ songId, landed: songId !== 20, atMs: now - 13000 + i * 3000, durationMs: 2500 }));
    return {
      state: withFlow(s, {
        scene: 'check',
        status: 'hold',
        autoAtMs: null,
        hold: { sinceMs: now - 16000, reason: 'hold', holdMusic: true, holdMusicAtMs: null },
        claims: [{ claimId: 'cl-5', round: 3, cardId: 57, kind: 'line', atMs: now - 16000, position: s.queue.position, status: 'checked', outcome: 'incomplete', completeSince: null, warnings: [] }],
        check: { claimId: 'cl-5', cardId: 57, kind: 'line', outcome: 'incomplete', row: 2, otherRows: [], cardType: 'normal', steps, startAtMs: now - 14500, endAtMs: now - 1000 },
      }),
    };
  },
  checkWrongType: (now) => {
    // A special card claimed in a regular round: its type fails, so no song is played.
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'check',
        status: 'hold',
        autoAtMs: null,
        hold: { sinceMs: now - 3000, reason: 'hold', holdMusic: true, holdMusicAtMs: null },
        claims: [{ claimId: 'cl-8', round: 3, cardId: 508, kind: 'line', atMs: now - 3000, position: s.queue.position, status: 'checked', outcome: 'wrongType', completeSince: null, warnings: [] }],
        check: { claimId: 'cl-8', cardId: 508, kind: 'line', outcome: 'wrongType', row: null, otherRows: [], cardType: 'especial', steps: [], startAtMs: now + 600, endAtMs: now + 600 },
      }),
    };
  },
  celebration: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'celebration',
        status: 'playing',
        autoAtMs: null,
        round: { ...s.round, lineConfirmed: true },
        celebration: { kind: 'line', round: 3, cardIds: [123], winningSongId: 69, sinceMs: now - 1500, music: 'winningSong' },
        winners: [...s.winners, { round: 3, kind: 'line', cardId: 123, claimId: 'cl-7', winningSongId: 69, position: s.queue.position, atMs: now - 1500, name: null, notes: null }],
      }),
    };
  },
  celebrationBingo: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'celebration',
        status: 'playing',
        autoAtMs: null,
        round: { ...s.round, lineConfirmed: true },
        celebration: { kind: 'bingo', round: 3, cardIds: [57, 301], winningSongId: 7, sinceMs: now - 1500, music: 'victory' },
      }),
    };
  },
  interval: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'interval',
        status: 'playing',
        autoAtMs: null,
        current: null,
        next: null,
        interval: { sinceMs: now - 40000, nextRound: 4, guideEndMs: now + 140000 },
        intervalMusic: { track: { title: 'Last Christmas', artist: 'Wham!', index: 3, count: 24, sinceMs: now - 25000 } },
      }),
    };
  },
  after: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { scene: 'after', status: 'idle', autoAtMs: null, current: null, next: null }) };
  },
  pause: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { status: 'hold', autoAtMs: null, pause: { sinceMs: now - 30000 }, hold: { sinceMs: now - 30000, reason: 'music', holdMusic: true, holdMusicAtMs: null } }) };
  },
  suspense: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { status: 'transition', autoAtMs: null, suspense: { id: 'tr-25', sinceMs: now - 8000, autoReleaseAtMs: now + 22000 } }) };
  },
};

export const FIXTURE_NAMES = Object.keys(FIXTURES);
