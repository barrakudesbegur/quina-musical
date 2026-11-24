// Typed sample snapshots for every scene, for demo mode (`?demo=<name>`), design review and tests.
// The story is "Quina 3": 24 songs in, Boig per tu just landed, card 57 and card 123 are 1 song from a Line.
// The Desgraciat fixtures play Quina 5, the Quina Desgraciada (see DESGRACIAT_LANDED).
// Song ids and titles are last year's pool (test material only).
import { PROTOCOL_VERSION, STANDING_LIST_MAX, type IncomingEvent, type LandingInfo, type ShowState } from '@quina/protocol';
import type { CheckStep, FlowFields, FlowState } from '../flow.ts';

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
  // The Desgraciat fixtures' landings (DESGRACIAT_LANDED).
  10: ['Boys Will Be Boys', 'Paulina Rubio'],
  19: ['Devuélveme a mi chica', 'Hombres G'],
  27: ['Give Me Everything', 'Pitbull, AFROJACK, Ne-Yo, Nayer'],
  30: ['Hay Quel Venir al Sur', 'Raffaella Carrà'],
  38: ['Las de la Intuición', 'Shakira'],
  40: ["L'Empordà", 'Sopa De Cabra'],
  43: ['Love Story', 'Taylor Swift'],
  50: ['Ni Una Sola Palabra', 'Paulina Rubio'],
  52: ['No Rompas Mi Corazón', 'Trip Band'],
  55: ['Purpurina', 'Alberto Gambino'],
  56: ['Que la Detengan', 'David Civera'],
  57: ['Samba de Janeiro', 'Bellini'],
  59: ['Shin Chan Dance', 'SX3'],
  65: ["T'Estimo Molt", "Lax'n'Busto"],
  72: ['Viva La Vida', 'Coldplay'],
};

const song = (songId: number) => ({ songId, title: FIXTURE_SONGS[songId]?.[0] ?? `Cançó ${songId}`, artist: FIXTURE_SONGS[songId]?.[1] ?? '' });

/** The round's landings so far, oldest first (the last is the current song). */
export const FIXTURE_LANDED = [25, 2, 17, 41, 15, 31, 3, 68, 5, 75, 60, 62, 1, 16, 45, 35, 7];

