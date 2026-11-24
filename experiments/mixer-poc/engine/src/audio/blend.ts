// Renders for the Blend (R8): the next song's bars before its chosen hook, stretched to the current song's
// tempo by analysis/stretch.py (through the relay), decoded ahead of the Spin. Only drums and bass are kept.
import { LAYERING } from '../config.ts';
import { compatible } from '../plan/keys.ts';
import type { KeyInfo, Mode } from '../plan/keys.ts';
import type { BlendSource } from '../plan/planner.ts';
import type { StemName } from '../plan/recipes.ts';
import { isRecord } from './loader.ts';
import type { StemBuffers } from './stems.ts';

const PARTS: readonly StemName[] = ['drums', 'bass'];

/** A decoded render for one outgoing song and hook (BlendStore.forPair); `scale` undoes the stored part gain. */
export interface BlendBuffers {
  buffers: StemBuffers;
  scale: number;
}

/** What prepare() needs: B's hook to render at A's tempo, and whether the tempos are within ±4% (`tight`). */
export interface BlendRequest {
  aSongId: number;
  aBpm: number;
  aHookId: string | null;
  bSongId: number;
  hookId: string;
  beatsPerBar?: number;
  tight: boolean;
}

/** One render as load() fills it in; `error` says why it failed. */
interface BlendState {
  summary: BlendSource | null;
  buffers: StemBuffers | null;
  scale: number;
  error: string | null;
}

/** A render in the store: its state, and `ready`, which settles once it is decoded or has failed. */
interface BlendRender extends BlendState {
  ready: Promise<void>;
}

/**
 * One song in data/keys/index.json (analysis/keys.py): its global key and each hook's (by hook id), in the
 * `key`, `mode`, `camelot`, `confidence` form plan/keys.ts reads.
 */
interface KeysIndexSong {
  songId: number;
  global?: KeyInfo;
  hooks?: Record<string, KeyInfo>;
}

/**
 * The relay's answer to POST /api/stretch (relay/server.ts stretchRender, from analysis/stretch.py --json), the
 * fields read here. `dir` is the render's folder under /stretch/<song>/, `parts` the decoded parts in it, stored at
 * `partGain`. `request` places the requested bars inside a (possibly larger) cached render, in file seconds;
 * `mode` is 'direct', 'half' or 'double' time.
 */
type StretchResponse =
  | { ok: false; reason: string }
  | {
      ok: true;
      dir: string;
      parts: string[];
      partGain?: number;
      effectiveBpm: number;
      beatsPerBar?: number;
      request: { mode: string; hookSec: number; firstDownbeatSec: number; targetBeatSec: number };
    };

const isNumber = (x: unknown): x is number => typeof x === 'number';
const isMode = (x: unknown): x is Mode => x === 'major' || x === 'minor';

function isKeyInfo(k: unknown): k is KeyInfo {
  if (!isRecord(k)) return false;
  const { key, mode, camelot, pitchClass, confidence } = k;
  return (key === undefined || typeof key === 'string') && (mode === undefined || isMode(mode)) &&
    (camelot === undefined || typeof camelot === 'string') && (pitchClass === undefined || isNumber(pitchClass)) &&
    (confidence === undefined || isNumber(confidence));
}

function isKeysIndexSong(s: unknown): s is KeysIndexSong {
  if (!isRecord(s) || !isNumber(s.songId)) return false;
  const { global, hooks } = s;
  return (global === undefined || isKeyInfo(global)) && (hooks === undefined || (isRecord(hooks) && Object.values(hooks).every(isKeyInfo)));
}

function isStretchResponse(r: unknown): r is StretchResponse {
  if (!isRecord(r)) return false;
  if (r.ok !== true) return r.ok === false && typeof r.reason === 'string';
  const { dir, parts, partGain, effectiveBpm, beatsPerBar, request: q } = r;
  return typeof dir === 'string' && Array.isArray(parts) && parts.every((p) => typeof p === 'string') &&
    (partGain === undefined || isNumber(partGain)) && isNumber(effectiveBpm) && (beatsPerBar === undefined || isNumber(beatsPerBar)) &&
    isRecord(q) && typeof q.mode === 'string' && isNumber(q.hookSec) && isNumber(q.firstDownbeatSec) && isNumber(q.targetBeatSec);
}

const errorText = (error: unknown): string => String(error instanceof Error ? error.message : error);

