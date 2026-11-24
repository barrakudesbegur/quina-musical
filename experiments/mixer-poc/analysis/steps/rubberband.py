"""Rubber Band Library (R3 "finer" engine) through its C API, offline, with a key-frame map.

Homebrew's `rubberband` (4.0.0) ships librubberband.dylib; this module loads it with ctypes so
stretching runs in-process with no temp files. pylibrb 0.1.2 bundles the same library, but its
`set_keyframe_map` binding is unusable (the nanobind map caster is missing), and the key-frame map
is what pins every source beat to the target grid, so pylibrb is only used as a constant-ratio
fallback when the dylib is missing.

Rubber Band is GPL-2.0-or-later. It is only used here as offline preparation tooling.
"""
from __future__ import annotations

import ctypes
import ctypes.util
import os
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

import numpy as np

# rubberband-c.h option bits.
OPT_OFFLINE = 0x00000000
OPT_TRANSIENTS_CRISP = 0x00000000
OPT_TRANSIENTS_MIXED = 0x00000100
OPT_DETECTOR_COMPOUND = 0x00000000
OPT_FORMANT_SHIFTED = 0x00000000
OPT_CHANNELS_TOGETHER = 0x10000000
OPT_ENGINE_FASTER = 0x00000000
OPT_ENGINE_FINER = 0x20000000

OPT_WINDOW_SHORT = 0x00100000
# "r3short" is R3 with its short window: tighter transients and timing, less tonal accuracy.
ENGINES = {"r3": OPT_ENGINE_FINER, "r3short": OPT_ENGINE_FINER | OPT_WINDOW_SHORT, "r2": OPT_ENGINE_FASTER}
LIB_CANDIDATES = (
    os.environ.get("RUBBERBAND_LIB", ""),
    "/opt/homebrew/opt/rubberband/lib/librubberband.dylib",
    "/usr/local/opt/rubberband/lib/librubberband.dylib",
)


@lru_cache(maxsize=1)
def _lib() -> ctypes.CDLL | None:
    paths = [p for p in LIB_CANDIDATES if p and os.path.exists(p)]
    found = ctypes.util.find_library("rubberband")
    if found:
        paths.append(found)
    for path in paths:
        try:
            lib = ctypes.CDLL(path)
        except OSError:
            continue
        P, U, I, D = ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_double
        FPP = ctypes.POINTER(ctypes.POINTER(ctypes.c_float))
        UP = ctypes.POINTER(ctypes.c_uint)
        sig = {
            "rubberband_new": (P, [U, U, I, D, D]),
            "rubberband_delete": (None, [P]),
            "rubberband_get_engine_version": (I, [P]),
            "rubberband_set_expected_input_duration": (None, [P, U]),
            "rubberband_set_max_process_size": (None, [P, U]),
            "rubberband_set_key_frame_map": (None, [P, U, UP, UP]),
            "rubberband_study": (None, [P, FPP, U, I]),
            "rubberband_process": (None, [P, FPP, U, I]),
            "rubberband_available": (I, [P]),
            "rubberband_retrieve": (U, [P, FPP, U]),
            "rubberband_set_default_debug_level": (None, [I]),
        }
        for name, (res, args) in sig.items():
            fn = getattr(lib, name)
            fn.restype, fn.argtypes = res, args
        lib.rubberband_set_default_debug_level(0)
        lib._path = path  # type: ignore[attr-defined]
        return lib
    return None


def backend() -> str:
    lib = _lib()
    if lib is not None:
        return f"librubberband 4.0.0 (ctypes, {lib._path})"  # type: ignore[attr-defined]
    try:
        import pylibrb  # noqa: F401

        return "pylibrb 0.1.2 (constant ratio only)"
    except ImportError:
        return "none"


def _workers() -> int:
    """Threads for parallel renders (RUBBERBAND_THREADS, default: performance cores, max 8)."""
    env = os.environ.get("RUBBERBAND_THREADS")
    if env:
        return max(1, int(env))
    return max(1, min(8, (os.cpu_count() or 4) - 2))


