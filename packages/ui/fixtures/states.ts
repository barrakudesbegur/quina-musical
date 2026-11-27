// Typed sample snapshots for every scene, for demo mode (`?demo=<name>`), design review and tests.
// The story is "Quina 3": 24 songs in, Boig per tu just landed, card 57 and card 123 are 1 song from a Line.
// The Desgraciat fixtures play Quina 5, the Quina Desgraciada (see DESGRACIAT_LANDED).
// Song ids and titles are last year's pool (test material only).
import {
  PROTOCOL_VERSION,
  STANDING_LIST_MAX,
  type CheckInfo,
  type CheckOutcome,
  type CheckStep,
  type ClaimInfo,
  type FinaleInfo,
  type ClaimWarning,
  type IncomingEvent,
  type LandingInfo,
  type ShowState,
  type WinKind,
} from '@quina/protocol';
import type { FlowFields, FlowState } from '../flow.ts';
import { cardFace, type CatalogCard } from '../data/catalog.ts';

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
  // The other songs on the cards the Check fixtures claim (FIXTURE_CARDS).
  4: ['Baby', 'Justin Bieber, Ludacris'],
  12: ['capaz (merengueton)', 'Alleh, Yorghaki'],
  24: ['Flying Free', 'Pont Aeri, Marian Dacal'],
  32: ['La Bomba', 'King Africa'],
  39: ['La Vaca Lola - Remix', 'Toy Cantando'],
  46: ['Mi gran noche', 'Raphael'],
  47: ['MR. MOONDIAL', 'Quevedo, Pitbull'],
  48: ['Nada Fue Un Error', 'Coti, Andrés Calamaro'],
  53: ['On The Floor', 'Jennifer Lopez, Pitbull'],
  54: ['Puedes Contar Conmigo', 'La Oreja de Van Gogh'],
  58: ['Sense Tu', 'Teràpia de Shock'],
  61: ['The Best of Both Worlds', 'Hannah Montana'],
  64: ['Tenía Tanto Que Darte', 'Nena Daconte'],
  66: ['This Is Me', 'Demi Lovato, Joe Jonas'],
  71: ['Un Beso Y Una Flor', 'Nino Bravo'],
  73: ['Vivir Así Es Morir de Amor', 'Camilo Sesto'],
  77: ['Yo Te Esperaré', 'Cali Y El Dandee'],
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
  // The finale's «Salvats!» (FINALE_LANDED_SAVED).
  36: ['La Playa', 'La Oreja de Van Gogh'],
};

const song = (songId: number) => ({ songId, title: FIXTURE_SONGS[songId]?.[0] ?? `Cançó ${songId}`, artist: FIXTURE_SONGS[songId]?.[1] ?? '' });

/** The throw songs' track (D138, D151): «Flying Free», from its hook 15.6 s before the drop, or from the drop (the storm). */
const FLYING_FREE = { title: 'Flying Free', artist: 'Pont Aeri, Marian Dacal', dropSec: 208.76, durationSec: 406.4 };
export const FIXTURE_THROW_SONGS: ShowState['throwSongs'] = {
  throw: { ...FLYING_FREE, startSec: 193.18 },
  storm: { ...FLYING_FREE, startSec: 208.76 },
};

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
    current: { ...song(7), hookId: 'h1', firstPlay: false, posSec: 6, endsAtMs: now + 60000 },
    next: song(74),
    queue: { position, length: 77 },
    round: { number: 3, kind: 'normal', cardType: 'normal', side: 1, pool: '1', startedAtMs: now - 8 * 60000, targetEndMs: now + 18 * 60000, lineConfirmed: false },
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
    pace: { sec: 14, firstPlaySec: 22, locked: false, nudge: 1.05, slotSec: 14.7, spinSec: 7 },
    schedule: { roundEndMs: now + 27 * 60000, gameEndMs: now + 140 * 60000, roundDriftSec: 120, gameDriftSec: 300 },
    autoAtMs: now + 9000,
    transition: null,
    suspense: null,
    landings: landings(now),
    history: [],
    prizes: revealedUpTo(3),
    throwSong: null,
    throwSongs: FIXTURE_THROW_SONGS,
    lastRound: false,
    finale: null,
  };
  const flow: FlowFields = {
    scene: 'play',
    pause: null,
    shuffle: null,
    intro: null,
    claims: [],
    check: null,
    celebrationNext: null,
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

/** A state at this Heat, with the engine's sample for it already arrived (the projector eases through samples). */
const withHeat = (s: FullState, value: number, now: number): DemoScript => ({
  state: { ...s, heat: value },
  events: [{ afterMs: 100, event: { v: PROTOCOL_VERSION, type: 'heat.sample', value, fromMs: now - 40_000, toMs: now - 20_000 } }],
});

// ---- the presenter-paced Check (D107–D126) -------------------------------------------------------------
// The engine's Check (game/check.ts) worked out by hand for the printed cards the fixtures claim, so the console's
// private card, the projector's reveals and the phones' strip agree.

/** The printed cards the Check fixtures claim (apps/cards/dist/cards.json; tests/ui/fixtures.test.ts checks them): the
 * normal cards' two sides, the especial card's one. The fixtures' rounds play side 1. */
const fixtureCard = (id: number, type: string, ...sides: (readonly (readonly number[])[])[]): CatalogCard => ({ id, type, sides: sides.map((lines, i) => ({ side: i + 1, lines })) });
export const FIXTURE_CARDS: Readonly<Record<number, CatalogCard>> = {
  23: fixtureCard(23, 'normal', [[27, 47, 73, 75], [7, 17, 41, 53], [3, 4, 71, 77]], [[62, 11, 52, 75], [23, 38, 57, 72], [26, 29, 61, 73]]),
  57: fixtureCard(57, 'normal', [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]], [[1, 6, 27, 38], [9, 21, 59, 75], [2, 39, 67, 77]]),
  123: fixtureCard(123, 'normal', [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]], [[35, 34, 72, 74], [31, 50, 54, 57], [18, 22, 53, 70]]),
  204: fixtureCard(204, 'normal', [[32, 45, 50, 58], [38, 46, 61, 69], [24, 52, 54, 56]], [[7, 38, 50, 68], [14, 27, 33, 54], [26, 71, 73, 75]]),
  508: fixtureCard(508, 'especial', [[31, 32, 39, 74], [17, 48, 75, 12], [3, 35, 38, 54]]),
};

