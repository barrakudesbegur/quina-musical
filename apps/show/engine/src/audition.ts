// Audition page: hear the beat grid (clicks on beats, accent on downbeats, a bell every 4 bars from the
// selected hook), see it over the waveform, preview a landing from silence, and save hand fixes.
import { AudioClock } from './clock.ts';
import { SongLoader, fetchJson, isRecord, type DecodedSong } from './audio/loader.ts';
import { metronomeClick, bell } from './audio/synth/clicks.ts';
import { analysisProblems, checkSignaturesMeta, type Analysis, type Hook, type SignatureMeta } from './analysis.ts';
import { el as $, targetOf } from './dom.ts';

/** A song in data/analysis/index.json, as the song picker shows it. */
interface IndexRow {
  id: number;
  title: string;
  artist: string;
  flags: string[];
  excluded: boolean;
}

/** The hook fields this page shows besides the ones the engine checks (tools/prep/analyze.py writes them). */
interface AuditionHook extends Hook {
  tagTimeSec?: number;
  beatIndex?: number;
  tagBarPositionBeats?: number;
  pickupBeats?: number;
}

/** The analysis fields this page shows besides the ones the engine checks (tools/prep/analyze.py writes them). */
interface AuditionAnalysis extends Analysis {
  hooks: AuditionHook[];
  downbeatBeatIndex?: number[];
  tempo: Analysis['tempo'] & {
    barSecIqrPct?: number;
    estimates?: { spotify?: number | null; librosa?: number | null; beatThisRaw?: number | null };
  };
  source: Analysis['source'] & { durationDeltaSec?: number | null };
  loudness?: NonNullable<Analysis['loudness']> & { integratedLufs?: number };
  energy?: { barRmsDb?: number[] };
}

/** data/pools/<pool>/overrides/<id>.json: hand fixes, re-derived by the relay. Unknown fields are kept as they are. */
interface Override {
  note?: string | null;
  downbeatShiftBeats?: number | null;
  tempoFactor?: number | null;
  exclude?: boolean | null;
  disableHooks?: string[] | null;
  hookDownbeats?: Record<string, number> | null;
  hookPickupBeats?: Record<string, number> | null;
  /** Signature id → picked (true) or vetoed (false); tools/prep/signatures.py applies them. */
  signatures?: Record<string, boolean> | null;
  /** No Signature plays for this song. */
  signaturesOff?: boolean | null;
  /** Approved automatic hooks (tools/prep/hooks_auto.py): candidate id → its tag and where it lands (analyze.py adds them). */
  autoHooks?: Record<string, AutoHookDecision> | null;
  /** Automatic candidates turned down (kept so the page shows them as rejected). */
  autoHooksRejected?: string[] | null;
  /** Hand tags whose suggested one-bar shift was turned down. */
  hookShiftDeclined?: string[] | null;
  [field: string]: unknown;
}

interface AutoHookDecision {
  tag: string;
  downbeatSec: number;
}

/** data/hooks/<id>.json (tools/prep/hooks_auto.py). */
interface AutoHooksMeta {
  candidates: { id: string; bar: number; downbeatSec: number; score: number; evidence: { chorus: number; jump: number; vocal: number }; suggestedTag: string }[];
  refine: { hookId: string; bar: number; suggestShiftBars: number }[];
}

const isAutoHooksMeta = (x: unknown): x is AutoHooksMeta =>
  isRecord(x) && isArray(x.candidates) && isArray(x.refine) &&
  x.candidates.every((c) => isRecord(c) && typeof c.id === 'string' && Number.isInteger(c.bar) && typeof c.downbeatSec === 'number' && typeof c.score === 'number' && isRecord(c.evidence)) &&
  x.refine.every((r) => isRecord(r) && typeof r.hookId === 'string' && Number.isInteger(r.bar) && Number.isInteger(r.suggestShiftBars));

/** POST /api/override/<id> (relay/server.ts): the re-derived analysis, or why it failed. */
interface SaveReply {
  ok: boolean;
  log?: string;
  error?: string;
  analysis?: unknown;
}

const isArray = (x: unknown): x is readonly unknown[] => Array.isArray(x);

const isIndexRow = (row: unknown): row is IndexRow =>
  isRecord(row) && Number.isInteger(row.id) && typeof row.title === 'string' && typeof row.artist === 'string' &&
  isArray(row.flags) && row.flags.every((flag) => typeof flag === 'string') && typeof row.excluded === 'boolean';

function indexRows(index: unknown): readonly IndexRow[] {
  if (!isRecord(index) || !isArray(index.songs)) throw new Error('analysis index: bad schema');
  const rows = index.songs;
  if (!rows.every(isIndexRow)) throw new Error('analysis index: bad song entry');
  return rows;
}

const isNumberMap = (x: unknown): x is Record<string, number> => isRecord(x) && Object.values(x).every((v) => typeof v === 'number');
const optional = (x: unknown, check: (x: unknown) => boolean) => x == null || check(x);

