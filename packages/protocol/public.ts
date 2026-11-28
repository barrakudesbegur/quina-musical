// The public feed: what players' phones receive from the cloud. Defined by Platform (quina-musical-b2) and UI
// (quina-musical-1e) together; docs/protocol.md explains it.
//
// It is a WHITELIST, built by the cloud from the Game it keeps (cloud/src/domain/projection.ts). It never carries
// the Queue, the next song, possible winners, the Phase, the real Heat, `roundEndMs`, claim details or winners'
// names. A song becomes public only once the laptop has journalled its landing, so phones follow the projector
// and never lead it.
//
// Phones send nothing: they connect to `/feed?cards=12,123` (the card numbers feed Admin's anonymous "cards
// opened on phones"), get one `public.state` snapshot, then `public.delta` messages. Every message carries the
// feed's `seq`; a phone that sees a gap, or a delta before any snapshot, reconnects for a fresh snapshot.
// No heartbeats and no polling: reconnect with `reconnectDelayMs` when the socket closes. Back in the foreground,
// reconnect only if the socket closed meanwhile (an open one is fine): every connection is a billed request.
//
// Times are epoch ms on the cloud's clock. Every message carries `nowMs` (the cloud's clock when it was sent),
// so a phone estimates its own offset as `nowMs - Date.now()` on arrival.
import { PROTOCOL_VERSION, type ProtocolVersion, type RoundKind, type ShowScene, type WinKind } from './vocabulary.ts';
import type { PublicPlan } from './plan.ts';

/** The phones' tunables. */
export const PUBLIC_FEED = Object.freeze({
  /** At most this many card numbers in `?cards=`; more are refused. */
  maxCardsPerPhone: 30,
  /** The highest card number a phone may name. */
  maxCardNumber: 9999,
  /** Phones show "Connexió perduda, tornem de seguida" once the laptop has been offline this long. */
  offlineNoticeAfterMs: 20_000,
  /** Reconnect: full jitter, the first retry within 1 s, doubling up to 30 s. */
  reconnectFirstMs: 1_000,
  reconnectCapMs: 30_000,
  /** Back in the foreground: reconnect after a random wait of up to this long, so phones don't arrive together. */
  resumeJitterMs: 2_000,
  /** `gameEndMs` is rounded to this, so it never gives the Phase away. */
  gameEndRoundingMs: 5 * 60_000,
});

/** Where the show is: the protocol's `ShowScene`. */
export type PublicScene = ShowScene;
/** A Line or a Bingo ("Línia", "Quina!"). */
export type PublicWinKind = WinKind;

/** A counted landing: the song counts from `atMs`. */
export interface PublicLanding {
  /** Its Queue index. Landings are kept in Queue order. */
  position: number;
  songId: number;
  atMs: number;
}

export interface PublicRound {
  number: number;
  kind: RoundKind;
  /** The printed card type it plays: a card counts in it when `card.type === cardType`. Absent from an older cloud:
   * defaultCardType(kind). */
  cardType?: string;
  /** The card's side it plays (D178): phones mark that side's songs. Absent means 1. */
  side?: number;
  /** PUBLIC (D237): the drum's tile order, `drumOrder(songIds, drumSeed)`, so a phone lays out the projector's drum.
   * Drawn on its own: it tells nothing about the Queue. Absent from an older engine or cloud. */
  drumSeed?: number;
  startedAtMs: number;
  lineConfirmed: boolean;
  /** The round is over (every landed song is already marked on the phones as it lands). */
  ended: boolean;
  /** Counted landings only; Back removes one. */
  landings: PublicLanding[];
}

/** A Spin in progress: its timing, its seed and, since U206, its landing song (the screens reveal it only at landAtMs). */
export interface PublicSpin {
  startAtMs: number;
  /** null while a Suspense is held open. */
  landAtMs: number | null;
  /** PUBLIC (D237): the drum solver's seed, so a phone's solveSpin replays the projector's trajectory. Absent while a
   * Suspense is held open, and from an older engine or cloud. */
  spinSeed?: number;
  /**
   * The song the Spin lands on (U206, the user: sending it early is fine as long as it's revealed at the right time):
   * from the Spin's start, so a phone solves the projector's very Spin onto its tile (drumOrder) and lands with it.
   * Phones must not show the song before `landAtMs`. A Back may still cancel the Spin, and that song then stays next.
   * Absent while a Suspense is held open (its landing isn't chosen yet), and from an older engine or cloud.
   */
  targetId?: number;
}

