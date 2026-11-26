// The automatic voice cues (D198, D202–D204): a lead sound (the chime, or a round's fanfare) and the cue's voice, played
// one after the other on the [voices] slider while the music dips under them (graph.voiceDuck). The files are
// tools/prep/voices.py's: /voiceaudio/<name>.flac, one loudness, with /data/voice/index.json listing them (placeholders
// marked) and their lengths. A missing file plays as silence: the cue still ends, so what it led into follows.
import type { VoiceCue, VoiceLead } from '@quina/protocol';
import type { AudioGraph } from './graph.ts';
import { VOICE } from '../config.ts';

interface VoiceIndexEntry {
  name: string;
  durationSec: number;
  placeholder: boolean;
}

export class VoicePlayer {
  readonly graph: AudioGraph;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private sources: AudioBufferSourceNode[] = [];
  /** The cue playing, and when it ends (audio clock). */
  playing: { cue: VoiceCue; end: number } | null = null;
  index: VoiceIndexEntry[] = [];

  constructor(graph: AudioGraph) {
    this.graph = graph;
  }

  /** The index, and every file decoded ahead (they're short): a cue never waits for its audio. */
  async load(): Promise<void> {
    try {
      const index: unknown = await (await fetch('/data/voice/index.json', { cache: 'no-store' })).json();
      const list = typeof index === 'object' && index && Array.isArray((index as { voices?: unknown }).voices) ? (index as { voices: VoiceIndexEntry[] }).voices : [];
      this.index = list.filter((v) => typeof v?.name === 'string');
      for (const v of this.index) this.buffer(v.name);
      const placeholders = this.index.filter((v) => v.placeholder).length;
      if (placeholders) console.info(`voice cues: ${placeholders} of ${this.index.length} are placeholders`);
    } catch (error) {
      console.warn('voice cues: no index (tools/prep/voices.py); cues play as silence', error);
    }
  }

  private buffer(name: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(name);
    if (!p) {
      p = fetch(`/voiceaudio/${encodeURIComponent(name)}.flac`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data) => this.graph.ctx.decodeAudioData(data))
        .catch((error) => {
          console.warn('voice cue', name, error);
          return null;
        });
      this.buffers.set(name, p);
    }
    return p;
  }

  /** The lead, then the voice, from `at`; the music dips under both. Returns when it starts and ends (audio clock): the
   * runtime calls `finish` at the end, which brings the music back up. */
  async play(cue: VoiceCue, lead: VoiceLead, at: number): Promise<{ start: number; end: number }> {
    this.stop();
    const [leadBuf, voiceBuf] = await Promise.all([this.buffer(lead), this.buffer(cue)]);
    const { ctx } = this.graph;
    const start = Math.max(at, ctx.currentTime + 0.02);
    let t = start;
    const out = this.graph.vol.voices;
    for (const buffer of [leadBuf, voiceBuf]) {
      if (!buffer) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(out);
      source.start(t);
      this.sources.push(source);
      t += buffer.duration;
    }
    this.duck(true, Math.max(ctx.currentTime, start - VOICE.duckSec));
    this.playing = { cue, end: t };
    return { start, end: t };
  }

  /** Stop the cue playing (skipped, Pausa, Panic): the music comes back up. */
  stop(): void {
    const now = this.graph.ctx.currentTime;
    for (const s of this.sources) {
      try {
        s.stop(now + 0.05);
      } catch {}
    }
    this.sources = [];
    if (this.playing) {
      this.playing = null;
      this.duck(false, now);
    }
  }

  /** The cue played out: the music comes back up. False when it isn't the one playing (it was stopped or replaced). */
  finish(cue: VoiceCue): boolean {
    if (this.playing?.cue !== cue) return false;
    this.playing = null;
    this.sources = [];
    this.duck(false, this.graph.ctx.currentTime);
    return true;
  }

  private duck(on: boolean, at: number): void {
    this.graph.glide(this.graph.voiceDuck.gain, on ? VOICE.duckDb : 0, on ? VOICE.duckSec : VOICE.releaseSec, at);
  }
}
