// The projector's animation moments (ANIMATIONS.md, Projector table). `momentsOf` summarises what is on
// screen at a given time; `diffMoments` compares two summaries and names the moments that just happened (a Check's
// reveals, a step back, its review and its cue come from successive snapshots of the same Check). The
// stage sets `data-anim` and dispatches a `quina:anim` event for each, so a theme script can hook them.
// Moments are timed by the show's clock (landing times, step times, the Shuffle window), never by when a
// message arrives, and the first summary after mounting only enters the scene: a late join never replays
// past steps or landings. Pure.
import type { ShowScene, WinKind } from '../../../packages/ui/flow.ts';
import type { HeatSample } from '../../../packages/rules/heat.ts';
import type { StageView } from '../view.ts';
import { checkReveal, typeReveal, type CheckVerdict, type StepState, type TypeState } from './check.ts';
import { motionAt, type MotionPhase } from './motion.ts';
import { fateAt, type NinoFate } from './finale.ts';
import { shufflePhaseAt, type ShufflePhase } from './shuffle.ts';
import { visibleSongs } from './songs.ts';
import { roughCountdown, sameCountdown, type RoughCountdown, type RoughCountdownOptions } from './timing.ts';

/** Every projector hook, as in ANIMATIONS.md. */
export const ANIM_NAMES = [
  'scene-enter',
  'spin',
  'landing',
  'suspense',
  'heat',
  'shuffle',
  'check-enter',
  'check-type',
  'check-step',
  'check-unreveal',
  'check-review',
  'check-result',
  'check-fallen',
  'celebrate',
  'finale-enter',
  'finale-fall',
  'finale-clear',
  'finale-back',
  'finale-safe',
  'finale-win',
  'interval-rotate',
  'sponsor-pages',
  'idle',
  'credits',
  'pause',
  'link-lost',
] as const;
export type AnimName = (typeof ANIM_NAMES)[number];

/** `detail` of a `quina:anim` event. Only public facts: never the incoming song or a private field. */
export type AnimDetail =
  | { name: 'scene-enter'; scene: ShowScene }
  | { name: 'spin' }
  | { name: 'landing'; songId: number }
  | { name: 'suspense' }
  | { name: 'heat' }
  | { name: 'shuffle'; phase: ShufflePhase }
  | { name: 'check-enter'; cardId: number; kind: WinKind }
  | { name: 'check-type'; ok: boolean }
  | { name: 'check-step'; index: number; songId: number; state: StepState }
  /** A step back inside a Check (D127, D134): the mark at `index`, the last revealed, lifts off. */
  | { name: 'check-unreveal'; index: number; songId: number }
  /** The Check went under review («Revisió manual»: the plaque slides down), or the review went on (it slides up). */
  | { name: 'check-review'; on: boolean }
  | { name: 'check-result'; result: CheckVerdict }
  /** The Desgraciat round: a standing claim's card has fallen (its result, instead of `check-result`). */
  | { name: 'check-fallen'; cardId: number }
  | { name: 'celebrate'; kind: WinKind }
  /** The Desgraciat's finale (D161): finalists come on stage, fall, leave at the next Spin, come back with Enrere, are
   * saved together («Salvats!», D181), or one is left. Their numbers are public: they're on stage. */
  | { name: 'finale-enter'; numbers: number[] }
  | { name: 'finale-fall'; numbers: number[] }
  | { name: 'finale-clear'; numbers: number[] }
  | { name: 'finale-back'; numbers: number[] }
  | { name: 'finale-safe' }
  | { name: 'finale-win'; number: number }
  | { name: 'interval-rotate' }
  | { name: 'idle'; scene: ShowScene }
  | { name: 'credits' }
  | { name: 'pause'; on: boolean }
  | { name: 'link-lost'; lost: boolean };

export interface Moments {
  /** Built from a real snapshot (not the placeholder before the first one arrives). */
  synced: boolean;
  scene: ShowScene;
  /** Changes when the scene is entered again for something new (another round, another celebration). */
  sceneKey: string;
  paused: boolean;
  linkLost: boolean;
  motion: MotionPhase;
  /** The newest song on screen. */
  landing: { songId: number; atMs: number } | null;
  check: {
    key: string;
    cardId: number;
    kind: WinKind;
    type: TypeState | null;
    songIds: number[];
    steps: StepState[];
    result: CheckVerdict | null;
    reviewing: boolean;
  } | null;
  shuffle: { key: string; phase: ShufflePhase } | null;
  celebration: { key: string; kind: WinKind } | null;
  /** The finale on stage: each finalist's fate as shown now (by number), and the «Salvats!» landing once it has landed. */
  finale: { key: string; fates: Readonly<Record<number, NinoFate>>; savedAtMs: number | null } | null;
  /** The Heat sample that has started (its `fromMs`). */
  heat: { fromMs: number } | null;
  /** The Interval's rough countdown: it ticks (`interval-rotate`) when what it says changes. */
  countdown: { key: string; at: RoughCountdown | null } | null;
}

