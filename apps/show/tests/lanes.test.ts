// P1 stem lanes and P2 slices: the pure helpers the Deck runs (audio/lanes.ts). The subtraction test uses a
// real song's mix and stems (cache/<id>/mix.flac and cache/<id>/stems, decoded with ffmpeg) and the Deck's own
// frame arithmetic: removing a part must leave mix − part to −60 dB, and removing every part must leave
// silence. It is skipped, with a note, when the audio or ffmpeg is not there (audio stays out of the repo).
// test.html checks the same through the real Web Audio graph.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { frameAligned, laneSources, laneStart, onsetShift, pointsAt, schedulePoints } from '../engine/src/audio/lanes.ts';
import type { LanePart, StemName } from '../engine/src/plan/events.ts';
import { CACHE, OUT } from '../relay/pool.ts';


const SR = 48000;

test('frameAligned: whole frames, within a frame of the plan, the song keeps its place in time', () => {
  for (const [when, offset] of [[12.3456789, 41.987654321], [0.5, 38.52], [100.000001, 0.0000003], [7.77777, 3.33333]]) {
    const at = frameAligned(when, offset, SR);
    const frame = Math.round(at.when * SR);
    assert.ok(Math.abs(at.when * SR - frame) < 1e-5, 'starts a hair before a whole frame');
    assert.ok(Number.isInteger(Math.round(at.offset * SR)) && Math.abs(at.offset * SR - Math.round(at.offset * SR)) < 1e-6, 'a whole-frame offset');
    // The song position sounding at any later time moves by less than a frame.
    const t = when + 3.21;
    const asked = offset + (t - when);
    const got = at.offset + (t - at.when);
    assert.ok(Math.abs(asked - got) * SR <= 1.01, `moved ${(asked - got) * SR} frames`);
  }
});

test('laneSources: a stem at full scale, and other = mix − scale·(drums + bass + vocals)', () => {
  assert.deepEqual(laneSources('drums', 2), [{ from: 'drums', gain: 2 }]);
  assert.deepEqual(laneSources('other', 2), [{ from: 'mix', gain: 1 }, { from: 'drums', gain: -2 }, { from: 'bass', gain: -2 }, { from: 'vocals', gain: -2 }]);
});

test('lane breakpoints: held outside, linear between, cut to 0 at `until`', () => {
  const points = [[1, 0], [1.5, -1], [2, -1]] as const;
  assert.equal(pointsAt(points, 0.5), 0);
  assert.equal(pointsAt(points, 1.25), -0.5);
  assert.equal(pointsAt(points, 3), -1);
  const calls: [string, number, number][] = [];
  const param = {
    setValueAtTime: (v: number, t: number) => calls.push(['set', v, t]),
    linearRampToValueAtTime: (v: number, t: number) => calls.push(['ramp', v, t]),
  };
  schedulePoints(param, points, 1.2, 3);
  assert.deepEqual(calls[0], ['set', pointsAt(points, 1.2), 1.2]);
  assert.ok(calls.some(([k, v, t]) => k === 'ramp' && v === -1 && t === 1.5));
  assert.deepEqual(calls[calls.length - 1], ['ramp', 0, 3]);
  // Times never go backwards.
  for (let k = 1; k < calls.length; k++) assert.ok(calls[k][2] >= calls[k - 1][2]);
});

test('P2 onset snap: lands on a syllable after silence, and skips a noisy consonant', () => {
  const n = SR;
  const data = new Float32Array(n);
  const onset = Math.round(0.08 * SR);
  const vowel = onset + Math.round(0.02 * SR);
  for (let k = onset; k < vowel; k++) data[k] = 0.3 * (k % 2 ? 1 : -1); // noise-like: crosses every frame
  for (let k = vowel; k < n; k++) data[k] = 0.5 * Math.sin((2 * Math.PI * 220 * k) / SR);
  const shift = onsetShift([data], SR, 0, 0.25, 0.03);
  assert.ok(Math.abs(shift - vowel / SR) <= 0.006, `snapped to ${shift}, vowel at ${vowel / SR}`);
  assert.equal(onsetShift([new Float32Array(n)], SR, 0, 0.25, 0.03), 0, 'silence: no shift');
});

/** Decodes frames [start, end) of a FLAC to interleaved stereo float32, or null without ffmpeg. */
function decode(file: string, start: number, end: number): Float32Array | null {
  try {
    const out = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', `atrim=start_sample=${start}:end_sample=${end}`, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
    return new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4);
  } catch {
    return null;
  }
}

