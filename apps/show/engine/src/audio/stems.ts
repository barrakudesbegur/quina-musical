// Stems around the hooks of the next songs, decoded ahead of time so a transition can Tease with them: a
// few bars before each likely hook, drums, bass and vocals (the Ghost Tease and the vocal chops use B's
// voice). The playing song also gets its stem lanes (P1): its stems from its landed hook on, so a recipe can
// remove or throw one of its parts. Every slice starts on a whole frame of the song, sample-aligned with the
// mix (tools/prep/stems.py), so a lane subtracts exactly.
import { checkStemsMeta, stemWindowFor } from '../analysis.ts';
import type { Analysis, Hook, StemsMeta } from '../analysis.ts';
import { STEMS } from '../config.ts';
import { LANE_PARTS } from '../plan/events.ts';
import type { LanePart, StemName } from '../plan/events.ts';
import type { LaneCoverage } from '../plan/planner.ts';
import type { StemBars } from '../plan/moves.ts';

const PARTS: readonly StemName[] = ['drums', 'bass', 'vocals'];

/** Decoded stem slices, by stem; a stem that was not decoded is missing. */
export type StemBuffers = Partial<Record<StemName, AudioBuffer>>;

/** Decoded slices of a song's stems: `buffers` start at song time `startSec` (a whole frame); `scale` undoes the stored gain. */
export interface StemSlices {
  buffers: StemBuffers;
  startSec: number;
  scale: number;
}

/** The stems around one hook (StemStore.forHook), and the parts that are audible before it. */
export interface HookStems extends StemSlices {
  parts: StemName[];
}

/** One song's stems: `promise` settles once every hook is decoded (or given up on). */
interface SongStems {
  promise: Promise<void>;
  hooks: Map<string, HookStems>;
  bars: StemBars | null;
}

/** The playing song's stem lanes, for the hook it landed on. */
interface SongLanes {
  hookId: string;
  promise: Promise<StemSlices | null>;
  slices: StemSlices | null;
}

// Is this stem actually playing in the bars before the hook? (A quiet intro would make a silent Tease.)
function audibleBefore(meta: StemsMeta, part: StemName, hook: Hook): boolean {
  const bars = meta.bars?.[part];
  if (!bars) return true;
  const k = hook.downbeatIndex;
  const before = bars.slice(Math.max(0, k - STEMS.teaseBarsChecked), k);
  return before.length > 0 && before.reduce((a, b) => a + b, 0) / before.length >= STEMS.teaseMinBarDb;
}

const isLanePart = (name: string): name is LanePart => (LANE_PARTS as readonly string[]).includes(name);

/** The meta's per-bar levels, by part. */
function barsOf(meta: StemsMeta): StemBars | null {
  if (!meta.bars) return null;
  const out: Partial<Record<LanePart, readonly number[]>> = {};
  for (const [name, values] of Object.entries(meta.bars)) if (isLanePart(name)) out[name] = values;
  return out;
}