export interface MomentInputs {
  nowMs: number;
  /** The Heat sample that has started by now (packages/rules/heat.ts), or null. */
  heat: HeatSample | null;
  linkLost: boolean;
  checkMarkAt: 'end' | 'start';
  /** When the card-type badge gets its mark, after the Check starts (model/check.ts `typeMarkAt`). */
  checkTypeLeadMs: number;
  /** The rough countdown's steps (config.ts `countdown`). */
  countdown: RoughCountdownOptions;
}

export function momentsOf(view: StageView, { nowMs, heat, linkLost, checkMarkAt, checkTypeLeadMs, countdown }: MomentInputs): Moments {
  const body = view.body;
  const newest = visibleSongs(view.songs, nowMs, 1)[0] ?? null;
  const moments: Moments = {
    synced: view.synced,
    scene: body.scene,
    sceneKey: body.scene,
    paused: view.paused,
    linkLost,
    motion: 'idle',
    landing: newest ? { songId: newest.songId, atMs: newest.atMs } : null,
    check: null,
    shuffle: null,
    celebration: null,
    finale: null,
    heat: heat ? { fromMs: heat.fromMs } : null,
    countdown: null,
  };
  switch (body.scene) {
    case 'play':
      moments.sceneKey = `play:${body.round?.number ?? ''}`;
      moments.motion = motionAt(body.motion, nowMs);
      if (body.finale) {
        const f = body.finale;
        moments.finale = {
          key: f.key,
          fates: Object.fromEntries(f.ninos.map((n) => [n.number, fateAt(n, nowMs)])),
          savedAtMs: f.savedAtMs !== null && nowMs >= f.savedAtMs ? f.savedAtMs : null,
        };
      }
      break;
    case 'roundStart':
      moments.sceneKey = `roundStart:${body.round?.number ?? ''}`;
      if (body.shuffle) moments.shuffle = { key: body.shuffle.key, phase: shufflePhaseAt(body.shuffle, nowMs) };
      break;
    case 'check': {
      const c = body.check;
      const reveal = checkReveal(c, nowMs, checkMarkAt);
      moments.check = {
        key: c.key,
        cardId: c.cardId,
        kind: c.kind,
        type: typeReveal(c, nowMs, checkTypeLeadMs),
        songIds: c.steps.map((s) => s.songId),
        steps: reveal.steps,
        result: reveal.result,
        reviewing: c.reviewing,
      };
      break;
    }
    case 'celebration':
      moments.sceneKey = `celebration:${body.key}`;
      moments.celebration = { key: body.key, kind: body.kind };
      break;
    case 'interval': {
      moments.sceneKey = `interval:${body.nextRound.number}`;
      moments.countdown = { key: moments.sceneKey, at: roughCountdown(body.guideEndMs, nowMs, countdown) };
      break;
    }
    case 'before':
    case 'after':
      break;
  }
  return moments;
}

const IDLE_SCENES: ReadonlySet<ShowScene> = new Set(['before', 'interval', 'after']);

/** A Check's result moment: `check-fallen` for a card that fell in the Desgraciat round, else `check-result`. */
const resultMoment = (cardId: number, result: CheckVerdict): AnimDetail =>
  result === 'fallen' ? { name: 'check-fallen', cardId } : { name: 'check-result', result };

/** What entering a scene starts. */
function enterScene(next: Moments): AnimDetail[] {
  const out: AnimDetail[] = [{ name: 'scene-enter', scene: next.scene }];
  if (next.check) out.push({ name: 'check-enter', cardId: next.check.cardId, kind: next.check.kind });
  // A Check with no songs to reveal (a card of the wrong type) seen after its cue has its type mark and result at once.
  if (next.check && next.check.steps.length === 0) {
    if (next.check.type && next.check.type !== 'pending') out.push({ name: 'check-type', ok: next.check.type === 'ok' });
    if (next.check.result) out.push(resultMoment(next.check.cardId, next.check.result));
  }
  if (next.celebration) out.push({ name: 'celebrate', kind: next.celebration.kind });
  if (IDLE_SCENES.has(next.scene)) out.push({ name: 'idle', scene: next.scene });
  if (next.scene === 'after') out.push({ name: 'credits' });
  return out;
}