/** The round's public Shuffle: the phone animates it between these times. Never the Queue. */
export interface PublicShuffle {
  round: number;
  startAtMs: number;
  endAtMs: number;
}

/** A Heat sample: ease towards `value` between `fromMs` and `toMs` (the UI's shared `heatAt`). */
export interface PublicHeat {
  value: number;
  fromMs: number;
  toMs: number;
}

/** The Check on screen. Its steps are never published: the result shows only once decided. */
export interface PublicCheck {
  round: number;
  cardId: number;
  kind: PublicWinKind;
  result: 'pending' | 'valid' | 'invalid';
}

/** One prize won: a round's Line or Bingo. */
export interface PublicWinner {
  round: number;
  kind: PublicWinKind;
  /** Several when claims on the same landing share the prize. */
  cardIds: number[];
}

export interface PublicInterval {
  nextRound: number;
  /** Only a guide for the countdown. */
  guideEndMs: number;
}

/** The pulse of the song the room hears (the protocol's BeatInfo) on the cloud's clock, for the phones' marks to bob
 * in time. Never the incoming song's beat before its Spin's transition.scheduled (which makes the landing song public). */
export interface PublicBeat {
  /** Beats per minute as heard. */
  bpm: number;
  /** Beats in a bar (4 for almost every song; 3 and 2 exist). */
  beatsPerBar: number;
  /** A bar's first beat, epoch ms on the cloud's clock: normally a recent one (in the past); ahead of now only for a
   * Spin's landing. A phone counts beats from it, forwards or backwards. */
  downbeatAtMs: number;
}

/** Whether the show laptop is connected to the cloud, and since when. */
export interface PublicLink {
  online: boolean;
  sinceMs: number;
}

export interface PublicState {
  /** The year tag ('26', as in quina.barrakudesbegur.org/26/123). Phones tag their saved cards with it. */
  edition: string;
  /** The Game being played: a rehearsal and the real night are different Games. A change resets the rounds,
   * never the phone's cards. null before the laptop's first Game. */
  gameId: string | null;
  scene: PublicScene;
  /** In `roundStart`, before its Shuffle: the round being introduced (its prizes are announced), and its card type
   * (absent from an older cloud: defaultCardType(kind)). */
  intro: { round: number; kind: RoundKind; cardType?: string; side?: number } | null;
  /** The Shuffle while it runs. */
  shuffle: PublicShuffle | null;
  /** The presenters' technical pause ("Tornem de seguida"), over the scene. */
  pause: { sinceMs: number } | null;
  link: PublicLink;
  /** Every round of this Game so far; the last one is the current round. */
  rounds: PublicRound[];
  spin: PublicSpin | null;
  heat: PublicHeat | null;
  check: PublicCheck | null;
  winners: PublicWinner[];
  interval: PublicInterval | null;
  /** The expected end of the Game, rounded to `gameEndRoundingMs`. */
  gameEndMs: number | null;
  /**
   * The Game plan from Admin as phones may see it (plan.ts publicPlan): rounds, sponsors with logo paths, card
   * types, schedule, and only the revealed rounds' prizes (a locked round shows no bundle and no count; never the
   * cheat sheet). Null until one is set.
   */
  plan: PublicPlan | null;
  /** Admin's banner to every phone. */
  notice: string | null;
  /** Admin's default for interface sounds; a player's own choice wins. */
  soundsDefault: boolean;
  /** The phones' «LÍNIA!»/«QUINA!» over a card that completes one (the Game's settings, GameSettings.announceWins).
   * Optional in the type only: a feed state stored before it, or an older cloud, lacks it, and absent means true. */
  announceWins?: boolean;
  /** The pulse of the song heard, for the phones' marks; null when no song is heard. Optional in the type only: a feed
   * state stored before it, or an older cloud, lacks it, and absent means no beat. */
  beat?: PublicBeat | null;
}

