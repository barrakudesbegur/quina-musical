# Engine Architecture: real-time audio engine options and system design for a beat-synced bingo DJ mixer

Research date: 2026-11-23. Scope: engine choice (browser vs native vs existing DJ/DAW software), sample-accurate scheduling of transitions and FX, audio–visual sync with the roulette wheel, and the UI-to-engine protocol. "Inferences" are my own reasoning from the cited facts. Some of them use background knowledge, and those are labeled.

---

## 1. How capable is browser Web Audio for this job (scheduling, playbackRate vs time-stretch, AudioWorklet, FX, memory, WASM stretchers, Tone.js, pitfalls)?

### Takeaway
Web Audio can do everything except high-quality live time-stretching: sample-timed buffer starts with offsets, timed loops, and automation of gain, filter and delay are all built in. Time-stretching needs a WASM AudioWorklet (Signalsmith Stretch is the best-licensed option, MIT) or offline pre-rendering. Because the queue is known ahead, offline rendering removes the need for live stretching. The main limits are memory (decoded audio is float32), the autoplay gesture, and the lack of any automatic latency compensation for visuals.

### Cited Findings

**Scheduling model**
- `AudioBufferSourceNode.start(when, offset, duration)`: `when` is in the AudioContext time coordinate system. `offset` is computed "using the sound buffer's natural sample rate, rather than the current playback rate". `duration` is "independent of the playbackRate". `start()` can be called only once per node (it throws `InvalidStateError` otherwise). — [MDN start()](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)
- Audio events run on a separate thread, and "the audio will still happen at exactly the times they were told to happen" even when the main thread stalls. Chris Wilson's recommended pattern is a lookahead scheduler: about 25 ms timer interval and about 100 ms scheduleAheadTime. Visuals should be driven from `audioContext.currentTime`, not from rAF timestamps. "it is a bad idea to use JavaScript's setTimeout to directly start playing audio events". — [web.dev, "Scheduling web audio with precision" (A Tale of Two Clocks)](https://web.dev/articles/audio-scheduling)
- `playbackRate` is a **k-rate** AudioParam (computed once per 128-frame render quantum). When it is not 1.0, "the AudioBufferSourceNode resamples the audio before sending it to the output". So it is a varispeed: tempo and pitch change together. — [MDN playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate)
- The browser's built-in stretch (`<audio>` element `playbackRate`, i.e. pitch-preserving media playback) is one of the implementations in Parabola Research's stretch comparison. It is a separate mechanism from AudioBufferSourceNode. — [Bungee comparison page](https://bungee.parabolaresearch.com/compare-audio-stretch-tempo-pitch-change.html)

**AudioWorklet / WASM / GC**
- WASM suits the AudioWorklet because "it is faster and generates no garbage from the code". The render quantum is fixed at 128 frames, which gives an audio budget of "only 3ms at the sample rate of 44.1Khz". Heavy DSP can run in a Worker that talks to the worklet through a SharedArrayBuffer ring buffer and Atomics. The worklet "must not be synchronously blocked". — [Chrome for Developers, Audio Worklet design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern)
- Developers complain that the fixed 128-sample worklet size causes distortion on mobile devices (spec issue). This matters less on a desktop Mac. — [WebAudio spec issue #2632](https://github.com/WebAudio/web-audio-api/issues/2632)

**Memory for ~77 songs**
- `decodeAudioData` returns non-interleaved 32-bit float PCM, and its size is frames × channels × 4 bytes. It also resamples to the context rate. — [AudioCipher blog](https://audiocipher.app/blog/decode-audio-browser-web-audio-api)
- One developer reported that "float32 storage is maxing out my memory when I have 16+ long-form audio files loaded". A spec proposal for int16 internal storage, which would halve memory, has not shipped. — [WebAudio v2 issue #11](https://github.com/WebAudio/web-audio-api-v2/issues/11)
- An old Chromium bug: each 5 MB MP3 took about 100 MB, and the tab reached about 1 GB after 10 files. — [Chromium 40400583](https://issues.chromium.org/issues/40400583)
- Recommended mitigation: a byte-budgeted LRU cache of decoded buffers, with no stray channel-data references that keep buffers alive. — [DEV.to byte-budget LRU](https://dev.to/abidali671/decode-once-keep-what-fits-a-byte-budget-lru-cache-for-web-audio-buffers-with-tests-for-cpa)

**WASM time-stretchers usable in the browser (versions, licenses, status)**
- **Signalsmith Stretch (official web release)**: npm `signalsmith-stretch` 1.3.2 (27 Jun 2025), **MIT**, 0 dependencies, WASM plus AudioWorklet, UMD and ESM builds. `addBuffers()` lets playback start before the whole file is loaded. The C++ core "can handle a wide-range of pitch-shifts (multiple octaves) but time-stretching sounds best for more modest changes (between 0.75x and 1.5x)". The web release was sponsored by Metronaut. — [npm signalsmith-stretch](https://www.npmjs.com/package/signalsmith-stretch); [GitHub mirror](https://github.com/Signalsmith-Audio/signalsmith-stretch)
  - A third-party integration issue describes the web node as providing sample buffers, pitch/formant controls, **scheduling** and reported latency. It also notes that a Sep 2025 repo revision is newer than npm 1.3.2. — [LemmingsJS-MIDI issue #1186](https://github.com/doublemover/LemmingsJS-MIDI/issues/1186)
  - Integration reports from third-party PRs: the WASM chunk is about 44 kB gzipped; start/seek on the stretched path waits about 0.12 s for the stretcher to fill; the worklet loads from a blob URL, so a strict CSP can block it. — [stemora PR #16](https://github.com/Nat1anWasTaken/stemora/pull/16); [aired PR #87](https://github.com/TamerMomtaz/aired/pull/87) (search summaries attribute these details to "one PR" among these. I could not open the PRs to check which.)
- **rubberband-web** (delude88): 0.2.1, last published Oct 2022, **GPL-2.0-or-later**, about 124 weekly downloads, one maintainer, rated "not healthy" for activity. It provides an AudioWorklet with `setPitch`, `setTempo` and `setHighQuality`. — [Socket.dev](https://socket.dev/npm/package/rubberband-web); [GitHub](https://github.com/delude88/rubberband-web)
- **SoundTouchJS**: `@soundtouchjs/audio-worklet` 2.1.1 (3 Aug 2026), now in an Nx monorepo, TypeScript, ESM-only. License is **MPL-2.0** from 2.0.1 (earlier versions were LGPL-2.1). It has AudioParam-based controls, `processOffline()`, and WSOLA tuning via `setStretchParameters`. Sibling packages: `@soundtouchjs/phase-vocoder-worklet` ("smoother extreme-ratio time-stretching") and a formant-correction worklet. — [npm](https://www.npmjs.com/package/@soundtouchjs/audio-worklet); [GitHub](https://github.com/cutterbl/SoundTouchJS); [Snyk license history](https://snyk.io/advisor/npm-package/@soundtouchjs/audio-worklet)
- **Bungee**: a C++ real-time/offline stretcher, **MPL-2.0**, repo updated Oct 2026. Its author describes "current-best-practice phase vocoder techniques", with about 20 ms control latency and about 40 ms input-to-output. Two WASM wrappers exist: `bungee-web` 0.1.2 (MIT and MPL-2.0, AudioWorklet) and `bungee-pitch-shift` 1.0.8 (MIT, worklet, worker and offline modes). — [Bungee GitHub org](https://github.com/bungee-audio-stretch); [KVR thread](https://www.kvraudio.com/forum/viewtopic.php?t=607012&start=15); [bungee-web on jsDelivr](https://www.jsdelivr.com/package/npm/bungee-web); [bungee-pitch-shift on jsDelivr](https://www.jsdelivr.com/package/npm/bungee-pitch-shift)
- **Superpowered Web SDK**: `@superpoweredsdk/web` 2.8.1. Its feature list includes time stretching, pitch shifting, and a player with "time-stretching, pitch-shifting, scratching, looping and multi-player sync". **Commercial license, case by case** (email licensing@superpowered.com). You may experiment privately but "may not launch publicly ... without a license". A free license is possible at their discretion. — [Superpowered GitHub](https://github.com/superpoweredSDK/web-audio-javascript-webassembly-SDK-interactive-audio); [npm](https://www.npmjs.com/package/@superpoweredsdk/web); [Superpowered JS SDK page](https://superpowered.com/js-audio-library-sdk)
- Parabola's listening comparison covers Audacity, Bungee 2.4.8, Bungee Pro, élastique, PaulStretch, Rubber Band 4.0.0 R3, Serato, Signalsmith, Sonic, SoundTouch, Superpowered 2.7.2 and the browser's built-in stretch. It gives no license, latency or CPU data, and it warns the data "may contain errors". — [Bungee compare](https://bungee.parabolaresearch.com/compare-audio-stretch-tempo-pitch-change.html)
- Prior-art pattern: a WASM DAW project plans **Signalsmith (MIT) for real-time preview in an AudioWorklet and Rubber Band R3 (GPLv2+) for offline high quality in a Web Worker**. — [ACE-Step-DAW issue #1667](https://github.com/ace-step/ACE-Step-DAW/issues/1667)

**Tone.js**
- The latest tag is 15.1.22. Its release date is ambiguous: jsDocs and UNPKG say "1 year ago" (2025), while a third-party brief says 12 Jul 2026. The dev branch is still active, and tagged releases lag behind it. — [Tone.js releases](https://github.com/Tonejs/Tone.js/releases); [jsDocs tone@15.1.22](https://www.jsdocs.io/package/tone)
- Transport callbacks fire ahead of the audible time by the lookAhead, and run off the animation frame. For visuals, use `Tone.getDraw().schedule(cb, time)`, which fires on the animation frame nearest the audio time. Don't touch the DOM inside Transport callbacks. — [Tone.js wiki: Performance](https://github.com/Tonejs/Tone.js/wiki/Performance)
- Defaults: lookAhead 0.1 s and updateInterval 0.03 s. latencyHint can be "interactive", "playback", "balanced", "fastest" or seconds, and since v14.7 it can only be set in the constructor. — [Tone.js wiki: Performance](https://github.com/Tonejs/Tone.js/wiki/Performance); [Tone r13 Context docs](https://tonejs.github.io/docs/r13/Context)
- `GrainPlayer` is granular, with `detune` (cents) independent of `playbackRate`. `Tone.PitchShift` is a separate effect. — [GrainPlayer docs](https://tonejs.github.io/docs/14.8.36/GrainPlayer); [jsDocs](https://www.jsdocs.io/package/tone)

**Pitfalls**
- **Autoplay**: Chrome allows sound only after user interaction or once the Media Engagement Index threshold is met. Otherwise the error is "An AudioContext must be created or resumed after the document received a user gesture". A fresh profile can show a suspended context where a used profile doesn't, so test with a clean `--user-data-dir`. — [TelemetryTV autoplay doc](https://docs.telemetrytv.com/docs/googles-autoplay-policy); [webrtc/samples #1028](https://github.com/webrtc/samples/issues/1028)
- Kiosk launch: `chrome --kiosk --autoplay-policy=no-user-gesture-required <url>` (a 2019-era source; the chrome://flags entry was removed). — [chrome-autoplay repo](https://github.com/Hugo22O/chrome-autoplay); [gHacks](https://www.ghacks.net/2018/02/06/how-to-control-audio-and-video-autoplay-in-google-chrome/)
- **Tab throttling**: "Pages playing audible audio are considered user-visible and exempted from background timer throttling", and the exemption lasts several seconds after audio stops. Silent audio does not count. Chrome offers `--disable-background-timer-throttling`. — [Chrome blog: background tabs](https://developer.chrome.com/blog/background_tabs); [blink-dev intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/XRqy8mIOWps)
- Intensive throttling (Chrome 88) exempts tabs with audio, WebSockets or WebRTC. This is a secondary source. — [iKit blog](https://ikit.app/blog/background-tab-timer-throttling)
- **outputLatency / getOutputTimestamp support**: `outputLatency` is in Chrome 102+, Firefox 70+, and Safari 18.4+ (31 Mar 2025). — [caniuse](https://caniuse.com/mdn-api_audiocontext_outputlatency)
- `getOutputTimestamp()` is in Chrome 57+, Firefox 70+ and Safari 14.1+. — [W3cubDocs/MDN mirror](https://docs.w3cub.com/dom/audiocontext/getoutputtimestamp)
- A spec issue (about 5 years old) reported Chrome's `getOutputTimestamp()` "bouncing around" while Firefox's stayed steady. — [WebAudio issue #2461](https://github.com/WebAudio/web-audio-api/issues/2461)
- `standardized-audio-context` omitted `outputLatency` as of Mar 2025. — [issue #1017](https://github.com/chrisguttandin/standardized-audio-context/issues/1017)
- Web Audio does not compensate visuals for output latency. Measured on macOS: built-in output about 15–25 ms, AirPods about 178 ms. Firefox on macOS sometimes reported 0, and readings were inconsistent. Feature-detect, and re-read the value when playback starts. — [jamieonkeys](https://www.jamieonkeys.dev/posts/web-audio-api-output-latency/)

### Inferences
- **Memory math**: at 48 kHz stereo float32, audio costs 384 kB/s, so a 3.5-min song is about 81 MB decoded and all 77 songs are about 6.2 GB (about 5.7 GB at 44.1 kHz). Do **not** decode the whole library. Keep a sliding window (previous, current, next, next+1: about 320 MB) and decode the next song while the current one plays. The queue is pre-shuffled, so this is easy.
- **Pitch cost of playbackRate**: semitones = 12·log2(rate). ±2% gives about 0.34 st, ±5% about 0.84 st, ±8% about 1.33 st. For small BPM gaps, a short playbackRate nudge during the overlap, ramped back to 1.0 afterwards, is what a DJ without key-lock does, and it is cheap and glitch-free. For large BPM gaps across genres (90 vs 128), stretching is beyond Signalsmith's sweet spot of 0.75–1.5x anyway. Use non-beatmatched transition styles (echo-out, filter-and-cut, riser plus drop-swap, spinback), or use half/double-time relationships.
- **Sample-accurate DJ building blocks in Web Audio** (background knowledge of the Web Audio spec, not fetched here): AudioParam automation (`setValueAtTime`, `linearRampToValueAtTime`, `exponentialRampToValueAtTime`, `setTargetAtTime`, `setValueCurveAtTime`) on GainNode.gain, BiquadFilterNode.frequency/Q and DelayNode.delayTime is timed on the audio clock. An echo-out is a DelayNode in a feedback loop through a GainNode, with a filter in the loop. A ConvolverNode with a short IR gives reverb throws. Risers and impacts are pre-made samples started with `start(when)`. A beat-roll (4→2→1→½ beat loops) is most precise as a chain of pre-scheduled AudioBufferSourceNodes, each with `start(when, offset, duration)`. Changing `loopStart`/`loopEnd` while playing is not time-stamped.
- **Tone.js fit**: the Transport is one global tempo timeline. The hard part here is two decks at different BPMs, plus a timeline whose times are computed from beat grids. A small custom scheduler on raw Web Audio is simpler and more transparent. Tone.js is useful mainly for `Draw` and ready-made effects, and it is optional.
- **GC/jank risk is low for native nodes**: they render on the audio thread, so main-thread GC or React re-renders cannot cause dropouts once events are scheduled. The risk moves to (a) scheduling too late (keep at least 100–200 ms of lookahead, and schedule whole transitions seconds in advance), and (b) AudioWorklet JS that allocates in `process()`.

### Gaps
- I could not fetch the Signalsmith web README (404 on the raw path; npm returned 403), so the exact `schedule()` fields (output time, input time, rate, semitones, loop points) are unverified here. Check `web/` in the repo before building on it.
- No published CPU or latency benchmarks for Signalsmith, Bungee or SoundTouch worklets on Apple Silicon.
- No authoritative recent measurement of decodeAudioData time for a 4-min MP3 in Chrome on M-series.
- No 2025–2026 confirmation of whether Chrome's `getOutputTimestamp()` jitter (issue #2461) has been fixed.

---

## 2. Native options for a separate engine (Rust, JUCE, Python, SuperCollider, Sonic Pi, Pd/Max, Node native, Swift/AVAudioEngine, Electron/Tauri)

### Takeaway
On macOS, the strongest native candidates are **Swift with AVAudioEngine** (no dependencies, sample-time scheduling, Apple-maintained) and **Rust** (cpal 0.18 plus kira 0.12's clock and tween scheduler, with Signalsmith Stretch bindings). JUCE is the most capable but the slowest to build with. SuperCollider gives timestamped OSC scheduling but not true sample lock with its language. Python is only safe when its audio callback lives in C++ (as in pedalboard). An unusual option: **node-web-audio-api** runs the *same Web Audio API code* natively in Node. Prefer Electron over Tauri for hosting a Web Audio engine, because Tauri uses WebKit on macOS and has audio quirks.

### Cited Findings

**Rust**
- **kira** 0.12.6 (28 Oct 2026), **MIT OR Apache-2.0**. Features: tweens, mixer tracks with effects (filters, EQ, distortion are listed), clocks, modulators (LFOs), static and streaming sounds, cpal backend by default, symphonia for MP3/FLAC/OGG/WAV, and an `assert_no_alloc` feature for the audio thread. — [docs.rs/kira](https://docs.rs/kira/latest/kira/)
- kira clocks: sounds can start when a clock reaches a tick (`start_time(clock.time() + 4)`), tweens can start on a clock tick, and `ClockSpeed::TicksPerMinute(TEMPO)` gives one tick per beat. — [kira clock docs](https://docs.rs/kira/latest/kira/clock/index.html)
- **cpal** 0.18.2 (16 Aug 2026). The CoreAudio backend now includes **device latency and safety offset in timestamps**, sets the physical stream format directly, and reports xruns on default-output streams. Minimum macOS 14.2. — [docs.rs cpal](https://docs.rs/crate/cpal/latest); [cpal releases](https://github.com/rustaudio/cpal/releases)
- **rodio** 0.23.0 (11 Oct 2026) uses cpal 0.18.2 and Symphonia. — [lib.rs rodio](https://lib.rs/crates/rodio)
- **fundsp** is about v0.23.0 (unconfirmed date). — [lib.rs audio](https://lib.rs/multimedia/audio)
- Signalsmith Stretch in Rust: `ssstretch` 0.1.0 (cxx bindings); `signalsmith-stretch` 0.1.3 (cc plus bindgen, needs libclang); and `signalsmith-stretch-rs`, a pure-Rust port whose `process()` is "allocation-free and use no locks, threads, or I/O". — [lib.rs ssstretch](https://lib.rs/crates/ssstretch); [ethereal PR #11](https://github.com/diegoimbert/ethereal/pull/11); [signalsmith-stretch-rs](https://github.com/ioma8/signalsmith-stretch-rs)
- No published Rubber Band crate was found. One project builds Rubber Band from its single-file source with hand-written Rust FFI. — [Musicable PR #77](https://github.com/maxbonifacio/Musicable/pull/77)

**C++ / JUCE**
- JUCE 8 is dual-licensed **AGPLv3 / commercial**. The Starter tier is free (revenue up to $20k). Indie is up to $300k ($40/mo or $800 perpetual). Pro is unlimited ($175/mo or $3,500). Internal use without "conveying" closed-source binaries can fall under AGPLv3. — [JUCE 8 EULA](https://juce.com/legal/juce-8-licence/); [Get JUCE](https://juce.com/get-juce/)
- **Rubber Band** (C++) is **GPL-2.0-or-later or commercial** (commercial is required for closed-source or App Store distribution). v4.0 was released 25 Oct 2024. R3 ("Finer") gives "substantially higher-quality output" especially for "complex mixes, vocals ... substantial bass content" but "uses much more CPU". It has offline (default, sample-accurate, multithreaded) and real-time modes, and `OptionWindowShort` is a cheaper "draft" R3. — [Rubber Band GitHub](https://github.com/breakfastquay/rubberband); [breakfastquay.com/rubberband](https://breakfastquay.com/rubberband/); [usage.txt](https://breakfastquay.com/rubberband/usage.txt); [API docs](https://breakfastquay.com/rubberband/code-doc/classRubberBand_1_1RubberBandStretcher.html)
- Open issue: in R3 real-time mode, output alignment shifts by 1–2 frames depending on process() block size. — [rubberband #132](https://github.com/breakfastquay/rubberband/issues/132)

**Python**
- python-sounddevice: the PortAudio callback runs at real-time priority, and you must not "allocate memory, access the file system, call library functions or call other functions ... that may block". Underflows mean "the stream callback is using too much CPU time". — [sounddevice docs (misc)](https://python-sounddevice.readthedocs.io/en/0.4.4/api/misc.html)
- One user reported callback mode was impractical "due to the GIL" in a GUI app, with underflows and drift. Raising latency above 0.1 s fixed underflows for another user. — [sounddevice issue #384](https://github.com/spatialaudio/python-sounddevice/issues/384)
- **pedalboard** (Spotify): `AudioStream` puts "the entire audio callback into C++ ... the audio callback never waits for Python". `time_stretch()` and `PitchShift` use Rubber Band. `time_stretch` is whole-buffer and "not meant to be used in Pedalboard objects". — [LWN on PyCon 2025 talk](https://lwn.net/Articles/1027814/); [TimeStretch.h](https://github.com/spotify/pedalboard/blob/master/pedalboard/TimeStretch.h); [pedalboard examples v0.9.24](https://spotify.github.io/pedalboard/examples.html); [pedalboard GitHub](https://github.com/spotify/pedalboard)

**SuperCollider**
- Version 3.14.1, released 23–24 Nov 2025. — [SC releases](https://github.com/supercollider/supercollider/releases)
- OSC **bundles with timetags** are queued and "scheduled at the appropriate (sub)sample offset". Use `OffsetOut` for accuracy within a control block. The default `s.latency` is 0.2 s and applies only to OSC scheduling, not to audio latency. — [Nick Collins, Precise Timing in SC](https://composerprogrammer.com/teaching/supercollider/sctutorial/8.1%20Precise%20Timing%20in%20SC.html); [scsynth.org: always use bind](https://scsynth.org/t/why-you-should-always-wrap-synth-and-synth-set-in-server-default-bind/7310); [nathanho.me tips](https://nathanho.me/posts/supercollider-tips/)
- Limits: client and server run on different clocks, so "it is impossible to achieve deterministic (sub)sample accurate scheduling" in real time. Server latency doesn't compensate drift. Sample-accurate relative scheduling works in NRT mode. — [scsynth.org hard-sync thread](https://scsynth.org/t/keeping-sclang-and-scsynth-in-hard-sync/5526); [SC issue #2939](https://github.com/supercollider/supercollider/issues/2939)
- Time-stretch in SC is granular (`Warp1`), and BufRd has float-precision issues beyond 16,777,216 frames (about 5.8 min at 48 kHz). — [Warp1 docs](https://doc.sccode.org/Classes/Warp1.html); [PlayBuf 2017 wiki](https://github.com/supercollider/supercollider/wiki/PlayBuf-2017)

**Sonic Pi**
- It listens for OSC on port 4560. By default it **adds 500 ms of schedule-ahead latency** to synth and MIDI events. `use_real_time` sets that to 0 for a thread, and compensating for external cues uses `time_warp`. — [Sonic Pi Receiving OSC tutorial](https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/doc/tutorial/12.1-Receiving-OSC.md); [Sonic Pi CHANGELOG](https://github.com/sonic-pi-net/sonic-pi/blob/dev/CHANGELOG.md); [in_thread MIDI trigger thread](https://in-thread.sonic-pi.net/t/triggering-from-midi-is-this-example-robust/4432)

**Node.js native audio**
- **node-web-audio-api** (IRCAM) gives Node.js bindings to the Rust `web-audio-api-rs` implementation of the Web Audio spec, built with napi-rs. Latest is 2.2.0. It supports AudioWorklet and passes about 500 WPT tests (per DeepWiki). — [GitHub](https://github.com/ircam-ismm/node-web-audio-api); [npm](https://www.npmjs.com/package/node-web-audio-api); [docs.rs web-audio-api](https://docs.rs/web-audio-api)
- Open bug: an AudioWorkletProcessor keeps being called after `process()` returns false, so CPU use accumulates. — [issue #202](https://github.com/ircam-ismm/node-web-audio-api/issues/202)
- Paper: "The Web Audio API as a Standardized Interface Beyond Web Browsers" (JAES 2023). — [AES e-library](https://aes.org/publications/elibrary/elibrary-page/?id=22344)

**Swift / AVAudioEngine (macOS)**
- For multi-player sync, read `lastRenderTime.sampleTime`, add a start delay, build `AVAudioTime(sampleTime:atRate:)`, and `play(at:)` every player. That approach is "your ticket to 100% sample-frame accurate sync". Without the delay, the first 100–200 ms can be clipped. Round to whole frames. There is no built-in sync-group API. — [Apple Dev Forums 14138](https://developer.apple.com/forums/thread/14138)
- If `when` has a valid sampleTime, that is used and hostTime is ignored. Node sample time has an arbitrary zero. `nodeTimeForPlayerTime` and `playerTimeForNodeTime` convert between timelines. — [MBS AVAudioPlayerNode docs (mirror Apple headers)](http://www.monkeybreadsoftware.net/class-avaudioplayernodembs.shtml)
- Pitfalls: plain `play()` starts at the next render cycle; a node's sample time resets after stop; `playerTimeForNodeTime` is nil while paused. — [Medium: time in AVAudioPlayerNode](https://medium.com/@mehsamadi/making-sense-of-time-in-avaudioplayernode-475853f84eb6)
- One developer got silence when scheduling with hostTime only. — [Apple Dev Forums 93917](https://developer.apple.com/forums/thread/93917)
- `AVAudioUnitTimePitch` is Apple's phase vocoder, with a minimum rate of 1/32. — [Recreational Signal Processing: BlueNote's phase vocoder](https://recreationalsignalprocessing.substack.com/p/bluenotes-real-time-phase-vocoder)
- A developer reports audible artifacts ("flattering") when speeding up to 1.1–1.15x even at `overlap = 32`, while 0.7–0.8x sounded fine. — [Apple Dev Forums 769240](https://developer.apple.com/forums/thread/769240)

**Electron / Tauri wrappers**
- Electron (Chromium): append `app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required')` in the main process before `ready`. The `webPreferences.autoplayPolicy` setting reportedly has no effect. — [electron #14323](https://github.com/electron/electron/issues/14323); [cordova-electron #102](https://github.com/apache/cordova-electron/issues/102)
- These switches are commonly paired with it: `disable-background-timer-throttling`, `disable-renderer-backgrounding`, `disable-backgrounding-occluded-windows`. — [thecodersblog 2025](https://thecodersblog.com/electron-video-player-sound-autoplay-2025)
- Tauri on macOS uses WKWebView (WebKit). Reported problems:
  - `createMediaElementSource` produced silence in a Tauri app. — [stemdeck #38](https://github.com/stemdeckapp/stemdeck/issues/38)
  - WebKit breaks AudioWorklet, getUserMedia and decodeAudioData workflows for one app, and from macOS 14 ATS blocks `http://127.0.0.1` without `NSAllowsLocalNetworking`. — [bandmate #1218](https://github.com/xKirtle/bandmate/issues/1218)
  - Tauri apps are capped at 60 fps on macOS. — [bandmate #1218](https://github.com/xKirtle/bandmate/issues/1218)
- AudioWorklet is listed as widely available in WKWebView. — [caniwebview](https://caniwebview.com/features/mdn-audioworklet/)

### Inferences
Ratings are my judgment, from the facts above plus general experience, on a scale of 1 (poor) to 5 (excellent).

| Option | Time-stretch quality | Scheduling precision | Effects | Dev speed (for a web dev) | Live reliability | Notes |
|---|---|---|---|---|---|---|
| Browser Web Audio (Chrome/Electron) | 3 live (Signalsmith worklet), 5 if pre-rendered offline | 5 (native nodes on audio clock) | 4 (biquad, delay, convolver, gain, waveshaper; custom via worklet) | 5 | 4 (a UI crash or reload kills audio unless the engine is isolated) | Fastest PoC |
| Swift + AVAudioEngine | 3 (TimePitch artifacts above about 1.1x); 5 with offline pre-render | 5 (sampleTime scheduling) | 4 (Apple AUs: EQ, delay, reverb, distortion; background knowledge) | 3 | 5 | Best "Apple-native" fallback |
| Rust (cpal + kira + signalsmith-stretch-rs) | 4 | 5 (kira clocks and tweens) | 3 (fewer built-in FX; filter, EQ, distortion listed) | 2–3 | 5 | Good if you like Rust; kira has no built-in stretch |
| C++ JUCE (+ Rubber Band/Signalsmith) | 5 | 5 | 5 | 1–2 | 5 | Overkill for a PoC; AGPL or Starter license |
| Python (pedalboard AudioStream, sounddevice) | 5 offline (Rubber Band); live stretching awkward | 3 | 4 (pedalboard FX, VST3/AU hosting) | 4 | 2–3 (only safe if callback is C++) | Great for the **offline render/analysis pipeline**, not the live engine |
| SuperCollider | 2–3 (granular) unless pre-stretched buffers | 4 (timestamped bundles; not sample-locked to client) | 5 | 2 | 4 | Powerful but steep learning curve |
| Sonic Pi | 2 | 3 (500 ms default latency, live-coding model) | 4 | 3 | 3 | Wrong tool: designed for live coding, not external deterministic control |
| Pure Data / Max | 3 | 4 | 5 | 2 | 4 | Not researched in depth (see Gaps) |
| Node + node-web-audio-api | same as browser | 4–5 | 4 | 4 (reuses browser engine code) | 4 (young project; worklet bug #202) | Interesting "same code, native process" fallback |
| Tauri (WKWebView) | same as Safari Web Audio | 4 | 4 | 4 | 3 (WebKit audio quirks) | Use only with a Rust-native audio core, not webview audio |
| Electron (Chromium) | same as browser | 5 | 4 | 5 | 4 | Lets you set autoplay and throttling switches |

- For a separate engine process, the deciding feature is **isolation**: the music keeps playing even if the React UI reloads or crashes. Any native engine, or a headless Node with node-web-audio-api, provides that.
- None of the native options solves a problem that offline rendering doesn't already solve for the time-stretch quality question. Their main benefit is reliability and isolation, not capability.

### Gaps
- No sources were gathered on **Pure Data / Max** or **pyo** (versions, scheduling precision). Max for Live is covered only through the Ableton LOM.
- I did not verify which kira 0.12 effects exist beyond filter, EQ and distortion (for example delay or reverb). Check docs.rs.
- I did not verify sample-accurate **parameter automation** in AVAudioEngine (for example AUParameter ramps or AUScheduleParameterBlock for Apple's built-in units). Without it, filter sweeps may be quantized to the render buffer.
- I did not verify whether node-web-audio-api's `decodeAudioData` supports MP3 on macOS (likely via symphonia, unconfirmed).

---

## 3. Using existing DJ/DAW software as the engine (Mixxx, Ableton Live + AbletonOSC/M4L, VirtualDJ)

### Takeaway
**Ableton Live with AbletonOSC** is the most capable "existing engine". It has top-tier warping, launch quantization, follow actions and FX, plus a documented OSC API with a beat listener. But it is a paid, heavyweight dependency, and getting precise landing times back to the wheel takes extra work. **Mixxx** (free, GPL) has no official OSC or remote API in stable releases as of Nov 2026: stable is 2.5.x, 2.6 is still beta, and OSC exists only in an unmerged PR and forks. That leaves MIDI over the IAC bus plus JS mappings, which makes timestamped feedback hard. **VirtualDJ** has native OSC, but it needs a PRO license.

### Cited Findings

**Mixxx**
- The 2.6 beta was announced 11 May 2025 (stems, movable hotcues). — [Mixxx news](https://mixxx.org/news/2025-05-11-mixxx-2_6_beta-released/)
- Softpedia lists "2.5.6 / 2.6 Beta" as of 19 Oct 2026. — [Softpedia](https://www.softpedia.com/get/Multimedia/Audio/Audio-Mixers-Synthesizers/Mixxx.shtml)
- Chocolatey lists 2.5.6 (27 Mar 2026) plus 2.6.0 beta and 2.7.0 alpha builds. — [Chocolatey](https://community.chocolatey.org/packages/mixxx/2.6.0-beta-96)
- The Mixxx news page (latest post 2 Nov 2026) has no 2.6.0 release post. — [mixxx.org/news](https://mixxx.org/news/)
- OSC: you need binaries of **PR #13835** for OSC support. The macOS CI build crashed when OSC was enabled (Jan 2025). — [Oscleton for Mixxx](https://mixxx.discourse.group/t/oscleton-for-mixxx/31049)
- As of June 2025 the OSC PR was not accepted, though a developer says "the PRs work fully". — [OSC Control of Mixxx](https://mixxx.discourse.group/t/osc-control-of-mixxx/32106)
- Third-party OSC forks exist. — [me9umiii/mixxx_osc](https://github.com/me9umiii/mixxx_osc)
- Scripting: JS controller mappings use `engine.getValue`/`setValue`/`getParameter`/`setParameter`. — [MIDI Scripting wiki](https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting)
- Controls include `beatsync`, `quantize`, `beatjump`, `beatjump_size`, `beatjump_X_forward/backward`, and beatloops. — [Mixxx Controls manual 2.4](https://manual.mixxx.org/2.4/en/chapters/appendix/mixxx_controls.html)
- Workarounds: MIDI-over-network apps, or sending keypresses. — [MixxxHelpers](https://github.com/DaveBullet1050/MixxxHelpers); [Mixxx forum remote control thread](https://www.mixxx.org/forums/viewtopic.php?f=6&t=8263)

**Ableton Live + AbletonOSC / Max for Live**
- AbletonOSC: **MIT**, requires **Live 11 or above**. Endpoints include:
  - `/live/clip/fire`, `/live/scene/fire`
  - `/live/clip/set/launch_quantization` (0=Global, 1=None, 2=8 Bars ... 14=1/32)
  - `/live/song/set/clip_trigger_quantization`
  - `/live/song/start_listen/beat` (beat number pushed to `/live/song/get/beat`)
  - `/live/song/get|set/tempo`, `/live/song/get|set/current_song_time` (beats)
  - `/live/clip/get|set/warping`, `/live/clip/get|set/warp_mode` (0=Beats ... 6=Pro)
  - `/live/clip_slot/create_clip` (MIDI only)
  - The README documents no timing or latency caveats.
  — [AbletonOSC README](https://github.com/ideoforms/AbletonOSC)
- Live's launch quantization: with "Global" a clip follows the Control Bar setting. "Any setting other than None will quantize the clip's launch when it is triggered by Follow Actions". — [Ableton Manual: Launching Clips](https://www.ableton.com/en/manual/launching-clips/)
- `ClipSlot.create_audio_clip(path)` (absolute path to an audio file, audio tracks only) exists in the Live Object Model **from Live 12.0.5**. Earlier versions throw "no attribute". — [Cycling '74 LOM ClipSlot](https://docs.cycling74.com/apiref/lom/clipslot/); [Max forum thread](https://cycling74.com/forums/function-createaudioclip-class-clipslot-and-track-missing-lom)
- Live 12 also added `Track.create_audio_clip(file_path, position)` for the Arrangement. One user saw a 5-beat file come out as a 4-beat clip. — [AbletonMCP PR #1](https://github.com/windmonarch/AbletonMCP/pull/1)
- AbletonOSC doesn't expose `create_audio_clip` by default ("Unknown OSC address"). One project patches it in. — [AbeltonGod PR #87](https://github.com/castorsalzmann-ui/AbeltonGod/pull/87)

**VirtualDJ**
- Native OSC: set `oscPort`. Commands take the form `/vdj/{vdjscript}`, for example `/vdj/deck/1/play`. Queries use `/vdj/query/...` and subscriptions use `/vdj/subscribe/...`, with replies sent to `oscPortBack`. "**this feature requires a VDJ PRO license**". — [VirtualDJ options list](https://virtualdj.com/manuals/virtualdj/appendix/optionslist.html)
- The official forum advises OS2L for complex commands. One user reports boolean queries return no value. — [VDJ and new OSC support](https://virtualdj.com/forums/266538/VirtualDJ_Technical_Support/VDJ_and_new_OSC_support.html)
- There is also an HTTP "Network Control" plugin (default port 8080, optional bearer password) that runs any VDJScript. — [VirtualDJ wiki](https://virtualdj.com/wiki/NetworkControlPlugin.html); [virtualdj-connect](https://github.com/chrisle/virtualdj-connect)

### Inferences
- **Ableton pros**: battle-tested live audio engine; Complex Pro warping is a solved time-stretch; launch quantization and follow actions map directly onto "quantize Next to the next N-bar boundary"; rack macros and automation give fancy FX quickly; AbletonOSC is easy to drive from Node.
- **Ableton cons**: license cost (and Suite for Max for Live). Each of the 77 songs must be warped, and auto-warp mistakes need manual fixes. Building transitions programmatically means patching AbletonOSC or writing M4L JS. The wheel needs `landAt` *before* the launch, so you must compute it from `current_song_time`, tempo and the quantization grid, then map beats to wall-clock time yourself. The beat listener reports beats after the fact, over UDP, with no timestamps documented. Two decks at different native tempos fight Live's single global tempo, so every clip must be warped and tempo automated.
- **Mixxx pros**: free, real DJ engine (beatgrids, sync, quantize, filter, echo and reverb effects, key-lock, Auto DJ).
- **Mixxx cons**: no official network API. Control goes through the macOS IAC MIDI bus plus a JS mapping, there is no timestamped event stream back to the UI, and "transition designs" must be written in the mapping language. It is a poor fit for a wheel that must stop on an exact downbeat.
- **VirtualDJ**: OSC plus VDJScript is the most "DJ-native" remote API, but it needs a paid PRO license, timing feedback is UDP values without timestamps, and it is closed-source.
- For a proof of concept, existing software is best used as a **fallback** or a **benchmark** for how good a transition should sound, not as the primary engine. The custom wheel's need for an exact landing timestamp is the sticking point.

### Gaps
- I could not confirm whether Mixxx 2.6.0 stable shipped between 2 Nov and 23 Nov 2026, or the merge status of PR #13835.
- No measured latency or jitter for AbletonOSC listeners, or for Live remote-script tick rates.
- No VirtualDJ PRO pricing was checked.
- I did not verify whether AbletonOSC (a MIDI Remote Script) works in Live Intro/Standard or needs Suite.

---

## 4. Pre-rendering vs live mixing (and the hybrid)

### Takeaway
Because the next song is known minutes ahead, the expensive and quality-critical part (time-stretching the incoming song to the outgoing tempo, with a tempo glide back to native) can be **rendered offline at the highest quality (Rubber Band R3 offline)** while the current song plays. FX on the outgoing song and the exact start moment stay **live and sample-scheduled**. That hybrid keeps "Next works at any moment" and removes live stretching from the real-time path. Full transition pre-renders are possible but force a choice of exit points ahead of time.

### Cited Findings
- Rubber Band has offered both "a sample-accurate multithreaded offline mode and a real-time lock-free streaming mode" since v1.0. Offline is the default. R3 is higher quality but costs more CPU. — [breakfastquay.com/rubberband](https://breakfastquay.com/rubberband/); [Rubber Band GitHub](https://github.com/breakfastquay/rubberband)
- FFmpeg's `rubberband` filter (needs `--enable-librubberband`) has these options: `tempo`/`pitch` (0.01–100), `transients` (crisp, mixed, smooth), `detector`, `phase`, `window`, `smoothing`, `formant`, `pitchq`, `channels`. `tempo` and `pitch` can be changed at runtime via filter commands. `atempo` is the lower-quality built-in alternative. — [FFmpeg filters doc](https://ffmpeg.org/ffmpeg-filters.html); [FFmpeg 8.0.3 rubberband doc mirror](https://ayosec.github.io/ffmpeg-filters-docs/8.0/Filters/Audio/rubberband.html)
- pedalboard `time_stretch()` (Rubber Band-based, `high_quality` default, optional pitch shift since v0.9.8) works on whole buffers. — [TimeStretch.h](https://github.com/spotify/pedalboard/blob/master/pedalboard/TimeStretch.h)
- The dual-engine pattern (real-time Signalsmith preview plus offline Rubber Band R3 render) is used by a browser DAW. — [ACE-Step-DAW #1667](https://github.com/ace-step/ACE-Step-DAW/issues/1667)
- License note: Rubber Band is GPL-2.0-or-later unless a commercial license is bought. Using it as a *tool* in an offline pipeline (CLI or ffmpeg) for a private event doesn't involve distributing software. — [Rubber Band GitHub](https://github.com/breakfastquay/rubberband)

### Inferences
- **Three strategies:**
  1. **Fully live.** All stretching and FX happen in real time (Signalsmith worklet, or AVAudioUnitTimePitch). *Pro*: maximum flexibility (Back, re-order, any target tempo). *Con*: lower stretch quality at larger ratios, more CPU on the audio thread, more moving parts at showtime.
  2. **Fully pre-rendered transitions** (outgoing tail + FX + incoming head as one file). *Pro*: zero real-time DSP risk, studio quality, and you can audition every transition before the event. *Con*: you must pre-pick exit points. "Next" at an arbitrary moment means rendering a transition for every candidate exit phrase (for example every 8 bars, so about 10–20 renders per song), or forcing a wait until a pre-rendered exit. Changing the transition style (early fast vs late hype) multiplies the renders. If the presenter presses "Back" or skips, the pre-renders are invalid.
  3. **Hybrid (recommended).** Offline, render only the **incoming song's head**: time-stretched so its first N bars match the outgoing BPM, then a tempo glide back to its native tempo. Or render the whole incoming track with that ramp; on M-series this is a background job during the roughly 3-min current song. Live, quantize the "Next" press to the next suitable bar or phrase boundary of the outgoing track inside the 5–11 s spin window. Schedule `start(landAt − preroll, offsetIntoHead)` for the incoming buffer and timed automation on the outgoing track (high-pass sweep, beat-roll loop chain, echo-out feedback, riser sample, gain cut). Everything live is cheap native nodes; all stretching was done offline.
- **Fallback inside the hybrid**: if the incoming pre-render isn't ready, or the order changed (Back), use a non-beatmatched transition (echo-out or filter-and-cut plus impact on the drop). It needs no stretching, so it is always available.
- **Fit to the spin window**: 128 BPM gives a 1.875 s bar and a 7.5 s 4-bar phrase. 90 BPM gives a 2.67 s bar. A 6-s-wide window (5–11 s after the press) always contains at least 2 bar boundaries at 80+ BPM. It contains a 4-bar boundary at 128 BPM about 80% of the time (6/7.5), and an 8-bar boundary only about 40% of the time. Two remedies: land on the incoming song's phrase start (you choose the incoming offset freely, so any incoming phrase can land on any outgoing bar), or extend the outgoing song with a 1–2 bar loop until a phrase boundary. Max transition length is about 11 s, roughly 5–6 bars at 128 BPM. "Long hype" transitions should therefore mean denser build-ups, not more bars, unless the build-up starts before the press.
- **Render-time budget**: I found no benchmark, but offline R3 on a single 3–4 min stereo song is plausibly seconds on Apple Silicon. Verify in the PoC.

### Gaps
- No benchmark for Rubber Band R3 offline speed on Apple Silicon.
- I did not confirm Rubber Band's time-map / key-frame map support (for a variable-ratio "match then glide back" render) from primary docs in this session. The `RubberBandStretcher` API docs are the place to check (`setKeyFrameMap` in offline mode).
- No prior-art write-up was found on automatic DJ systems that pre-render transitions.

---

## 5. Audio–visual sync: stopping a physics-animated wheel exactly on a downbeat

### Takeaway
Don't simulate free physics and hope. Compute the wheel's trajectory **backwards** from a known stop time (`landAt`) and stop angle, and drive the animation from the **audio clock** mapped to `performance.now()`, compensated for output latency. If the engine and wheel run in the same browser page, `getOutputTimestamp()` plus `outputLatency` covers this. If the engine is native or the screens are remote, send **future timestamps** in a shared clock, using NTP-style offset estimation over WebSocket. Never route the PA feed over Bluetooth or AirPlay.

### Cited Findings
- Visuals should key off the audio clock rather than rAF timestamps. Chris Wilson's metronome queues note times and, in rAF, shows the note whose audio time has passed. — [web.dev audio scheduling](https://web.dev/articles/audio-scheduling)
- Tone.js `Draw.schedule(cb, audioTime)` fires on the animation frame nearest the audio time. — [Tone.js Performance wiki](https://github.com/Tonejs/Tone.js/wiki/Performance)
- In Firefox, `outputLatency*1000 == performance.now() - getOutputTimestamp().performanceTime` held. Chrome's values bounced (an old report). — [WebAudio issue #2461](https://github.com/WebAudio/web-audio-api/issues/2461)
- Web Audio doesn't compensate output latency automatically. Delay visuals by `outputLatency`, read at play time. Measured: AirPods 0.178 s vs built-in about 0.015–0.025 s. — [jamieonkeys](https://www.jamieonkeys.dev/posts/web-audio-api-output-latency/)
- On macOS the native output latency comes from `kAudioDevicePropertyLatency`, `kAudioDevicePropertySafetyOffset` and `kAudioStreamPropertyLatency`. Re-read it when the device or route changes. A flash/click test confirms alignment (within one frame after the fix). — [KitePlayer issue #495](https://github.com/yuroyami/KitePlayer/issues/495)
- cpal 0.18 now folds device latency and safety offset into CoreAudio timestamps. — [docs.rs cpal](https://docs.rs/crate/cpal/latest)
- AirPods: about 160 ms reported vs about 215–220 ms measured, decreasing over time (Apple forum). — [Apple Dev Forums 679274](https://developer.apple.com/forums/thread/679274)
- AAC Bluetooth is about 120–200 ms. — [tonal.fm](https://www.tonal.fm/bluetooth-latency-test)
- AirPlay (Airfoil) has about a **2 s** buffer. — [Rogue Amoeba](https://rogueamoeba.com/support/knowledgebase/?showArticle=Airfoil-AudioLatency)
- Web `outputLatency` may not include the Bluetooth leg (per the jamieonkeys post and the tonal.fm summary). — [tonal.fm](https://www.tonal.fm/bluetooth-latency-test)
- Clock sync over WebSocket: the `timesync` library uses an NTP-like round-trip with half-RTT correction. It can run over WebSocket by overriding `send` and calling `receive`, uses JSON-RPC, and emits a `change` event with the offset (the package is about 4 years old). — [npm timesync](https://www.npmjs.com/package/timesync)
- PeerTime is a transport-agnostic derivative. — [rse/peertime](https://github.com/rse/peertime)
- **Ableton Link** keeps tempo, beat and phase in sync. A timeline is a (beat, time, tempo) triple that maps beats to time. Participants with the same quantum are phase-aligned. The API has `timeAtBeat(beat, quantum)` and `requestBeatAtTime`. — [Link docs](https://ableton.github.io/link/); [Link.hpp](https://github.com/Ableton/link/blob/master/include/ableton/Link.hpp); [LAC 2018 Link paper](https://lac.linuxaudio.org/2018/pdf/42-paper.pdf)
- Browsers can't join Link directly. Bridges include:
  - joymixa-bridge: WebSocket on :20809, broadcasting tempo, beat and phase at 20 Hz. — [joymixa-bridge](https://github.com/Xicnet/joymixa-bridge)
  - browser-sync-ableton-link (Node ws). — [browser-sync-ableton-link](https://github.com/vigliensoni/browser-sync-ableton-link)
  - Carabiner (TCP, EDN messages). — [lib-carabiner](https://github.com/Deep-Symmetry/lib-carabiner)
  - A note from one integration: an https page can't open `ws://` to a LAN device (mixed content). — [ricochet PR #3](https://github.com/MohamedFekryyy/ricochet/pull/3)
- Prior art for driving visuals or lighting from a DJ audio clock: Deep Symmetry's Open Beat Control and beat-link (Pioneer Pro DJ Link to OSC). VirtualDJ's OS2L sends beat and BPM to DMX software. — [open-beat-control](https://github.com/Deep-Symmetry/open-beat-control); [VirtualDJ OSC/ArtNet thread](https://virtualdj.com/forums/256403/VirtualDJ_Technical_Support/VDJ_together_with_OSC_or_ArtNet_for_DMX_control.html)

### Inferences
- **Deterministic wheel trajectory.** The engine returns `{startAt, landAt}` immediately on "Next". The wheel knows its current angle φ0 and the target slot's angle φT, and picks a whole number of extra turns k so the initial speed looks plausible. Total angle is Θ = 2πk + (φT − φ0) and T = landAt − startAt.
  - With constant deceleration: ω0 = 2Θ/T and θ(t) = ω0·t − ½(ω0/T)·t².
  - A "physics" look can come from a custom ease (fast spin-up, long cubic or exponential decay) whose end is pinned at (T, Θ). Add cosmetic pointer flicks or detents along the way, plus a tiny overshoot *after* landAt, so the "stop" frame is exactly the downbeat.
  - T is fixed by the music (5–11 s), so the wheel adapts to the audio, not the other way round.
- **Clock mapping in the same page**: each rAF, call `ts = ctx.getOutputTimestamp()`. The audible context time at rAF time `now` is `ts.contextTime + (now − ts.performanceTime)/1000`. Then t_wheel = that − startAt. This mapping already includes output latency per the spec definition. If it proves jittery in Chrome, smooth it (a linear fit over the last N samples), or fall back to `currentTime − outputLatency`. Add a manually calibrated **display offset** for projector input lag, measured with a flash-and-click test.
- If the wheel window is a separate window on the same Mac (for example a popup moved fullscreen to the projector display), `performance.now()` origins differ per window. Exchange `performance.timeOrigin + performance.now()` (epoch-ms) instead (background knowledge).
- **Native engine**: send `landAt` as engine host time converted to a wall-clock epoch, already including the engine's output latency (Core Audio or cpal timestamps). Browsers convert with the offset estimated by ping-pong (sub-millisecond RTT on localhost, a few ms on Wi-Fi LAN). Because events are announced 5–11 s in advance, network latency doesn't matter; only clock offset accuracy does.
- **Link** is optional. It helps if other music software or lighting must follow the beat, but it adds a bridge process. A simple "timeline triple" (trackPos, atTime, rate) pushed on every change gives the same benefit for the wheel and screens.
- **PA routing**: use a wired interface or the built-in output to the mixer. AirPlay (about 2 s) and Bluetooth (about 150–250 ms, varying over time) make the reported latency unreliable and the projector-to-audio offset visible.

### Gaps
- Projector and TV input lag is unknown and venue-specific. It must be measured on site (flash and click with a phone slow-motion camera).
- No current confirmation of Chrome `getOutputTimestamp()` stability on macOS in 2026.
- I found no published prior art specifically for a "prize wheel that stops on a downbeat".

---

## 6. Communication between the UI and the engine (WebSocket vs OSC vs MIDI vs HTTP; message protocol)

### Takeaway
Use **WebSocket with JSON** between the browser UIs and the engine (or a small local relay server). Browsers speak it natively, it is bidirectional for events, and it works across devices on the LAN. Use OSC only at the edge to talk to OSC-speaking software (Ableton, VirtualDJ, SuperCollider). Web MIDI is useful only for a physical "Next" button or pad. HTTP suits only one-shot commands or health checks. Every event carries **absolute future timestamps in a shared clock** plus a timeline anchor, rather than streaming every beat.

### Cited Findings
- AbletonOSC, VirtualDJ OSC, Sonic Pi and SuperCollider all use OSC over UDP. — [AbletonOSC](https://github.com/ideoforms/AbletonOSC); [VirtualDJ options](https://virtualdj.com/manuals/virtualdj/appendix/optionslist.html); [Sonic Pi OSC tutorial](https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/doc/tutorial/12.1-Receiving-OSC.md); [Nick Collins SC timing](https://composerprogrammer.com/teaching/supercollider/sctutorial/8.1%20Precise%20Timing%20in%20SC.html)
- Browser-to-Link and browser-to-native integrations use a local WebSocket bridge, for example 20 Hz state broadcast with tempo, beat, phase and transport. — [joymixa-bridge](https://github.com/Xicnet/joymixa-bridge)
- `timesync` can run over an existing WebSocket for clock offset. — [npm timesync](https://www.npmjs.com/package/timesync)
- An https page cannot open `ws://` to a LAN device (mixed content). Serve the UI over http on the LAN, or use wss. — [ricochet PR #3](https://github.com/MohamedFekryyy/ricochet/pull/3)
- On macOS 14+, a WKWebView-based app (Tauri) needs `NSAllowsLocalNetworking` to reach `http://127.0.0.1`. — [bandmate #1218](https://github.com/xKirtle/bandmate/issues/1218)
- VirtualDJ shows the subscription pattern: subscribe to a value and get pushed updates when it changes. — [VirtualDJ options](https://virtualdj.com/manuals/virtualdj/appendix/optionslist.html)

### Inferences
- **Transport choice:**
  - **WebSocket** for UI ↔ engine (browser-native, bidirectional, ordered, reliable).
  - **OSC/UDP** only where the engine is third-party software. A small Node relay (for example `osc` or `node-osc` npm packages) translates to and from WebSocket.
  - **MIDI** (Web MIDI in Chrome, or the IAC bus) for hardware buttons or for driving Mixxx.
  - **HTTP** for `/health` and asset upload only.
- **Message design principles**: (1) commands are intent, not timing; the engine decides the timing. (2) The engine replies with scheduled absolute times in a shared clock (epoch-ms, or engine time plus a published offset). (3) Send beat grids once per track and let clients compute beats locally from an anchor `(posSec, atTime, rate)`, re-sent on every change: play, pause, rate ramp or seek. This is Link's (beat, time, tempo) idea. (4) Use idempotent IDs, so a reconnecting UI can ask for a full `state` snapshot.
- **Suggested protocol (JSON over WS):**
  - Clock: `{"type":"clock.ping","t0":<clientEpochMs>}` → `{"type":"clock.pong","t0":..,"t1":<engineRecv>,"t2":<engineSend>}`. The client keeps the lowest-RTT samples.
  - Commands (UI → engine):
    - `{"type":"cmd.next","reqId":"..."}`
    - `{"type":"cmd.back"}`, `{"type":"cmd.play"}`, `{"type":"cmd.pause"}`
    - `{"type":"cmd.setMode","mode":"fast"|"hype"|"auto","roundProgress":0..1}`
    - `{"type":"cmd.setTransitionOverride","style":"cut"|"echoOut"|"filterSwap"|"loopRollBuild"|"beatmatchBlend"}`
    - `{"type":"cmd.panic"}` (instant safe fade or stop)
    - `{"type":"cmd.preloadStatus?"}`
  - Events (engine → UIs):
    - `{"type":"state","seq":n,"current":{trackId,posSec,atMs,rate,playing},"next":{trackId,ready:true|false,renderProgress},"mode":...}` on connect and on change.
    - `{"type":"track.grid","trackId":..,"bpm":..,"downbeatsSec":[...],"phrases":[{startSec,label}],"key":"8A"}` once per track.
    - `{"type":"transition.scheduled","id":..,"reqId":..,"from":trackA,"to":trackB,"pressAtMs":..,"startAtMs":..,"landAtMs":..,"durationMs":..,"style":"loopRollBuild","landing":{"trackPosSec":..,"bar":..,"section":"drop"},"wheel":{"targetIndex":..}}`. This is the key message for the wheel.
    - `{"type":"transition.cue","id":..,"atMs":..,"what":"riser"|"filterSweepStart"|"echoThrow"|"impact"}` for optional light or visual cues.
    - `{"type":"transition.landed","id":..,"atMs":..}`, sent after the fact for confirmation and logging.
    - `{"type":"transition.cancelled","id":..,"reason":..}`
    - `{"type":"timeline","trackId":..,"posSec":..,"atMs":..,"rate":..}` on every rate, pause or seek change.
    - `{"type":"beat","bar":..,"beat":..,"atMs":..}` optional, low-rate. Clients can derive beats from grid and timeline.
    - `{"type":"engine.health","xruns":n,"cpu":..,"outputLatencyMs":..}`

### Gaps
- No source compares WebSocket vs OSC latency or jitter on a LAN. On the same machine both are sub-millisecond (general knowledge, not measured here).
- Web MIDI availability and permissions in Chrome 2026 were not re-verified.

---

## 7. Recommended primary architecture and fallback for a fast proof of concept

### Takeaway
**Primary: a browser-only engine is viable.** Run Web Audio in Chrome (kiosk, or Electron for launch flags) in the *same page that renders the wheel* on the laptop driving the projector. Add an offline Python/CLI pipeline that pre-analyzes every song and pre-renders time-stretched incoming heads with Rubber Band R3. The admin UI (React) talks to it through a tiny local WebSocket relay. **Fallback A (reliability):** move the identical timeline model into a separate native engine process (Swift/AVAudioEngine, or Node + node-web-audio-api reusing the same code), keeping the same WS protocol. **Fallback B (dev time for fancy FX):** Ableton Live 12 + AbletonOSC (patched with `create_audio_clip`), driven from the same Node relay.

### Cited Findings
- Web Audio schedules sample-timed starts and offsets on an audio thread that is immune to main-thread stalls. — [web.dev](https://web.dev/articles/audio-scheduling); [MDN start()](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)
- Signalsmith Stretch's official MIT WASM/AudioWorklet build covers live stretching within 0.75–1.5x. — [npm signalsmith-stretch](https://www.npmjs.com/package/signalsmith-stretch)
- Rubber Band R3 offline gives the highest stretch quality for complex mixes and bass-heavy music (GPL, fine for a private offline pipeline). — [Rubber Band GitHub](https://github.com/breakfastquay/rubberband)
- Audible tabs are exempt from timer throttling. Autoplay can be removed with `--autoplay-policy=no-user-gesture-required` (Chrome) or `appendSwitch` (Electron). — [Chrome background tabs](https://developer.chrome.com/blog/background_tabs); [chrome-autoplay](https://github.com/Hugo22O/chrome-autoplay); [electron #14323](https://github.com/electron/electron/issues/14323)
- `outputLatency` and `getOutputTimestamp` are now available in Chrome, Firefox and Safari 18.4+. — [caniuse](https://caniuse.com/mdn-api_audiocontext_outputlatency); [W3cubDocs](https://docs.w3cub.com/dom/audiocontext/getoutputtimestamp)
- node-web-audio-api runs the Web Audio API natively in Node (Rust core). — [GitHub](https://github.com/ircam-ismm/node-web-audio-api)
- AVAudioEngine supports sample-time-aligned starts across players. — [Apple Dev Forums 14138](https://developer.apple.com/forums/thread/14138)
- AbletonOSC (MIT, Live 11+) exposes launch quantization, the beat listener, tempo and warp mode. `create_audio_clip` exists in the Live 12.0.5+ LOM. — [AbletonOSC](https://github.com/ideoforms/AbletonOSC); [LOM ClipSlot](https://docs.cycling74.com/apiref/lom/clipslot/)
- Tauri/WKWebView has reported audio quirks on macOS, so prefer Chromium for a Web Audio engine. — [stemdeck #38](https://github.com/stemdeckapp/stemdeck/issues/38); [bandmate #1218](https://github.com/xKirtle/bandmate/issues/1218)

### Inferences

**Primary architecture (PoC):**
1. **Offline prep (Python, run before the event, and again in the background for the next song):**
   - Analysis: beat grid, downbeats, phrases and sections, drops, key, loudness. This is covered by a sibling researcher.
   - For each song in queue order, render an "incoming head" (or the full track) with Rubber Band R3 via the CLI, pedalboard, or `ffmpeg -af rubberband`. Its first N bars are time-stretched to the previous song's BPM, followed by a tempo glide back to native.
   - Store WAV/FLAC plus a JSON sidecar (grids at both stretched and native positions).
   - Skip stretching where the BPM ratio falls outside about 0.9–1.1 (or a half/double-time equivalent). Mark those transitions as "non-beatmatched styles only".
2. **Engine and wheel page (Chrome kiosk or Electron)** on the Mac's projector display, with audio out through a wired interface to the PA:
   - Raw Web Audio graph per deck: AudioBufferSourceNode(s) → filter (Biquad HP/LP) → echo send (Delay plus feedback Gain plus LP) → deck gain → master bus (light compressor or limiter via DynamicsCompressorNode) → destination.
   - A decoded-buffer LRU window (previous, current, next, next+1).
   - A **transition planner**. On `next`, pick `landAt` = the earliest musically valid boundary in [press+5 s, press+11 s], preferring phrase boundaries. Pick a style from the mode and round progress plus BPM compatibility. Emit a list of scheduled actions (source starts with offsets, AudioParam ramps, riser sample starts, loop-roll chains) and schedule them all immediately. They are seconds ahead, so main-thread jank is irrelevant.
   - The wheel renders from the audio clock via `getOutputTimestamp()`, with the deterministic trajectory computed backwards from `landAt`.
   - Optional: signalsmith-stretch worklet for live tempo nudges or a "Back" case that has no pre-render.
3. **Local relay server (Node or Bun, about 100 lines)**: serves the admin UI and relays WS messages between the admin UI, the engine page and any extra screens. It is also the clock reference for remote screens.
4. **Admin UI (existing React)**: back, play/pause, next, mode, panic. It shows the engine state and `transition.scheduled` countdowns.
5. **Other screens**: subscribe to the same WS and run the same wheel code. They convert `landAtMs` with their estimated clock offset. A few ms of error is invisible on a TV.

**Why this primary:** it is the fastest path for a web developer. All required DSP except high-quality live stretching is built into Web Audio, and the queue being known turns that one hard problem into an offline batch job. Audio and wheel share one clock in one process, so sync is exact without any network clock sync. The only libraries needed are optional: signalsmith-stretch (MIT) and possibly Tone.js `Draw`.

**Main risks of the primary, and how to cover them:**
- A UI reload or crash kills the music. Keep the admin UI in a *different* page or process from the engine page, and use kiosk mode.
- The autoplay gesture: add a "Start show" click, or use the launch flag.
- Memory: use the sliding-window decode.
- Chrome `getOutputTimestamp` jitter: smooth it, or fall back to `currentTime − outputLatency`.
- Bluetooth or AirPlay outputs: forbid them.

**Fallback A, native engine (if browser reliability is in doubt, or for the "production" version):**
- The engine keeps the same transition-planner and scheduled-action model, and the same WS protocol.
- The wheel then runs in the browser using clock-synced `landAtMs`.
- Easiest port: **Node + node-web-audio-api**, reusing the TypeScript engine almost verbatim. Validate MP3 decoding, AudioWorklet stability (issue #202) and xrun behavior first.
- Most robust on a Mac: **Swift + AVAudioEngine**. Use AVAudioPlayerNode per deck with sampleTime scheduling, Apple's EQ, delay and reverb units, and offline-rendered stretched heads, so AVAudioUnitTimePitch is only for small nudges.
- Rust (cpal 0.18 + kira 0.12 clocks and tweens + signalsmith-stretch-rs) is equally viable if the developer prefers Rust.

**Fallback B, existing software (if dev time for fancy FX is the bottleneck):**
- Ableton Live 12 as the audio engine:
  - 77 songs pre-warped.
  - Per-transition FX racks with macros.
  - Launch quantization set to 1 or 2 bars (or 4 bars in hype mode).
  - AbletonOSC (plus a `create_audio_clip` patch) driven by the Node relay.
- The relay computes `landAt` from `current_song_time`, tempo and the quantization grid, and publishes `transition.scheduled` to the wheel.
- Expect looser landing precision than the custom engine. It needs measurement, probably tens of milliseconds unless Live's timing is calibrated.
- Mixxx and VirtualDJ are not recommended for this use: no official network API in stable Mixxx, a paid PRO license for VirtualDJ OSC, and neither offers timestamped scheduling feedback.

**PoC sequencing suggestion:**
1. Two decoded songs, plus "next" with an echo-out-and-cut transition landing on a downbeat, plus a wheel stopping on it (validates the clock mapping).
2. Add offline Rubber Band head renders and a beatmatched blend.
3. Add the style ladder (fast to hype) and build-up FX.
4. Run a stress test: a 2-hour soak with the UI reloading, a second display attached, and CPU load. Count xruns and glitches.

### Gaps
- No direct reliability comparison (xrun rates) between Chrome Web Audio and AVAudioEngine on Apple Silicon over long sessions. This needs the PoC soak test.
- The recommendation's render-time and landing-precision figures for Fallback B are estimates, not measurements.
- I did not research DJ-software engineering talks or blogs (for example Mixxx engine internals, or Serato/djay architecture) in this pass. That is a possible source of further prior art.
