# Offline music-analysis and audio-processing toolchain for automatic DJ transitions (Apple Silicon Mac, Nov 2026)

Scope: tools for analyzing each of the ~77 local MP3s ahead of time (tempo, beat grid, downbeats and bars, phrases and sections, chorus/hook/drop, key, loudness, energy, stems), and for rendering transitions offline (time-stretch, pitch-shift, FX). Version, date and license data come from live PyPI JSON, Homebrew API and GitHub API queries made on 2026-11-23, plus the linked docs and papers. Method: nothing was installed. Compatibility conclusions come from package metadata (requires_python, requires_dist, wheel tags) and from docs and issues.

(Saved by the coordinator from the researcher's hand-back, because the researcher's file write was blocked.)

## 1. Beat, downbeat and tempo tracking (beat_this, madmom, BeatNet, essentia, librosa, aubio, Mixxx/QM-DSP)

### Takeaway
Beat This! (CPJKU, ISMIR 2024) is the best default in 2026:
- MIT license for both code and weights.
- pip-installable (`beat-this` 1.1.0, April 2026).
- State of the art on beat and downbeat F1 across pop, rock, jazz and Latin datasets.
- About 4x faster than madmom on CPU.
- Makes no constant-tempo assumption.

madmom's DBN is still useful as an optional post-processor when you want a smooth, periodic grid. It must be installed from git: PyPI 0.16.1 dates from 2018 and breaks on NumPy ≥1.24. Its models are CC BY-NC-SA. Use essentia (RhythmExtractor2013, TempoCNN) and librosa only as cheap tempo cross-checks.

### Cited Findings