const isOverride = (x: unknown): x is Override =>
  isRecord(x) && !isArray(x) &&
  optional(x.note, (v) => typeof v === 'string') &&
  optional(x.downbeatShiftBeats, (v) => typeof v === 'number') &&
  optional(x.tempoFactor, (v) => typeof v === 'number') &&
  optional(x.exclude, (v) => typeof v === 'boolean') &&
  optional(x.disableHooks, (v) => isArray(v) && v.every((id) => typeof id === 'string')) &&
  optional(x.hookDownbeats, isNumberMap) &&
  optional(x.hookPickupBeats, isNumberMap) &&
  optional(x.signatures, (v) => isRecord(v) && Object.values(v).every((d) => typeof d === 'boolean')) &&
  optional(x.signaturesOff, (v) => typeof v === 'boolean') &&
  optional(x.autoHooks, (v) => isRecord(v) && Object.values(v).every((d) => isRecord(d) && typeof d.tag === 'string' && typeof d.downbeatSec === 'number')) &&
  optional(x.autoHooksRejected, (v) => isArray(v) && v.every((id) => typeof id === 'string')) &&
  optional(x.hookShiftDeclined, (v) => isArray(v) && v.every((id) => typeof id === 'string'));

function checkOverride(x: unknown): Override {
  if (!isOverride(x)) throw new Error('override: unexpected fields');
  return x;
}

const isSaveReply = (x: unknown): x is SaveReply =>
  isRecord(x) && typeof x.ok === 'boolean' && optional(x.log, (v) => typeof v === 'string') && optional(x.error, (v) => typeof v === 'string');

const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
const clock = new AudioClock(ctx);
const loader = new SongLoader(ctx);
const musicGain = ctx.createGain();
const clickGain = ctx.createGain();
musicGain.connect(ctx.destination);
clickGain.connect(ctx.destination);

const PEAKS_PER_SEC = 400;
const ZOOM_BEFORE = 2.5;
const ZOOM_AFTER = 3.5;
const FLAG_TEXT: Record<string, string> = {
  no_hook_tags: 'no hook tags in songs.json yet (tag them there; the song is left out until then)',
  duration_mismatch: 'MP3 length ≠ songs.json (hooks may be shifted)',
  best_hook_ambiguous: 'best tag is mid-bar',
  bar_phase_changes: 'bar phase changes',
  tempo_unstable: 'unstable tempo',
  auto_half_time: 'tempo auto-halved (bar phase is a guess)',
  grid_irregular: 'irregular grid',
  tags_suggest_phase_shift: 'tags fit another bar phase better (try Downbeats ±1 beat)',
  auto_phase_from_tags: 'bar phase chosen from the tags after halving',
};

let index: readonly IndexRow[] = [];
let songId: number | null = null;
let entry: DecodedSong | null = null;
let peaks: { mins: Float32Array; maxs: Float32Array } | null = null;
let selectedHook = 0;
let override: Override = {};
let savedOverrideText = '{}';
let playing: { source: AudioBufferSourceNode; startCtx: number; offset: number } | null = null;
let pausedPos = 0;
let nextBeat = 0;
let extraClicks: { time: number; accent: boolean }[] = [];
let downbeatSet = new Set<number>();
let signatures: SignatureMeta[] = [];
let autoHooks: AutoHooksMeta | null = null;
let signatureVoice: AudioBufferSourceNode | null = null;
const signatureBuffers = new Map<string, Promise<AudioBuffer>>();

// The song on the page. Everything but loading acts on it, so an action taken before the first song is
// loaded fails here.
function current(): DecodedSong {
  if (!entry) throw new Error('no song loaded yet');
  return entry;
}
const analysis = (): AuditionAnalysis => current().analysis;

// ---------- loading ----------
async function boot() {
  index = indexRows(await fetchJson('/analysis/index.json'));
  const wanted = Number(new URLSearchParams(location.search).get('song')) || index[0].id;
  fillSelect();
  await loadSong(wanted);
}

function isFlagged(row: IndexRow) {
  return row.flags.some((f) => f !== 'has_override');
}

function fillSelect() {
  const flaggedOnly = $('flagged-only', HTMLInputElement).checked;
  const select = $('song-select', HTMLSelectElement);
  select.replaceChildren(
    ...index
      .filter((row) => !flaggedOnly || isFlagged(row) || row.id === songId)
      .map((row) => {
        const option = document.createElement('option');
        option.value = String(row.id);
        const flags = row.flags.filter((f) => f !== 'has_override');
        option.textContent = `${row.id} · ${row.title} — ${row.artist}${flags.length ? `  ⚑${flags.length}` : ''}${row.excluded ? ' (excluded)' : ''}`;
        return option;
      }),
  );
  if (songId != null) select.value = String(songId);
}