/** The engine's Check timing (engine config FLOW.check): a landed song's snippet, a ✗'s broken record, a standing ✓'s
 * knock; and the time between two presses in these fixtures. */
const PACED = { snippetMs: 2500, missMs: 1200, stillMs: 550, pressGapMs: 900 };

/** What the engine finds on a card (computeCheck): the songs its Check reveals, where the reveals stop, its outcome. */
interface CardFinding {
  outcome: CheckOutcome;
  row: number | null;
  otherRows: number[];
  cardType: string;
  /** The songs the Check reveals, in the card's grid order (a Line: its row). */
  songs: { songId: number; landed: boolean }[];
  /** The last index it reveals (the last, or the first ✗); null when it reveals none (wrongType). */
  revealUntil: number | null;
  markedCard: { songId: number; landed: boolean }[];
}

/**
 * A card's Check from the counted landings, on the round's side: a Line plays its completed row (top first), else the
 * row with most landed songs (top on a tie); a Bingo all 12; a standing claim its 12 in card order up to the first
 * landed one (never a shared win, D180). A card of another type than the round's is `wrongType`, with nothing to reveal.
 */
export function cardFinding(cardId: number, kind: WinKind, landed: ReadonlySet<number>, roundType = 'normal', side = 1): CardFinding {
  const printed = FIXTURE_CARDS[cardId];
  const card = cardFace(printed, side);
  if (printed.type !== roundType || !card) return { outcome: 'wrongType', row: null, otherRows: [], cardType: printed.type, songs: [], revealUntil: null, markedCard: [] };
  const markedCard = card.lines.flat().map((songId) => ({ songId, landed: landed.has(songId) }));
  if (kind === 'standing') {
    const first = markedCard.findIndex((s) => s.landed);
    const outcome: CheckOutcome = first < 0 ? 'complete' : 'fallen';
    return { outcome, row: null, otherRows: [], cardType: card.type, songs: markedCard, revealUntil: first < 0 ? markedCard.length - 1 : first, markedCard };
  }
  let row: number | null = null;
  let otherRows: number[] = [];
  let songs = markedCard;
  if (kind === 'line') {
    const counts = card.lines.map((line) => line.filter((id) => landed.has(id)).length);
    const complete = counts.flatMap((n, r) => (n === 4 ? [r] : []));
    row = complete[0] ?? counts.indexOf(Math.max(...counts));
    otherRows = complete.filter((r) => r !== row);
    songs = card.lines[row].map((songId) => ({ songId, landed: landed.has(songId) }));
  }
  const miss = songs.findIndex((s) => !s.landed);
  return { outcome: miss < 0 ? 'complete' : 'incomplete', row, otherRows, cardType: card.type, songs, revealUntil: miss < 0 ? songs.length - 1 : miss, markedCard };
}

/** A revealed song's sound, as the engine plays it (stepSound): its snippet, the broken record or the knock. */
const revealMs = (song: { landed: boolean }, kind: WinKind): number => (song.landed ? PACED.snippetMs : kind === 'standing' ? PACED.stillMs : PACED.missMs);