/**
 * The moments that happened between two summaries. `prev` null (just mounted) or not synced (no snapshot
 * yet): only enter the scene, so the first snapshot never replays a landing, a step or a Shuffle phase.
 */
export function diffMoments(prev: Moments | null, next: Moments): AnimDetail[] {
  if (!prev || (!prev.synced && next.synced)) {
    // The placeholder already entered this very scene: don't enter it twice.
    const out = prev?.sceneKey === next.sceneKey ? enterScene(next).filter((a) => a.name !== 'scene-enter' && a.name !== 'idle') : enterScene(next);
    if (next.paused) out.push({ name: 'pause', on: true });
    if (next.linkLost) out.push({ name: 'link-lost', lost: true });
    return out;
  }
  const out: AnimDetail[] = [];
  if (prev.paused !== next.paused) out.push({ name: 'pause', on: next.paused });
  if (prev.linkLost !== next.linkLost) out.push({ name: 'link-lost', lost: next.linkLost });

  const sceneChanged = prev.sceneKey !== next.sceneKey || prev.check?.key !== next.check?.key;
  if (sceneChanged) out.push(...(prev.scene === next.scene && next.check ? enterScene(next).filter((a) => a.name !== 'scene-enter') : enterScene(next)));

  if (prev.motion !== next.motion) {
    if (next.motion === 'spin') out.push({ name: 'spin' });
    else if (next.motion === 'suspense') out.push({ name: 'suspense' });
  }

  if (next.landing && (!prev.landing || next.landing.atMs > prev.landing.atMs)) out.push({ name: 'landing', songId: next.landing.songId });

  const pc = prev.check;
  const nc = next.check;
  if (pc && nc && pc.key === nc.key) {
    if (nc.type && nc.type !== 'pending' && nc.type !== pc.type) out.push({ name: 'check-type', ok: nc.type === 'ok' });
    // A step back: the marks past the new last revealed song lift off, the last one first.
    for (let index = pc.steps.length - 1; index >= nc.steps.length; index--) out.push({ name: 'check-unreveal', index, songId: pc.songIds[index] });
    nc.steps.forEach((state, index) => {
      if (state !== 'pending' && state !== pc.steps[index]) out.push({ name: 'check-step', index, songId: nc.songIds[index], state });
    });
    if (nc.reviewing !== pc.reviewing) out.push({ name: 'check-review', on: nc.reviewing });
    if (nc.result && !pc.result) out.push(resultMoment(nc.cardId, nc.result));
  }

  const ps = prev.shuffle;
  const ns = next.shuffle;
  if (ns && ns.phase !== 'before' && (ps?.key !== ns.key ? ns.phase !== 'done' : ps.phase !== ns.phase)) out.push({ name: 'shuffle', phase: ns.phase });

  out.push(...finaleMoments(prev.finale, next.finale));

  if (next.heat && next.heat.fromMs !== prev.heat?.fromMs) out.push({ name: 'heat' });

  const pt = prev.countdown;
  const nt = next.countdown;
  if (pt && nt && pt.key === nt.key && pt.at && nt.at && !sameCountdown(pt.at, nt.at)) out.push({ name: 'interval-rotate' });
  return out;
}

/** The finale's moments between two summaries of the same scene (a late join enters with none). */
function finaleMoments(prev: Moments['finale'], next: Moments['finale']): AnimDetail[] {
  if (!next) return [];
  const numbers = (f: Moments['finale'], fate?: NinoFate) => Object.entries(f?.fates ?? {}).filter(([, v]) => !fate || v === fate).map(([k]) => Number(k));
  if (!prev || prev.key !== next.key) return [{ name: 'finale-enter', numbers: numbers(next) }];
  const out: AnimDetail[] = [];
  const was = prev.fates;
  const is = next.fates;
  const entered = numbers(next).filter((n) => !(n in was));
  const fell = numbers(next, 'down').filter((n) => was[n] === 'up');
  const back = numbers(next, 'up').filter((n) => was[n] === 'down');
  // The fallen leave at the next Spin; a finalist removed by hand leaves the same way.
  const left = numbers(prev).filter((n) => !(n in is));
  const won = numbers(next, 'win').find((n) => was[n] !== 'win');
  if (entered.length) out.push({ name: 'finale-enter', numbers: entered });
  if (fell.length) out.push({ name: 'finale-fall', numbers: fell });
  if (left.length) out.push({ name: 'finale-clear', numbers: left });
  if (back.length) out.push({ name: 'finale-back', numbers: back });
  if (next.savedAtMs !== null && next.savedAtMs !== prev.savedAtMs) out.push({ name: 'finale-safe' });
  if (won !== undefined) out.push({ name: 'finale-win', number: won });
  return out;
}