async function loadSong(id: number) {
  stop();
  songId = id;
  history.replaceState(null, '', `?song=${id}`);
  $('song-select', HTMLSelectElement).value = String(id);
  $('title').textContent = 'Loading…';
  loader.retain([id]);
  peaks = null;
  entry = await loader.ensure(id);
  override = checkOverride(await fetchJson(`/api/override/${id}`).catch(() => ({})));
  savedOverrideText = JSON.stringify(override);
  signatures = checkSignaturesMeta(await fetchJson(`/data/signatures/${id}.json`).catch(() => null))?.signatures ?? [];
  const hooksFile: unknown = await fetchJson(`/data/hooks/${id}.json`).catch(() => null);
  autoHooks = isAutoHooksMeta(hooksFile) ? hooksFile : null;
  signatureBuffers.clear();
  peaks = computePeaks(entry.buffer);
  const best = entry.analysis.hooks.findIndex((h) => h.tag === 'best');
  selectedHook = Math.max(0, best);
  pausedPos = Math.max(0, hookDownbeat() - 4 * barAt(hook()));
  refreshAnalysisViews();
}

function refreshAnalysisViews() {
  const a = analysis();
  downbeatSet = new Set(a.downbeatBeatIndex);
  $('title').textContent = `${a.songId} · ${a.title} — ${a.artist}`;
  const t = a.tempo;
  const est = t.estimates;
  const delta = a.source.durationDeltaSec;
  $('tempo').textContent =
    `${t.bpm} BPM (Spotify ${est?.spotify ?? '—'}, librosa ${est?.librosa ?? '—'}, raw ${est?.beatThisRaw ?? '—'}) · ` +
    `${t.beatsPerBar}/4 · bar ${t.barSecMedian}s ± ${t.barSecIqrPct}% · ${a.source.durationSec.toFixed(1)} s` +
    (delta != null ? ` (songs.json ${delta > 0 ? '+' : ''}${delta} s)` : '') +
    ` · LUFS ${a.loudness?.integratedLufs}`;
  $('flags').replaceChildren(
    ...(a.flags ?? []).map((flag) => {
      const li = document.createElement('li');
      li.textContent = FLAG_TEXT[flag] ? `${flag}: ${FLAG_TEXT[flag]}` : flag;
      return li;
    }),
  );
  renderHooks();
  renderAutoHooks();
  renderSignatures();
  renderOverride();
}

function computePeaks(buffer: AudioBuffer) {
  const channels = [...Array(buffer.numberOfChannels).keys()].map((c) => buffer.getChannelData(c));
  const bin = Math.round(buffer.sampleRate / PEAKS_PER_SEC);
  const count = Math.ceil(buffer.length / bin);
  const mins = new Float32Array(count);
  const maxs = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let lo = 1;
    let hi = -1;
    const end = Math.min(buffer.length, (i + 1) * bin);
    for (let s = i * bin; s < end; s += 2) {
      let v = 0;
      for (const ch of channels) v += ch[s];
      v /= channels.length;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    mins[i] = lo;
    maxs[i] = hi;
  }
  return { mins, maxs };
}