/** One Claim of a Check fixture. */
interface PacedSpec {
  claimId: string;
  cardId: number;
  kind: WinKind;
  atMs: number;
  /** How many of its songs are revealed (on screen), else it isn't on screen. */
  revealed?: number;
  /** When the last revealed song's sound started; the earlier ones a press apart before it. */
  lastAtMs?: number;
  /** When it came on screen (default: a moment before its first reveal). */
  startAtMs?: number;
  auto?: boolean;
  /** Its cue has played: it passed or failed (the Claim is decided). */
  cue?: 'pass' | 'fail';
  reviewing?: boolean;
  /** Waiting for its Check (default when not on screen). */
  queued?: boolean;
  warnings?: ClaimWarning[];
  completeSince?: number | null;
}

/** A Claim and, when it's on screen, its Check, as the engine's state carries them. */
function pacedClaim(spec: PacedSpec, round: number, landed: ReadonlySet<number>, position: number): { claim: ClaimInfo; check: CheckInfo | null } {
  const found = cardFinding(spec.cardId, spec.kind, landed, 'normal', 1);
  const onScreen = spec.revealed !== undefined && !spec.queued;
  const shown = found.songs.slice(0, spec.revealed ?? 0);
  const revealed: CheckStep[] = [];
  let at = spec.lastAtMs ?? spec.atMs;
  for (let i = shown.length - 1; i >= 0; i--) {
    const durationMs = revealMs(shown[i], spec.kind);
    revealed.unshift({ songId: shown[i].songId, landed: shown[i].landed, atMs: at, durationMs });
    if (i > 0) at -= PACED.pressGapMs + revealMs(shown[i - 1], spec.kind);
  }
  const cue = spec.cue ?? null;
  const reviewing = spec.reviewing ?? false;
  const done = found.revealUntil === null || shown.length > found.revealUntil;
  const status = cue === 'pass' ? 'valid' : cue === 'fail' ? 'invalid' : reviewing ? 'reviewing' : onScreen ? 'checking' : 'queued';
  const claim: ClaimInfo = {
    claimId: spec.claimId,
    round,
    cardId: spec.cardId,
    kind: spec.kind,
    atMs: spec.atMs,
    position,
    status,
    outcome: found.outcome,
    completeSince: spec.completeSince ?? (found.outcome === 'complete' ? position : null),
    warnings: spec.warnings ?? [],
    markedCard: found.markedCard,
    revealUntil: found.revealUntil,
    cueNext: onScreen && cue === null && !reviewing && done,
  };
  const startAtMs = spec.startAtMs ?? (revealed[0]?.atMs ?? spec.atMs + 2000) - 1500;
  const check: CheckInfo | null = onScreen
    ? {
        claimId: spec.claimId,
        cardId: spec.cardId,
        kind: spec.kind,
        outcome: found.outcome,
        row: found.row,
        otherRows: found.otherRows,
        cardType: found.cardType,
        side: 1,
        startAtMs,
        total: found.songs.length,
        revealed,
        auto: spec.auto ?? false,
        cue,
        reviewing,
      }
    : null;
  return { claim, check };
}

/**
 * A Check on screen over `s`: the round in its Hold (`claim`: the music from before the Check under Parlem), every
 * Claim of the batch, the one on screen (the spec with `revealed`), and `celebrationNext` when it's due.
 */
function pacedCheck(s: FullState, specs: readonly PacedSpec[], landed: readonly number[], celebrationNext: FullState['celebrationNext'] = null): FullState {
  const set = new Set(landed);
  const built = specs.map((spec) => pacedClaim(spec, s.round.number, set, s.queue.position));
  const first = Math.min(...specs.map((c) => c.atMs));
  return withFlow(s, {
    scene: 'check',
    status: 'hold',
    autoAtMs: null,
    hold: { sinceMs: first, reason: 'claim', holdMusic: false, holdMusicAtMs: null, ducked: true },
    claims: built.map((b) => b.claim),
    // The one on screen: the latest Claim with reveals (an earlier one already had its cue).
    check: built.filter((b) => b.check).at(-1)?.check ?? null,
    celebrationNext,
  });
}

/** Quina 3 after «Tots Som Súpers» lands too: card 123's top row is complete (its Line). */
export const FIXTURE_LANDED_LINE = [...FIXTURE_LANDED, 69];

function lineState(now: number): FullState {
  const s = baseState(now);
  return withFlow(s, {
    current: { ...song(69), hookId: 'h1', firstPlay: false, posSec: 20, endsAtMs: now + 40000 },
    queue: { ...s.queue, position: FIXTURE_LANDED_LINE.length - 1 },
    landings: landings(now, FIXTURE_LANDED_LINE, now - 20000),
  });
}


