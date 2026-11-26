"""The automatic voice cues (D198, D202–D204): each cue and lead sound at one loudness, ready for the show.

Every name (the protocol's VOICE_CUES, plus the `chime` and the round's `fanfare`) comes from the user's recording,
data/media/voice/<name>.<mp3|m4a|wav|flac|ogg|opus>, when there is one, else from a placeholder made here: the voice by
macOS `say` (Spanish "Mónica" reading the Catalan line, the system voice without her), the chime and fanfare as tones.
Each is decoded to 48 kHz stereo FLAC in data/cache/voice/<name>.flac, at TARGET_LUFS (a short chime or fanfare by its
peak), and listed in data/out/voice/index.json:

    {"schemaVersion": 1, "voices": [{"name", "durationSec", "placeholder", "source"}]}

`placeholder: true` marks what's still to record (the laptop's preflight warns about it). Placeholders never go in
data/media/voice/, so only the recordings are synced. A name is redone when its source is newer than its output (or it
changes between a recording and a placeholder); `--force` redoes all.

    tools/prep/.venv/bin/python tools/prep/voices.py [--force] [--only NAME ...]
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import repertoire as repertoires  # noqa: E402
from steps import loudness as loud_step  # noqa: E402

SR = 48000
SOURCE_DIR = repertoires.MEDIA / "voice"
CACHE_DIR = repertoires.CACHE / "voice"
OUT_DIR = repertoires.OUT / "voice"
AUDIO_EXTS = (".mp3", ".m4a", ".wav", ".flac", ".ogg", ".opus")
# A lead sound is short: by its peak, a little under the voice.
LEAD_PEAK_DBFS = -6.0
PLACEHOLDER_VOICE = "Mónica"

# The protocol's VOICE_CUES (packages/protocol/vocabulary.ts), with each placeholder's line; tests check they match.
NUMBERS = ["u", "dos", "tres", "quatre", "cinc", "sis", "set", "vuit", "nou", "deu"]
LINES: dict[str, str] = {
    **{f"round-{i + 1}": f"Comença la Quina {n}!" for i, n in enumerate(NUMBERS)},
    "round-desgraciat": "Comença la Quina del Desgraciat!",
    "round-especial": "Comença la Quina Especial!",
    "doors-60": "Falta una hora per començar la Quina!",
    "doors-45": "Falten quaranta-cinc minuts per començar!",
    "doors-30": "Falten trenta minuts per començar!",
    "doors-15": "Falten quinze minuts! Encara sou a temps de comprar cartrons!",
    "doors-5": "Falten cinc minuts per començar!",
    "doors-3": "Falten tres minuts! Seieu, que comencem!",
    "start": "Benvinguts i benvingudes a la Quina Quina!",
    "descans-2min": "Tornem en dos minuts!",
    "goodbye": "Gràcies per venir! Fins l'any que ve!",
}
LEADS = ("chime", "fanfare")
NAMES = (*LINES, *LEADS)


def source_of(name: str) -> Path | None:
    for ext in AUDIO_EXTS:
        path = SOURCE_DIR / f"{name}{ext}"
        if path.exists():
            return path
    return None


def decode(src: Path) -> np.ndarray:
    """Any audio file as 48 kHz stereo float64."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "x.wav"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-map", "0:a:0", "-ar", str(SR), "-ac", "2",
                        str(wav)], check=True)
        signal, _ = sf.read(wav, dtype="float64", always_2d=True)
    return signal


def tone(freqs_secs: list[tuple[float, float]], gap: float = 0.0) -> np.ndarray:
    """Soft sine notes one after another (a placeholder chime or fanfare)."""
    parts = []
    for freq, secs in freqs_secs:
        t = np.arange(int(secs * SR)) / SR
        env = np.minimum(1.0, t / 0.01) * np.exp(-3.0 * t / secs)
        note = 0.5 * np.sin(2 * np.pi * freq * t) * env + 0.15 * np.sin(4 * np.pi * freq * t) * env
        parts.extend([note, np.zeros(int(gap * SR))])
    mono = np.concatenate(parts)
    return np.stack([mono, mono], axis=1)