// ---------- helpers ----------
// Undefined when the song has no hook at that index.
const hook = (): AuditionHook | undefined => analysis().hooks[selectedHook];
const hookDownbeat = (h = hook()) => h?.downbeatSec ?? h?.tagTimeSec ?? 0;
function barAt(h: AuditionHook | undefined) {
  return h?.barSecLocal || analysis().tempo.barSecMedian;
}
function beatAt(h: AuditionHook | undefined) {
  return barAt(h) / analysis().tempo.beatsPerBar;
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

function currentPos() {
  if (!playing) return pausedPos;
  return playing.offset + (clock.audible() - playing.startCtx);
}

// ---------- transport ----------
function play(fromPos = pausedPos, at = ctx.currentTime + 0.06) {
  stop();
  ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = current().buffer;
  source.connect(musicGain);
  const offset = Math.max(0, Math.min(fromPos, current().buffer.duration - 0.05));
  source.start(at, offset);
  source.onended = () => {
    if (playing?.source === source) {
      pausedPos = 0;
      playing = null;
      $('play').textContent = 'Play';
    }
  };
  playing = { source, startCtx: at, offset };
  nextBeat = analysis().beats.findIndex((b) => b >= offset - 0.001);
  if (nextBeat < 0) nextBeat = analysis().beats.length;
  $('play').textContent = 'Pause';
}

function stop() {
  if (playing) {
    pausedPos = currentPos();
    playing.source.onended = null;
    try {
      playing.source.stop();
    } catch {}
    playing = null;
  }
  extraClicks = [];
  $('play').textContent = 'Play';
}

function togglePlay() {
  if (playing) stop();
  else play();
}

function seekBy(seconds: number) {
  const pos = Math.max(0, currentPos() + seconds);
  if (playing) play(pos);
  else pausedPos = pos;
}

// Silence, then a one-bar count-in on the hook's own grid, then the hook downbeat lands exactly at T
// (B starts at T − pickup), the same arithmetic the show engine uses.
function landSelected() {
  const h = hook();
  if (!h?.downbeatSec) return;
  stop();
  ctx.resume();
  const beat = beatAt(h);
  const bpb = analysis().tempo.beatsPerBar;
  const T = ctx.currentTime + 0.3 + bpb * beat;
  const lead = Math.min(h.pickupSec || 0, h.downbeatSec);
  extraClicks = [];
  for (let k = bpb; k >= 1; k--) extraClicks.push({ time: T - k * beat, accent: k === bpb });
  play(h.downbeatSec - lead, T - lead);
}

function scheduler() {
  if (!playing || !entry) return;
  const horizon = ctx.currentTime + 0.2;
  const level = $('clicks-on', HTMLInputElement).checked ? 1 : 0;
  for (const click of extraClicks.splice(0)) {
    if (click.time >= ctx.currentTime && level) metronomeClick(ctx, clickGain, click.time, { accent: click.accent });
  }
  const { beats } = entry.analysis;
  const hookBeatIndex = hook()?.beatIndex;
  const bpb = entry.analysis.tempo.beatsPerBar;
  while (nextBeat < beats.length) {
    const time = playing.startCtx + (beats[nextBeat] - playing.offset);
    if (time > horizon) break;
    if (time >= ctx.currentTime - 0.005 && level) {
      const isDownbeat = downbeatSet.has(nextBeat);
      metronomeClick(ctx, clickGain, time, { accent: isDownbeat });
      if (isDownbeat && hookBeatIndex != null) {
        const barsFromHook = Math.round((nextBeat - hookBeatIndex) / bpb);
        if (barsFromHook % 4 === 0) bell(ctx, clickGain, time, { strong: barsFromHook === 0, level: 0.8 });
      }
    }
    nextBeat++;
  }
}

// ---------- drawing ----------
function sizeCanvas(canvas: HTMLCanvasElement) {
  const ratio = devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2D canvas context');
  g.setTransform(1, 0, 0, 1, 0, 0);
  return { g, width, height, ratio };
}

function drawOverview(pos: number, a: AuditionAnalysis) {
  const { g, width, height, ratio } = sizeCanvas($('overview', HTMLCanvasElement));
  const duration = a.source.durationSec;
  const x = (t: number) => (t / duration) * width;
  g.clearRect(0, 0, width, height);
  const rms = a.energy?.barRmsDb || [];
  g.fillStyle = 'rgba(185,176,200,0.35)';
  rms.forEach((db, i) => {
    const h = Math.max(0, (db + 40) / 40) * height * 0.9;
    g.fillRect(x(a.downbeats[i]), height - h, Math.max(1, x(a.downbeats[i + 1] ?? duration) - x(a.downbeats[i]) - 1), h);
  });
  a.hooks.forEach((h, i) => {
    g.fillStyle = !h.valid ? '#777' : i === selectedHook ? '#f2b84b' : h.tag === 'best' ? '#6fdc8c' : '#8fb8ff';
    g.fillRect(x(hookDownbeat(h)) - 1.5 * ratio, 0, 3 * ratio, height);
  });
  g.fillStyle = '#fff';
  g.fillRect(x(pos) - ratio, 0, 2 * ratio, height);
}

function drawZoom(pos: number, a: AuditionAnalysis, peaks: { mins: Float32Array; maxs: Float32Array }) {
  const { g, width, height, ratio } = sizeCanvas($('zoom', HTMLCanvasElement));
  const t0 = pos - ZOOM_BEFORE;
  const span = ZOOM_BEFORE + ZOOM_AFTER;
  const x = (t: number) => ((t - t0) / span) * width;
  const mid = height / 2;
  g.clearRect(0, 0, width, height);

  // waveform
  g.fillStyle = 'rgba(185,176,200,0.55)';
  for (let px = 0; px < width; px++) {
    const t = t0 + (px / width) * span;
    const i = Math.floor(t * PEAKS_PER_SEC);
    if (i < 0 || i >= peaks.mins.length) continue;
    const top = mid - peaks.maxs[i] * mid * 0.95;
    const bottom = mid - peaks.mins[i] * mid * 0.95;
    g.fillRect(px, top, 1, Math.max(1, bottom - top));
  }

  // grid
  const h = hook();
  const hookBeatIndex = h?.beatIndex;
  const bpb = a.tempo.beatsPerBar;
  g.font = `${11 * ratio}px ui-monospace, Menlo, monospace`;
  a.beats.forEach((b, i) => {
    if (b < t0 || b > t0 + span) return;
    const isDownbeat = downbeatSet.has(i);
    g.fillStyle = isDownbeat ? 'rgba(242,184,75,0.95)' : 'rgba(255,255,255,0.25)';
    g.fillRect(x(b) - (isDownbeat ? ratio : ratio / 2), 0, isDownbeat ? 2 * ratio : ratio, height);
    if (isDownbeat && hookBeatIndex != null) {
      const bars = Math.round((i - hookBeatIndex) / bpb);
      g.fillStyle = bars === 0 ? '#6fdc8c' : 'rgba(242,184,75,0.95)';
      g.fillText(bars === 0 ? 'HOOK' : (bars > 0 ? '+' : '') + bars, x(b) + 3 * ratio, 13 * ratio);
    }
  });

  // hooks: tag (orange dashed), landing downbeat (green), pickup start (yellow)
  for (const [i, hk] of a.hooks.entries()) {
    const alpha = i === selectedHook ? 1 : 0.45;
    g.setLineDash([5 * ratio, 4 * ratio]);
    g.strokeStyle = `rgba(255,159,67,${alpha})`;
    g.lineWidth = 2 * ratio;
    g.beginPath();
    // Without a tag time this is NaN, and the canvas ignores the line.
    const tagX = x(hk.tagTimeSec ?? NaN);
    g.moveTo(tagX, 0);
    g.lineTo(tagX, height);
    g.stroke();
    g.setLineDash([]);
    if (hk.downbeatSec != null) {
      g.fillStyle = `rgba(111,220,140,${alpha})`;
      g.fillRect(x(hk.downbeatSec) - 2 * ratio, height - 18 * ratio, 4 * ratio, 18 * ratio);
      if (hk.pickupSec) {
        g.fillStyle = `rgba(255,230,120,${alpha})`;
        g.fillRect(x(hk.downbeatSec - hk.pickupSec), height - 10 * ratio, x(hk.downbeatSec) - x(hk.downbeatSec - hk.pickupSec), 4 * ratio);
      }
    }
  }

  // playhead
  g.fillStyle = '#fff';
  g.fillRect(x(pos) - ratio, 0, 2 * ratio, height);
}

function frame() {
  requestAnimationFrame(frame);
  if (!entry || !peaks) return;
  let pos = currentPos();
  if (playing && pos >= entry.buffer.duration) pos = entry.buffer.duration;
  drawOverview(pos, entry.analysis);
  drawZoom(pos, entry.analysis, peaks);
  $('position').textContent = fmt(Math.max(0, pos));
}

// ---------- hooks table + overrides ----------
function renderHooks() {
  const a = analysis();
  $('hooks').replaceChildren(
    ...a.hooks.map((h, i) => {
      const tr = document.createElement('tr');
      tr.classList.toggle('is-selected', i === selectedHook);
      tr.classList.toggle('is-invalid', !h.valid);
      const cells = [
        `<input type="radio" name="hook" ${i === selectedHook ? 'checked' : ''} data-act="select" data-i="${i}" aria-label="Select ${h.id}">`,
        `${i + 1}. ${h.id}`,
        h.tagTimeSec?.toFixed(2),
        h.downbeatSec?.toFixed(3) ?? '—',
        h.tagBarPositionBeats ?? '—',
        h.pickupBeats ? `${h.pickupBeats} beat (${h.pickupSec.toFixed(2)} s)` : '—',
        h.gainToTargetDb ?? '—',
        (h.issues || []).join(', '),
        suggestionCell(h.id, i),
        `<button class="small" data-act="pre" data-i="${i}">−4 bars</button>
         <button class="small" data-act="land" data-i="${i}">Land</button>
         <button class="small" data-act="prev-bar" data-i="${i}" title="Land one bar earlier">◀ bar</button>
         <button class="small" data-act="next-bar" data-i="${i}" title="Land one bar later">bar ▶</button>
         <button class="small" data-act="pickup-" data-i="${i}">pickup −½</button>
         <button class="small" data-act="pickup+" data-i="${i}">pickup +½</button>
         <button class="small" data-act="toggle" data-i="${i}">${(override.disableHooks || []).includes(h.id) ? 'enable' : 'disable'}</button>`,
      ];
      tr.innerHTML = cells.map((c, k) => `<td${k === 7 ? ' class="issues"' : ''}>${c ?? ''}</td>`).join('');
      return tr;
    }),
  );
}

/**
 * The refine step's suggestion for a hand-tagged hook (tools/prep/hooks_auto.py): land a bar earlier or later, on
 * the phrase grid. Yes moves it (the tag itself is kept); No remembers the answer.
 */
function suggestionCell(hookId: string, i: number): string {
  const r = autoHooks?.refine.find((x) => x.hookId === hookId);
  if (!r?.suggestShiftBars) return '—';
  if (override.hookDownbeats?.[hookId] != null) return 'moved by hand';
  if (override.hookShiftDeclined?.includes(hookId)) return 'kept';
  const where = r.suggestShiftBars < 0 ? 'a bar earlier' : 'a bar later';
  return `${where}? <button class="small" data-act="shift-yes" data-i="${i}">Yes</button> <button class="small" data-act="shift-no" data-i="${i}">No</button>`;
}

// ---------- Automatic hooks ----------
/** A candidate's decision as the page stands: approved (its tag), rejected, or undecided. */
function autoStatus(id: string): string | null {
  const approved = override.autoHooks?.[id];
  if (approved) return approved.tag;
  return override.autoHooksRejected?.includes(id) ? 'rejected' : null;
}

function renderAutoHooks() {
  const list = autoHooks?.candidates ?? [];
  $('auto-hooks-empty').hidden = list.length > 0;
  $('auto-hooks').replaceChildren(
    ...list.map((c) => {
      const tr = document.createElement('tr');
      const status = autoStatus(c.id);
      const approved = override.autoHooks?.[c.id];
      tr.classList.toggle('is-selected', approved != null);
      tr.classList.toggle('is-invalid', status === 'rejected');
      const at = approved?.downbeatSec ?? c.downbeatSec;
      const bar = analysis().downbeats.findIndex((x) => Math.abs(x - at) < 1e-3);
      const cells = [
        c.id,
        String(bar >= 0 ? bar : c.bar),
        at.toFixed(3),
        c.score.toFixed(2),
        `${c.evidence.chorus.toFixed(2)} · ${c.evidence.jump.toFixed(2)} · ${c.evidence.vocal.toFixed(0)}`,
        status ?? `— (suggested ${c.suggestedTag})`,
        `<button class="small" data-auto="play" data-id="${c.id}" title="Play from 4 bars before it">−4 bars</button>
         <button class="small" data-auto="best" data-id="${c.id}">Best</button>
         <button class="small" data-auto="main" data-id="${c.id}">Main</button>
         <button class="small" data-auto="reject" data-id="${c.id}">Reject</button>
         <button class="small" data-auto="undo" data-id="${c.id}">Undo</button>
         <button class="small" data-auto="earlier" data-id="${c.id}" ${approved ? '' : 'disabled'} title="Land one bar earlier">◀ bar</button>
         <button class="small" data-auto="later" data-id="${c.id}" ${approved ? '' : 'disabled'} title="Land one bar later">bar ▶</button>`,
      ];
      tr.innerHTML = cells.map((x) => `<td>${x}</td>`).join('');
      return tr;
    }),
  );
}

function autoHookAction(act: string | undefined, id: string | undefined) {
  const c = autoHooks?.candidates.find((x) => x.id === id);
  if (!c) return;
  const a = analysis();
  const approved = { ...(override.autoHooks ?? {}) };
  const rejected = new Set(override.autoHooksRejected ?? []);
  if (act === 'play') {
    const at = approved[c.id]?.downbeatSec ?? c.downbeatSec;
    const d = a.downbeats.findIndex((x) => x >= at - 1e-3);
    play(Math.max(0, a.downbeats[Math.max(0, d - 4)] ?? at - 8));
    return;
  }
  if (act === 'best' || act === 'main') {
    approved[c.id] = { tag: act, downbeatSec: approved[c.id]?.downbeatSec ?? c.downbeatSec };
    rejected.delete(c.id);
  } else if (act === 'reject') {
    delete approved[c.id];
    rejected.add(c.id);
  } else if (act === 'undo') {
    delete approved[c.id];
    rejected.delete(c.id);
  } else if ((act === 'earlier' || act === 'later') && approved[c.id]) {
    const at = approved[c.id].downbeatSec;
    const d = a.downbeats.findIndex((x) => Math.abs(x - at) < 1e-3) + (act === 'earlier' ? -1 : 1);
    if (d >= 0 && d < a.downbeats.length) approved[c.id] = { ...approved[c.id], downbeatSec: a.downbeats[d] };
  }
  override.autoHooks = Object.keys(approved).length ? approved : null;
  override.autoHooksRejected = rejected.size ? [...rejected] : null;
  renderAutoHooks();
  renderOverride();
}

// ---------- Signatures ----------
/**
 * What happens to a Signature, as the page stands (this page's unsaved choices first): the song's Signatures
 * are off, it is picked or vetoed by hand, it is the automatic pick (from the last Save), or nothing.
 */
function statusOf(s: SignatureMeta): 'off' | 'picked' | 'vetoed' | 'auto' | null {
  if (override.signaturesOff) return 'off';
  const decision = override.signatures?.[s.id];
  if (decision === true) return 'picked';
  if (decision === false) return 'vetoed';
  return s.pick === 'auto' && s.approved ? 'auto' : null;
}

const STATUS_TEXT = { off: 'off', picked: 'plays (picked)', vetoed: 'vetoed', auto: 'plays (automatic)' } as const;

function renderSignatures() {
  $('signatures-empty').hidden = signatures.length > 0;
  $('signatures-off', HTMLInputElement).checked = Boolean(override.signaturesOff);
  $('signatures').replaceChildren(
    ...signatures.map((s) => {
      const tr = document.createElement('tr');
      const status = statusOf(s);
      tr.classList.toggle('is-selected', status === 'picked' || status === 'auto');
      tr.classList.toggle('is-invalid', status === 'vetoed' || status === 'off');
      const cells = [
        s.id,
        s.kind,
        s.stem,
        `${s.startSec.toFixed(2)}–${s.endSec.toFixed(2)}`,
        s.beats.toFixed(1),
        s.score.toFixed(2),
        status ? STATUS_TEXT[status] : '—',
        `<button class="small" data-sig="play" data-id="${s.id}">Play</button>
         <button class="small" data-sig="context" data-id="${s.id}" title="Play the song from 2 s before it">In song</button>
         <button class="small" data-sig="approve" data-id="${s.id}" title="This one plays (instead of the automatic pick)">Pick</button>
         <button class="small" data-sig="reject" data-id="${s.id}" title="Never this one">Veto</button>
         <button class="small" data-sig="undecided" data-id="${s.id}" title="Back to the automatic pick">Undo</button>`,
      ];
      tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join('');
      return tr;
    }),
  );
}

function signatureBuffer(id: string): Promise<AudioBuffer> {
  let buffer = signatureBuffers.get(id);
  if (!buffer) {
    buffer = fetch(`/signatures/${songId}/${id}.flac`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${id}: HTTP ${r.status}`))))
      .then((bytes) => ctx.decodeAudioData(bytes));
    signatureBuffers.set(id, buffer);
  }
  return buffer;
}

async function signatureAction(act: string | undefined, id: string | undefined) {
  const s = signatures.find((x) => x.id === id);
  if (!s) return;
  if (act === 'play') {
    stop();
    signatureVoice?.stop();
    const source = ctx.createBufferSource();
    source.buffer = await signatureBuffer(s.id);
    const gain = ctx.createGain();
    gain.gain.value = 10 ** (s.gainDb / 20) * musicGain.gain.value;
    source.connect(gain).connect(ctx.destination);
    source.start(ctx.currentTime + 0.03);
    signatureVoice = source;
    return;
  }
  if (act === 'context') {
    play(Math.max(0, s.startSec - 2));
    return;
  }
  const decisions = { ...(override.signatures ?? {}) };
  if (act === 'approve') decisions[s.id] = true;
  else if (act === 'reject') decisions[s.id] = false;
  else delete decisions[s.id];
  override.signatures = decisions;
  renderSignatures();
  renderOverride();
}

function renderOverride() {
  // Drop the empty fields (null, {} and []), keeping the others in order.
  for (const [key, v] of Object.entries(override)) {
    const keep = v != null && !(typeof v === 'object' && !isArray(v) && !Object.keys(v).length) && !(isArray(v) && !v.length);
    if (!keep) delete override[key];
  }
  $('override-json').textContent = JSON.stringify(override, null, 2);
  $('override-note', HTMLInputElement).value = override.note || '';
  const dirty = JSON.stringify(override) !== savedOverrideText;
  $('save-status').textContent = dirty ? 'Unsaved changes' : '';
}

function setMap(key: 'hookDownbeats' | 'hookPickupBeats', id: string, value: number | null | undefined) {
  const map = { ...(override[key] || {}) };
  if (value == null) delete map[id];
  else map[id] = value;
  override[key] = map;
}

function hookAction(act: string | undefined, i: number) {
  const a = analysis();
  const h = a.hooks[i];
  if (act === 'select') {
    selectedHook = i;
    renderHooks();
    return;
  }
  selectedHook = i;
  if (act === 'pre') {
    play(Math.max(0, hookDownbeat(h) - 4 * barAt(h)));
  } else if (act === 'land') {
    landSelected();
  } else if (act === 'prev-bar' || act === 'next-bar') {
    const d = h.downbeatIndex + (act === 'prev-bar' ? -1 : 1);
    if (d < 0 || d >= a.downbeats.length) return;
    setMap('hookDownbeats', h.id, a.downbeats[d]);
    setMap('hookPickupBeats', h.id, 0);
  } else if (act === 'pickup-' || act === 'pickup+') {
    const value = Math.max(0, (h.pickupBeats || 0) + (act === 'pickup+' ? 0.5 : -0.5));
    setMap('hookPickupBeats', h.id, value);
    if (!override.hookDownbeats?.[h.id]) setMap('hookDownbeats', h.id, h.downbeatSec);
  } else if (act === 'shift-yes') {
    const shift = autoHooks?.refine.find((x) => x.hookId === h.id)?.suggestShiftBars ?? 0;
    const d = h.downbeatIndex + shift;
    if (shift && d >= 0 && d < a.downbeats.length) {
      setMap('hookDownbeats', h.id, a.downbeats[d]);
      setMap('hookPickupBeats', h.id, 0);
    }
  } else if (act === 'shift-no') {
    override.hookShiftDeclined = [...new Set([...(override.hookShiftDeclined ?? []), h.id])];
  } else if (act === 'toggle') {
    const list = new Set(override.disableHooks || []);
    if (list.has(h.id)) list.delete(h.id);
    else list.add(h.id);
    override.disableHooks = [...list];
  }
  renderHooks();
  renderOverride();
}

function songFix(fix: string) {
  const [kind, value] = fix.split(':');
  if (kind === 'shift') {
    const next = (override.downbeatShiftBeats || 0) + Number(value);
    override.downbeatShiftBeats = next || undefined;
  } else if (kind === 'tempo') {
    override.tempoFactor = Number(value);
  } else if (kind === 'exclude') {
    override.exclude = override.exclude ? undefined : true;
  } else if (kind === 'reset') {
    override = {};
  }
  renderOverride();
}

async function saveOverride() {
  $('save-status').textContent = 'Saving and re-deriving…';
  const response = await fetch(`/api/override/${songId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(override),
  });
  const result: unknown = await response.json();
  if (!isSaveReply(result) || !result.ok) {
    $('save-status').textContent = `Failed: ${isSaveReply(result) ? result.error || result.log : 'unexpected reply'}`;
    return;
  }
  // The page keeps a song whose hooks are all disabled now, so they can be enabled again.
  const problems = analysisProblems(result.analysis).filter((problem) => problem !== 'no valid hook');
  if (problems.length) throw new Error(`re-derived analysis: ${problems.join(', ')}`);
  const derived = result.analysis as Analysis; // checked just above, apart from having a valid hook
  current().analysis = derived;
  savedOverrideText = JSON.stringify(override);
  const row = index.find((r) => r.id === songId);
  if (row) row.flags = derived.flags ?? [];
  if (playing) play(currentPos());
  refreshAnalysisViews();
  $('save-status').textContent = `Saved. ${(result.log ?? '').split('\n')[0]}`;
}

// ---------- events ----------
$('song-select').addEventListener('change', (e) => loadSong(Number(targetOf(e, HTMLSelectElement).value)));
$('flagged-only').addEventListener('change', fillSelect);
function stepSong(direction: number) {
  const options = [...$('song-select', HTMLSelectElement).options].map((o) => Number(o.value));
  const i = songId == null ? -1 : options.indexOf(songId);
  const next = options[(i + direction + options.length) % options.length];
  if (next != null) loadSong(next);
}
$('prev-song').addEventListener('click', () => stepSong(-1));
$('next-song').addEventListener('click', () => stepSong(1));
$('play').addEventListener('click', togglePlay);
$('land').addEventListener('click', landSelected);
$('pre-hook').addEventListener('click', () => hookAction('pre', selectedHook));
$('click-volume').addEventListener('input', (e) => (clickGain.gain.value = Number(targetOf(e, HTMLInputElement).value)));
$('music-volume').addEventListener('input', (e) => (musicGain.gain.value = Number(targetOf(e, HTMLInputElement).value)));
clickGain.gain.value = Number($('click-volume', HTMLInputElement).value);
musicGain.gain.value = Number($('music-volume', HTMLInputElement).value);
$('hooks').addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target.closest('[data-act]') : null;
  if (target instanceof HTMLElement) hookAction(target.dataset.act, Number(target.dataset.i));
});
document.querySelectorAll('[data-song-fix]').forEach((b) =>
  b.addEventListener('click', () => {
    const fix = b instanceof HTMLElement ? b.dataset.songFix : undefined;
    if (fix !== undefined) songFix(fix);
  }),
);
$('override-note').addEventListener('change', (e) => {
  override.note = targetOf(e, HTMLInputElement).value || undefined;
  renderOverride();
});
$('save-override').addEventListener('click', saveOverride);
$('signatures-off').addEventListener('change', (e) => {
  override.signaturesOff = targetOf(e, HTMLInputElement).checked || null;
  renderSignatures();
  renderOverride();
});