def _ptrs(arr: np.ndarray):
    """float** over the rows of a C-contiguous (channels, samples) float32 array."""
    row = ctypes.POINTER(ctypes.c_float)
    return (row * arr.shape[0])(*[arr[c].ctypes.data_as(row) for c in range(arr.shape[0])])


def stretch(
    audio: np.ndarray,
    sample_rate: int,
    out_len: int,
    keyframes: list[tuple[int, int]] | None = None,
    engine: str = "r3",
    channels_together: bool = True,
    block: int = 1 << 16,
) -> np.ndarray:
    """Stretch (channels, samples) float audio to exactly `out_len` samples, pitch preserved.

    `keyframes` are (source sample, output sample) pairs, strictly increasing in both, that the
    output must hit; between them the stretch is linear. The overall time ratio is out_len / in_len.
    """
    x = np.ascontiguousarray(audio, dtype=np.float32)
    channels, n = x.shape
    ratio = out_len / n
    lib = _lib()
    if lib is None:
        return _stretch_pylibrb(x, sample_rate, out_len, engine)
    opts = OPT_OFFLINE | ENGINES[engine] | OPT_TRANSIENTS_CRISP | OPT_DETECTOR_COMPOUND
    if channels_together and channels == 2:
        opts |= OPT_CHANNELS_TOGETHER
    st = lib.rubberband_new(sample_rate, channels, opts, ratio, 1.0)
    try:
        lib.rubberband_set_expected_input_duration(st, n)
        lib.rubberband_set_max_process_size(st, block)
        for i in range(0, n, block):
            chunk = np.ascontiguousarray(x[:, i:i + block])
            lib.rubberband_study(st, _ptrs(chunk), chunk.shape[1], int(i + block >= n))
        if keyframes:
            kf = [(int(a), int(b)) for a, b in keyframes if 0 < a < n and 0 < b < out_len]
            if kf:
                src = (ctypes.c_uint * len(kf))(*[a for a, _ in kf])
                dst = (ctypes.c_uint * len(kf))(*[b for _, b in kf])
                lib.rubberband_set_key_frame_map(st, len(kf), src, dst)
        out = np.zeros((channels, out_len + 4 * block), dtype=np.float32)
        got = 0

        def drain() -> None:
            nonlocal got, out
            while True:
                avail = lib.rubberband_available(st)
                if avail <= 0:
                    return
                if got + avail > out.shape[1]:
                    out = np.concatenate([out, np.zeros((channels, avail + block), np.float32)], axis=1)
                view = np.ascontiguousarray(out[:, got:got + avail])
                k = lib.rubberband_retrieve(st, _ptrs(view), avail)
                out[:, got:got + k] = view[:, :k]
                got += k

        for i in range(0, n, block):
            chunk = np.ascontiguousarray(x[:, i:i + block])
            lib.rubberband_process(st, _ptrs(chunk), chunk.shape[1], int(i + block >= n))
            drain()
        drain()
    finally:
        lib.rubberband_delete(st)
    y = out[:, :got]
    if got < out_len:
        y = np.pad(y, ((0, 0), (0, out_len - got)))
    return y[:, :out_len]


def _splice_gains(a: np.ndarray, b: np.ndarray, length: int) -> tuple[np.ndarray, np.ndarray]:
    """Fade-out / fade-in gains for splicing two renders of the same material.

    The renders' phases differ, so a linear fade dips when they are uncorrelated and an equal-power
    fade bumps when they are correlated. The gain law is normalised by their measured correlation
    rho (clipped to [0, 1]): g_out^2 + g_in^2 + 2 rho g_out g_in = 1 all along the fade.
    """
    num = float(np.sum(a * b))
    den = float(np.sqrt(np.sum(a * a) * np.sum(b * b))) + 1e-12
    rho = min(1.0, max(0.0, num / den))
    t = (np.arange(length) + 0.5) / length
    u, v = np.sin(0.5 * np.pi * t), np.cos(0.5 * np.pi * t)
    norm = np.sqrt(u * u + v * v + 2 * rho * u * v)
    return (v / norm).astype(np.float32), (u / norm).astype(np.float32)