interface StemsJson {
  stemGain: number;
  windows: { startSample: number; lengthSamples: number }[];
}

test('P1 subtraction on real stems through the Deck\'s frame arithmetic: −60 dB residual, and every part removed leaves silence', (t) => {
  const id = 1;
  const meta = path.join(OUT, 'stems', `${id}.json`);
  const mixFile = path.join(CACHE, String(id), 'mix.flac');
  if (!fs.existsSync(meta) || !fs.existsSync(mixFile)) return t.skip(`no stems or audio for song ${id} (cache/ is not in the repo)`);
  const { stemGain, windows } = JSON.parse(fs.readFileSync(meta, 'utf8')) as StemsJson;
  const window = windows[0];
  // A deck started at an arbitrary (non-frame) time from an arbitrary song position, as a plan would.
  const deck = frameAligned(103.123456789, 52.3711 - 0.4123, SR);
  const startFrame = Math.round(deck.when * SR);
  const offsetFrame = Math.round(deck.offset * SR);
  // A lane at an arbitrary time a few seconds later, for one second.
  const at = 106.98765;
  const frames = SR;
  const mixAt = laneStart(startFrame, offsetFrame, at, SR, 0);
  const stemAt = laneStart(startFrame, offsetFrame, at, SR, window.startSample);
  const songFrame = offsetFrame + (mixAt.frame - startFrame); // what the main source plays at the lane's first frame
  const mix = decode(mixFile, songFrame, songFrame + frames);
  if (!mix) return t.skip('ffmpeg is not available');
  const stem = (name: StemName) => decode(path.join(CACHE, String(id), 'stems', `${name}.${window.startSample}.flac`), stemAt.offsetFrames, stemAt.offsetFrames + frames);
  const stems: Partial<Record<StemName, Float32Array>> = { drums: stem('drums') ?? undefined, bass: stem('bass') ?? undefined, vocals: stem('vocals') ?? undefined };
  // Each lane's source buffers, read at the lane's offsets (a mix source in a lane reads it like the main source).
  const mixLane = decode(mixFile, mixAt.offsetFrames, mixAt.offsetFrames + frames);
  assert.ok(mixLane);
  const lane = (part: LanePart, level: number) => (k: number) => laneSources(part, 1 / stemGain)
    .reduce((sum, { from, gain }) => sum + level * gain * (from === 'mix' ? mixLane[k] : (stems[from]?.[k] ?? NaN)), 0);
  const rms = (f: (k: number) => number) => Math.sqrt(Array.from({ length: mix.length }, (_, k) => f(k) ** 2).reduce((a, b) => a + b, 0) / mix.length);
  const mixRms = rms((k) => mix[k]);
  // mix + (−1)·drums against mix − drums/stemGain read straight from the files at the same song frames.
  const drums = stems.drums;
  const truth = decode(path.join(CACHE, String(id), 'stems', `drums.${window.startSample}.flac`), songFrame - window.startSample, songFrame - window.startSample + frames);
  assert.ok(drums && truth && mixRms > 0);
  const removeDrums = lane('drums', -1);
  const residual = rms((k) => mix[k] + removeDrums(k) - (mix[k] - truth[k] / stemGain));
  const db = 20 * Math.log10(Math.max(residual, 1e-12) / mixRms);
  assert.ok(db < -60, `drums removal residual ${db.toFixed(1)} dB`);
  // Every part removed (drums, bass, vocals and other): nothing is left.
  const all = (['drums', 'bass', 'vocals', 'other'] as const).map((p) => lane(p, -1));
  const left = rms((k) => all.reduce((sum, f) => sum + f(k), mix[k]));
  const leftDb = 20 * Math.log10(Math.max(left, 1e-12) / mixRms);
  assert.ok(leftDb < -60, `everything removed leaves ${leftDb.toFixed(1)} dB`);
  // The check is sharp: drums read one frame off would leave a residual far above −60 dB.
  const late = decode(path.join(CACHE, String(id), 'stems', `drums.${window.startSample}.flac`), stemAt.offsetFrames + 1, stemAt.offsetFrames + 1 + frames);
  assert.ok(late);
  const offDb = 20 * Math.log10(rms((k) => late[k] - truth[k]) / stemGain / mixRms);
  assert.ok(offDb > -60, `a one-frame misalignment shows (${offDb.toFixed(1)} dB)`);
  console.log(`P1 residual: drums removed ${db.toFixed(1)} dB, all parts removed ${leftDb.toFixed(1)} dB (song ${id})`);
});
