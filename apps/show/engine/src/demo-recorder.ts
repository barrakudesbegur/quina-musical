// The listening demo's recorder (show page `?record=1`; tests/support/listen-demo.ts drives it): it records what
// the page plays, the limiter's output, and notes a cue for every transition (what the planner chose) and every
// show-flow moment, so the user's listening notes can point at a time. Nothing else changes: the show plays as on the
// night. The recording stays on this laptop (the driver writes it under data/out, gitignored).
import type { ShowEvent } from '@quina/protocol';
import type { Plan } from './plan/planner.ts';

/** One moment of the demo, `atSec` from the recording's start. */
export interface DemoCue {
  atSec: number;
  kind: 'press' | 'landing' | 'event';
  text: string;
  detail?: Record<string, unknown>;
}

export interface DemoRecording {
  /** The recording as a WebM/Opus file, base64. */
  audioBase64: string;
  mimeType: string;
  cues: DemoCue[];
  durationSec: number;
}

/** What a plan is, in a listener's words: the recipe, how A leaves, the landing, and what's layered. */
export function describePlan(plan: Plan): { text: string; detail: Record<string, unknown> } {
  const extras = [
    plan.signature ? `Signature (${plan.signature.deck === 'B' ? "the next song's" : "the outgoing song's"})` : null,
    plan.vocal === 'entry' ? 'vocal entry' : plan.vocal === 'callResponse' ? 'call and response' : null,
    plan.blend ? 'Blend' : null,
    plan.teaseStyle ? `tease (${plan.teaseStyle})` : null,
    ...plan.layers,
  ].filter((x): x is string => Boolean(x));
  const text = [`${plan.recipe} ${plan.recipeName}`, plan.exit ? `exit ${plan.exit}` : null, `landing ${plan.landing}`, ...extras, plan.phase]
    .filter(Boolean)
    .join(', ');
  return {
    text,
    detail: {
      recipe: plan.recipe, family: plan.family, exit: plan.exit, landing: plan.landing, impact: plan.impact, phase: plan.phase,
      signature: plan.signature?.id ?? null, vocal: plan.vocal ?? null, layers: plan.layers, from: plan.a?.songId ?? null, to: plan.b.songId,
      spinSec: Math.round((plan.T - plan.spinStart) * 10) / 10,
    },
  };
}

/** What a show event means for the listener, or null for the ones the demo doesn't mark. */
export function describeEvent(event: ShowEvent): string | null {
  switch (event.type) {
    case 'suspense.started':
      return 'Suspense: the song loops its phrase, the build grows, the drum hovers';
    case 'claim.opened':
      return `Claim: card #${event.claim.cardId} (${event.claim.kind})`;
    case 'check.scheduled':
      return `Check of #${event.check.cardId}: ${event.check.steps.length} steps (${event.check.outcome})`;
    case 'celebration.started':
      return `Celebration (${event.celebration.kind}), music: ${event.celebration.music}`;
    case 'scene.changed':
      return `scene: ${event.scene}`;
    default:
      return null;
  }
}

/** Records `source` (the limiter) from `start()` until `stop()`. */
export class DemoRecorder {
  readonly ctx: AudioContext;
  readonly cues: DemoCue[] = [];
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private t0 = 0;
  private holding: string | null = null;

  constructor(ctx: AudioContext, source: AudioNode) {
    this.ctx = ctx;
    const tap = ctx.createMediaStreamDestination();
    source.connect(tap);
    this.stream = tap.stream;
  }

  private readonly stream: MediaStream;

  start(): void {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType, audioBitsPerSecond: 256_000 } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(1000);
    this.t0 = this.ctx.currentTime;
  }

  /** A cue at audio-clock time `at` (now by default). */
  mark(kind: DemoCue['kind'], text: string, detail?: Record<string, unknown>, at = this.ctx.currentTime): void {
    if (!this.recorder) return;
    this.cues.push({ atSec: Math.round((at - this.t0) * 10) / 10, kind, text, ...(detail ? { detail } : {}) });
  }

  plan(plan: Plan): void {
    const { text, detail } = describePlan(plan);
    this.mark('press', `Next pressed → ${text}`, detail, plan.now);
    this.mark('landing', `landing of song ${plan.b.songId}`, undefined, plan.T);
  }

  event(event: ShowEvent): void {
    if (event.type === 'state') {
      // Holds come and go through the state: note their start and end.
      const hold = event.hold ? (event.hold.ducked === false ? 'Aguanta (Stay): the song plays on, looping its phrase' : `Hold (${event.hold.reason})`) : null;
      if (hold !== this.holding) {
        if (hold) this.mark('event', hold);
        else if (this.holding) this.mark('event', `${this.holding.split(':')[0]} released`);
        this.holding = hold;
      }
      return;
    }
    const text = describeEvent(event);
    if (text) this.mark('event', text);
  }

  async stop(): Promise<DemoRecording> {
    const recorder = this.recorder;
    if (!recorder) throw new Error('not recording');
    const durationSec = this.ctx.currentTime - this.t0;
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    recorder.stop();
    await done;
    this.recorder = null;
    const blob = new Blob(this.chunks, { type: recorder.mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { audioBase64: btoa(binary), mimeType: recorder.mimeType, cues: [...this.cues].sort((a, b) => a.atSec - b.atSec), durationSec };
  }
}