def stretch_piecewise(
    audio: np.ndarray,
    sample_rate: int,
    src_anchors: np.ndarray,
    out_anchors: np.ndarray,
    engine: str = "r3",
    context_sec: float = 0.25,
    xfade_sec: float = 0.010,
    splice_lead_sec: float = 0.015,
    stereo_pairs: bool = True,
) -> tuple[np.ndarray, dict]:
    """Stretch with a constant ratio per piece, pieces spliced just before each interior anchor.

    `audio` is (channels, samples); `src_anchors` are sample positions in it (increasing) and
    `out_anchors` the output positions they must land on (out_anchors[0] = 0). The output covers
    src_anchors[0]..src_anchors[-1]; audio outside that range is only used as context. Every piece
    [a_i, a_i+1] is rendered on its own with `context_sec` of extra source on both sides, so each
    anchor's transient is rendered fresh, and pieces are crossfaded over `xfade_sec` ending
    `splice_lead_sec` before the anchor (the anchors are downbeats: the splice sits in the pre-masking
    shadow of the downbeat's transient).

    Why pieces: R3 keeps a key-frame map only loosely (its ratio is smoothed) and wanders up to
    ~15-18 ms from the ideal timing over a 10 s constant-ratio render; one bar per piece keeps every
    downbeat within a few ms and resets the wander at each bar.

    With `stereo_pairs`, an even channel count is treated as consecutive stereo pairs and each pair
    is stretched with Rubber Band's ChannelsTogether (mid/side) option.
    """
    x = np.ascontiguousarray(audio, dtype=np.float32)
    channels, n = x.shape
    src = np.asarray(src_anchors, dtype=float)
    out = np.asarray(out_anchors, dtype=float)
    out_len = int(round(out[-1]))
    y = np.zeros((channels, out_len), dtype=np.float32)
    ctx = int(round(context_sec * sample_rate))
    xf = max(1, int(round(xfade_sec * sample_rate)))
    lead = int(round(splice_lead_sec * sample_rate))
    groups = (
        [slice(c, c + 2) for c in range(0, channels, 2)]
        if stereo_pairs and channels % 2 == 0
        else [slice(0, channels)]
    )
    pieces = len(src) - 1
    ratios = [(out[i + 1] - out[i]) / (src[i + 1] - src[i]) for i in range(pieces)]  # time ratios
    spans = [(max(0, int(np.floor(src[i])) - ctx), min(n, int(np.ceil(src[i + 1])) + ctx)) for i in range(pieces)]
    # Every (piece, stereo pair) is an independent render: run them on threads (ctypes drops the GIL).
    jobs = {}
    with ThreadPoolExecutor(max_workers=_workers()) as pool:
        for i, (a0, a1) in enumerate(spans):
            seg_len = int(round((a1 - a0) * ratios[i]))
            for gi, g in enumerate(groups):
                jobs[i, gi] = pool.submit(stretch, x[g, a0:a1], sample_rate, seg_len, None, engine)
        renders = [np.concatenate([jobs[i, gi].result() for gi in range(len(groups))], axis=0)
                   for i in range(pieces)]
    prev_tail: np.ndarray | None = None  # previous piece's render over the next crossfade zone
    for i in range(pieces):
        s0, o0, o1 = src[i], out[i], out[i + 1]
        r = ratios[i]
        a0 = spans[i][0]
        rendered = renders[i]
        offset = int(round(o0 - (s0 - a0) * r))  # output position of rendered[:, 0]
        # This piece owns [w0, w1) of the output; crossfade zones are [b - xf, b) at interior anchors.
        w0 = 0 if i == 0 else int(round(o0)) - lead
        w1 = out_len if i == pieces - 1 else int(round(o1)) - lead

        def take(lo: int, hi: int) -> np.ndarray:
            seg = np.zeros((channels, hi - lo), dtype=np.float32)
            r_lo, r_hi = lo - offset, hi - offset
            c_lo, c_hi = max(0, r_lo), min(rendered.shape[1], r_hi)
            if c_hi > c_lo:
                seg[:, c_lo - r_lo:c_hi - r_lo] = rendered[:, c_lo:c_hi]
            return seg

        if i == 0:
            y[:, w0:w1 - (xf if pieces > 1 else 0)] = take(w0, w1 - (xf if pieces > 1 else 0))
        else:
            z0 = w0 - xf
            incoming = take(z0, w0)
            g_out, g_in = _splice_gains(prev_tail, incoming, xf)
            y[:, z0:w0] = prev_tail * g_out + incoming * g_in
            body_end = w1 - (xf if i < pieces - 1 else 0)
            y[:, w0:body_end] = take(w0, body_end)
        if i < pieces - 1:
            prev_tail = take(w1 - xf, w1)
    return y, {"pieces": pieces, "timeRatios": ratios, "xfadeSec": xfade_sec, "spliceLeadSec": splice_lead_sec}


