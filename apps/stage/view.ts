// The projector's privacy boundary. The stage runs on the show laptop and receives the full state, which
// holds secrets the audience must never see: the next song (`next`, `transition.to`), the Queue, possible
// winners, the Phase, claims and their warnings, winners' names and notes. `stageView` picks out only what
// the projector may draw, and the DOM code reads nothing else. Pure; tests/ui/stage/view.test.ts checks that
// no private field ever comes out.
import type { RoundKind, ShowState } from '@quina/protocol';
import type { FlowFields, WinKind, WinnerInfo } from '../../packages/ui/flow.ts';
import { revealedRounds, roundPlan, sponsorOf, splitBundle, type GamePlan, type Prize } from '../../packages/ui/plan.ts';
import type { Catalog } from '../../packages/ui/data/catalog.ts';
import { STAGE } from './config.ts';
import { stageScene } from './model/scene.ts';
import { revealedSongs, type LandedNote, type SongLookup, type StageSong } from './model/songs.ts';
import { motionView, type MotionView, type SpinNote } from './model/motion.ts';
import { checkCells, verdictOf, type CheckView } from './model/check.ts';
import { shuffleTimeline, type ShuffleTimeline } from './model/shuffle.ts';
import { playerAppLink } from './model/qr.ts';
import { STAGE_TEXT, joinCa } from './strings.ts';

/** A Line's or a Quina's prize bundle as the projector shows it: its headline prizes, and how many more. */
export interface PrizeView {
  kind: WinKind;
  /** The headline prizes' titles, joined ("Sopar per a dos i Pernil"). */
  title: string;
  /** A single headline prize's detail (null with several). */
  detail: string | null;
  /** The headline prizes' sponsors' names, joined, or null. */
  sponsor: string | null;
  /** How many other prizes the bundle holds ("i 3 premis més"). */
  more: number;
}

/** A sponsor as the projector shows it (`label`: its public name; a winner's name never gets here). */
export interface SponsorView {
  label: string;
  logo: string | null;
}

export interface RoundView {
  number: number;
  special: boolean;
}

export interface WinnerView {
  round: number;
  kind: WinKind;
  cardId: number;
}

export interface RoundWinnersView {
  round: number;
  line: number[];
  bingo: number[];
}

export interface LinkView {
  href: string;
  label: string;
}

export interface BeforeView {
  scene: 'before';
  startAtMs: number | null;
  sponsors: SponsorView[];
  link: LinkView;
}

export interface RoundStartView {
  scene: 'roundStart';
  round: RoundView | null;
  prizes: PrizeView[];
  shuffle: (ShuffleTimeline & { key: string }) | null;
  /** Song ids for the Shuffle's grid, by id (never in Queue order: the stage doesn't know it). */
  tiles: number[];
}

export interface PlayView {
  scene: 'play';
  round: RoundView | null;
  /** The drum's motion: timestamps only, never the incoming song. */
  motion: MotionView | null;
}

export interface CheckSceneView {
  scene: 'check';
  check: CheckView;
}

export interface CelebrationView {
  scene: 'celebration';
  key: string;
  kind: WinKind;
  cardIds: number[];
  prize: PrizeView | null;
}

export interface IntervalView {
  scene: 'interval';
  /** The round about to start (named `nextRound`: `next` is the private next song everywhere else). */
  nextRound: RoundView;
  roundsTotal: number | null;
  prizes: PrizeView[];
  sinceMs: number;
  guideEndMs: number | null;
  lastRound: number;
  lastWinners: WinnerView[];
  sponsors: SponsorView[];
  link: LinkView;
}

export interface AfterView {
  scene: 'after';
  winners: RoundWinnersView[];
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
}

const NO_NOTES: LiveNotes = { landed: [], spin: null };

function prizeView(plan: GamePlan, kind: WinKind, bundle: readonly Prize[]): PrizeView | null {
  const { headline, others } = splitBundle(bundle.filter((p) => p.title));
  if (!headline.length) return null;
  const sponsors = [...new Set(headline.map((p) => sponsorOf(plan, p)?.name).filter((n): n is string => !!n))];
  return {
    kind,
    title: joinCa(headline.map((p) => p.title)),
    detail: headline.length === 1 ? headline[0].detail || null : null,
    sponsor: sponsors.length ? joinCa(sponsors) : null,
    more: others.length,
  };
}

/**
 * The rounds whose prizes the projector may show: what phones may see (plan.ts revealedRounds over the
 * engine's `prizes.revealed`). Null (every round) from an engine that doesn't report reveals.
 */
function openRounds(plan: GamePlan | null, state: ShowState | null): ReadonlySet<number> | null {
  if (!plan || !state?.prizes) return null;
  return new Set(revealedRounds(plan, state.prizes.revealed));
}

/** A round's prizes, unless they are still secret. */
function prizesOf(plan: GamePlan | null, round: number, open: ReadonlySet<number> | null): PrizeView[] {
  const r = plan ? roundPlan(plan, round) : null;
  if (!plan || !r || (open && !open.has(round))) return [];
  return [prizeView(plan, 'line', r.line), prizeView(plan, 'bingo', r.bingo)].filter((p): p is PrizeView => p !== null);
}

