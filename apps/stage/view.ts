// The projector's privacy boundary. The stage runs on the show laptop and receives the full state, which
// holds secrets the audience must never see: the next song (`next`, `transition.to`), the Queue, possible
// winners, the Phase, claims and their warnings, winners' names and notes. Winning card numbers aren't secret
// but are never shown either (the user's review: "people don't care who won unless it's them"), so they don't
// come out: only the Check names the card being checked, and the Desgraciat's finale its finalists, who are on stage
// (D161: their numbers and fates, never their cards). No prize comes out either, revealed or not (D311: none on the
// projector for now; D311 lists where they were). `stageView` picks out only what the projector may
// draw, and the DOM code reads nothing else. Pure; tests/ui/stage/view.test.ts checks that no private field
// ever comes out.
import { DEFAULT_SIDE, type RoundKind, type ShowState } from '@quina/protocol';
import type { CheckInfo, FlowFields, WinKind } from '../../packages/ui/flow.ts';
import { roundPlan, roundTitle, type GamePlan } from '../../packages/ui/plan.ts';
import { catalogFace, type Catalog } from '../../packages/ui/data/catalog.ts';
import { comingRoundPrice, knownCardTypes, type ComingRoundPrice } from '../../packages/ui/data/card-types.ts';
import { STAGE } from './config.ts';
import { stageScene } from './model/scene.ts';
import { revealedSongs, type LandedNote, type SongLookup, type StageSong } from './model/songs.ts';
import { motionView, type MotionView, type SpinNote } from './model/motion.ts';
import { finaleView, type FinaleView } from './model/finale.ts';
import { cardTypeBadge, checkCells, checkTypeOk, NO_CHECK_MEMORY, shownCheck, verdictOf, type CheckMemory, type CheckView } from './model/check.ts';
import { nightCardTypes, type NightCardType } from './model/night.ts';
import { shuffleTimeline, type ShuffleTimeline } from './model/shuffle.ts';
import { playerAppLink } from './model/qr.ts';
import { STAGE_TEXT, nextRoundLabel } from './strings.ts';

/** A sponsor as the projector shows it (`label`: its public name; a winner's name never gets here). */
export interface SponsorView {
  label: string;
  logo: string | null;
}

export interface RoundView {
  /** Its number in the plan (the engine's), not the one on screen. */
  number: number;
  special: boolean;
  desgraciat: boolean;
  /** Its name, "Quina 4" by its Quina number, "Quina Especial", "Quina del Desgraciat" (plan.ts roundTitle): `label`,
   * as everywhere on the stage (`name` is a winner's, which never comes out). */
  label: string;
}

export interface LinkView {
  href: string;
  label: string;
}

export interface BeforeView {
  scene: 'before';
  startAtMs: number | null;
  /** The night's preview: each card type that plays, its colour, price and rounds (model/night.ts). */
  cardTypes: NightCardType[];
  sponsors: SponsorView[];
  link: LinkView;
}

/** A round's intro: its name, never its prizes (D311: no prizes on the projector for now; the presenters read them
 * from the console and phones have Premis). */
export interface RoundStartView {
  scene: 'roundStart';
  round: RoundView | null;
  shuffle: (ShuffleTimeline & { key: string }) | null;
  /** Song ids for the Shuffle's grid, by id (never in Queue order: the stage doesn't know it). */
  tiles: number[];
}

export interface PlayView {
  scene: 'play';
  round: RoundView | null;
  /** The drum's motion: timestamps only, never the incoming song. */
  motion: MotionView | null;
  /** The Desgraciat's finale on stage (D161): the finalists' numbers and fates, public by design; their cards never. */
  finale: FinaleView | null;
}

export interface CheckSceneView {
  scene: 'check';
  check: CheckView;
}

/** No winning card numbers and no prize (D311, for now): the shout and the round's name on its gold plate (U175
 * item 7). */
export interface CelebrationView {
  scene: 'celebration';
  key: string;
  kind: WinKind;
  round: RoundView;
}

/** The Interval: the next round and the countdown guide. No winning card numbers, no QR, no prizes. */
export interface IntervalView {
  scene: 'interval';
  /** The round about to start (named `nextRound`: `next` is the private next song everywhere else). */
  nextRound: RoundView;
  /** "Següent: Quina 4 de 8" (strings.ts nextRoundLabel). */
  plate: string;
  sinceMs: number;
  guideEndMs: number | null;
  sponsors: SponsorView[];
  /** The coming round's card and its price (ANIMATIONS.md `price-tag`), or null when no price is set. */
  price: PriceView | null;
}

/** A card type's price tag: its name and colour, and the price in cents. */
export interface PriceView {
  label: string;
  color: string;
  cents: number;
}

