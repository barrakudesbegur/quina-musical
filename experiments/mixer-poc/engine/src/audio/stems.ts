// Stems around the hooks of the next songs, decoded ahead of time so a transition can Tease with them.
// Only the slices a Tease can use are kept: a few bars before each likely hook, drums and bass.
import { checkStemsMeta, stemWindowFor } from '../analysis.ts';
import type { Analysis, Hook, StemsMeta } from '../analysis.ts';
import { STEMS } from '../config.ts';
import type { StemName } from '../plan/recipes.ts';

const PARTS: readonly StemName[] = ['drums', 'bass'];

/** Decoded stem slices, by stem; a stem that was not decoded is missing. */
export type StemBuffers = Partial<Record<StemName, AudioBuffer>>;

/** The stems around one hook (StemStore.forHook): `buffers` start at song time `startSec`; `scale` undoes the stored gain. */
export interface HookStems {
  buffers: StemBuffers;
  startSec: number;
  scale: number;
  parts: StemName[];
}

/** One song's stems: `promise` settles once every hook is decoded (or given up on). */
interface SongStems {
  promise: Promise<void>;
  hooks: Map<string, HookStems>;
}

// Is this stem actually playing in the bars before the hook? (A quiet intro would make a silent Tease.)
function audibleBefore(meta: StemsMeta, part: StemName, hook: Hook): boolean {
  const bars = meta.bars?.[part];
  if (!bars) return true;
  const k = hook.downbeatIndex;
  const before = bars.slice(Math.max(0, k - STEMS.teaseBarsChecked), k);
  return before.length > 0 && before.reduce((a, b) => a + b, 0) / before.length >= STEMS.teaseMinBarDb;
}

export class StemStore {
  ctx: BaseAudioContext;
  songs: Map<number, SongStems>;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.songs = new Map(); // id → { promise, hooks: Map<hookId, { buffers, startSec, scale, parts }> }
  }

  // Decode the stems around the song's valid best/main hooks. Never rejects: a song without stems just
  // gets low-passed Teases.
  ensure(songId: number, analysis: Analysis): Promise<void> {
    let entry = this.songs.get(songId);
    if (!entry) {
      const hooks = new Map<string, HookStems>();
      entry = {
        hooks,
        promise: this.load(songId, analysis, hooks).catch((error: unknown) => {
          console.warn('stems', songId, error);
        }),
      };
      this.songs.set(songId, entry);
    }
    return entry.promise;
  }

  async load(songId: number, analysis: Analysis, hooks: Map<string, HookStems>): Promise<void> {
    const response = await fetch(`/data/stems/${songId}.json`, { cache: 'no-store' });
    if (!response.ok) return;
    const meta = checkStemsMeta(await response.json());
    if (!meta) return;
    const wanted = analysis.hooks.filter((h) => h.valid && (h.tag === 'best' || h.tag === 'main'));
    const decoded = new Map<string, AudioBuffer>(); // `${stem}.${startSample}` → the whole window, dropped after slicing
    for (const hook of wanted) {
      const fromSec = Math.max(0, hook.downbeatSec - STEMS.leadSec);
      const toSec = hook.downbeatSec + STEMS.tailSec;
      const window = stemWindowFor(meta, fromSec, toSec);
      if (!window) continue;
      const buffers: StemBuffers = {};
      for (const part of PARTS) {
        if (!meta.stems.includes(part) || !audibleBefore(meta, part, hook)) continue;
        const key = `${part}.${window.startSample}`;
        let full = decoded.get(key);
        if (!full) {
          const file = await fetch(`/stems/${songId}/${key}.flac`);
          if (!file.ok) continue;
          full = await this.ctx.decodeAudioData(await file.arrayBuffer());
          decoded.set(key, full);
        }
        buffers[part] = slice(this.ctx, full, fromSec - window.startSec, toSec - window.startSec);
      }
      const parts = PARTS.filter((part) => buffers[part]);
      if (parts.length) hooks.set(hook.id, { buffers, startSec: fromSec, scale: 1 / meta.stemGain, parts });
    }
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

  retain(ids: readonly (number | null | undefined)[]): void {
    const keep = new Set(ids.filter((id) => id != null));
    for (const id of [...this.songs.keys()]) if (!keep.has(id)) this.songs.delete(id);
  }
}

function slice(ctx: BaseAudioContext, buffer: AudioBuffer, fromSec: number, toSec: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const start = Math.max(0, Math.round(fromSec * sr));
  const end = Math.min(buffer.length, Math.round(toSec * sr));
  const out = ctx.createBuffer(buffer.numberOfChannels, Math.max(1, end - start), sr);
  for (let c = 0; c < buffer.numberOfChannels; c++) out.copyToChannel(buffer.getChannelData(c).subarray(start, end), c);
  return out;
}
