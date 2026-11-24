// Turns a planner plan into Web Audio calls. Every ramp is anchored with setValueAtTime at its start;
// exponential ramps never target 0 (the planner uses 0.0001).
import { whoosh, thunk } from './synth/clicks.ts';
import { SYNTHS } from './synth/fx.ts';
import { isDeckParam } from './deck.ts';
import type { Deck, DeckName } from './deck.ts';
import { isGraphParam } from './graph.ts';
import type { AudioGraph } from './graph.ts';
import type { DecoyEvent, ParamTarget, PlanEvent, SynthEventOf, SynthName } from '../plan/recipes.ts';

const EPS = 0.0001;

/** What a plan plays on: the graph, and the decks by name (A is null when nothing is playing). */
export interface PlanOutputs {
  graph: AudioGraph;
  decks: Partial<Record<DeckName, Deck | null>>;
  /** Plays a Decoy (main.ts), when the experiment is on. */
  decoy?: (event: DecoyEvent) => void;
}

/** What applyPlan() did, by kind; `skipped` counts set and ramp events whose parameter does not exist. */
export interface AppliedCounts {
  params: number;
  sfx: number;
  synth: number;
  skipped: number;
}

function resolveParam(target: ParamTarget, { graph, decks }: PlanOutputs): AudioParam | null {
  const [owner, name] = target.split('.');
  if (owner === 'A' || owner === 'B') return isDeckParam(name) ? (decks[owner]?.param(name) ?? null) : null;
  return isGraphParam(target) ? graph.param(target) : null;
}

// Generic in the voice's name, so the voice and its params stay paired.
function playSynth<N extends SynthName>(ctx: BaseAudioContext, destination: AudioNode, event: SynthEventOf<N>): void {
  const fn = SYNTHS[event.name];
  if (fn) fn(ctx, destination, event.params);
}

export function applyPlan(plan: { events: readonly PlanEvent[] }, outputs: PlanOutputs): AppliedCounts {
  const { graph, decks } = outputs;
  const { ctx } = graph;
  const applied: AppliedCounts = { params: 0, sfx: 0, synth: 0, skipped: 0 };
  for (const event of plan.events) {
    switch (event.kind) {
      case 'sfx':
        playSfx(graph, event);
        applied.sfx++;
        continue;
      case 'synth':
        playSynth(ctx, graph.synthBus, event);
        applied.synth++;
        continue;
      case 'slices':
        decks[event.deck]?.playSlices(event);
        continue;
      case 'stemLane':
        decks[event.deck]?.playLane(event);
        continue;
      case 'preverb':
        decks[event.deck]?.playPreverb(event);
        continue;
      case 'scratch':
        decks[event.deck]?.playScratch(event);
        continue;
      case 'spinback':
        decks[event.deck]?.spinback(event);
        continue;
      case 'stems':
        decks[event.deck]?.playStems(event);
        continue;
      case 'blend':
        decks[event.deck]?.playBlend(event);
        continue;
      case 'signature':
        decks[event.deck]?.playSignature(event);
        continue;
      case 'decoy':
        outputs.decoy?.(event);
        continue;
      case 'set':
      case 'ramp': {
        const param = resolveParam(event.target, { graph, decks });
        if (!param) {
          applied.skipped++;
          continue;
        }
        if (event.kind === 'set') {
          param.setValueAtTime(event.value, Math.max(event.at, ctx.currentTime));
        } else {
          const t0 = Math.max(event.t0, ctx.currentTime);
          const t1 = Math.max(event.t1, t0 + 0.001);
          param.setValueAtTime(event.from, t0);
          if (event.curve === 'exp') param.exponentialRampToValueAtTime(Math.max(event.to, EPS), t1);
          else param.linearRampToValueAtTime(event.to, t1);
        }
        applied.params++;
        continue;
      }
      default: {
        const unhandled: never = event; // every PlanEvent kind is handled above
        throw new Error(`plan event of unknown kind: ${JSON.stringify(unhandled)}`);
      }
    }
  }
  return applied;
}

export function playSfx(graph: AudioGraph, { name, at, gainDb = 0 }: { name: string; at: number; gainDb?: number }): void {
  const { ctx } = graph;
  const when = Math.max(at, ctx.currentTime);
  const level = 10 ** (gainDb / 20);
  if (name === 'whoosh') return whoosh(ctx, graph.fxBus, when, { level });
  if (name === 'thunk') return thunk(ctx, graph.fxBus, when, level * 1.6);
  graph.playSample(name, when, gainDb);
}