$('auto-hooks').addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target.closest('[data-auto]') : null;
  if (target instanceof HTMLElement) autoHookAction(target.dataset.auto, target.dataset.id);
});

$('signatures').addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target.closest('[data-sig]') : null;
  if (!(target instanceof HTMLElement)) return;
  signatureAction(target.dataset.sig, target.dataset.id).catch((error: unknown) => {
    $('save-status').textContent = `Signature: ${error instanceof Error ? error.message : String(error)}`;
  });
});
$('overview').addEventListener('click', (e) => {
  const rect = $('overview').getBoundingClientRect(); // the element this listener is on
  const pos = ((e.clientX - rect.left) / rect.width) * analysis().source.durationSec;
  if (playing) play(pos);
  else pausedPos = pos;
});
document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.matches('input[type="text"], select')) return;
  const bar = barAt(hook());
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'ArrowLeft') seekBy(e.shiftKey ? -bar / 4 : -bar);
  else if (e.key === 'ArrowRight') seekBy(e.shiftKey ? bar / 4 : bar);
  else if (e.key === 'l' || e.key === 'L') landSelected();
  else if (e.key === 'h' || e.key === 'H') hookAction('pre', selectedHook);
  else if (e.key === 'c' || e.key === 'C') $('clicks-on', HTMLInputElement).checked = !$('clicks-on', HTMLInputElement).checked;
  else if (e.key === '[') stepSong(-1);
  else if (e.key === ']') stepSong(1);
  else if (/^[1-9]$/.test(e.key) && analysis().hooks[Number(e.key) - 1]) hookAction('select', Number(e.key) - 1);
});

setInterval(scheduler, 25);
requestAnimationFrame(frame);
boot().catch((error: unknown) => {
  $('title').textContent = `Failed to load: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
});
