"""Build the touch sounds' sprites (D206-D208): one small mono MP3 per surface with only the recordings its classes
use, and sprites.ts with each sample's place in it. The picks live in packages/ui/sounds/picks.json; the recordings
are the lossless WAVs of Josh Comeau's button-sounds (MIT), from a checkout of the commit picks.json names.

    git clone https://github.com/joshwcomeau/button-sounds /tmp/button-sounds   # then check out picks.json's commit
    tools/prep/.venv/bin/python tools/prep/ui_sounds.py --source /tmp/button-sounds/package/audio

Each source file holds its samples one second apart: a press at N x 1000 ms (190 ms long) and its release at
N x 1000 + 200 ms. The build cuts the first `samples` of each, trims the silence around each one, brings each
sound's variant to one peak (`peakDb`), fades its end, and lays them out with `gapMs` of silence between, so the
MP3's frame padding never clips a click. It decodes the MP3 again (as browsers do, honouring the encoder delay) and
checks each sample's onset against the map.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import librosa
import numpy as np
import soundfile

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / 'packages' / 'ui' / 'sounds'
VARIANTS = ('press', 'release')


def cut(audio: np.ndarray, sr: int, start_ms: float, length_ms: float) -> np.ndarray:
    a = int(round(start_ms * sr / 1000))
    return audio[a:a + int(round(length_ms * sr / 1000))].copy()


def trim(x: np.ndarray, sr: int, head_db: float = -40.0, tail_db: float = -50.0, keep_ms: float = 2.0) -> np.ndarray:
    """Drop the silence around the sound, so a press sounds the moment it plays: from `keep_ms` before the first point
    within `head_db` of the peak, to 4 x `keep_ms` past the last point within `tail_db` of it."""
    peak = np.abs(x).max()
    if peak == 0:
        return x[:1]
    first = int(np.argmax(np.abs(x) >= peak * 10 ** (head_db / 20)))
    loud = np.where(np.abs(x) >= peak * 10 ** (tail_db / 20))[0]
    keep = int(keep_ms * sr / 1000)
    return x[max(0, first - keep):min(len(x), loud[-1] + 4 * keep)]


def build_surface(name: str, surface: dict, layout: dict, source: Path, work: Path) -> dict:
    sr = layout['sampleRate']
    gap = np.zeros(int(layout['gapMs'] * sr / 1000))
    fade = int(layout['fadeMs'] * sr / 1000)
    # Each (sound, variant) once, however many classes use it, with the most samples any of them asks for.
    wanted: dict[tuple[str, str], int] = {}
    for cls in surface['classes'].values():
        for variant in VARIANTS:
            if variant in cls:
                key = (cls[variant], variant)
                wanted[key] = max(wanted.get(key, 0), cls.get('samples', layout['samples']))
    pieces: list[np.ndarray] = [gap]
    cursor = len(gap)
    places: dict[tuple[str, str], list[list[float]]] = {}
    peak = 10 ** (layout['peakDb'] / 20)
    for (sound, variant), count in sorted(wanted.items()):
        audio, _ = librosa.load(source / f'{sound}.wav', sr=sr, mono=True)
        offset = 0 if variant == 'press' else 200
        length = layout['pressMs'] if variant == 'press' else layout['releaseMs']
        samples = [trim(cut(audio, sr, i * 1000 + offset, length), sr) for i in range(1, count + 1)]
        samples = [s for s in samples if np.abs(s).max() > 0]
        if len(samples) < count:
            raise SystemExit(f'{sound} {variant}: only {len(samples)} of {count} samples have sound')
        gain = peak / max(np.abs(s).max() for s in samples)
        places[(sound, variant)] = []
        for s in samples:
            s = s * gain
            n = min(fade, len(s))
            s[-n:] *= np.linspace(1, 0, n)
            places[(sound, variant)].append([round(cursor * 1000 / sr, 2), round(len(s) * 1000 / sr, 2)])
            pieces += [s, gap]
            cursor += len(s) + len(gap)
    pcm = np.concatenate(pieces).astype(np.float32)
    wav = work / f'{name}.wav'
    mp3 = OUT / f'{name}.mp3'
    soundfile.write(wav, pcm, sr, subtype='FLOAT')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-ac', '1', '-ar', str(sr), '-c:a', 'libmp3lame',
                    '-b:a', layout['bitrate'], '-map_metadata', '-1', str(mp3)], check=True)
    check_onsets(mp3, pcm, sr, places)
    classes = {}
    for cls_name, cls in surface['classes'].items():
        entry: dict = {}
        for variant in VARIANTS:
            if variant in cls:
                entry[variant] = {'sound': cls[variant], 'at': places[(cls[variant], variant)][: cls.get('samples', layout['samples'])]}
        entry['rate'] = cls['rate']
        if 'bend' in cls:
            entry['bend'] = cls['bend']
        classes[cls_name] = entry
    print(f'{name}: {len(wanted)} recordings, {len(pcm) / sr:.1f} s, {mp3.stat().st_size / 1000:.0f} KB')
    return {'gain': surface['gain'], 'classes': classes}


def check_onsets(mp3: Path, pcm: np.ndarray, sr: int, places: dict) -> None:
    """The decoded MP3 must line up with the map: the onset of each sample within 1 ms of where the map says."""
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'],
                             check=True, capture_output=True).stdout
    y = np.frombuffer(decoded, dtype=np.float32)
    worst = 0.0
    for spots in places.values():
        for start, length in spots:
            a = int(start * sr / 1000)
            b = a + int(length * sr / 1000)
            # Cross-correlate the source sample with the decoded audio around its place (±20 ms).
            pad = int(0.02 * sr)
            ref = pcm[a:b]
            seg = y[max(0, a - pad):b + pad]
            if len(seg) < len(ref):
                raise SystemExit(f'{mp3.name}: the decoded file is shorter than the map')
            corr = np.correlate(seg, ref, mode='valid')
            shift = (int(np.argmax(corr)) - (a - max(0, a - pad))) * 1000 / sr
            worst = max(worst, abs(shift))
    if worst > 1.0:
        raise SystemExit(f'{mp3.name}: a sample is {worst:.2f} ms off its place in the map')
    print(f'{mp3.name}: onsets within {worst:.2f} ms of the map')


def write_ts(sprites: dict, picks: dict) -> None:
    # Number lists on one line each: [start, length] pairs and rate ranges.
    body = re.sub(r'\[\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]', r'[\1, \2]', json.dumps(sprites, indent=2, ensure_ascii=False))
    body = re.sub(r'\[\s*((?:\[[^\[\]]*\],?\s*)+)\]', lambda m: '[' + ', '.join(re.findall(r'\[[^\[\]]*\]', m.group(1))) + ']', body)
    src = picks['source']
    text = (
        '// Generated by tools/prep/ui_sounds.py from picks.json: do not edit by hand. The touch sounds\' sprites (D206-D208):\n'
        '// for each class, where its press and release samples sit in <surface>.mp3 ([start, length] in ms), its random\n'
        '// rate range, and its pitch bend. The recordings: Josh Comeau\'s button-sounds (MIT, LICENSE-button-sounds.txt),\n'
        f'// {src["repo"]} at {src["commit"][:12]}.\n'
        "import type { SpriteMap } from './types.ts';\n\n"
        f'export const SPRITES = {body} as const satisfies Record<string, SpriteMap>;\n'
    )
    (OUT / 'sprites.ts').write_text(text, encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--source', type=Path, required=True, help="button-sounds' package/audio folder (the WAVs)")
    args = parser.parse_args()
    picks = json.loads((OUT / 'picks.json').read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory() as tmp:
        sprites = {name: build_surface(name, surface, picks['layout'], args.source, Path(tmp)) for name, surface in picks['surfaces'].items()}
    write_ts(sprites, picks)


if __name__ == '__main__':
    sys.exit(main())
