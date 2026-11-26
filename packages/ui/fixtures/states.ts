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
  type ClaimWarning,
  type IncomingEvent,
  type LandingInfo,
  type ShowState,
  type WinKind,
} from '@quina/protocol';
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

// ---- the presenter-paced Check (D107–D126) -------------------------------------------------------------
// The engine's Check (game/check.ts) worked out by hand for the printed cards the fixtures claim, so the console's
// private card, the projector's reveals and the phones' strip agree.

/** The printed cards the Check fixtures claim (apps/cards/dist/cards.json; tests/ui/fixtures.test.ts checks them). */
export const FIXTURE_CARDS: Readonly<Record<number, { type: string; lines: readonly (readonly number[])[] }>> = {
  23: { type: 'normal', lines: [[27, 47, 73, 75], [7, 17, 41, 53], [3, 4, 71, 77]] },
  57: { type: 'normal', lines: [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]] },
  123: { type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] },
  204: { type: 'normal', lines: [[32, 45, 50, 58], [38, 46, 61, 69], [24, 52, 54, 56]] },
  508: { type: 'especial', lines: [[31, 32, 39, 74], [17, 48, 75, 12], [3, 35, 38, 54]] },
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
 * A card's Check from the counted landings: a Line plays its completed row (top first), else the row with most landed
 * songs (top on a tie); a Bingo all 12; a standing claim its 12 in card order up to the first landed one (`fellLast`
 * when that is the latest landing). A card of another type than the round's is `wrongType`, with nothing to reveal.
 */
export function cardFinding(cardId: number, kind: WinKind, landed: ReadonlySet<number>, roundType = 'normal', latest: number | null = null): CardFinding {
  const card = FIXTURE_CARDS[cardId];
  const markedCard = card.lines.flat().map((songId) => ({ songId, landed: landed.has(songId) }));
  if (card.type !== roundType) return { outcome: 'wrongType', row: null, otherRows: [], cardType: card.type, songs: [], revealUntil: null, markedCard: [] };
  if (kind === 'standing') {
    const first = markedCard.findIndex((s) => s.landed);
    const outcome: CheckOutcome = first < 0 ? 'complete' : markedCard[first].songId === latest ? 'fellLast' : 'fallen';
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
function pacedClaim(spec: PacedSpec, round: number, landed: ReadonlySet<number>, position: number, latest: number | null): { claim: ClaimInfo; check: CheckInfo | null } {
  const found = cardFinding(spec.cardId, spec.kind, landed, 'normal', latest);
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
  const latest = landed[landed.length - 1] ?? null;
  const built = specs.map((spec) => pacedClaim(spec, s.round.number, set, s.queue.position, latest));
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
    current: last ? { ...song(last), hookId: 'h1', firstPlay: false, posSec: Math.max(0, (now - lastAtMs) / 1000), endsAtMs: lastAtMs + 60000 } : null,
    next: count > 1 ? song(DESGRACIAT_LANDED[landed] ?? 74) : song(74),
    queue: { position: landed - 1, length: 77 },
    round: { number: 5, kind: 'desgraciat', cardType: 'normal', startedAtMs: now - 6 * 60000, targetEndMs: now + 12 * 60000, lineConfirmed: false },
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
  /** The end screen with the end music: «Tempesta» in Següent's place, «Llançament» beside it. */
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
};

export const FIXTURE_NAMES = Object.keys(FIXTURES);
