"""Hook detection for songs nobody tagged (this year's playlist, the user's decision Q33 b), and a refine step for
hand tags. Per-bar features in, candidates out; tools/prep/hooks_auto.py reads the audio and writes the files.

A hook is where a chorus lands. Three kinds of evidence, per bar (index = downbeat index):
- the chorus (structure): the song is cut into sections by Laplacian segmentation of its bars (chroma recurrence
  for what comes back, timbre continuity for what belongs together; McFee and Ellis 2014), the sections are
  grouped into a few kinds, and the start of a section scores by how loud its kind is and how often it comes
  back;
- an energy jump: the next 4 bars are louder than the 4 before;
- a vocal onset: the singer comes in (silent in the 2 bars before, singing on this one).
On last year's songs (hand-tagged), the top candidate lands within a bar of a tagged hook in 26 of 77 songs and
one of the top three in 48 (chance: about one in eight per candidate): proposals, not answers. The user
approves, rejects or nudges each on the audition page, and only approved ones become hooks. The refine step moves
a candidate by at most a bar onto the song's 4-bar phrase grid when the grid's bar scores nearly as well, and
suggests the same for hand tags (the tag itself is always kept).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

WINDOW_BARS = 4
MIN_GAP_BARS = 8
MAX_CANDIDATES = 5
VOCAL_ON_DB = -26.0
VOCAL_OFF_DB = -36.0
# How many kinds of section the segmentation groups bars into (intro, verse, chorus, bridge…): each count votes, so
# a chorus merged with the verse at one count is told apart at another.
SECTION_KINDS = (3, 4, 5, 6)
WEIGHTS = {"chorus": 1.0, "jump": 0.2, "vocal": 0.1}
# The refine step moves a bar onto the phrase grid when the grid bar scores at least this share of it.
SNAP_SHARE = 0.9
# A hand tag is suggested a shift when the bar next to it scores this much more (and sits on the grid).
SUGGEST_MARGIN = 0.15


@dataclass(frozen=True)
class Candidate:
    bar: int
    score: float
    evidence: dict
    snapped: int  # bars the refine step moved it by (−1, 0 or +1)


def _norm(x: np.ndarray | float, lo: float, hi: float):
    return np.clip((np.asarray(x, dtype=float) - lo) / (hi - lo), 0.0, 1.0)


def _kmeans(x: np.ndarray, k: int, iters: int = 50) -> np.ndarray:
    """Plain k-means, seeded by spread-out rows (deterministic)."""
    k = min(k, len(x))
    centers = x[np.linspace(0, len(x) - 1, k).astype(int)]
    labels = np.zeros(len(x), dtype=int)
    for _ in range(iters):
        labels = np.argmin(((x[:, None, :] - centers[None]) ** 2).sum(-1), axis=1)
        moved = np.array([x[labels == j].mean(0) if np.any(labels == j) else centers[j] for j in range(k)])
        if np.allclose(moved, centers):
            break
        centers = moved
    return labels


def section_kinds(chroma: np.ndarray, mfcc: np.ndarray, k: int = 4) -> np.ndarray:
    """Each bar's kind of section (0..k−1): Laplacian segmentation of the bars' chroma recurrence and MFCC continuity."""
    import librosa
    import scipy.linalg
    import scipy.ndimage
    import scipy.sparse.csgraph

    n = len(chroma)
    if n < 2 * k:
        return np.zeros(n, dtype=int)
    rec = librosa.segment.recurrence_matrix(chroma.T, width=3, mode="affinity", sym=True)
    rec = librosa.segment.timelag_filter(scipy.ndimage.median_filter)(rec, size=(1, 5))
    step = np.sum(np.diff(mfcc, axis=0) ** 2, axis=1)
    near = np.exp(-step / (np.median(step) + 1e-9))
    path = np.diag(near, k=1) + np.diag(near, k=-1)
    deg_path, deg_rec = path.sum(axis=1), rec.sum(axis=1)
    mu = deg_path.dot(deg_path + deg_rec) / (np.sum((deg_path + deg_rec) ** 2) + 1e-9)
    lap = scipy.sparse.csgraph.laplacian(mu * rec + (1 - mu) * path, normed=True)
    _, vecs = scipy.linalg.eigh(lap)
    # An eigenvector's sign is arbitrary (it can differ between BLAS builds and thread counts): fix it so its
    # largest component is positive.
    vecs = vecs * np.where(vecs[np.abs(vecs).argmax(axis=0), np.arange(vecs.shape[1])] < 0, -1.0, 1.0)
    vecs = scipy.ndimage.median_filter(vecs, size=(5, 1))
    norm = np.cumsum(vecs**2, axis=1) ** 0.5
    return _kmeans(vecs[:, :k] / (norm[:, k - 1:k] + 1e-9), k)


def chorus_starts(kinds: np.ndarray, bar_db: np.ndarray) -> np.ndarray:
    """Per bar, how much a section starting there sounds like the chorus: its kind's loudness rank (60%) and how
    often that kind comes back (40%, up to four times); 0 where no section of at least 2 bars starts."""
    n = len(kinds)
    sections = []
    start = 0
    for i in range(1, n + 1):
        if i == n or kinds[i] != kinds[start]:
            sections.append((start, i, int(kinds[start])))
            start = i
    count: dict[int, int] = {}
    levels: dict[int, list[float]] = {}
    for a, b, kind in sections:
        count[kind] = count.get(kind, 0) + 1
        levels.setdefault(kind, []).extend(float(x) for x in bar_db[a:b])
    order = sorted(levels, key=lambda kind: -np.mean(levels[kind]))
    out = np.zeros(n)
    for a, b, kind in sections:
        if b - a >= 2:
            out[a] = max(out[a], 0.6 * (1 - order.index(kind) / len(order)) + 0.4 * min(count[kind], 4) / 4)
    return out


def _rank(x: np.ndarray) -> np.ndarray:
    """Each value's rank in the song, 0..1."""
    return np.argsort(np.argsort(x)) / max(1, len(x) - 1)


