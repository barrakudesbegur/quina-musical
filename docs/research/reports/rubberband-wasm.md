# Rubber Band in WebAssembly: measured (28 Nov 2026)

## The answer

Not too slow. A real Blend render (song 11 "Blue (Da Ba Dee)", hook 11-best-0, 8+1 bars, 128 → 122 BPM, all 5 parts) takes 2.0–2.2 s on 8 workers in Node or Chrome, against 1.33 s native. On one thread: 6.7 s in Node, 7.1 s in a Chrome Worker, against 4.25 s native, so about 1.6× native either way. The render starts a minute or more ahead, so even 7 s fits about 10 times over. The output matches native to float rounding: zero differing samples at 16 bits, every downbeat within 3 ms of the grid. Checked by the session: both listening pairs are byte-identical.

Setup: M1 Pro, macOS 27, Node 26.13, headless Chrome 158, other sessions running (load 2–3). Medians of 3 after a warm-up. The stretch step only: inputs decoded in memory, no FLAC written. Nothing written to the repo; the native baseline called steps/rubberband.py's functions directly, never render().

## The builds

| Build | Rubber Band | R3 / short window | Key-frame map, study, offline | SIMD / threads | Node 1 thread | Node 8 workers | Chrome 1 Worker | Chrome 8 Workers | Licence |
|---|---|---|---|---|---|---|---|---|---|
| native (Homebrew + ctypes) | 4.0.0 | yes / yes | yes | NEON / 8 Python threads | 4.25 s | 1.33 s | n/a | n/a | GPL-2.0+ |
| `@ainsej/rubberband-wasm` 4.0.1 (Daninet fork, 2026-06) | 4.0.0 | yes / yes | yes | no / no | 6.70 s | 2.06 s | 7.08 s | 2.18 s | GPLv2 |
| `@echogarden/rubberband-wasm` 0.2.0 | 4.0.0 | yes / yes | yes | no / no | 6.73 s | 2.04 s | 7.07 s | 2.18 s | GPL-2.0-only |
| `rubberband-wasm` 3.3.0 (Daninet) | 3.3.0 | yes / yes | yes | no / no | 8.01 s | 2.44 s | 8.47 s | 2.75 s | GPLv2 |
| `rubberband-web` 0.2.1 | ? | not exposed | no: realtime AudioWorklet only | – | – | – | – | – | GPL-2.0+ |
| `timestretcher` 3.2.0 | ? | not exposed | no key-frame map | no / no | – | – | – | – | GPL-2.0+ |

Per part, one thread (@ainsej; Node / Chrome / native): mix and drums (sliced, short window) 0.69 / 0.72 / 0.53 s each; bass, vocals, other (one R3 pass + key-frame map) about 1.77 / 1.88 / 1.06 s each. One continuous R3 pass sets the parallel time. Startup: 2–13 ms to compile, 15–31 ms for 8 workers. No cross-origin isolation needed (no shared memory). No build uses WASM SIMD; a -msimd128 build might close some of the gap (not built). layering-prep.md §2.4's 1.6–1.9 s is the whole stretch.py process; the stretch alone is 1.33 s.

## Quality

All parts, all builds, Node and Chrome, one thread and pooled: 814 426 samples each; largest sample difference 1.5–3.0e-8; SNR 161–185 dB; log-mel difference 0.000 dB; zero differing samples at 16 bits. The 3 WASM builds are bit-identical to each other; the tiny gap to native is the FFT (Accelerate vs built-in). For scale, the tonal stems without the key-frame map give SNR −3 to +4 dB.

Timing against the grid (stretch.py's verify() xcorr), identical native and WASM: downbeats median 0–2 ms, max 3 ms; beats p95 1–3 ms (bass 31 ms, max 40 ms: the method failing on held notes with no onset, same in both).

## What a port involves

- steps/rubberband.py: ~200 lines (stretch, _splice_gains, stretch_piecewise, stretch_mapped) move; already ~170 lines of output-identical JS in src/rbcore.mjs (untyped, no tests). The ctypes loader becomes a ~40-line WASM loader plus a ~40-line worker pool. The pylibrb fallback goes.
- stretch.py: ~85 lines of pure maths (section, plan, find_hook, load_analysis), tempo_match.choose_multiple (50), the anchors, time map and the meta fields the engine reads. ~180 more only if the relay keeps a disk cache. read_region becomes a FLAC decoder: Chrome's decodeAudioData handles FLAC; Node has none built in.
- verify (~100 lines) and the CLI stay in Python as offline QA.
- Total about 300–450 lines of TypeScript; the relay's spawn(python stretch.py) (server.ts 285–323) goes.

## Not verified

Phones or other machines; FLAC decode/encode in the port; a SIMD build; other songs, ratios or tempo drift (one song at −4.7%); the Beat This! part of verify(); library versions are from build scripts, not a runtime call.

## Files (in the setup session's scratch folder, not in the repo)

listen/ (two native-vs-WASM pairs, mix part, 16-bit WAV), src/rbcore.mjs (the JS port), src/prep_native.py, src/bench-node.mjs, src/run-chrome.sh with web/, src/compare.py, results/ (raw JSON), out/ (renders, planar float32).