**Beat This! (CPJKU/beat_this)**
- It is the official implementation of the ISMIR 2024 paper "Beat This! Accurate Beat Tracking Without DBN Postprocessing" (Foscarin, Schlüter, Widmer). It tracks beats and downbeats. The Python API returns lists of beat and downbeat times, and the CLI writes `.beats` files that Sonic Visualiser can open. — [GitHub README](https://github.com/CPJKU/beat_this)
- Code and weights are MIT. The README notes that some of the training data is copyrighted or under limited CC licenses. The repo was last pushed 2026-05-28. — [GitHub README](https://github.com/CPJKU/beat_this)
- PyPI: `beat-this` 1.1.0, released 2026-04-14, pure-Python wheel. Dependencies: `torch>=2`, torchaudio, einops, rotary-embedding-torch, soxr. — [PyPI](https://pypi.org/project/beat-this/)
- The 1.1.0 changelog adds "Support non-CUDA accelerator chips (thanks to @tillt)", PyPI publishing, a checkpoint-download fix, `infer_beat_numbers()`, and saving raw activations from the CLI. Version 1.0 was released 2024-10-18. — [CHANGELOG.md](https://github.com/CPJKU/beat_this/blob/main/CHANGELOG.md)
- The README itself does not mention MPS. By default it uses the first CUDA GPU and falls back to CPU; `--gpu=-1` forces CPU, and `--float16` may speed up recent GPUs. — [GitHub README](https://github.com/CPJKU/beat_this)
- Models: `final0`–`final2` (the default, about 78 MB each) and `small0`–`small2` (about 8.1 MB each). — [GitHub README](https://github.com/CPJKU/beat_this)
- The main model has about 20M parameters and the small one about 2M. The small model still reaches state-of-the-art F1 on GTZAN. — [paper arXiv 2407.21658](https://arxiv.org/html/2407.21658)
- The optional `--dbn` flag runs madmom's DBN with its default parameters. It requires madmom installed from GitHub, because the PyPI release only supports old Python and numpy versions. — [GitHub README](https://github.com/CPJKU/beat_this)
- GTZAN test set, F1 scores (paper Table 2):

  | System | Beat F1 | Downbeat F1 |
  |---|---|---|
  | Hung et al. | 88.7 | 75.6 |
  | Beat This! main | 89.1 | 78.3 |
  | Beat This! small | 88.8 | 77.2 |
  | Beat This! with DBN | 88.1 | 77.4 |

  The DBN lowers F1 slightly but improves continuity: downbeat CMLt rises from 67.3 to 73.3. — [paper](https://arxiv.org/html/2407.21658)
- 8-fold cross-validation, beat/downbeat F1, on datasets relevant to this playlist:
  - RWC Pop 96.1/93.7
  - Beatles 94.5/88.8
  - Harmonix 95.8/90.7
  - Ballroom 97.5/95.3
  - JAAH (jazz) 95.1/85.0
  - GuitarSet 92.0/88.1
  - Weak spots: SMC 62.7 (beat), RWC Classical 77.1/66.3, ASAP 76.3/61.2

  — [paper](https://arxiv.org/html/2407.21658)
- The paper argues the DBN "is inherently bound to fail" with time-signature changes and with tempos outside its range. It also notes the network sometimes outputs "non-periodic beats" on complex pieces, and that dropping the DBN "hurts the CMLt and AMLt metrics". — [paper](https://arxiv.org/html/2407.21658)
- The README warns results can be "unfairly good" on songs that were in the training data. — [README](https://github.com/CPJKU/beat_this)
- Speed and accuracy from one third-party, non-peer-reviewed test (34 clips, 4-core CPU):
  - Runtime per audio minute: Beat This! `final0` 2.8 s (PyTorch) or about 2 s (ONNX, model only); madmom 10.5 s; librosa 0.6 s.
  - Beat/downbeat F, final0: 0.98/0.93 on drum-only clips and 0.93/0.95 on full mixes.
  - Beat/downbeat F, madmom 0.16.1: 0.96/0.74 and 0.97/0.75, plus 8 bar-offset errors.

  — [drumtx PR #7](https://github.com/tylermac92/drumtx/pull/7)
- A Rust port processes overlapping 30 s (1,500-frame) chunks, and its runtime scales linearly with audio length. — [crates.io beat-this](https://crates.io/crates/beat-this)

**madmom**
- PyPI 0.16.1 (2018-11-14) is source-only, with no arm64 wheel. Its license field reads "BSD, CC BY-NC-SA" and "Free for non-commercial use". — [PyPI](https://pypi.org/project/madmom/)
- Code is BSD. Model and data files are CC BY-NC-SA 4.0; commercial use requires contacting Gerhard Widmer. — [README](https://github.com/CPJKU/madmom)
- The PyPI release fails with `module 'numpy' has no attribute 'float'`. The fix users report is installing from git (0.17.dev). — [Discussion #536](https://github.com/CPJKU/madmom/discussions/536)
- Background: `np.float` was removed in NumPy 1.24, and NumPy 2 also removed `np.float_`. — [pythonspeed](https://pythonspeed.com/articles/numpy-2/)
- Git main: the last commit was on 2024-08-25, "CI and NumPy compatibility updates (#540)". Its `pyproject.toml` build-requires `numpy>2` and `cython>=0.25`. The repo is not archived and was last pushed 2026-03-20. — [commits](https://github.com/CPJKU/madmom/commits/main), [pyproject.toml](https://github.com/CPJKU/madmom/blob/main/pyproject.toml)
- BeatNet's README says madmom 0.16.1 has "compatibility issues with Python >= 3.10 and NumPy >= 1.24". — [BeatNet](https://github.com/mjhydri/BeatNet)
- `madmom-infer` (openmirlab) is an inference-only madmom in pure numpy: "no Cython, no compilation, numpy 2.x ready". Its full pipeline took a median 31–37 s on a 270 s input. — [madmom-infer](https://github.com/openmirlab/madmom-infer)

**BeatNet**
- It combines a CRNN with particle filtering for online and streaming use. Offline mode uses madmom's DBN. It needs librosa and madmom, plus pyaudio for streaming. — [README](https://github.com/mjhydri/BeatNet)
- License CC-BY-4.0. The last PyPI release is 1.1.3 (2023-11-28); the repo was last pushed 2026-04-13. — [PyPI](https://pypi.org/project/BeatNet/)
- The README gives no numeric accuracy figures. — [README](https://github.com/mjhydri/BeatNet), [ISMIR 2021 paper](https://archives.ismir.net/ismir2021/paper/000033.pdf)

**Essentia**
- RhythmExtractor2013:
  - Outputs `bpm`, `ticks`, `confidence`, `estimates` and `bpmIntervals`.
  - The `degara` method always reports confidence 0.
  - Tempo limits: minTempo 40–180 and maxTempo 60–250, defaults 40 and 208.
  - The input must be 44.1 kHz.

  — [docs](https://essentia.upf.edu/reference/std_RhythmExtractor2013.html)
- TempoCNN:
  - Outputs `globalTempo`, `localTempo` (one estimate about every 6 s) and `localTempoProbabilities`, which can serve as confidence.
  - The input must be 11025 Hz.
  - The docs "strongly recommend to use majority voting when assuming constant tempo".
  - Based on Schreiber & Müller (ISMIR 2018).

  — [docs](https://essentia.upf.edu/reference/std_TempoCNN.html)
- Models made by MTG are CC BY-NC-SA 4.0, with a proprietary license on request. — [models](https://essentia.upf.edu/models.html)
- The library itself is AGPL-3.0. — [PyPI](https://pypi.org/project/essentia/)
- Wheels:
  - Latest, 2.1b6.dev1438 (2026-05-19): the only macOS arm64 wheel is cp314 (macOS 15+).
  - 2.1b6.dev1389 (2025-07-24): macOS arm64 wheels for cp39–cp313 (macOS 15+).
  - The same applies to `essentia-tensorflow`.

  — [PyPI files](https://pypi.org/project/essentia/#files)

**librosa**
- 1.0.1 was released 2026-11-12. It requires Python ≥3.12 and NumPy ≥2.1. License ISC. — [PyPI](https://pypi.org/project/librosa/)
- In 1.0, the only beat-related changes are type-annotation fixes. The audioread backend was removed. — [changelog](https://librosa.org/doc/main/changelog.html), [downstream notes](https://github.com/perminder-klair/subwave/issues/2198)
- There is an official tutorial on beat tracking with time-varying tempo. — [tutorial](https://librosa.org/doc/main/auto_tutorials/03-advanced/plot_dynamic_beat.html)

**aubio**
- The last PyPI release is 0.4.9 (2019-02-08), GPLv3+. Homebrew has 0.4.9 with arm64 bottles. The repo was last pushed 2026-04-10. — [PyPI](https://pypi.org/project/aubio/), [Homebrew](https://formulae.brew.sh/formula/aubio)

**Mixxx / QM-DSP**
- Mixxx ships two beat analyzers. Queen Mary (the default) produces individual beats, i.e. a variable-tempo beat map. SoundTouch produces only an average BPM, i.e. a constant grid. — [Mixxx wiki](https://github.com/mixxxdj/mixxx/wiki/Developer-Guide-Analysers)
- The QM algorithm runs complex spectral-difference onsets, then a comb filterbank, then a Viterbi tempo contour, then dynamic-programming beat tracking (TempoTrackV2). — [extraction](https://github.com/gigawhitlocks/queen-mary-beat-detector)
- The "Assume constant tempo" option can be turned off for variable-tempo tracks. — [manual 2.3](https://github.com/mixxxdj/manual/blob/2.3/source/chapters/preferences/beat_detection.rst)
- Version 2.5 adds "Fast Analysis", which only analyzes the first minute. — [manual 2.5](https://manual.mixxx.org/2.5/fr/chapters/preferences/beat_detection.html)
- An unmerged PR notes that the raw beat map "has a lot of noise". — [PR #2877](https://github.com/mixxxdj/mixxx/pull/2877)
- Mixxx 2.5.6 is available as a Homebrew cask. — [cask](https://formulae.brew.sh/cask/mixxx)

### Inferences
- Use Beat This! without DBN as the primary source and store its output as a beat map (a list of times).
- Also store the DBN grid. Disagreement between the two grids flags songs with variable tempo or meter.
- Derive BPM from the median inter-beat interval. Cross-check it against essentia RhythmExtractor2013 and TempoCNN, and against GetSongBPM. Flag differences above 2% that are not half- or double-time.
- Roughly 15 minutes of CPU time for all 77 songs (about 4 minutes each, at 2.8 s per audio minute).
- aubio and QM-DSP add nothing as pipeline components.

### Gaps
- No head-to-head benchmark across all these trackers was found, and no recent MIREX results for these specific tools.
- No Apple Silicon or MPS timing for Beat This! was found. The changelog says "non-CUDA" support but does not name MPS.
- No accuracy numbers on pop music were found for librosa, essentia multifeature or aubio.
- It is unverified whether madmom git builds on Python 3.12/3.13 arm64.

## 2. Structure, segmentation and chorus/hook detection

### Takeaway
All-In-One gives the most practical functional labels, but the original package is stale (last push May 2024) and NATTEN is broken on Mac. Use the `all-in-one-infer` fork instead: it runs neighborhood attention in pure PyTorch, but on Mac it is CPU-only because MPS is rejected. SongFormer (Sept 2025) reports better section accuracy but is aimed at CUDA GPUs. No single tool reliably finds the recognizable part of a song. Combine the model labels with repetition, energy and vocal presence, and let the existing hand-tagged hooks override and serve as ground truth.

### Cited Findings

**allin1 (original)**
- Outputs `bpm`, `beats`, `downbeats`, `beat_positions` and `segments`. Labels: start, end, intro, outro, break, bridge, inst, solo, verse, chorus. License MIT. — [README](https://github.com/mir-aidj/all-in-one)
- Install steps: PyTorch, then NATTEN (installed automatically on macOS), then madmom from git, then `pip install allin1`. The device defaults to CUDA, else CPU. Speed: 10 songs (33 minutes of audio) in 73 s on an RTX 4090. — [README](https://github.com/mir-aidj/all-in-one)
- PyPI 1.1.0 (2023-10-10) requires `natten` on Darwin. The repo was last pushed 2024-05-09. — [PyPI](https://pypi.org/project/allin1/)
- Relevant open issues ([issues](https://github.com/mir-aidj/all-in-one/issues)):
  - #11: NATTEN fails to install on macOS.
  - #17: asks for MPS alternatives to NATTEN.
  - #28: on macOS, install fails with "No module named 'torch'".
  - #30: incompatible with NATTEN 0.17.5.
  - #16 and #23: `natten1dqkrpb() takes 4 positional arguments`.
  - #39 (2026-09-20, still open): run neighborhood attention in plain PyTorch on CPU and MPS.
- NATTEN 0.21.7 (2026-07-26) is source-only. — [PyPI natten](https://pypi.org/project/natten/)
- Non-NVIDIA users "can only use" NATTEN's Flex Attention backend. Since 0.21.5 NATTEN needs PyTorch ≥2.8. CPU wheels are only listed for 0.17.5. — [natten.org](https://natten.org/install/)
- Paper results on Harmonix:

  | Metric | All-In-One | SpecTNT (prior SOTA) |
  |---|---|---|
  | Beat F1 | .958 | — |
  | Downbeat F1 | .915 | — |
  | Boundary HR.5F | .660 | .558 |
  | Label PWF | .738 | .712 |
  | Label Sf | .769 | .724 |

  The model uses Demucs-separated stems as input. — [arXiv 2307.16425](https://arxiv.org/html/2307.16425v1)

**all-in-one-infer (openmirlab fork)**
- Replaces NATTEN with a pure-PyTorch implementation that "reproduces NATTEN 0.17.5's output". "Results, model names, and the JSON format match upstream." — [README](https://github.com/openmirlab/all-in-one-infer)
- Supports macOS, but `'mps'` is rejected, so only CUDA or CPU. It still needs madmom-infer.
- The structure model's forward pass takes under 0.5 s per song on an RTX 4090; most of the time goes to source separation.
- Code is MIT, but the checkpoint weights are CC-BY-NC-SA-4.0.
- Different MP3 decoders "can shift audio by 20–40 ms". — [README](https://github.com/openmirlab/all-in-one-infer)
- PyPI 3.1.0 (2026-07-12) depends on `madmom-infer` and `demucs-infer>=4.2.2`. Its optional `natten` extra pins natten <0.20 and torch <2.8. The README says new versions are installed from GitHub only. The repo was last pushed 2026-11-14. — [PyPI](https://pypi.org/project/all-in-one-infer/)

**SongFormer**
- Labels: intro, verse, pre-chorus, chorus, bridge, inst, silence, outro. Pre-chorus is mapped to verse by default. — [arXiv 2510.02797](https://arxiv.org/abs/2510.02797)
- Section accuracy, as reported by the authors (ACC / HR.5F / HR3F):

  | Dataset | All-In-One | SongFormer |
  |---|---|---|
  | HarmonixSet | .740 / .596 / .730 | .795 / .703 / .784 |
  | SongFormBench-CN | .834 / .563 / .771 | .890 / .690 / .852 |

  — [GitHub](https://github.com/ASLP-lab/SongFormer)
- Speed: 2–4 s per song on an L40 GPU, against 9–12 s for All-In-One.
- Tested on Ubuntu with Python 3.10. Uses the MuQ and MusicFM front-ends. Code is CC-BY-4.0. MPS and CPU support are not mentioned. — [GitHub](https://github.com/ASLP-lab/SongFormer)

**Others**
- MSAF: MIT license. PyPI 0.1.84 (2026-11-22). — [GitHub](https://github.com/urinieto/msaf), [PyPI](https://pypi.org/project/msaf/)
- pychorus:
  - Based on Goto's method (chroma plus time-lag similarity).
  - Doesn't detect choruses in music recorded without a metronome.
  - Returns only one chorus, and only a `clip_length` slice.
  - MIT license. PyPI 0.1 dates from 2018; the repo was last pushed 2023-12.

  — [GitHub](https://github.com/vivjay30/pychorus)
- Pop Music Highlighter (TISMIR 2018) uses an emotion-attention model and is evaluated by chorus detection on RWC-Pop. — [TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.14)
- Its repo is GPL-3.0 and was last pushed in 2018. — [GitHub](https://github.com/remyhuang/pop-music-highlighter)
- A supervised CNN chorus detector ("chorusness" curve) has been published, but its code was not verified. — [ResearchGate](https://www.researchgate.net/publication/350456920_Supervised_Chorus_Detection_for_Popular_Music_Using_Convolutional_Neural_Network_and_Multi-task_Learning)

### Inferences
- Hook score per candidate window:
  - (a) the model's chorus label,
  - (b) how often the section repeats (self-similarity),
  - (c) bar energy z-score,
  - (d) vocal-stem presence,
  - (e) manual best/main/secondary tags, which override everything else.

  Measure how often the top automatic candidate falls within ±1 bar of the hand-tagged hooks before trusting it.
- Expect all-in-one-infer to take minutes per song on CPU, mostly in Demucs. That is fine for an overnight batch.
- SongFormer is an option as a one-off run on a CUDA machine if the allin1 labels are poor.
- Decode each MP3 once and analyze the same WAV that playback uses. A 20–40 ms offset is 1/12 to 1/6 of a beat at 120 BPM.
- Derive phrases yourself: snap section boundaries to downbeats, then group bars into 4, 8 or 16-bar phrases.

### Gaps
- No chorus-detection evaluation on Spanish/Catalan pop, reggaeton or Christmas songs was found.
- SongFormer on Mac is unverified, and its weights license is not stated.
- No pychorus or MSAF accuracy figures for functional labels were found.
- No detector for "drops" in non-EDM music was found.

## 3. Key detection

### Takeaway
Run keyfinder-cli (libKeyFinder, GPL-3, outputs Camelot) and essentia KeyExtractor (AGPL, `edma` and `bgate` profiles). Optionally add madmom's CNN. Flag songs where they disagree. Reliable accuracy numbers on full pop tracks are scarce and come mostly from vendor blogs. Expect roughly 65–80% exact agreement.

### Cited Findings
- Essentia KeyExtractor ([docs](https://essentia.upf.edu/reference/std_KeyExtractor.html)):
  - `profileType` options: diatonic, krumhansl, temperley, weichai, tonictriad, temperley2005, thpcp, shaath, gomez, noland, faraldo, pentatonic, edmm, edma, bgate, braw. The default is `bgate`.
  - Outputs key, scale and strength.
  - Defaults: 4096 frame and hop size, 25–3500 Hz, 440 Hz tuning.
- keyfinder-cli ([GitHub](https://github.com/evanpurkhiser/keyfinder-cli)):
  - Wraps libKeyFinder.
  - `-n` selects standard, openkey (1m = C major) or camelot (8B = C major).
  - Needs ffmpeg and libkeyfinder. GPL-3.0.
  - The repo was last pushed 2026-11-10; libkeyfinder was last pushed 2024-11-25.
- Homebrew has libkeyfinder 2.2.8 (GPL-3, arm64 bottles) but no keyfinder-cli formula, so keyfinder-cli has to be built with CMake. — [Homebrew](https://formulae.brew.sh/formula/libkeyfinder)
- madmom `CNNKeyRecognitionProcessor` implements Korzeniowski & Widmer (ISMIR 2018): an ensemble predicting 24 classes, with a `KeyRecognition` CLI. — [docs](https://madmom.readthedocs.io/en/v0.16/modules/features/key.html), [paper](https://archives.ismir.net/ismir2018/paper/000007.pdf)
- Their EUSIPCO 2017 predecessor scored 74.3 against 70.1 for the reference systems when trained on the matching genre, and dropped cross-genre. This figure comes from a search snippet. — [EUSIPCO 2017](https://new.eurasip.org/Proceedings/Eusipco/Eusipco2017/papers/1570347645.pdf)
- DJ-tool comparisons (non-peer-reviewed):
  - 2015 test: Mixed In Key 7 86% (57/66), rekordbox 70%, KeyFinder 65%. In Mixxx, KeyFinder "performs considerably better" than Queen Mary but is slower. — [Immerground](https://immerground.com/blog/mixed-in-key-alternatives)
  - "2026" test of 200 tracks: Mixed In Key 89%, KeyFinder 76%, Rekordbox 69%, Beatport 60%. Possibly vendor-affiliated. — [Dubspot](https://blog.dubspot.com/dubspot-lab-report-mixed-in-key-vs-beatport)
  - Common failure modes: KeyFinder confuses relative major and minor; Rekordbox struggles with vocal-heavy tracks. — [Setflow](https://www.setflow.app/blog/wrong-key-detection-dj-library)
  - 2025 r/DJs comparison (reported by a vendor): Rekordbox 72.2, Mixed In Key 85.2, Serato 64.2. — [OpenKeyScan](https://www.openkeyscan.com/)
- Camelot wheel ([Mixed In Key](https://mixedinkey.com/camelot-wheel/)):
  - Minor keys: 1A A♭m, 2A E♭m, 3A B♭m, 4A Fm, 5A Cm, 6A Gm, 7A Dm, 8A Am, 9A Em, 10A Bm, 11A F♯m, 12A D♭m.
  - Major keys: 1B B, 2B F♯, 3B D♭, 4B A♭, 5B E♭, 6B B♭, 7B F, 8B C, 9B G, 10B D, 11B A, 12B E.
  - Compatible moves: the same code; the same number with the other letter; ±1 number (wrapping 12↔1).
  - "Energy Boost" is +2 with the same letter.
  - The numbers are positions on the wheel, not semitones.

### Inferences
- Store tonic, mode, Camelot and Open Key, plus each tool's raw estimate and an agreement flag (exact, or relative major/minor).
- Also compute the key of the hook window, because key changes in the last chorus can mislead global-key tools.
- A key clash matters only during the overlap. Stem tricks and risers can mask it.

### Gaps
- No peer-reviewed accuracy numbers were found for essentia `edma`/`bgate` or libKeyFinder on full-length pop. The only essentia benchmark found used loops, and its numbers were not retrieved. — [arXiv 2008.11507](https://arxiv.org/pdf/2008.11507)
- MIREX key detection results for these specific tools were not retrieved.

## 4. Loudness and energy

### Takeaway
Measure integrated LUFS (pyloudnorm) and true peak (ffmpeg loudnorm pass 1 or libebur128), then apply a static gain to a common target. Avoid one-pass dynamic loudnorm. For energy, compute beat- or bar-synchronous RMS and onset strength (librosa), per stem where possible. Build-up and drop detection will have to be heuristic.

### Cited Findings
- pyloudnorm ([README](https://github.com/csteinmetz1/pyloudnorm), [PyPI](https://pypi.org/project/pyloudnorm/)):
  - Implements ITU-R BS.1770-4.
  - API: `Meter`, `integrated_loudness`, `normalize.loudness`, `normalize.peak`, `loudness_range` (EBU Tech 3342).
  - True peak is not mentioned.
  - License MIT. Version 0.2.0 released 2026-01-04.
- ffmpeg loudnorm, two-pass mode ([DEV analysis](https://dev.to/lpgit/why-is-my-tiny-desk-ai-clip-quieter-than-other-videos-two-pass-ffmpeg-loudnorm-to-14-lufs-and-3ne9), [ffmpeg-cookbook](https://ffmpeg-cookbook.com/en/articles/loudness-normalization/), [tnonline](https://wiki.tnonline.net/w/Blog/Audio_normalization_with_FFmpeg)):
  - Pass 1 (`print_format=json`) measures input_i, input_tp, input_lra, input_thresh and target_offset.
  - Pass 2 feeds these back as measured_* and offset, with `linear=true`, to apply a single constant gain.
  - Linear mode silently falls back to dynamic if any measured value is missing, if the target LRA is lower than the source's, or if the gain would push true peak above the target.
  - The pass-1 `normalization_type` field shows which mode will be used.
  - loudnorm upsamples internally, so set `-ar` explicitly.
- Homebrew, all with arm64 bottles: ffmpeg 9.0.2 (GPL-3 build), libebur128 1.2.6 (MIT), rsgain 3.8 (ReplayGain 2.0 tagger, BSD-2). — [ffmpeg](https://formulae.brew.sh/formula/ffmpeg), [libebur128](https://formulae.brew.sh/formula/libebur128), [rsgain](https://formulae.brew.sh/formula/rsgain)
- librosa 1.0 fixed a buffer check in `feature.rms`. — [changelog](https://librosa.org/doc/main/changelog.html)
- DJ guidance: match phrases intro to intro, breakdown to breakdown, drop to drop. — [djay guide](https://stemsplitterpro.com/blog/djay-pro-stems/)

### Inferences
- Decode each MP3 to a 44.1 kHz float WAV.
- Measure LUFS, LRA and true peak, then store `gain_to_target_db` (around −14 LUFS is a choice, not a sourced standard).
- Compute RMS and onset strength per beat and per bar, for the mix and for each stem.
- Event heuristics:
  - Build-up: a rising bar-RMS slope over 4–8 bars plus rising onset density.
  - Drop or chorus entry: a large energy jump on a downbeat that coincides with a section boundary.
  - Breakdown: low drum-stem energy.
- ReplayGain tags only help if the player reads them. A gain field in the JSON is simpler.

### Gaps
- No benchmark of drop or build-up detection on pop was found.
- pyloudnorm vs. ffmpeg/libebur128 agreement on these files was not tested.

## 5. Stem separation and DJ stem tricks

### Takeaway
facebookresearch/demucs is archived. The maintained line is Défossez's fork, which released Demucs 4.1.0 on 2026-07-11 (MIT code, weights on Hugging Face). For the best vocals, use audio-separator (MIT, 0.48.0, Oct 2026, MPS and CoreML) with BS-RoFormer or Mel-RoFormer: vocals SDR about 12.6–12.9, against about 10.8 for htdemucs_ft. Use htdemucs for the 4-stem split. Expect seconds to tens of seconds per song on MPS or MLX ports, and minutes on CPU. Spleeter is obsolete (Python <3.12 only).

### Cited Findings

**Demucs**
- facebookresearch/demucs is archived (last push 2024-04-24). adefossez/demucs is active (last push 2026-10-26). Both are MIT. — [facebookresearch](https://github.com/facebookresearch/demucs), [adefossez](https://github.com/adefossez/demucs)
- The fork's README calls it "the officially maintained Demucs now that I (Alexandre Défossez) have left Meta to join Kyutai", but adds "I'm not actively working on Demucs anymore". It announces "11/07/2026: Released Demucs v4.1.0 with modernized packaging, lighter inference dependencies, numerous fixes, and pretrained models hosted on Hugging Face". — [README](https://github.com/adefossez/demucs)
- PyPI 4.1.0 (2026-07-11): Python ≥3.10, torch ≥2.1 on arm64, plus safetensors, huggingface-hub and sphn. — [PyPI](https://pypi.org/project/demucs/)
- Model and usage notes ([README](https://github.com/adefossez/demucs)):
  - `htdemucs` is the default, at 9.00 dB SDR on MUSDB HQ.
  - `htdemucs_ft` takes about 4x longer.
  - In `htdemucs_6s`, the piano stem is weak.
  - `--two-stems` is no faster than a full split.
  - Transformer models are limited to 7.8 s segments.
  - On CPU, processing takes about 1.5x the track duration.
  - The weights' license is "not clear".

**Demucs on Apple Silicon**
- MPS has dtype problems; `PYTORCH_ENABLE_MPS_FALLBACK=1` is the usual workaround. — [issue #432](https://github.com/facebookresearch/demucs/issues/432)
- M1 Max, PyTorch MPS: about 10 s for a 133 s track. — [audio.cpp #785](https://github.com/0xShug0/audio.cpp/issues/785)
- demucs-mlx's own benchmark: CPU 52.3 s, MPS 6.9 s, MLX 2.7 s. — [demucs-mlx](https://pypi.org/project/demucs-mlx/1.4.11/)
- M4 MPS: 1.48 s per 7 s chunk, about 50 s per 4-minute song. — [stemsplitter](https://stemsplitter.github.io/research/spleeter-vs-htdemucs/)
- M4 Max MLX port: a 7-minute track in about 12 s, against 2 min 15 s on CPU. — [Medium](https://medium.com/@andradeolivier/i-ported-demucs-to-apple-silicon-it-separates-a-7-minute-song-in-12-seconds-6c4e5cffb5c3)
- stemdrop reports htdemucs crashing on MPS. With MLX, a 3-minute song takes about 5 s (htdemucs) or 15 s (htdemucs_ft). — [stemdrop](https://github.com/carlitoswillis/stemdrop)

**audio-separator**
- Architectures: MDX, VR, Demucs and MDXC/RoFormer. — [README](https://github.com/nomadkaraoke/python-audio-separator)
- SDR of the top models:
  - BS-Roformer-1297: vocals 12.9, instrumental 17.0
  - Mel-Band Roformer Kim: vocals 12.6
  - htdemucs_ft: vocals 10.8, drums 10.1, bass 11.9
- On Apple Silicon, PyTorch models use MPS and ONNX models use CoreML. Requires torch ≥2.13 and macOS 14+. Install with `pip install "audio-separator[cpu]"`.
- MIT license (credit UVR).
- RoFormer models with higher overlap now run 4–6x more passes per track than in 0.46.x.
- PyPI 0.48.0 (2026-10-29), Python ≥3.10, numpy ≥2. — [PyPI](https://pypi.org/project/audio-separator/)

**RoFormer and Spleeter background**
- BS-RoFormer reaches 9.80 dB average SDR on MUSDB18HQ without extra data, and took first place in SDX23 (trained with extra data). — [arXiv 2309.02612](https://arxiv.org/abs/2309.02612)
- The community training repo (ZFTurbo/Music-Source-Separation-Training) is MIT and active. — [ZFTurbo](https://github.com/ZFTurbo/Music-Source-Separation-Training)
- Spleeter 2.4.2 (2025-04) requires Python <3.12. — [PyPI](https://pypi.org/project/spleeter/)

**Stem-based DJ techniques**
- djay Neural Mix techniques ([guide](https://stemsplitterpro.com/blog/djay-pro-stems/)):
  - Solo or mute stems to make acapellas and instrumentals.
  - Stem EQ: Low = drums, Mid = harmonics, High = vocals.
  - Stem crossfaders to swap individual stems between decks.
  - Mute FX with a 1, 3/4 or 1/2-beat echo tail.
  - Effects on a single stem.
  - Phrase matching.
- Serato Stems is used "for live acapellas, drum swaps and quick mashups". Soloed stems "often sound rough… but workable inside a mix" (vendor blog). — [DJ.Studio](https://dj.studio/blog/stem-separation-djs-methods-metrics)

### Inferences
- Run Demucs 4.1.0 `htdemucs` on every song. Try MPS first, then the fallback flag, then demucs-mlx. Feed the same stems to all-in-one-infer where possible.
- Add a RoFormer vocals pass for songs where an acapella will be exposed.
- Stem tricks that fit the spin window:
  - Loop the outgoing drums under the spin and tease the incoming acapella over them.
  - Swap the bass on a phrase downbeat.
  - Throw a vocal echo-out as the drum lands.
  - Build an intro for the incoming song from its drum stem alone.
  - Sweep filters on the "other" stem only.
- Keep soloed stems short (1–4 bars) or hidden under effects.

### Gaps
- No controlled MPS benchmark for Demucs 4.1.0 was found. Reports conflict.
- MVSep and the UVR GUI were not researched in depth.
- Licenses of individual RoFormer weights were not checked.

## 6. Offline time-stretch and pitch-shift

### Takeaway
Use Rubber Band 4.0 with the R3 ("finer") engine as the quality default (Homebrew arm64 bottle, GPL-2+ or commercial license). Signalsmith Stretch (MIT) is the best permissive alternative. Keep vocal tempo changes within about ±6–8%. Beyond about 10%, artifacts are obvious. For large tempo gaps, use half- or double-time matching, stretch only the drums, or hide a cut under the riser.

### Cited Findings
- Rubber Band 4.0 was released 25 Oct 2024 with a new pitch-shift API. It is GPL, with a commercial license available, and has a free macOS CLI. — [breakfastquay](https://breakfastquay.com/rubberband/)
- Homebrew has 4.0.0 (GPL-2.0+) with arm64 bottles. — [Homebrew](https://formulae.brew.sh/formula/rubberband)
- Version 3.0.0 (7 July 2022) added the R3/Finer engine: "substantially higher-quality output", at higher CPU cost. R2 remains the library default. — [news](https://breakfastquay.com/news/20220707.html)
- R3 is better "especially [for] complex mixes, vocals… and music with substantial bass content". — [class ref](https://breakfastquay.com/rubberband/code-doc/classRubberBand_1_1RubberBandStretcher.html)
- On the CLI, `-3`/`--fine` selects R3. Invoked as `rubberband-r3`, R3 is the default. — [usage](https://breakfastquay.com/rubberband/usage.txt), [manpage](https://manpages.debian.org/testing/rubberband-cli/rubberband-r3.1.en.html)
- R2 is about 3x faster than R3. Version 3.1 added a short-window R3 "draft" mode that is about as fast as R2. — [blog](https://thebreakfastpost.com/2022/09/30/performance-improvements-in-rubber-band-library/)
- Use offline mode (`OptionProcessOffline`) and `OptionEngineFiner`. Add `OptionFormantPreserved` when pitch-shifting vocals. — [integration guide](https://breakfastquay.com/rubberband/integration.html)
- Unknown options are silently ignored, so linking an old library falls back to R2 without warning. — [class ref](https://breakfastquay.com/rubberband/code-doc/classRubberBand_1_1RubberBandStretcher.html)
- pyrubberband 0.4.0 (2024, ISC) works "via the command-line through files on disk". It provides `time_stretch`, `pitch_shift` and `timemap_stretch`, and `rbargs` passes extra CLI flags. — [GitHub](https://github.com/bmcfee/pyrubberband), [docs](https://pyrubberband.readthedocs.io/en/stable/)
- pylibrb 0.1.2 (GPLv2) has arm64 wheels. — [PyPI](https://pypi.org/project/pylibrb/)
- Signalsmith Stretch is MIT. Its README says time-stretching "sounds best for more modest changes (between 0.75x and 1.5x)". — [GitHub](https://github.com/Signalsmith-Audio/signalsmith-stretch)
- Its Python binding, python-stretch 0.3.1 (2025, MIT), has arm64 wheels. — [PyPI](https://pypi.org/project/python-stretch/)
- An osu! discussion judged Signalsmith "almost as good" as Staffpad. — [osu #38225](https://github.com/ppy/osu/discussions/38225)
- Bungee: MPL-2.0, a phase vocoder that supports continuously varying tempo and pitch. There is a commercial Pro version. Builds with CMake and includes a CLI. — [GitHub](https://github.com/bungee-audio-stretch/bungee)
- Bungee's vendor comparison page gives objective tables only, no listener scores. — [compare](https://bungee.parabolaresearch.com/compare-audio-stretch-tempo-pitch-change)
- SoundTouch: Homebrew sound-touch 2.4.1, LGPL-2.1. — [Homebrew](https://formulae.brew.sh/formula/sound-touch)
- audiotsm 0.1.2 dates from 2017 (MIT). — [PyPI](https://pypi.org/project/audiotsm/)
- librosa `time_stretch` does fixed-rate stretching (see also its phase vocoder) and points to pyrubberband for "high-quality time stretching". — [docs](https://librosa.org/doc/0.11.0/generated/librosa.effects.time_stretch.html)
- Stretch-ratio rules of thumb (DJ blogs, not controlled tests):
  - Inaudible under 4–6%; "degrades noticeably beyond roughly 6 to 8 percent". — [Serato keylock guide](https://vibesdj.io/how-to/use-keylock-in-serato)
  - Audible past about 8%. — [OpenKeyScan](https://www.openkeyscan.com/key-and-bpm-guide)
  - Beyond ±8–10%, artifacts appear "on exposed vocals and cymbals". — [Sirenmix](https://sirenmix.com/blog/bpm-guide)
  - Noticeable beyond about ±5%, especially on transients. +6% without keylock is about one semitone. — [Mixgraph](https://www.mixgraph.io/tools/pitch-tempo)
- One project excluded Rubber Band because it is "GPLv2+ or paid". — [xjmusic #567](https://github.com/xjmusic/xjmusic/issues/567)

### Inferences
- When rendering offline, use R3 regardless of CPU cost.
- For tempo ramps during the spin, use `timemap_stretch` or Bungee.
- The playlist spans roughly 70–180 BPM. Preferred strategies, in order:
  1. Half- or double-time equivalence.
  2. Stretch only the drum loop.
  3. Cut on a downbeat under the riser peak and the roulette stop.
  4. Cap vocal stretch at about 6–8%.
- **Licensing:** the GPL and AGPL tools are fine for a private tool that isn't distributed. The CC BY-NC-SA weights (madmom, allin1, essentia models) are a separate non-commercial restriction. Whether a ticketed bingo event counts as "commercial" is a question for the user.

### Gaps
- No controlled listening study comparing R3, Signalsmith and Bungee on pop vocals was found.
- R3 throughput on Apple Silicon was not measured.

## 7. Offline FX rendering

### Takeaway
pedalboard (GPL-3, 0.9.26, Oct 2026, Apple Silicon wheels) covers what a transition needs:
- Filters: highpass, lowpass, ladder.
- Time effects: reverb, delay, convolution.
- Dynamics and gain: compressor, limiter, gain.
- Rubber Band pitch shifting and time-stretching.
- VST3 and AU plugin hosting.
- Fast file I/O.

A 10–20 s transition should render in well under a few seconds, but I found no benchmark of exactly this.

### Cited Findings
- pedalboard is GPLv3, bundling JUCE (GPLv3 or commercial) and Rubber Band (GPLv2+ or commercial). — [README](https://github.com/spotify/pedalboard)
- Effects: Chorus, Distortion, Phaser, Clipping, Compressor, Gain, Limiter, Highpass/Lowpass/Ladder filters, Convolution, Delay, Reverb, PitchShift, MP3Compressor, Resample, Bitcrush. Its `PitchShift` and `time_stretch` use Rubber Band.
- Hosts VST3 plugins on macOS, Windows and Linux, and Audio Units on macOS.
- "Up to 300x faster than pySoX" for single transforms; file reading up to 4x faster than `librosa.load`.
- Reads and writes AIFF, FLAC, MP3, OGG and WAV with no extra dependencies, with streaming O(1)-memory resampling.
- PyPI 0.9.26 (2026-10-07), Python ≥3.10, arm64 and universal2 wheels. — [PyPI](https://pypi.org/project/pedalboard/)
- Homebrew: sox 14.4.2 (GPL/LGPL) and ffmpeg 9.0.2 (GPL-3 build), both with arm64 bottles. — [sox](https://formulae.brew.sh/formula/sox), [ffmpeg](https://formulae.brew.sh/formula/ffmpeg)

### Inferences
- Render chain, entirely in numpy: slice the stems on bar boundaries, stretch with R3, then apply filter sweeps, delay throws, reverb tails and gain envelopes, add the riser and impact SFX, run a limiter, and write a WAV.
- Automate filter sweeps by processing short chunks with `reset=False`. This pattern is unverified.
- Pre-render all 76 transitions, since the queue is known in advance. This should take minutes in total, and the native player then only has to play files sample-accurately.
- sox is fine for CLI experiments. ffmpeg stays the tool for decoding, encoding and loudness measurement.

### Gaps
- No pedalboard render-time benchmark on Apple Silicon was found. "Under a few seconds" is an inference.
- Whether per-chunk parameter changes cause zipper noise was not verified.

## 8. Spotify deprecation and other metadata sources

### Takeaway
Spotify's Audio Features and Audio Analysis endpoints have been unavailable to new apps since 27 Nov 2024. AcousticBrainz is frozen at June 2022 (CC0 dumps remain). GetSongBPM has a free keyed API that requires a backlink, limited to 3,000 requests per hour. Use these only as sanity checks.

### Cited Findings
- From 27 Nov 2024, new apps lose access to Related Artists, Recommendations, Audio Features, Audio Analysis, featured and category playlists, 30-second previews in multi-get responses, and algorithmic and editorial playlists. Apps with existing extended access are unaffected. — [Spotify blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api), [Music Ally](https://musically.com/2024/11/28/spotify-removes-features-from-web-api-citing-security-issues/)
- AcousticBrainz was shut down over "low data quality" (announced Feb 2022), and submissions stopped in June 2022. Dumps of about 30M items are CC0. — [MetaBrainz](https://community.metabrainz.org/t/acousticbrainz-submissions-data-dumps-and-next-steps/589843), [HN](https://news.ycombinator.com/item?id=34439239)
- Sources conflict on whether the AcousticBrainz API still works: one says it is offline, another reports HTTP 200 on 2026-07-12. — [freqblog](https://freqblog.com/blog/acousticbrainz-alternative/), [DEV.to](https://dev.to/birrings/acousticbrainz-alternative-in-2026-the-honest-insiders-guide-28kn)
- GetSongBPM API: free, but a backlink is required or the account is suspended. Base URL `api.getsong.co`, an API key is required, limit 3,000 requests per hour. — [GetSongBPM](https://getsongbpm.com/api)
- pyacoustid 1.3.1 (2026-04, MIT) can look up a MusicBrainz ID from an audio fingerprint, which is the key for AcousticBrainz. — [PyPI](https://pypi.org/project/pyacoustid/)

### Inferences
- A one-off cross-check script is enough. Store the results under `external_refs`, never as primary values.
- Songs released after 2022 won't be in AcousticBrainz.

### Gaps
- Tunebat and MusicBrainz were not researched in detail.
- Spotify's Feb 2026 API changes were not verified.

## 9. Proposed JSON schema and recommended toolchain

### Takeaway
Use one Python 3.12 or 3.13 venv (uv) on macOS 15+ arm64 with these components:
- **Beats:** beat-this 1.1.0, plus an optional DBN grid from madmom git or madmom-infer.
- **Tempo cross-checks:** essentia 2.1b6.dev1389 (or dev1438 on Python 3.14) and librosa 1.0.1.
- **Sections:** all-in-one-infer on CPU.
- **Stems:** demucs 4.1.0, plus an optional audio-separator RoFormer vocals pass.
- **Key:** keyfinder-cli (CMake build against Homebrew libkeyfinder) and essentia KeyExtractor.
- **Loudness:** pyloudnorm and ffmpeg.
- **Stretching:** Rubber Band 4.0 (Homebrew), through pylibrb or the CLI.
- **Rendering:** pedalboard.

Write one JSON file per song, with explicit beat and downbeat lists, provenance for every estimate, and ready-made cue candidates.

### Cited Findings
- librosa 1.0.1 requires Python ≥3.12. — [PyPI](https://pypi.org/project/librosa/)
- essentia arm64 wheels: cp39–cp313 for dev1389, cp314 only for dev1438, all macOS 15+. — [PyPI](https://pypi.org/project/essentia/#files)
- torch 2.15.0 (2026-10-28) requires Python ≥3.11 and has macOS 14+ arm64 wheels; cp311–cp313 confirmed. — [PyPI](https://pypi.org/project/torch/)
- audio-separator requires torch ≥2.13 on arm64. — [PyPI](https://pypi.org/project/audio-separator/)
- Spleeter requires Python <3.12, which conflicts with librosa 1.0. — [PyPI](https://pypi.org/project/spleeter/)
- all-in-one-infer's base install is pure PyTorch; only its NATTEN extra pins torch <2.8. — [PyPI](https://pypi.org/project/all-in-one-infer/)
- Different MP3 decoders shift audio by 20–40 ms. — [all-in-one-infer](https://github.com/openmirlab/all-in-one-infer)
- Homebrew formulae with arm64 bottles: rubberband 4.0.0, libkeyfinder 2.2.8, ffmpeg 9.0.2, sound-touch 2.4.1, libebur128 1.2.6, rsgain 3.8. — [rubberband](https://formulae.brew.sh/formula/rubberband), [libkeyfinder](https://formulae.brew.sh/formula/libkeyfinder), [ffmpeg](https://formulae.brew.sh/formula/ffmpeg)

### Inferences

**Toolchain**

| Stage | Primary | Cross-check / fallback | License | Notes |
|---|---|---|---|---|
| Decode | ffmpeg 9 → 44.1 kHz float WAV | — | GPL build | Analyze and play the same WAV |
| Beats/downbeats | beat-this `final0`, no DBN | DBN grid (madmom git / madmom-infer); allin1 beats | MIT (madmom models CC BY-NC-SA) | Disagreement = variable-tempo flag |
| Tempo | Median inter-beat interval | essentia RhythmExtractor2013 + TempoCNN; GetSongBPM | AGPL / CC BY-NC-SA models | Resolve half/double time |
| Sections | all-in-one-infer (CPU) | SongFormer on CUDA; MSAF / librosa | MIT code, CC-BY-NC-SA weights | Snap to downbeats; 4/8/16-bar phrases |
| Hooks | Fusion of label + repetition + energy + vocals + manual tags | pychorus | — | Manual tags override |
| Key | keyfinder-cli `-n camelot` + essentia `edma`/`bgate` | madmom CNN | GPL-3 / AGPL | Agreement flag |
| Loudness | pyloudnorm LUFS/LRA | ffmpeg loudnorm pass 1 (true peak) | MIT / GPL | Static gain |
| Energy | librosa RMS + onset strength per beat/bar, per stem | — | ISC | Heuristics |
| Stems | demucs 4.1.0 htdemucs (MPS → fallback → MLX) | audio-separator RoFormer vocals | MIT code | WAV/FLAC |
| Stretch | Rubber Band 4.0 R3 | Signalsmith (python-stretch) | GPL-2+ / MIT | Vocals ≤ about 6–8% |
| FX/render | pedalboard 0.9.26 | ffmpeg / sox | GPL-3 | Pre-render transitions |

**Proposed per-song JSON (`analysis/<song_id>.json`)**
```json
{
  "schema_version": "1.0",
  "song_id": "042",
  "source": {"mp3_path": "songs/042.mp3", "analysis_wav": "cache/042/mix.wav", "decoder": "ffmpeg 9.0.2", "sha256": "…", "duration_s": 213.47, "sample_rate": 44100},
  "metadata": {"title": "…", "artist": "…", "year": 2004, "mbid": null, "spotify_id": null, "tags": ["christmas"]},
  "tempo": {"bpm": 104.0, "bpm_confidence": 0.91, "is_variable": false,
            "local_bpm": [[0.0, 103.8], [6.0, 104.1]], "half_double_equivalents": [52.0, 208.0],
            "estimates": {"beat_this_ibi_median": 104.0, "essentia_rhythm2013": {"bpm": 104.1, "confidence": 3.2},
                          "essentia_tempocnn": 104.0, "external_getsongbpm": 104}},
  "meter": {"beats_per_bar": 4, "confidence": 0.95},
  "beats": {"times": [0.512, 1.089, 1.666], "beat_in_bar": [1, 2, 3], "source": "beat_this 1.1.0 final0",
            "dbn_times": [0.514, 1.090, 1.667]},
  "downbeats": [0.512, 2.820, 5.128],
  "bars": [{"index": 0, "start": 0.512, "end": 2.820}],
  "phrases": [{"start_bar": 0, "n_bars": 8, "start": 0.512, "end": 18.97, "section_index": 0}],
  "sections": [{"start": 0.512, "end": 18.97, "start_bar": 0, "end_bar": 8, "label": "intro",
                "label_source": "all-in-one-infer harmonix-all", "confidence": null, "alt_labels": {"songformer": "intro"}}],
  "hooks": [{"rank": 1, "start": 46.6, "end": 65.1, "start_bar": 20, "n_bars": 8, "kind": "chorus", "score": 0.87,
             "evidence": {"model_label": "chorus", "repetitions": 3, "energy_z": 1.4, "vocal_presence": 0.92},
             "manual_tag": "best"}],
  "events": {"buildups": [{"start": 37.4, "end": 46.6, "slope_db_per_bar": 0.8}],
             "drops": [{"time": 46.6, "energy_jump_db": 5.2}], "breakdowns": [], "vocal_entries": [9.7, 46.6]},
  "key": {"tonic": "A", "mode": "minor", "camelot": "8A", "open_key": "1m", "confidence": 0.74, "agreement": "exact",
          "estimates": {"keyfinder_cli": "8A", "essentia_edma": {"key": "A", "scale": "minor", "strength": 0.71},
                        "essentia_bgate": {"key": "C", "scale": "major", "strength": 0.66}},
          "hook_key": "8A"},
  "loudness": {"integrated_lufs": -8.9, "lra_lu": 5.1, "true_peak_dbtp": 0.6, "target_lufs": -14.0,
               "gain_to_target_db": -5.1, "tools": ["pyloudnorm 0.2.0", "ffmpeg loudnorm pass1"]},
  "energy": {"resolution": "bar", "rms_db": [-24.1, -18.3], "onset_strength": [0.21, 0.44],
             "stems_rms_db": {"vocals": [], "drums": [], "bass": [], "other": []}, "overall_energy_0_1": 0.72},
  "stems": {"model": "htdemucs (demucs 4.1.0)", "sample_rate": 44100,
            "paths": {"vocals": "cache/042/vocals.wav", "drums": "cache/042/drums.wav", "bass": "cache/042/bass.wav", "other": "cache/042/other.wav"},
            "vocals_hq": {"model": "BS-Roformer-Viperx-1297", "path": "cache/042/vocals_roformer.wav"}},
  "cues": {"cue_in": [{"time": 46.6, "bar": 20, "reason": "hook_start", "score": 0.9},
                      {"time": 37.4, "bar": 16, "reason": "pre_hook_phrase_start", "score": 0.7}],
           "cue_out": [{"time": 65.1, "bar": 28, "reason": "hook_end_phrase_boundary", "score": 0.85}],
           "clip_windows": [{"start": 46.6, "end": 65.1, "n_bars": 8, "priority": "short"},
                            {"start": 37.4, "end": 83.6, "n_bars": 20, "priority": "long"}],
           "drum_loop_candidates": [{"start": 18.97, "n_bars": 2, "drums_only_energy_db": -16.0}]},
  "external_refs": {"getsongbpm": {"bpm": 104, "key": "Am"}, "acousticbrainz": null},
  "analysis": {"created_at": "2026-11-23T18:00:00Z",
               "tool_versions": {"beat_this": "1.1.0", "demucs": "4.1.0", "all_in_one_infer": "3.1.0", "essentia": "2.1b6.dev1389", "librosa": "1.0.1", "pyloudnorm": "0.2.0"},
               "warnings": ["dbn_vs_raw_grid_disagree_after_150s"], "manual_overrides": {}}
}
```

Schema notes (inferences):
- Store times in seconds and also as bar indices. The planner thinks in bars; the renderer needs seconds.
- Keep the per-tool `estimates` so disagreements can be reviewed.
- Keep `manual_overrides` separate so re-running the analysis never wipes hand fixes.
- `clip_windows.priority` maps to the game phase: short early in the round, long and hype-building near the end.
- Add a separate `transitions/<from>_<to>.json` holding the technique, bar alignment, stretch ratio, spin duration (5–11 s) and the rendered file path.

### Gaps
- Nothing was install-tested on this Mac. Verify these first:
  1. madmom git build on Python 3.12/3.13 arm64 (or use madmom-infer instead).
  2. Demucs 4.1.0 on MPS.
  3. all-in-one-infer end-to-end on CPU (Demucs 4.1.0 vs. its own `demucs-infer`).
  4. The keyfinder-cli CMake build against Homebrew libkeyfinder.
- Per-song runtimes on this specific machine are unknown. The estimates come from third-party reports on other Apple Silicon chips.