const priceView = (p: ComingRoundPrice | null): PriceView | null => (p ? { label: p.label.name, color: p.label.color, cents: p.cents } : null);

/** Thanks and the sponsors' credits; no winning card numbers. */
export interface AfterView {
  scene: 'after';
  sponsors: SponsorView[];
}

export type SceneView = BeforeView | RoundStartView | PlayView | CheckSceneView | CelebrationView | IntervalView | AfterView;

/** Everything the projector may draw. */
export interface StageView {
  /** A snapshot has been received (until then the stage shows the before scene and fires no moments). */
  synced: boolean;
  title: string;
  /** A technical pause: "Tornem de seguida" over any scene. */
  paused: boolean;
  /** The round's revealed songs, newest first (landed only, each with its landing time). */
  songs: StageSong[];
  body: SceneView;
}

/** What the stage learnt from events between snapshots (already stripped of secrets by the source). */
export interface LiveNotes {
  landed: readonly LandedNote[];
  spin: SpinNote | null;
  /** The Check between snapshots: the last one on screen, a review's start, a step back (model/check.ts). */
  check?: CheckMemory;
}

const NO_NOTES: LiveNotes = { landed: [], spin: null, check: NO_CHECK_MEMORY };

/** Round `number` and its kind: the plan's, else `known` (the intro's), else the state's for its current round. */
function roundOf(number: number | null | undefined, plan: GamePlan | null, state: ShowState | null, known: RoundKind | null = null): { number: number; kind: RoundKind } | null {
  if (!number || number < 1) return null;
  return { number, kind: roundPlan(plan, number)?.kind ?? known ?? (state?.round.number === number ? state.round.kind : 'normal') };
}

function roundView(round: { number: number; kind: RoundKind }, plan: GamePlan | null): RoundView {
  return { number: round.number, special: round.kind === 'special', desgraciat: round.kind === 'desgraciat', label: roundTitle(round, plan) };
}


const sponsorsOf = (plan: GamePlan | null): SponsorView[] => (plan?.sponsors ?? []).map((s) => ({ label: s.name, logo: s.logo }));

/** Titles from the snapshot's landed songs first, then the catalog. */
function songLookup(state: ShowState | null, catalog: Catalog | null): SongLookup {
  const fromState = new Map<number, { title: string; artist: string }>();
  for (const l of state?.landings ?? []) if (!l.undone && l.title) fromState.set(l.songId, { title: l.title, artist: l.artist });
  if (state?.current?.title) fromState.set(state.current.songId, { title: state.current.title, artist: state.current.artist });
  return (songId) => fromState.get(songId) ?? catalog?.songs.get(songId) ?? null;
}

/**
 * The Check as the projector may draw it. Nothing private comes out: the result (`verdict`) only from the cue, the type
 * badge's ✗ with it, the grid from the printed card (public) and the revealed songs.
 */
function checkView(shown: { check: CheckInfo; discarded: boolean }, plan: GamePlan | null, catalog: Catalog | null, lookup: SongLookup, memory: CheckMemory): CheckView {
  const c = shown.check;
  const steps = c.revealed.map((s) => ({ songId: s.songId, landed: s.landed, atMs: s.atMs, durationMs: s.durationMs }));
  const row = c.kind === 'line' ? c.row : null;
  // The side checked: the round's (an older engine sends none: side 1).
  const card = catalogFace(catalog, c.cardId, c.side ?? DEFAULT_SIDE);
  const review = memory.review?.claimId === c.claimId ? memory.review.atMs : null;
  const back = memory.unrevealed;
  // A step back replays the song before the one it took off: the new last revealed one. Only one made since this Check
  // came on screen: one from before a review that left the screen (D121) replays nothing when the Check comes back.
  const replayed = back && back.claimId === c.claimId && back.atMs >= c.startAtMs && back.index === steps.length && back.index > 0 ? steps[back.index - 1] : null;
  return {
    key: `${c.cardId}@${c.startAtMs}`,
    cardId: c.cardId,
    kind: c.kind,
    cardType: cardTypeBadge(c.cardType, c.side ?? DEFAULT_SIDE, checkTypeOk(c), knownCardTypes(catalog?.cardTypes), plan),
    verdict: verdictOf(c.outcome, c.cue, c.kind),
    row,
    total: c.total,
    // A card of the wrong type has nothing to reveal: no grid, only its type (and, at the cue, its big card).
    cells: c.total > 0 ? checkCells(card, steps, row, (id) => lookup(id)?.title ?? null) : [],
    steps,
    startAtMs: c.startAtMs,
    reviewing: c.reviewing,
    reviewSinceMs: c.reviewing ? review : null,
    replay: replayed && back ? { step: back.index - 1, fromMs: back.atMs, toMs: back.atMs + replayed.durationMs } : null,
    discarded: shown.discarded,
  };
}