def stretch_mapped(
    audio: np.ndarray,
    sample_rate: int,
    src_anchors: np.ndarray,
    out_anchors: np.ndarray,
    engine: str = "r3",
    stereo_pairs: bool = True,
) -> tuple[np.ndarray, dict]:
    """One continuous pass with the anchors as a key-frame map: no splices, looser timing.

    Same arguments and output span as `stretch_piecewise`. R3 follows the map only loosely (its
    ratio changes are smoothed), so anchors can be off by several ms (p95 ~5-15 ms on music); use it
    for tonal parts, where a splice would be more audible than the timing.
    """
    x = np.ascontiguousarray(audio, dtype=np.float32)
    channels, n = x.shape
    src = np.asarray(src_anchors, dtype=float)
    out = np.asarray(out_anchors, dtype=float)
    out_len = int(round(out[-1]))
    r_first = (out[1] - out[0]) / (src[1] - src[0])
    r_last = (out[-1] - out[-2]) / (src[-1] - src[-2])
    pre = int(round(src[0] * r_first))          # output samples of the leading context
    total = pre + out_len + int(round((n - src[-1]) * r_last))
    keyframes = [(int(round(s)), int(round(pre + o))) for s, o in zip(src, out)]
    groups = (
        [slice(c, c + 2) for c in range(0, channels, 2)]
        if stereo_pairs and channels % 2 == 0
        else [slice(0, channels)]
    )
    with ThreadPoolExecutor(max_workers=_workers()) as pool:
        futures = [pool.submit(stretch, x[g], sample_rate, total, keyframes, engine) for g in groups]
        y = np.concatenate([f.result() for f in futures], axis=0)
    return y[:, pre:pre + out_len], {"pieces": 1, "keyframes": len(keyframes)}


def _stretch_pylibrb(x: np.ndarray, sample_rate: int, out_len: int, engine: str) -> np.ndarray:
    from pylibrb import Option, RubberBandStretcher

    opts = Option.PROCESS_OFFLINE | (Option.ENGINE_FASTER if engine == "r2" else Option.ENGINE_FINER)
    if engine == "r3short":
        opts |= Option.WINDOW_SHORT
    st = RubberBandStretcher(sample_rate, x.shape[0], opts, initial_time_ratio=out_len / x.shape[1])
    st.set_expected_input_duration(x.shape[1])
    st.set_max_process_size(x.shape[1])
    st.study(x, final=True)
    st.process(x, final=True)
    parts = []
    while (avail := st.available()) > 0:
        parts.append(st.retrieve(avail))
    y = np.concatenate(parts, axis=1) if parts else np.zeros((x.shape[0], 0), np.float32)
    if y.shape[1] < out_len:
        y = np.pad(y, ((0, 0), (0, out_len - y.shape[1])))
    return y[:, :out_len]