// ---- the Desgraciat round (Quina 5 in SAMPLE_PLAN) ----------------------------------------------------
// Worked out from apps/cards/dist/cards.json, so every screen agrees: the normal cards 1–210 are the round's valid
// cards in play (`baseState`'s "1-210, 400-440"), and these landings leave card #57 the last one standing. The states
// name the normal cards explicitly: SAMPLE_PLAN's Desgraciat plays its kind's default (the special cards since D70), but
// a plan may pick the normal ones (U26), and these demos exercise the round, not the card type.

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
/** The standing cards after some numbers of DESGRACIAT_LANDED (11 standing and fewer: the finale's are among them). */
export const DESGRACIAT_STANDING_AFTER: Readonly<Record<number, readonly number[]>> = {
  11: DESGRACIAT_STANDING_26,
  12: DESGRACIAT_STANDING_23,
  18: [22, 34, 51, 55, 56, 57, 72, 81, 99, 140, 184],
  19: [34, 55, 56, 57, 72, 81, 99, 140, 184],
  20: [34, 56, 57, 72, 81, 99, 140, 184],
  21: [34, 56, 57, 72, 81],
  22: [DESGRACIAT_LAST_CARD.cardId],
};

/**
 * Quina 5, the Desgraciat round, after `landed` songs of DESGRACIAT_LANDED (the newest at `lastAtMs`): the private
 * `standing` (its card list only from 60 down) and the Futur's `lastStandingAt` and `standingCurve`.
 */
export function desgraciatState(now: number, landed: number, lastAtMs = now): FullState {
  const count = DESGRACIAT_COUNTS[landed - 1] ?? 210;
  return desgraciatAfter(now, DESGRACIAT_LANDED.slice(0, landed), { count, cardIds: DESGRACIAT_STANDING_AFTER[landed] ?? null }, lastAtMs);
}

/** The Desgraciat round after the landings `ids` (the newest at `lastAtMs`), with `standing` cards left (their list
 * when known). The Futur counts down to the last card standing of DESGRACIAT_LANDED. */