export class BlendStore {
  ctx: BaseAudioContext;
  renders: Map<string, BlendRender>;
  keys: Map<number, KeysIndexSong> | null;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.renders = new Map(); // `${aSongId}:${hookId}` → { ready, summary, buffers, scale, error }
    this.keys = null; // songId → data/keys entry
  }

  async loadKeys(): Promise<void> {
    try {
      const index: unknown = await (await fetch('/data/keys/index.json', { cache: 'no-store' })).json();
      if (!isRecord(index) || !Array.isArray(index.songs)) throw new Error('data/keys/index.json: no songs');
      this.keys = new Map(index.songs.filter(isKeysIndexSong).map((s) => [s.songId, s]));
    } catch (error) {
      console.warn('keys', error);
      this.keys = new Map();
    }
  }

  /** A song's hook keys by hook id (data/keys), for the planner's key checks (D9's Ghost, D12's overlap). */
  hookKeys(songId: number): Readonly<Record<string, KeyInfo>> | null {
    return this.keys?.get(songId)?.hooks ?? null;
  }

  // B's bass may layer over A only when the tempos are within ±4% and the hooks' keys are compatible.
  bassAllowed({ tight, aSongId, aHookId, bSongId, bHookId }: {
    tight: boolean;
    aSongId: number;
    aHookId: string | null;
    bSongId: number;
    bHookId: string;
  }): boolean {
    if (!tight || !this.keys) return false;
    const a = this.keys.get(aSongId);
    const b = this.keys.get(bSongId);
    const aKey = (aHookId == null ? undefined : a?.hooks?.[aHookId]) ?? a?.global;
    const bKey = b?.hooks?.[bHookId] ?? b?.global;
    return compatible(aKey, bKey, { minConfidence: LAYERING.minKeyConfidence });
  }

  // Never rejects: without a render the planner simply does not blend.
  prepare({ aSongId, aBpm, aHookId, bSongId, hookId, beatsPerBar = 4, tight }: BlendRequest): Promise<void> {
    const key = `${aSongId}:${hookId}`;
    const known = this.renders.get(key);
    if (known) return known.ready;
    const state: BlendState = { summary: null, buffers: null, scale: 1, error: null };
    const ready = this.load(state, { aSongId, aBpm, aHookId, bSongId, hookId, beatsPerBar, tight }).catch((error: unknown) => {
      state.error = errorText(error);
      console.warn('blend', key, error);
    });
    const entry: BlendRender = Object.assign(state, { ready }); // the same object load() fills in
    this.renders.set(key, entry);
    return entry.ready;
  }

  async load(entry: BlendState, request: Required<BlendRequest>): Promise<void> {
    const { aSongId, aBpm, aHookId, bSongId, hookId, beatsPerBar, tight } = request;
    if (!this.keys) await this.loadKeys();
    const response = await fetch('/api/stretch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ song: bSongId, hook: hookId, toBpm: aBpm, bars: LAYERING.renderBars, afterBars: LAYERING.renderAfterBars }),
    });
    const r: unknown = await response.json();
    if (!isStretchResponse(r)) throw new Error(`stretch ${bSongId}/${hookId}: bad response`);
    if (!r.ok) throw new Error(`stretch ${bSongId}/${hookId}: ${r.reason}`);
    if (r.request.mode !== 'direct') throw new Error(`stretch ${bSongId}/${hookId}: ${r.request.mode} time is not used for blends`);
    const buffers: StemBuffers = {};
    for (const part of PARTS) {
      if (!r.parts.includes(part)) continue;
      if (!/^\d+-[a-z]+-\d+@[0-9.]+$/.test(r.dir)) throw new Error(`stretch ${bSongId}/${hookId}: bad render name`);
      const file = await fetch(`/stretch/${bSongId}/${r.dir}/${part}.flac`);
      if (file.ok) buffers[part] = await this.ctx.decodeAudioData(await file.arrayBuffer());
    }
    if (!buffers.drums) throw new Error(`stretch ${bSongId}/${hookId}: no drums`);
    entry.buffers = buffers;
    entry.scale = 1 / (r.partGain || 1);
    entry.summary = {
      aSongId,
      hookId,
      toBpm: r.effectiveBpm,
      hookSec: r.request.hookSec,
      firstDownbeatSec: r.request.firstDownbeatSec,
      barSec: r.request.targetBeatSec * (r.beatsPerBar || beatsPerBar),
      bass: Boolean(buffers.bass) && this.bassAllowed({ tight, aSongId, aHookId, bSongId, bHookId: hookId }),
    };
  }

  // What the planner may use, once decoded.
  summary(aSongId: number, hookId: string): BlendSource | null {
    return this.renders.get(`${aSongId}:${hookId}`)?.summary ?? null;
  }

  forPair(aSongId: number, hookId: string): BlendBuffers | null {
    const entry = this.renders.get(`${aSongId}:${hookId}`);
    return entry?.buffers ? { buffers: entry.buffers, scale: entry.scale } : null;
  }

  // Keep only renders for these outgoing songs.
  retain(aSongIds: readonly (number | null | undefined)[]): void {
    const keep = new Set(aSongIds.filter((id) => id != null).map(String));
    for (const key of [...this.renders.keys()]) if (!keep.has(key.split(':')[0])) this.renders.delete(key);
  }
}