def energy_jump(bar_db: np.ndarray, w: int = WINDOW_BARS) -> np.ndarray:
    """Per bar, the next `w` bars' mean level over the `w` before (dB; 0 where either side is missing)."""
    n = len(bar_db)
    out = np.zeros(n)
    for i in range(w, n - w + 1):
        out[i] = float(np.mean(bar_db[i:i + w]) - np.mean(bar_db[i - w:i]))
    return out


def vocal_onset(vocals: np.ndarray) -> np.ndarray:
    """Per bar, 1 where the singer comes back in: silent in the two bars before, singing on this one. The song's
    first entrance is left out: after an instrumental intro it is the first verse, not a chorus."""
    n = len(vocals)
    out = np.zeros(n)
    for i in range(2, n):
        if vocals[i] >= VOCAL_ON_DB and max(vocals[i - 1], vocals[i - 2]) <= VOCAL_OFF_DB:
            out[i] = 1.0
    first = np.flatnonzero(vocals >= VOCAL_ON_DB)
    if len(first) and out[first[0]]:
        out[first[0]] = 0.0
    return out


def bar_scores(chroma: np.ndarray, mfcc: np.ndarray, bar_db: np.ndarray, vocals: np.ndarray | None) -> tuple[np.ndarray, dict]:
    """The combined hook score per bar, and each kind of evidence."""
    n = min(len(chroma), len(mfcc), len(bar_db), len(vocals) if vocals is not None else len(bar_db))
    bar_db = np.asarray(bar_db[:n], dtype=float)
    chorus = sum(chorus_starts(section_kinds(chroma[:n], mfcc[:n], k), bar_db) for k in SECTION_KINDS) / len(SECTION_KINDS)
    jump = _rank(energy_jump(bar_db))
    vocal = vocal_onset(np.asarray(vocals[:n], dtype=float)) if vocals is not None else np.zeros(n)
    score = WEIGHTS["chorus"] * chorus + WEIGHTS["jump"] * jump + WEIGHTS["vocal"] * vocal
    return score, {"chorus": chorus, "jump": jump, "vocal": vocal}


def phrase_phase(score: np.ndarray, top: int = 8) -> int:
    """The 4-bar phase (0–3) the song's strongest bars agree on: its phrase grid."""
    if not len(score):
        return 0
    strong = np.argsort(score)[::-1][:top]
    totals = [float(sum(score[i] for i in strong if i % 4 == p)) for p in range(4)]
    return int(np.argmax(totals))


def refine(score: np.ndarray, bar: int, phase: int) -> int:
    """`bar` moved by at most one onto the phrase grid, when the grid bar scores at least SNAP_SHARE of it."""
    if bar % 4 == phase:
        return bar
    for d in (-1, 1):
        k = bar + d
        if 0 <= k < len(score) and k % 4 == phase and score[k] >= SNAP_SHARE * score[bar]:
            return k
    return bar


def detect(score: np.ndarray, evidence: dict, first: int = 2, tail: int = 4) -> tuple[list[Candidate], int]:
    """The hook candidates from bar_scores, best first: the score's peaks at least MIN_GAP_BARS apart (not in the
    first `first` bars or the last `tail`), each refined onto the phrase grid. Returns them and the grid's phase."""
    phase = phrase_phase(score)
    order = [int(i) for i in np.argsort(score)[::-1] if first <= i < len(score) - tail and score[i] > 0]
    chosen: list[Candidate] = []
    for i in order:
        k = refine(score, i, phase)
        if any(abs(k - c.bar) < MIN_GAP_BARS for c in chosen):
            continue
        ev = {name: round(float(v[k]), 3) for name, v in evidence.items()}
        chosen.append(Candidate(bar=k, score=round(float(score[k]), 3), evidence=ev, snapped=k - i))
        if len(chosen) >= MAX_CANDIDATES:
            break
    return chosen, phase


def suggest_shift(score: np.ndarray, phase: int, bar: int) -> int:
    """For a hand tag landing on `bar`: −1 or +1 when the bar next to it scores clearly better (by SUGGEST_MARGIN)
    and sits on the phrase grid, else 0. The tag itself is kept; the audition page asks."""
    best, gain = 0, 0.0
    for d in (-1, 1):
        k = bar + d
        if not 0 <= k < len(score) or k % 4 != phase:
            continue
        if score[k] - score[bar] > max(SUGGEST_MARGIN, gain):
            best, gain = d, float(score[k] - score[bar])
    return best