function desgraciatAfter(now: number, ids: readonly number[], standing: { count: number; cardIds: readonly number[] | null }, lastAtMs: number): FullState {
  const s = baseState(now);
  const landed = ids.length;
  const { count } = standing;
  const cardIds = standing.cardIds ? [...standing.cardIds] : null;
  const last = ids[ids.length - 1];
  const lastStandingAt = DESGRACIAT_LANDED.length - 1;
  return withFlow(s, {
    current: last ? { ...song(last), hookId: 'h1', firstPlay: false, posSec: Math.max(0, (now - lastAtMs) / 1000), endsAtMs: lastAtMs + 60000 } : null,
    next: count > 1 ? song(DESGRACIAT_LANDED[landed] ?? 74) : song(74),
    queue: { position: landed - 1, length: 77 },
    round: { number: 5, kind: 'desgraciat', cardType: 'normal', side: 1, pool: '1', startedAtMs: now - 6 * 60000, targetEndMs: now + 12 * 60000, lineConfirmed: false },
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

/** A standing Check: the Desgraciat round after `landed` songs (the newest 30 s ago), its Claims as `specs`. */
function standingCheckState(now: number, landed: number, specs: readonly PacedSpec[]): FullState {
  return pacedCheck(desgraciatState(now, landed, now - 30000), specs, DESGRACIAT_LANDED.slice(0, landed));
}

// ---- the Desgraciat's finale (D161, D166–D168, D180–D187) ---------------------------------------------
// The eight cards standing after 20 landings come up on stage. «Love Story» (the 21st) takes out #99, #140 and #184;
// «All I Want for Christmas Is You» (the 22nd) takes out #34, #56, #72 and #81, so #57 wins. The «Salvats!» story plays
// «SUPERESTRELLA» 22nd instead (#34, #57 and #72 fall), then «La Playa», on the cards of both #56 and #81: it would take
// them both, so it counts for neither (D180, D181). tests/ui/fixtures.test.ts checks every fall against cards.json.

/** The finalists, entered in ascending order. */
export const FINALE_FINALISTS = DESGRACIAT_STANDING_AFTER[20];
/** The «Salvats!» story's landings. */
export const FINALE_LANDED_SAVED = [...DESGRACIAT_LANDED.slice(0, 21), 60, 36];
/** Who falls at which landing (Queue index), in each story. */
export const FINALE_FALLS: Readonly<Record<'win' | 'saved', Readonly<Record<number, readonly number[]>>>> = {
  win: { 20: [99, 140, 184], 21: [34, 56, 72, 81] },
  saved: { 20: [99, 140, 184], 21: [34, 57, 72] },
};

/**
 * The engine's `finale` after the landings `ids` (the newest at `lastAtMs`, 14 s apart): the falls of `story` up to the
 * last landing, the one left standing as the winner.
 */
function finaleAfter(ids: readonly number[], story: 'win' | 'saved', lastAtMs: number, cued = false): FinaleInfo {
  const atOf = (position: number) => lastAtMs - (ids.length - 1 - position) * 14000;
  const fallen = Object.entries(FINALE_FALLS[story])
    .map(([p, cards]) => [Number(p), cards] as const)
    .filter(([p]) => p < ids.length)
    .flatMap(([position, cards]) => cards.map((cardId) => ({ cardId, position, songId: ids[position], atMs: atOf(position) })));
  const standing = FINALE_FINALISTS.filter((id) => !fallen.some((f) => f.cardId === id));
  const lastFall = fallen.at(-1);
  const winner = standing.length === 1 && lastFall ? { cardId: standing[0], position: lastFall.position, songId: lastFall.songId, atMs: lastFall.atMs } : null;
  return { cardIds: [...FINALE_FINALISTS], standing, fallen, winner, cued };
}

/** The Desgraciat round with its finale on, after `landed` songs of DESGRACIAT_LANDED (the newest at `lastAtMs`). Auto-advance stops at a winner. */
function finaleState(now: number, landed: number, lastAtMs = now - 4000): FullState {
  const s = desgraciatState(now, landed, lastAtMs);
  const finale = finaleAfter(DESGRACIAT_LANDED.slice(0, landed), 'win', lastAtMs);
  return withFlow(s, { finale, autoAtMs: finale.winner ? null : s.autoAtMs });
}

/** The «Salvats!» story after `landed` of its songs (22 or 23). */
function savedState(now: number, landed: number, lastAtMs = now - 4000): FullState {
  const ids = FINALE_LANDED_SAVED.slice(0, landed);
  const finale = finaleAfter(ids, 'saved', lastAtMs);
  return withFlow(desgraciatAfter(now, ids, { count: finale.standing.length, cardIds: finale.standing }, lastAtMs), { finale });
}

/** A later snapshot in a live demo: `state` re-stamped at `atMs`. */
const later = (state: FullState, seq: number, atMs: number): IncomingEvent => ({ ...state, seq, atMs });

/** The finale's demos (`?demo=<name>`): the button growing, the stage, a fall, «Salvats!», the winner and the cue. */
const FINALE_FIXTURES: Record<string, (now: number) => DemoScript> = {
  /** 11 standing: «Final a l'escenari» has grown. */
  desgraciatEleven: (now) => ({ state: desgraciatState(now, 18) }),
  /** 9 standing: «Final a l'escenari» is the biggest button, ringed and recommended. */
  desgraciatNine: (now) => ({ state: desgraciatState(now, 19) }),
  /** The finale started: the eight standing after 20 songs are on stage; «+ Finalista» takes the claim slot. */
  finale: (now) => ({ state: finaleState(now, 20) }),
  /** On stage, 1.5 s in «Love Story» lands and #99, #140 and #184 fall, each at their place; at 6 s the next Spin starts
   * and they leave. */
  finaleFall: (now) => {
    const landsAt = now + 1500;
    const landed = finaleState(now, 21, landsAt);
    const spin = withFlow(landed, { status: 'transition', autoAtMs: null, transition: { id: 'tr-22', recipe: 'R7', phase: 'final', to: 1, landAtMs: now + 12000 } });
    return { state: finaleState(now, 20, now - 12500), events: [{ afterMs: 1500, event: later(landed, 2, landsAt) }, { afterMs: 6000, event: later(spin, 3, now + 6000) }] };
  },
  /** Just after that fall: the three fallen ninos faded at their places until the next Spin. */
  finaleFallen: (now) => ({ state: finaleState(now, 21) }),
  /** Two left, #56 and #81; 1.5 s in «La Playa» lands, on both their cards: «Salvats!». */
  finaleSaved: (now) => {
    const landsAt = now + 1500;
    return { state: savedState(now, 22, now - 12500), events: [{ afterMs: 1500, event: later(savedState(now, 23, landsAt), 2, landsAt) }] };
  },
  /** Five on stage; 1.5 s in the 22nd song takes out four of them and #57 is the last one standing: «Celebrem!» waits. */
  finaleWin: (now) => {
    const landsAt = now + 1500;
    return { state: finaleState(now, 21, now - 12500), events: [{ afterMs: 1500, event: later(finaleState(now, 22, landsAt), 2, landsAt) }] };
  },
  /** The presenters' cue: the Desgraciat Celebration, «QUINA POTRA!» on the projector (D186). */
  finaleCelebration: (now) => {
    const s = finaleState(now, 22, now - 60000);
    return {
      state: withFlow(s, {
        scene: 'celebration',
        status: 'playing',
        finale: finaleAfter(DESGRACIAT_LANDED, 'win', now - 60000, true),
        celebration: { kind: 'standing', round: 5, cardIds: [DESGRACIAT_LAST_CARD.cardId], winningSongId: 1, sinceMs: now - 1500, music: 'victory', parlem: false },
        winners: [...s.winners, { round: 5, kind: 'standing', cardId: DESGRACIAT_LAST_CARD.cardId, claimId: 'cl-14', winningSongId: 1, position: s.queue.position, atMs: now - 1500, name: null, notes: null }],
      }),
    };
  },
};

const FALLEN_CLAIM = { claimId: 'cl-12', cardId: DESGRACIAT_FALLEN_CARD.cardId };
const LAST_CLAIM = { claimId: 'cl-13', cardId: DESGRACIAT_LAST_CARD.cardId };

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
        intro: { round: 5, kind: 'desgraciat', cardType: 'normal', side: 1, sinceMs: now - 20000 },
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
  /** #23 claims to be standing after 12 songs: «Seguides» is revealing its songs in a row, 5 of the 7 up to «Limbo». */
  checkStanding: (now) => ({
    state: standingCheckState(now, 12, [{ ...FALLEN_CLAIM, kind: 'standing', atMs: now - 12000, revealed: 5, lastAtMs: now - 200, auto: true }]),
  }),
  /** The same Check at its cue: «Limbo», the 7th, has sounded, so the big button is «Fallada». */
  checkFallen: (now) => ({
    state: standingCheckState(now, 12, [{ ...FALLEN_CLAIM, kind: 'standing', atMs: now - 16000, revealed: 7, lastAtMs: now - 3000 }]),
  }),
  /** Just after that cue: #23 fell with «Limbo», and #57's Check comes on screen in a moment. */
  checkCueFallen: (now) => ({
    state: standingCheckState(now, 12, [
      { ...FALLEN_CLAIM, kind: 'standing', atMs: now - 18000, revealed: 7, lastAtMs: now - 4500, cue: 'fail' },
      { ...LAST_CLAIM, kind: 'standing', atMs: now - 9000 },
    ]),
  }),
  /** #57, the last one standing: all 12 revealed, none landed; the big button is «Celebrem!». */
  checkStandingValid: (now) => ({
    state: standingCheckState(now, 22, [{ ...LAST_CLAIM, kind: 'standing', atMs: now - 30000, revealed: 12, lastAtMs: now - 2500, completeSince: 21 }]),
  }),
  /** DEMPEUS! #57 wins Quina 5. */
  celebrationStanding: (now) => {
    const s = desgraciatState(now, 22, now - 60000);
    return {
      state: withFlow(s, {
        scene: 'celebration',
        status: 'playing',
        autoAtMs: null,
        celebration: { kind: 'standing', round: 5, cardIds: [57], winningSongId: 1, sinceMs: now - 1500, music: 'victory', parlem: false },
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
        intervalMusic: { set: 'breaks', track: { title: 'Last Christmas', artist: 'Wham!', index: 5, count: 24, sinceMs: now - 25000 } },
        prizes: revealedUpTo(4),
      }),
    };
  },
};

/** The Quina 3 Check fixtures' Claims (Lines). */
const CARD_57 = { claimId: 'cl-5', cardId: 57, kind: 'line' } as const;
const CARD_123 = { claimId: 'cl-7', cardId: 123, kind: 'line' } as const;
const CARD_204 = { claimId: 'cl-6', cardId: 204, kind: 'line' } as const;

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
      state: withFlow(s, { scene: 'roundStart', status: 'idle', current: null, next: null, queue: { position: -1, length: 77 }, landings: [], autoAtMs: null, round: { ...s.round, number: 4 }, intro: { round: 4, kind: 'normal', cardType: 'normal', side: 1, sinceMs: now - 20000 }, prizes: revealedUpTo(4) }),
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
  // The garland at each Heat level (ANIMATIONS.md "The garland's lights"): the engine's Heat, and a sample that has
  // already arrived, so the projector shows it at once.
  playCold: (now) => withHeat(baseState(now), 0.1, now),
  playWarm: (now) => withHeat(baseState(now), 0.4, now),
  playHot: (now) => withHeat(baseState(now), 0.65, now),
  playFire: (now) => withHeat(baseState(now), 0.92, now),
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
  // The presenter-paced Check (D107–D126), on Quina 3: #57 fails its third row at «Elefants»; #123's top row is complete
  // once «Tots Som Súpers» lands (lineState); #204 fails at its first song; #508 is a special card.
  /** #57's Check has just come on screen: nothing revealed; the first press reveals «All Night». */
  checkStarted: (now) => ({ state: pacedCheck(baseState(now), [{ ...CARD_57, atMs: now - 3000, revealed: 0, startAtMs: now - 1500 }], FIXTURE_LANDED) }),
  /** #57 halfway: «All Night» revealed, «Aserejé»'s snippet playing; #204 (not registered as sold) waits its turn. */
  check: (now) => ({
    state: pacedCheck(baseState(now), [{ ...CARD_57, atMs: now - 9000, revealed: 2, lastAtMs: now - 800 }, { ...CARD_204, atMs: now - 6000, warnings: ['notSold'] }], FIXTURE_LANDED),
  }),
  /** «Seguides» on: #57's songs reveal in a row, the third playing now. */
  checkAuto: (now) => ({ state: pacedCheck(baseState(now), [{ ...CARD_57, atMs: now - 12000, revealed: 3, lastAtMs: now - 600, auto: true }], FIXTURE_LANDED) }),
  /** #123 at its cue: its top row has all sounded, and the next press is «Celebrem!» (the fanfare and the Celebration). */
  checkValid: (now) => ({
    state: pacedCheck(lineState(now), [{ ...CARD_123, atMs: now - 20000, revealed: 4, lastAtMs: now - 3000 }], FIXTURE_LANDED_LINE),
  }),
  /** #57 at its cue: «Elefants», the 4th, didn't sound, so the next press is «Fallada» (the fail moment). */
  checkFailed: (now) => ({ state: pacedCheck(baseState(now), [{ ...CARD_57, atMs: now - 16000, revealed: 4, lastAtMs: now - 1500 }], FIXTURE_LANDED) }),
  /** #57 under review («Revisió manual») after 3 reveals; «Elefants» is next. Whatever was playing goes on. */
  checkReview: (now) => ({
    state: pacedCheck(baseState(now), [{ ...CARD_57, atMs: now - 20000, revealed: 3, lastAtMs: now - 8000, reviewing: true }], FIXTURE_LANDED),
  }),
  /**
   * #57's review went on (`reviewEnd continue`) after #204's Check took the screen meanwhile (D121): #57 is back with its
   * 3 earlier reveals, minutes old, already marked (no snippet replays them); «Elefants» waits for a press.
   */
  checkResumed: (now) => ({
    state: pacedCheck(baseState(now), [{ ...CARD_57, atMs: now - 300_000, revealed: 3, lastAtMs: now - 240_000, startAtMs: now - 200 }, { ...CARD_204, atMs: now - 290_000, warnings: ['notSold'] }], FIXTURE_LANDED),
  }),
  /** Two cards claimed: #123 at its cue (it passes, but #204 waits: «Vàlid · següent», no fanfare). */
  checkTwo: (now) => ({
    state: pacedCheck(lineState(now), [{ ...CARD_123, atMs: now - 20000, revealed: 4, lastAtMs: now - 2500 }, { ...CARD_204, atMs: now - 18000, warnings: ['notSold'] }], FIXTURE_LANDED_LINE),
  }),
  /** Just after #123's cue: valid, with its plaque and no fanfare; #204's Check comes on screen in a moment. */
  checkCuePass: (now) => ({
    state: pacedCheck(lineState(now), [{ ...CARD_123, atMs: now - 22000, revealed: 4, lastAtMs: now - 4000, cue: 'pass' }, { ...CARD_204, atMs: now - 18000, warnings: ['notSold'] }], FIXTURE_LANDED_LINE),
  }),
  /** Just after #57's cue: it failed (the fail moment), and #204's Check comes on screen in a moment. */
  checkCueFail: (now) => ({
    state: pacedCheck(baseState(now), [{ ...CARD_57, atMs: now - 20000, revealed: 4, lastAtMs: now - 3500, cue: 'fail' }, { ...CARD_204, atMs: now - 9000, warnings: ['notSold'] }], FIXTURE_LANDED),
  }),
  /** The last card (#204) failed after #123 passed: one more press («Celebrem!») starts #123's Celebration. */
  checkCelebrateNext: (now) => ({
    state: pacedCheck(
      lineState(now),
      [{ ...CARD_123, atMs: now - 30000, revealed: 4, lastAtMs: now - 16000, cue: 'pass' }, { ...CARD_204, atMs: now - 28000, revealed: 1, lastAtMs: now - 2500, cue: 'fail', warnings: ['notSold'] }],
      FIXTURE_LANDED_LINE,
      { claimId: CARD_204.claimId, step: 2 },
    ),
  }),
  /** A special card claimed in a regular round: nothing to reveal, and the first press is the cue, «Fallada». */
  checkWrongType: (now) => ({ state: pacedCheck(baseState(now), [{ claimId: 'cl-8', cardId: 508, kind: 'line', atMs: now - 3000, revealed: 0, warnings: ['notSold'] }], FIXTURE_LANDED) }),
  celebration: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'celebration',
        status: 'playing',
        autoAtMs: null,
        round: { ...s.round, lineConfirmed: true },
        celebration: { kind: 'line', round: 3, cardIds: [123], winningSongId: 69, sinceMs: now - 1500, music: 'winningSong', parlem: false },
        winners: [...s.winners, { round: 3, kind: 'line', cardId: 123, claimId: 'cl-7', winningSongId: 69, position: s.queue.position, atMs: now - 1500, name: null, notes: null }],
      }),
    };
  },
  /** A Line's Celebration with the Heat very hot: the garland's `win` with flames. */
  celebrationFire: (now) => {
    const script = FIXTURES.celebration(now);
    return withHeat(script.state as FullState, 0.92, now);
  },
  celebrationBingo: (now) => {
    const s = baseState(now);
    return {
      state: withFlow(s, {
        scene: 'celebration',
        status: 'playing',
        autoAtMs: null,
        round: { ...s.round, lineConfirmed: true },
        celebration: { kind: 'bingo', round: 3, cardIds: [57, 301], winningSongId: 7, sinceMs: now - 1500, music: 'victory', parlem: false },
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
        intervalMusic: { set: 'breaks', track: { title: 'Last Christmas', artist: 'Wham!', index: 3, count: 24, sinceMs: now - 25000 } },
      }),
    };
  },
  after: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { scene: 'after', status: 'idle', autoAtMs: null, current: null, next: null }) };
  },
  pause: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { status: 'hold', autoAtMs: null, pause: { sinceMs: now - 30000, overlay: true }, hold: { sinceMs: now - 30000, reason: 'music', holdMusic: true, holdMusicAtMs: null } }) };
  },
  suspense: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { status: 'transition', autoAtMs: null, suspense: { id: 'tr-25', sinceMs: now - 8000, autoReleaseAtMs: now + 22000 } }) };
  },
  /** Aguanta (B held): the song plays on at full volume, nothing lands, and Següent waits (D133). */
  stay: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { status: 'hold', autoAtMs: null, hold: { sinceMs: now - 6000, reason: 'hold', holdMusic: false, holdMusicAtMs: null, ducked: false } }) };
  },
  /** In play; 1.5 s in, Pausa starts (A's badge glides to «Acaba la pausa», D128), and 4 s later it ends. */
  pauseStart: (now) => {
    const s = baseState(now);
    const paused = withFlow(s, { status: 'hold', autoAtMs: null, pause: { sinceMs: now + 1500, overlay: true }, hold: { sinceMs: now + 1500, reason: 'pause', holdMusic: true, holdMusicAtMs: null, ducked: true } });
    const back = withFlow(s, { status: 'hold', autoAtMs: null, hold: { sinceMs: now + 5500, reason: 'pause', holdMusic: false, holdMusicAtMs: null, ducked: true } });
    return { state: s, events: [{ afterMs: 1500, event: { ...paused, seq: 2 } }, { afterMs: 5500, event: { ...back, seq: 3 } }] };
  },
  /** A break with «Llançament» playing over the break music (D138), 42 s in: started at its hook 42 s ago. */
  intervalThrow: (now) => {
    const s = FIXTURES.interval(now).state as FullState;
    const track = FIXTURE_THROW_SONGS.throw;
    return { state: { ...s, throwSong: { ...track, song: 'throw', playing: true, sinceMs: now - 42000, posSec: track.startSec } } };
  },
  /** A break with «Llançament» stopped by a tap at 1:05 from its hook: the next tap resumes it; the break music is back up. */
  intervalThrowStopped: (now) => {
    const s = FIXTURES.interval(now).state as FullState;
    const track = FIXTURE_THROW_SONGS.throw;
    return { state: { ...s, throwSong: { ...track, song: 'throw', playing: false, sinceMs: now - 5000, posSec: track.startSec + 65 } } };
  },
  /** The night's last round in play (Quina 8 of 8): «Tempesta» joins the top row (D155). */
  lastRound: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { lastRound: true, phase: 'final', round: { ...s.round, number: 8 } }) };
  },
  /** The last round's Check: «Tempesta» between «Enrere» and «Revisió manual». */
  checkLastRound: (now) => {
    const s = FIXTURES.check(now).state as FullState;
    return { state: { ...s, lastRound: true, round: { ...s.round, number: 8 } } };
  },
  /** The end screen with the end music: «Tempesta» alone in the big place, no «Enrere» or «Comprovar» (D194, D199). */
  afterMusic: (now) => {
    const s = FIXTURES.after(now).state as FullState;
    return { state: { ...s, intervalMusic: { set: 'end', track: { title: 'Feliz Navidad', artist: 'José Feliciano', index: 1, count: 50, sinceMs: now - 20000 } } } };
  },
  /** The end screen with «Tempesta» playing from its drop (D151, D153). */
  afterStorm: (now) => {
    const s = FIXTURES.afterMusic(now).state as FullState;
    const track = FIXTURE_THROW_SONGS.storm;
    return { state: { ...s, throwSong: { ...track, song: 'storm', playing: true, sinceMs: now - 20000, posSec: track.startSec } } };
  },
  /** Some volume sliders moved at the sound check (D139, D157): the menu shows them against their defaults. */
  volumes: (now) => {
    const s = baseState(now);
    return { state: withFlow(s, { game: { ...s.game, volumes: { master: 92, songs: 100, songsParlem: 38, djFx: 110, padFx: 100, ticks: 70, check: 100, holdMusic: 100, win: 125, fail: 100, finalLap: 100, intros: 85, breaks: 100, pausa: 60, throws: 141, doors: 100, end: 100 } } }) };
  },
  ...DESGRACIAT_FIXTURES,
  ...FINALE_FIXTURES,
};

export const FIXTURE_NAMES = Object.keys(FIXTURES);