/** The last 10 of `ids` as the state's landings, the newest landed at `lastAtMs`, 14 s apart. */
function landings(now: number, ids: readonly number[] = FIXTURE_LANDED, lastAtMs = now): LandingInfo[] {
  return ids.slice(-10).map((id, i, arr) => ({ ...song(id), position: ids.length - arr.length + i, atMs: lastAtMs - (arr.length - 1 - i) * 14000, undone: false }));
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
    round: { number: 3, kind: 'normal', cardType: 'normal', startedAtMs: now - 8 * 60000, targetEndMs: now + 18 * 60000, lineConfirmed: false },
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


// ---- the Desgraciat round (Quina 5 in SAMPLE_PLAN) ----------------------------------------------------
// Worked out from apps/cards/dist/cards.json, so every screen agrees: the normal cards 1–210 are the round's valid
// cards in play (`baseState`'s "1-210, 400-440"), and these landings leave card #57 the last one standing.

/** The Desgraciat round's landings, oldest first: the 22nd leaves only #57 standing. */
export const DESGRACIAT_LANDED = [59, 10, 30, 11, 45, 56, 41, 19, 52, 55, 72, 68, 17, 35, 40, 57, 50, 65, 38, 27, 43, 1];
/** Cards standing after each landing of DESGRACIAT_LANDED (index i: after i + 1 landings). */
export const DESGRACIAT_COUNTS = [176, 143, 122, 98, 76, 62, 49, 44, 37, 30, 26, 23, 22, 21, 16, 15, 14, 11, 9, 8, 5, 1];
/** The standing cards after 11 landings (26) and after 12 (23: «Titanium» knocked out #90, #194 and #210). */
export const DESGRACIAT_STANDING_26 = [22, 34, 51, 55, 56, 57, 66, 67, 68, 72, 81, 86, 87, 90, 99, 105, 106, 119, 140, 151, 173, 184, 185, 191, 194, 210];
export const DESGRACIAT_STANDING_23 = DESGRACIAT_STANDING_26.filter((id) => ![90, 194, 210].includes(id));
/** #57, the last card standing: its 12 songs in card order (none of them lands in the round). */
export const DESGRACIAT_LAST_CARD = { cardId: 57, songs: [5, 14, 64, 75, 15, 18, 60, 69, 2, 62, 16, 20] };
/** #23, claimed after 12 landings: its songs in card order up to «Limbo» (row 2, 3rd song), which has landed. */
export const DESGRACIAT_FALLEN_CARD = { cardId: 23, songs: [27, 47, 73, 75, 7, 17, 41], sankBy: 41 };

/** The engine's standing Check timing (engine config FLOW.check): lead, a ✓ knock, a landed snippet, gap, tail. */
const STANDING_CHECK = { leadMs: 1500, stillMs: 550, snippetMs: 2500, gapMs: 350, tailMs: 400 };

/** A standing Check's steps from `startAtMs`: a knock per song that hasn't landed, the snippet for the one that has. */
function standingSteps(songs: readonly number[], landed: ReadonlySet<number>, startAtMs: number): { steps: CheckStep[]; endAtMs: number } {
  let at = startAtMs + STANDING_CHECK.leadMs;
  const steps = songs.map((songId) => {
    const durationMs = landed.has(songId) ? STANDING_CHECK.snippetMs : STANDING_CHECK.stillMs;
    const step = { songId, landed: landed.has(songId), atMs: at, durationMs };
    at += durationMs + STANDING_CHECK.gapMs;
    return step;
  });
  return { steps, endAtMs: at - STANDING_CHECK.gapMs + STANDING_CHECK.tailMs };
}

/** A Check's whole length for these songs (from its start to its result). */
const standingCheckMs = (songs: readonly number[], landed: ReadonlySet<number>): number => standingSteps(songs, landed, 0).endAtMs;

/**
 * Quina 5, the Desgraciat round, after `landed` songs of DESGRACIAT_LANDED (the newest at `lastAtMs`): the private
 * `standing` (its card list only from 60 down) and the Futur's `lastStandingAt` and `standingCurve`.
 */
export function desgraciatState(now: number, landed: number, lastAtMs = now): FullState {
  const s = baseState(now);
  const ids = DESGRACIAT_LANDED.slice(0, landed);
  const count = DESGRACIAT_COUNTS[landed - 1] ?? 210;
  const cardIds = count === 26 ? DESGRACIAT_STANDING_26 : count === 23 ? DESGRACIAT_STANDING_23 : count === 1 ? [DESGRACIAT_LAST_CARD.cardId] : null;
  const last = ids[ids.length - 1];
  const lastStandingAt = DESGRACIAT_LANDED.length - 1;
  return withFlow(s, {
    current: last ? { ...song(last), hookId: 'h1', posSec: Math.max(0, (now - lastAtMs) / 1000), endsAtMs: lastAtMs + 60000 } : null,
    next: count > 1 ? song(DESGRACIAT_LANDED[landed] ?? 74) : song(74),
    queue: { position: landed - 1, length: 77 },
    round: { number: 5, kind: 'desgraciat', cardType: 'normal', startedAtMs: now - landed * 14000 - 30000, targetEndMs: now + 12 * 60000, lineConfirmed: false },
    phase: count > 100 ? 'early' : count > 30 ? 'mid' : count > 5 ? 'late' : 'final',
    heat: count > 100 ? 0.3 : count > 30 ? 0.52 : count > 5 ? 0.74 : 0.92,
    cards: { ...s.cards, climbingTo: 'standing' },
    possibleWinners: { line: [], bingo: [] },
    future: {
      lineAt: null,
      bingoAt: null,
      toLine: [],
      toBingo: [],
      markCounts: [],
      lastStandingAt: count > 1 ? lastStandingAt : null,
      standingCurve: count > 1 ? DESGRACIAT_COUNTS.slice(landed) : [],
    },
    standing: { count, cardIds: count <= STANDING_LIST_MAX ? cardIds : null },
    // Auto-advance never takes out the last card.
    autoAtMs: count > 1 ? now + 9000 : null,
    landings: landings(now, ids, lastAtMs),
    prizes: revealedUpTo(5),
    winners: [
      ...s.winners,
      { round: 3, kind: 'line', cardId: 123, claimId: 'cl-7', winningSongId: 69, position: 16, atMs: now - 40 * 60000, name: null, notes: null },
      { round: 3, kind: 'bingo', cardId: 57, claimId: 'cl-9', winningSongId: 7, position: 44, atMs: now - 30 * 60000, name: 'Pere', notes: null },
      { round: 4, kind: 'line', cardId: 31, claimId: 'cl-10', winningSongId: 60, position: 15, atMs: now - 20 * 60000, name: null, notes: null },
      { round: 4, kind: 'bingo', cardId: 204, claimId: 'cl-11', winningSongId: 2, position: 47, atMs: now - 10 * 60000, name: null, notes: null },
    ],
  });
}

/** A standing Check's state: claimed in the Desgraciat round after `landed` songs, started at `startAtMs`. */
function standingCheckState(now: number, landed: number, claim: { claimId: string; cardId: number; songs: readonly number[] }, startAtMs: number): FullState {
  const s = desgraciatState(now, landed, now - 30000);
  const landedSet = new Set(DESGRACIAT_LANDED.slice(0, landed));
  const { steps, endAtMs } = standingSteps(claim.songs, landedSet, startAtMs);
  const outcome = steps.some((st) => st.landed) ? 'fallen' : 'complete';
  const over = now >= endAtMs;
  return withFlow(s, {
    scene: 'check',
    status: 'hold',
    autoAtMs: null,
    hold: { sinceMs: startAtMs - 3000, reason: 'hold', holdMusic: true, holdMusicAtMs: null },
    claims: [
      {
        claimId: claim.claimId,
        round: 5,
        cardId: claim.cardId,
        kind: 'standing',
        atMs: startAtMs - 3000,
        position: s.queue.position,
        status: over ? 'checked' : 'checking',
        outcome,
        completeSince: outcome === 'complete' ? s.queue.position : null,
        warnings: [],
      },
    ],
    check: { claimId: claim.claimId, cardId: claim.cardId, kind: 'standing', outcome, row: null, otherRows: [], cardType: 'normal', steps, startAtMs, endAtMs },
  });
}

const FALLEN_CLAIM = { claimId: 'cl-12', ...DESGRACIAT_FALLEN_CARD };
const LAST_CLAIM = { claimId: 'cl-13', ...DESGRACIAT_LAST_CARD };

/** The Desgraciat round's demos (`?demo=<name>`). */
const DESGRACIAT_FIXTURES: Record<string, (now: number) => DemoScript> = {
  /** The intro of Quina 5, the Quina Desgraciada: its name, its one prize, and the hands-up nino. */
  desgraciatIntro: (now) => {
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
        round: { ...s.round, number: 5, kind: 'desgraciat' },
        cards: { ...s.cards, climbingTo: 'standing' },
        intro: { round: 5, kind: 'desgraciat', cardType: 'normal', sinceMs: now - 20000 },
        prizes: revealedUpTo(5),
      }),
    };
  },
  /** In play, 2 songs in: 143 cards standing (the count only, above 60). */
  desgraciat: (now) => ({ state: desgraciatState(now, 2) }),
  /** 26 standing; 1.5 s in, «Titanium» lands and knocks out #90, #194 and #210, leaving 23. */
  desgraciatFew: (now) => {
    const landsAt = now + 1500;
    return { state: desgraciatState(now, 11, now - 12500), events: [{ afterMs: 1500, event: { ...desgraciatState(now, 12, landsAt), seq: 2, atMs: landsAt } }] };
  },
  /** One card standing: #57. Auto-advance has stopped; checking #57 is the default action. */
  desgraciatLast: (now) => ({ state: desgraciatState(now, 22) }),
  /** #23 claims to be standing after 12 songs; the Check runs live and stops on «Limbo», which has landed. */
  checkStanding: (now) => ({ state: standingCheckState(now, 12, FALLEN_CLAIM, now + 600) }),
  /** The same Check, over: #23 fell with «Limbo». */
  checkFallen: (now) => ({ state: standingCheckState(now, 12, FALLEN_CLAIM, now - 600 - standingCheckMs(FALLEN_CLAIM.songs, new Set(DESGRACIAT_LANDED.slice(0, 12)))) }),
  /** #57, the last one standing: all 12 songs checked, none landed. */
  checkStandingValid: (now) => ({ state: standingCheckState(now, 22, LAST_CLAIM, now - 600 - standingCheckMs(LAST_CLAIM.songs, new Set())) }),
  /** DEMPEUS! #57 wins Quina 5. */
  celebrationStanding: (now) => {
    const s = desgraciatState(now, 22, now - 60000);
    return {
      state: withFlow(s, {
        scene: 'celebration',
        status: 'playing',
        autoAtMs: null,
        celebration: { kind: 'standing', round: 5, cardIds: [57], winningSongId: 1, sinceMs: now - 1500, music: 'victory' },
        winners: [...s.winners, { round: 5, kind: 'standing', cardId: 57, claimId: LAST_CLAIM.claimId, winningSongId: 1, position: s.queue.position, atMs: now - 1500, name: null, notes: null }],
      }),
    };
  },
  /** The Interval before Quina 5: the next round is the Quina Desgraciada. */
  intervalDesgraciat: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'interval',
        status: 'playing',
        autoAtMs: null,
        current: null,
        next: null,
        round: { ...s.round, number: 4 },
        interval: { sinceMs: now - 40000, nextRound: 5, guideEndMs: now + 140000 },
        intervalMusic: { track: { title: 'Last Christmas', artist: 'Wham!', index: 5, count: 24, sinceMs: now - 25000 } },
        prizes: revealedUpTo(4),
      }),
    };
  },
};

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
      state: withFlow(s, { scene: 'roundStart', status: 'idle', current: null, next: null, queue: { position: -1, length: 77 }, landings: [], autoAtMs: null, round: { ...s.round, number: 4 }, intro: { round: 4, kind: 'normal', cardType: 'normal', sinceMs: now - 20000 }, prizes: revealedUpTo(4) }),
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
  ...DESGRACIAT_FIXTURES,
};

export const FIXTURE_NAMES = Object.keys(FIXTURES);