def placeholder(name: str) -> np.ndarray:
    if name == "chime":
        return tone([(1046.5, 0.35), (1318.5, 0.6)], gap=0.02)
    if name == "fanfare":
        return tone([(523.3, 0.18), (659.3, 0.18), (784.0, 0.18), (1046.5, 0.7)], gap=0.03)
    with tempfile.TemporaryDirectory() as tmp:
        aiff = Path(tmp) / "say.aiff"
        voices = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
        cmd = ["say", "-o", str(aiff), LINES[name]]
        if PLACEHOLDER_VOICE in voices:
            cmd[1:1] = ["-v", PLACEHOLDER_VOICE]
        subprocess.run(cmd, check=True)
        return decode(aiff)


def level(signal: np.ndarray, name: str) -> np.ndarray:
    """A voice at TARGET_LUFS; a lead sound by its peak."""
    if name in LEADS:
        peak = float(np.max(np.abs(signal))) or 1.0
        return signal * (10 ** (LEAD_PEAK_DBFS / 20) / peak)
    lufs = loud_step.integrated(signal, SR)
    gain = loud_step.gain_to_target(lufs)
    out = signal * 10 ** (gain / 20)
    peak = float(np.max(np.abs(out)))
    return out / peak * 0.89 if peak > 0.89 else out


def prepare(name: str, force: bool, previous: dict) -> dict:
    src = source_of(name)
    flac = CACHE_DIR / f"{name}.flac"
    is_placeholder = src is None
    was = previous.get(name)
    fresh = (flac.exists() and was is not None and was.get("placeholder") == is_placeholder
             and (is_placeholder or flac.stat().st_mtime >= src.stat().st_mtime))
    if fresh and not force:
        return was
    signal = level(placeholder(name) if is_placeholder else decode(src), name)
    flac.parent.mkdir(parents=True, exist_ok=True)
    tmp = flac.with_suffix(".tmp.flac")
    sf.write(tmp, signal.astype(np.float32), SR, subtype="PCM_16", format="FLAC")
    tmp.replace(flac)
    return {"name": name, "durationSec": round(len(signal) / SR, 3), "placeholder": is_placeholder,
            "source": None if src is None else repertoires.display(src, repertoires.REPO)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--force", action="store_true", help="redo every name")
    ap.add_argument("--only", nargs="*", default=None, help="just these names")
    args = ap.parse_args(argv)
    if shutil.which("ffmpeg") is None:
        print("voices: ffmpeg is needed", file=sys.stderr)
        return 1
    index_path = OUT_DIR / "index.json"
    previous = {}
    if index_path.exists():
        previous = {v["name"]: v for v in json.loads(index_path.read_text()).get("voices", [])}
    names = [n for n in NAMES if not args.only or n in args.only]
    rows = {**previous}
    for name in names:
        if source_of(name) is None and name not in LEADS and shutil.which("say") is None:
            print(f"voices: {name}: no recording and no `say` for a placeholder", file=sys.stderr)
            continue
        rows[name] = prepare(name, args.force, previous)
    ordered = [rows[n] for n in NAMES if n in rows]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    text = json.dumps({"schemaVersion": 1, "voices": ordered}, ensure_ascii=False, indent=1) + "\n"
    if not index_path.exists() or index_path.read_text() != text:
        index_path.write_text(text)
    placeholders = sum(1 for v in ordered if v["placeholder"])
    print(f"voices: {len(ordered)} ready in {repertoires.display(CACHE_DIR, repertoires.REPO)}"
          + (f", {placeholders} placeholders (record them into {repertoires.display(SOURCE_DIR, repertoires.REPO)})" if placeholders else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