function sceneView(state: ShowState | null, flow: FlowFields, plan: GamePlan | null, catalog: Catalog | null, lookup: SongLookup, notes: LiveNotes): SceneView {
  const memory = notes.check ?? NO_CHECK_MEMORY;
  const shown = shownCheck(flow, state?.hold?.reason ?? null, memory.last);
  const scene = shown ? 'check' : stageScene(flow);
  const link = playerAppLink(plan?.edition, STAGE.playerApp);
  const roundNumber = state?.round.number ?? 0;
  const current = roundOf(roundNumber, plan, state);
  const play = (): PlayView => {
    const motion = motionView(state, notes.spin);
    // A Spin (or a Suspens) since the last landing clears the fallen from the stage (`finale-clear`).
    return { scene: 'play', round: current && roundView(current, plan), motion, finale: state && finaleView(state, catalog, motion !== null) };
  };
  switch (scene) {
    case 'before': {
      // Before the Game counts as round 1's Interval (U5): round 1's card type shows its price, the others none.
      const types = knownCardTypes(catalog?.cardTypes);
      const price = comingRoundPrice(plan, 1, types);
      const cardTypes = nightCardTypes(plan, types).map((t) => ({ ...t, priceCents: price && t.type === price.type ? price.cents : null }));
      return { scene, startAtMs: plan?.schedule.startAtMs ?? null, cardTypes, sponsors: sponsorsOf(plan), link };
    }
    case 'roundStart': {
      // The round being introduced (`intro`, set before the Shuffle) names it; then the Shuffle's; then the state's.
      const intro = flow.intro;
      const number = intro?.round ?? flow.shuffle?.round ?? roundNumber;
      const s = flow.shuffle;
      const round = roundOf(number, plan, state, intro?.round === number ? intro.kind : null);
      return {
        scene,
        round: round && roundView(round, plan),
        shuffle: s ? { ...shuffleTimeline(s.startAtMs, s.endAtMs, STAGE.shuffle.split), key: `${s.round}@${s.startAtMs}` } : null,
        tiles: catalog ? [...catalog.songs.keys()].sort((a, b) => a - b) : [],
      };
    }
    case 'check':
      // stageScene only returns 'check' with a Check present, and so does shownCheck.
      return shown ? { scene, check: checkView(shown, plan, catalog, lookup, memory) } : play();
    case 'celebration': {
      const c = flow.celebration;
      if (!c) return play();
      const round = roundView(roundOf(c.round, plan, state, c.kind === 'standing' ? 'desgraciat' : null) ?? { number: c.round, kind: 'normal' }, plan);
      return { scene, key: `${c.round}:${c.kind}@${c.sinceMs}`, kind: c.kind, round };
    }
    case 'interval': {
      const i = flow.interval;
      const number = i?.nextRound ?? roundNumber + 1;
      const next = roundOf(number, plan, state) ?? { number, kind: 'normal' as const };
      return {
        scene,
        nextRound: roundView(next, plan),
        // The plan's round count, else the engine's (what the total counts is pending U163).
        plate: nextRoundLabel(next, plan, plan?.rounds.length || state?.game.roundsTotal || null),
        sinceMs: i?.sinceMs ?? 0,
        guideEndMs: i?.guideEndMs ?? null,
        sponsors: sponsorsOf(plan),
        // What a card costs for the coming round (U5: a normal card × the regular rounds left; the especial's fixed price).
        price: priceView(comingRoundPrice(plan, number, knownCardTypes(catalog?.cardTypes))),
      };
    }
    case 'after':
      return { scene, sponsors: sponsorsOf(plan) };
    case 'play':
      return play();
  }
}

/**
 * What the projector may draw, from the full state, its show flow (`flowOf(state)`), the Game plan, the
 * catalog (cards.json) and the notes taken from events. Missing plan: no sponsor blocks. Missing
 * catalog: titles from the snapshot, no card grid beyond the played songs.
 */
export function stageView(
  state: ShowState | null,
  flow: FlowFields,
  plan: GamePlan | null,
  catalog: Catalog | null,
  notes: LiveNotes = NO_NOTES,
): StageView {
  const lookup = songLookup(state, catalog);
  return {
    synced: state !== null,
    title: plan?.title || STAGE_TEXT.title,
    paused: flow.pause !== null,
    songs: revealedSongs(state, notes.landed, lookup),
    body: sceneView(state, flow, plan, catalog, lookup, notes),
  };
}