function roundView(number: number | null | undefined, plan: GamePlan | null, state: ShowState | null, known: RoundKind | null = null): RoundView | null {
  if (!number || number < 1) return null;
  const planned = roundPlan(plan, number);
  const kind = planned?.kind ?? known ?? (state?.round.number === number ? state.round.kind : 'normal');
  return { number, special: kind === 'special' };
}


const sponsorsOf = (plan: GamePlan | null): SponsorView[] => (plan?.sponsors ?? []).map((s) => ({ label: s.name, logo: s.logo }));

/** Only the round, the kind and the card: never a winner's name or notes. */
const winnerView = (w: WinnerInfo): WinnerView => ({ round: w.round, kind: w.kind, cardId: w.cardId });

function winnersByRound(winners: readonly WinnerInfo[]): RoundWinnersView[] {
  const rounds = new Map<number, RoundWinnersView>();
  for (const w of winners) {
    const r = rounds.get(w.round) ?? { round: w.round, line: [], bingo: [] };
    const list = w.kind === 'line' ? r.line : r.bingo;
    if (!list.includes(w.cardId)) list.push(w.cardId);
    rounds.set(w.round, r);
  }
  return [...rounds.values()].sort((a, b) => a.round - b.round);
}

/** Titles from the snapshot's landed songs first, then the catalog. */
function songLookup(state: ShowState | null, catalog: Catalog | null): SongLookup {
  const fromState = new Map<number, { title: string; artist: string }>();
  for (const l of state?.landings ?? []) if (!l.undone && l.title) fromState.set(l.songId, { title: l.title, artist: l.artist });
  if (state?.current?.title) fromState.set(state.current.songId, { title: state.current.title, artist: state.current.artist });
  return (songId) => fromState.get(songId) ?? catalog?.songs.get(songId) ?? null;
}

function sceneView(state: ShowState | null, flow: FlowFields, plan: GamePlan | null, catalog: Catalog | null, lookup: SongLookup, notes: LiveNotes): SceneView {
  const scene = stageScene(flow);
  const link = playerAppLink(plan?.edition, STAGE.playerApp);
  const roundNumber = state?.round.number ?? 0;
  const open = openRounds(plan, state);
  const play = (): PlayView => ({ scene: 'play', round: roundView(roundNumber, plan, state), motion: motionView(state, notes.spin) });
  switch (scene) {
    case 'before':
      return { scene, startAtMs: plan?.schedule.startAtMs ?? null, sponsors: sponsorsOf(plan), link };
    case 'roundStart': {
      // The round being introduced (`intro`, set before the Shuffle) names it; then the Shuffle's; then the state's.
      const intro = flow.intro;
      const number = intro?.round ?? flow.shuffle?.round ?? roundNumber;
      const s = flow.shuffle;
      return {
        scene,
        round: roundView(number, plan, state, intro?.round === number ? intro.kind : null),
        prizes: prizesOf(plan, number, open),
        shuffle: s ? { ...shuffleTimeline(s.startAtMs, s.endAtMs, STAGE.shuffle.split), key: `${s.round}@${s.startAtMs}` } : null,
        tiles: catalog ? [...catalog.songs.keys()].sort((a, b) => a - b) : [],
      };
    }
    case 'check': {
      const c = flow.check;
      if (!c) return play(); // stageScene only returns 'check' with a check present
      const steps = c.steps.map((s) => ({ songId: s.songId, landed: s.landed, atMs: s.atMs, durationMs: s.durationMs }));
      const verdict = verdictOf(c.outcome);
      const card = catalog?.cards.get(c.cardId) ?? null;
      return {
        scene,
        check: {
          key: `${c.cardId}@${c.startAtMs}`,
          cardId: c.cardId,
          kind: c.kind,
          cardType: c.cardType ?? null,
          verdict,
          row: c.kind === 'line' ? c.row : null,
          cells: verdict === 'notValid' ? [] : checkCells(card, steps, c.row, (id) => lookup(id)?.title ?? null),
          steps: verdict === 'notValid' ? [] : steps,
          startAtMs: c.startAtMs,
          endAtMs: c.endAtMs,
        },
      };
    }
    case 'celebration': {
      const c = flow.celebration;
      if (!c) return play();
      const prize = prizesOf(plan, c.round, open).find((p) => p.kind === c.kind) ?? null;
      return { scene, key: `${c.round}:${c.kind}@${c.sinceMs}`, kind: c.kind, cardIds: [...c.cardIds], prize };
    }
    case 'interval': {
      const i = flow.interval;
      const next = i?.nextRound ?? roundNumber + 1;
      const lastRound = next - 1;
      return {
        scene,
        nextRound: roundView(next, plan, state) ?? { number: next, special: false },
        roundsTotal: plan?.rounds.length || state?.game.roundsTotal || null,
        prizes: prizesOf(plan, next, open),
        sinceMs: i?.sinceMs ?? 0,
        guideEndMs: i?.guideEndMs ?? null,
        lastRound,
        lastWinners: flow.winners.filter((w) => w.round === lastRound).map(winnerView),
        sponsors: sponsorsOf(plan),
        link,
      };
    }
    case 'after':
      return { scene, winners: winnersByRound(flow.winners), sponsors: sponsorsOf(plan) };
    case 'play':
      return play();
  }
}

/**
 * What the projector may draw, from the full state, its show flow (`flowOf(state)`), the Game plan, the
 * catalog (cards.json) and the notes taken from events. Missing plan: no prize or sponsor blocks. Missing
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