/** One change to the public state. The cloud and the phones apply them with the same `applyPublic`. */
export type PublicChange =
  | { kind: 'round'; round: PublicRound }
  | { kind: 'roundEnded'; round: number }
  | { kind: 'landed'; round: number; landing: PublicLanding }
  | { kind: 'undone'; round: number; position: number }
  | { kind: 'line'; round: number }
  | { kind: 'spin'; spin: PublicSpin | null }
  | { kind: 'heat'; heat: PublicHeat | null }
  | { kind: 'scene'; scene: PublicScene }
  | { kind: 'intro'; intro: { round: number; kind: RoundKind; cardType?: string } | null }
  | { kind: 'shuffle'; shuffle: PublicShuffle | null }
  | { kind: 'check'; check: PublicCheck | null }
  | { kind: 'winner'; winner: PublicWinner }
  | { kind: 'interval'; interval: PublicInterval | null }
  | { kind: 'pause'; pause: { sinceMs: number } | null }
  | { kind: 'link'; link: PublicLink }
  | { kind: 'gameEnd'; gameEndMs: number | null }
  | { kind: 'plan'; plan: PublicPlan | null }
  | { kind: 'notice'; notice: string | null }
  | { kind: 'sounds'; soundsDefault: boolean }
  | { kind: 'announceWins'; announceWins: boolean }
  | { kind: 'beat'; beat: PublicBeat | null };
export type PublicChangeKind = PublicChange['kind'];

/** The whole public state: on connect, and whenever the Game changes. */
export interface PublicSnapshot {
  v: ProtocolVersion;
  type: 'public.state';
  seq: number;
  nowMs: number;
  state: PublicState;
}

/** Changes that happened together (a landing also stops the Spin). `seq` is the snapshot's plus one per delta. */
export interface PublicDelta {
  v: ProtocolVersion;
  type: 'public.delta';
  seq: number;
  nowMs: number;
  changes: PublicChange[];
}

export type PublicMessage = PublicSnapshot | PublicDelta;

/** The public state before anything happened. */
export function emptyPublicState(edition: string): PublicState {
  return {
    edition,
    gameId: null,
    scene: 'before',
    intro: null,
    shuffle: null,
    pause: null,
    link: { online: false, sinceMs: 0 },
    rounds: [],
    spin: null,
    heat: null,
    check: null,
    winners: [],
    interval: null,
    gameEndMs: null,
    plan: null,
    notice: null,
    soundsDefault: true,
    announceWins: true,
    beat: null,
  };
}

/** A fresh Game in the same edition: the Game's own parts reset (announceWins and the beat among them), the edition's
 * (plan, notice, sounds, link) stay. */
export function newGamePublicState(previous: PublicState, gameId: string | null): PublicState {
  return {
    ...emptyPublicState(previous.edition),
    gameId,
    link: previous.link,
    plan: previous.plan,
    notice: previous.notice,
    soundsDefault: previous.soundsDefault,
  };
}

/** Apply changes in order. Pure: the state passed in is never changed. */
export function applyPublic(state: PublicState, changes: readonly PublicChange[]): PublicState {
  let next = state;
  for (const change of changes) next = applyOne(next, change);
  return next;
}

function applyOne(state: PublicState, change: PublicChange): PublicState {
  switch (change.kind) {
    case 'round':
      // A round restarted with the same number replaces the old one.
      return { ...state, rounds: [...state.rounds.filter((r) => r.number !== change.round.number), change.round] };
    case 'roundEnded':
      return withRound(state, change.round, (r) => ({ ...r, ended: true }));
    case 'landed':
      return withRound(state, change.round, (r) => ({
        ...r,
        landings: [...r.landings.filter((l) => l.position !== change.landing.position), change.landing].sort((a, b) => a.position - b.position),
      }));
    case 'undone':
      return withRound(state, change.round, (r) => ({ ...r, landings: r.landings.filter((l) => l.position !== change.position) }));
    case 'line':
      return withRound(state, change.round, (r) => ({ ...r, lineConfirmed: true }));
    case 'spin':
      return { ...state, spin: change.spin };
    case 'heat':
      return { ...state, heat: change.heat };
    case 'scene':
      return { ...state, scene: change.scene };
    case 'intro':
      return { ...state, intro: change.intro };
    case 'shuffle':
      return { ...state, shuffle: change.shuffle };
    case 'check':
      return { ...state, check: change.check };
    case 'winner': {
      // One entry per prize: a shared prize lists every winning card.
      const { round, kind, cardIds } = change.winner;
      const existing = state.winners.find((w) => w.round === round && w.kind === kind);
      if (!existing) return { ...state, winners: [...state.winners, { round, kind, cardIds: [...new Set(cardIds)] }] };
      const merged = { ...existing, cardIds: [...new Set([...existing.cardIds, ...cardIds])] };
      return { ...state, winners: state.winners.map((w) => (w === existing ? merged : w)) };
    }
    case 'interval':
      return { ...state, interval: change.interval };
    case 'pause':
      return { ...state, pause: change.pause };
    case 'link':
      return { ...state, link: change.link };
    case 'gameEnd':
      return { ...state, gameEndMs: change.gameEndMs };
    case 'plan':
      return { ...state, plan: change.plan };
    case 'notice':
      return { ...state, notice: change.notice };
    case 'sounds':
      return { ...state, soundsDefault: change.soundsDefault };
    case 'announceWins':
      return { ...state, announceWins: change.announceWins };
    case 'beat':
      return { ...state, beat: change.beat };
    default:
      change satisfies never;
      return state;
  }
}