export class StemStore {
  ctx: BaseAudioContext;
  songs: Map<number, SongStems>;
  lanes: Map<number, SongLanes>;
  /** Stems metadata per song, fetched once. */
  metas: Map<number, Promise<StemsMeta | null>>;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.songs = new Map(); // id → { promise, hooks: Map<hookId, { buffers, startSec, scale, parts }>, bars }
    this.lanes = new Map();
    this.metas = new Map();
  }

  meta(songId: number): Promise<StemsMeta | null> {
    let meta = this.metas.get(songId);
    if (!meta) {
      meta = fetch(`/data/stems/${songId}.json`, { cache: 'no-store' })
        .then(async (response) => (response.ok ? checkStemsMeta(await response.json()) : null))
        .catch(() => null);
      this.metas.set(songId, meta);
    }
    return meta;
  }

  // Decode the stems around the song's valid best/main hooks. Never rejects: a song without stems just
  // gets low-passed Teases.
  ensure(songId: number, analysis: Analysis): Promise<void> {
    let entry = this.songs.get(songId);
    if (!entry) {
      const created: SongStems = { hooks: new Map(), bars: null, promise: Promise.resolve() };
      created.promise = this.load(songId, analysis, created).catch((error: unknown) => {
        console.warn('stems', songId, error);
      });
      this.songs.set(songId, created);
      entry = created;
    }
    return entry.promise;
  }

  async load(songId: number, analysis: Analysis, entry: SongStems): Promise<void> {
    const meta = await this.meta(songId);
    if (!meta) return;
    entry.bars = barsOf(meta);
    const wanted = analysis.hooks.filter((h) => h.valid && (h.tag === 'best' || h.tag === 'main'));
    const decoded = new Map<string, AudioBuffer>(); // `${stem}.${startSample}` → the whole window, dropped after slicing
    for (const hook of wanted) {
      const fromSec = Math.max(0, hook.downbeatSec - STEMS.leadSec);
      const toSec = hook.downbeatSec + STEMS.tailSec;
      const sliced = await this.decodeSlices(songId, meta, fromSec, toSec, PARTS.filter((p) => audibleBefore(meta, p, hook)), decoded);
      const parts = PARTS.filter((part) => sliced?.buffers[part]);
      if (sliced && parts.length) entry.hooks.set(hook.id, { ...sliced, parts });
    }
  }

  /** The stems' slices over [fromSec, toSec] of the song, starting on a whole frame of its stored window. */
  private async decodeSlices(songId: number, meta: StemsMeta, fromSec: number, toSec: number, parts: readonly StemName[], decoded = new Map<string, AudioBuffer>()): Promise<StemSlices | null> {
    const window = stemWindowFor(meta, fromSec, toSec);
    if (!window) return null;
    const sr = meta.sampleRate;
    const first = Math.max(0, Math.round((fromSec - window.startSec) * sr));
    const last = Math.round((toSec - window.startSec) * sr);
    const buffers: StemBuffers = {};
    for (const part of parts) {
      if (!meta.stems.includes(part)) continue;
      const key = `${part}.${window.startSample}`;
      let full = decoded.get(key);
      if (!full) {
        const file = await fetch(`/stems/${songId}/${key}.flac`);
        if (!file.ok) continue;
        full = await this.ctx.decodeAudioData(await file.arrayBuffer());
        decoded.set(key, full);
      }
      buffers[part] = slice(this.ctx, full, first, last);
    }
    return { buffers, startSec: (window.startSample + first) / sr, scale: 1 / meta.stemGain };
  }

  // What the planner may use: hook id → { parts }, only once decoded.
  summary(songId: number): Record<string, { parts: StemName[] }> | null {
    const hooks = this.songs.get(songId)?.hooks;
    if (!hooks?.size) return null;
    return Object.fromEntries([...hooks].map(([id, h]) => [id, { parts: h.parts }]));
  }

  forHook(songId: number, hookId: string): HookStems | null {
    return this.songs.get(songId)?.hooks.get(hookId) ?? null;
  }

  /** The song's stems per-bar levels (data/stems `bars`), once its metadata is in. */
  barLevels(songId: number): StemBars | null {
    return this.songs.get(songId)?.bars ?? null;
  }

  /**
   * P1: decode the playing song's stems from just before the hook it landed on to STEMS.laneTailSec after it
   * (inside the stored window). Resolves with the slices (null without stems); never rejects.
   */
  ensureLanes(songId: number, hookId: string, analysis: Analysis): Promise<StemSlices | null> {
    const existing = this.lanes.get(songId);
    if (existing?.hookId === hookId) return existing.promise;
    const entry: SongLanes = { hookId, slices: null, promise: Promise.resolve(null) };
    entry.promise = (async () => {
      const hook = analysis.hooks.find((h) => h.id === hookId);
      const meta = await this.meta(songId);
      if (!hook || !meta) return null;
      const around = stemWindowFor(meta, hook.downbeatSec, hook.downbeatSec + 1);
      if (!around) return null;
      const fromSec = Math.max(around.startSec, hook.downbeatSec - STEMS.laneLeadSec);
      const toSec = Math.min(around.endSec, hook.downbeatSec + STEMS.laneTailSec);
      const slices = await this.decodeSlices(songId, meta, fromSec, toSec, PARTS);
      entry.slices = slices && PARTS.some((p) => slices.buffers[p]) ? slices : null;
      return entry.slices;
    })().catch((error: unknown) => {
      console.warn('stem lanes', songId, error);
      return null;
    });
    this.lanes.set(songId, entry);
    return entry.promise;
  }

  /** The playing song's decoded lanes. */
  lanesFor(songId: number): StemSlices | null {
    return this.lanes.get(songId)?.slices ?? null;
  }

  /** What the planner may use of a song's lanes: the span they cover and their parts (`other` needs all three stems). */
  laneSummary(songId: number): LaneCoverage | null {
    const slices = this.lanesFor(songId);
    if (!slices) return null;
    const stems = PARTS.filter((p) => slices.buffers[p]);
    const length = Math.min(...stems.map((p) => slices.buffers[p]?.duration ?? 0));
    const parts: LanePart[] = stems.length === PARTS.length ? [...stems, 'other'] : stems;
    return { fromSec: slices.startSec, toSec: slices.startSec + length, parts };
  }

  retain(ids: readonly (number | null | undefined)[]): void {
    const keep = new Set(ids.filter((id) => id != null));
    for (const id of [...this.songs.keys()]) if (!keep.has(id)) this.songs.delete(id);
    for (const id of [...this.lanes.keys()]) if (!keep.has(id)) this.lanes.delete(id);
    for (const id of [...this.metas.keys()]) if (!keep.has(id)) this.metas.delete(id);
  }
}

/** Frames [first, last) of `buffer`, as a new buffer. */
function slice(ctx: BaseAudioContext, buffer: AudioBuffer, first: number, last: number): AudioBuffer {
  const start = Math.max(0, first);
  const end = Math.min(buffer.length, last);
  const out = ctx.createBuffer(buffer.numberOfChannels, Math.max(1, end - start), buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) out.copyToChannel(buffer.getChannelData(c).subarray(start, end), c);
  return out;
}