function withRound(state: PublicState, number: number, update: (round: PublicRound) => PublicRound): PublicState {
  if (!state.rounds.some((r) => r.number === number)) return state;
  return { ...state, rounds: state.rounds.map((r) => (r.number === number ? update(r) : r)) };
}

/** What a phone has: the last state and the `seq` it is at. */
export interface PublicView {
  seq: number;
  state: PublicState;
}

/**
 * Follow the feed on a phone. `ok` gives the new view; `resync` means reconnect for a fresh snapshot (a gap,
 * or a delta before any snapshot); `ignore` is a message this version doesn't know. Never throws.
 */
export function followFeed(view: PublicView | null, message: unknown):
  | { kind: 'ok'; view: PublicView }
  | { kind: 'resync' }
  | { kind: 'ignore' } {
  if (!isPublicMessage(message)) return { kind: 'ignore' };
  if (message.type === 'public.state') return { kind: 'ok', view: { seq: message.seq, state: message.state } };
  if (!view || message.seq !== view.seq + 1) return { kind: 'resync' };
  return { kind: 'ok', view: { seq: message.seq, state: applyPublic(view.state, message.changes) } };
}

/** A public message of this protocol version. It trusts the cloud for the fields. */
export function isPublicMessage(message: unknown): message is PublicMessage {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || !Number.isInteger(m.seq) || typeof m.nowMs !== 'number') return false;
  if (m.type === 'public.state') return Boolean(m.state) && typeof m.state === 'object';
  return m.type === 'public.delta' && Array.isArray(m.changes);
}

/**
 * How long to wait before reconnect attempt number `attempt` (0 for the first): full jitter, a random wait
 * between 0 and min(cap, first × 2^attempt), so a crowd of phones never comes back at the same moment.
 */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random, first: number = PUBLIC_FEED.reconnectFirstMs, cap: number = PUBLIC_FEED.reconnectCapMs): number {
  const ceiling = Math.min(cap, first * 2 ** Math.max(0, Math.min(attempt, 30)));
  return Math.floor(random() * ceiling);
}

/** The `?cards=` value for a phone's cards: unique, sorted, comma-separated. */
export function cardsParam(cards: readonly number[]): string {
  return [...new Set(cards)].sort((a, b) => a - b).join(',');
}

/** Read `?cards=`: card numbers 1..maxCardNumber, at most maxCardsPerPhone. null when malformed. Empty is fine. */
export function parseCardsParam(text: string | null): number[] | null {
  if (!text) return [];
  const parts = text.split(',');
  if (parts.length > PUBLIC_FEED.maxCardsPerPhone) return null;
  const cards: number[] = [];
  for (const part of parts) {
    if (!/^[1-9][0-9]{0,3}$/.test(part)) return null;
    const card = Number(part);
    if (card > PUBLIC_FEED.maxCardNumber) return null;
    cards.push(card);
  }
  return [...new Set(cards)].sort((a, b) => a - b);
}

/** Round a time to `gameEndRoundingMs`. */
export function roundGameEnd(ms: number | null): number | null {
  if (ms === null) return null;
  const step = PUBLIC_FEED.gameEndRoundingMs;
  return Math.round(ms / step) * step;
}
