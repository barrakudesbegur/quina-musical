# DJ techniques catalog for the mixer

What real DJs and producers do at a transition, turned into recipes the planner can draw. Written 2026-11-24 from DJ and production guides (sources at the end, all opened). It follows [GLOSSARY.md](../../../GLOSSARY.md) and [mixer-design-decisions.md](../../../docs/mixer-design-decisions.md). Fundamentals (phrasing, gaps, roll timings, harmonic mixing) are in `research_notes/Bingo DJ mixer research/dj_technique.md` and are not repeated here.

This catalog adds 19 techniques (D1–D19) to the ones built so far: R1 slam cut, R2 echo-out, R4 loop roll, R5 brake/spinback, R6 reverb wash, R7 build & land, R8 Blend, R10 power-down, Suspense and FADE. Decoys are being built separately (`DecoyEvent`), so none of the entries below uses another song.

## How to read an entry

**Times.**
- **T** is the Landing: B's hook downbeat sounds and the drum locks.
- **P** = T − pickup. B is fully open from P.
- **G** = P − gap, the start of the silence, with the gap in B beats from the Phase's `gapBeats`.
- `a` and `barA` are A's beat and bar at its exit downbeat. `b` and `barB` are B's (`gB.beat`, `gB.bar`).
- `e` is A's exit downbeat in S2. "A-bar −1" is the last A bar before T.

**Shapes.**
- **S1** rides A and lands on its downbeat.
- **S2** lets A exit and then builds on B's grid.
- **S3** layers B (stretched to A's tempo) under A.

**Notation.**
- `rand{…}` is drawn per Transition, for variety.
- `phase{E, M, L, F}` scales with the Phase: early, mid, late, final.
- Levels follow `recipes.ts`: deck gains are linear, synths are in dB like `buildLayers`, and impact levels run 0.45–0.9.

**Kind.**
- A **recipe** owns A's exit and B's landing, and enters the rotation with a family.
- A **layer** decorates any compatible recipe. It is drawn with a Phase chance, the way Signatures and Teases are today.

Splitting recipes from layers is the main structural suggestion here. It multiplies variety without multiplying recipes.

**Pick** lists the shape, the tempo class, whether keys must be compatible, whether stems are needed, the Phases, the family and the kind.
- **Tempo classes:** tight (±4%, 20% of ordered pairs), direct (±8%, 36%), none (63%).
- **Keys:** "key —" means keys don't matter.
- **Melodic blends** fit about 7.5% of pairs, so techniques that work with tempo "none" are worth the most.

**Show context.** This is a party crowd at a Catalan family music bingo, with a projector drum and two presenters who talk over the music.
- The best moves make the next song recognisable (Teases), give the room something to shout or clap, and stay short and clean under speech.
- Long melodic washes and exposed artefacts are the main dangers.

## Ranking at a glance

The ranking weighs value for this show first, then feasibility.

| # | Technique | Group | Kind | Shape | Tempo | Key | Stems | Phases | Family | Value | Effort |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Trans gate and pump | a | recipe + exit | S1 | any | — | — | E M L F | gate | high | tiny |
| D2 | Stop-time hits and the crowd gap | a | recipe | S1 | any | — | (RMS) | E M L F | hits | high | tiny |
| D3 | Spiral echo-out | a | recipe + exit | S1 | any | — | — | E M L F | spiral | high | tiny |
| D4 | Half-time → double-time build | a | bridge pattern | S2 | any | — | — | M L F | build | med | tiny |
| D5 | Riff bed | a | layer | S2 | any | — | Signature | M L F | — | med | small |
| D6 | Fake drop | a | recipe | S2 | any | — | opt. | L F | fake | med | small |
| D7 | Pitch-up rush | a | recipe | S1 | any | — | — | M L | pitch | med | tiny |
| D8 | Stem peel (strip-down, acapella-out, vocal throw) | b: P1 | recipe | S1 (S2) | any | — | A | E M L F | strip | high | small after P1 |
| D9 | Ghost Tease | b: P1 | layer | S1 S2 | any | guarded | B | M L F | — | high | tiny after P1 |
| D10 | Drum swap | b: P1 | recipe | S3 | ±8% | — (bass: yes) | A + B | E M L F | swap | high | small after P1 |
| D11 | Vocal-chop stutter build | b: P2 | recipe / layer | S2, S1 gap | any | — | B voc / call | E M L F | chop | high | small |
| D12 | Pre-verb swell into the hook | b: P3 | layer | all | any | B's own | opt. | E M L F | — | high | small |
| D13 | Clap-along build | b: P4 | bridge pattern | S2 | any | — | — | E M | build | med | tiny |
| D14 | Tape start into the hook | b: P5 | landing variant | all | any | — | — | M L F | stop | med | small |
| D15 | Instrumental braker | b: P1 | recipe | S1 | any | — | A voc | M L F | stop | med | small after P1 |
| D16 | Acapella-in mashup | b: P1 | recipe | S3 | ±4% | required | A + B | M L F | swap | high but rare | small after P1 |
| D17 | Meet-in-the-middle tempo ride | c | enabler | S3 | ±16% | as layered | — | all | — | med | big |
| D18 | Key-shifted layers | c | enabler | S3 | ±4–8% | made compatible | B | all | — | med | med–big |
| D19 | Scratch-in | c | recipe / layer | S2, S1 gap | any | — | B call | M L F | scratch | med | big |

---

## (a) Buildable now with existing primitives

### D1 · Trans gate and pump

Sources: [Garnish: Beat FX "Trans"](https://edu.garnishmusicproduction.com/dj-mixer-effects-colour-fx-beat-fx-slip-mode/) · [Future Sound Academy: trance gate and pump shapes](https://www.futuresoundacademy.com/blog/free-shaperbox-alternatives-2026) · [Crossfader: GRV6 "Drum Trans"](https://wearecrossfader.co.uk/blog/ddj-grv6-review/)

**What.**
- **In DJ terms:** the Pioneer Trans Beat FX is a gate that chops the outgoing track in time, and the "trance gate" is the producer's 1/16 square shape at about 80% mix.
- **Its sibling, the pump:** a sidechain-style duck on every beat that recovers over about 70% of the beat.
- **In our engine:** dense `set`/`ramp` events on `A.gain` on A's grid, plus an `A.hpf` sweep, a riser and an optional `kicks` synth for the pump. No new primitive: a two-bar ladder is about 40 gain edges.

**Spec** (S1, `k` A-bars ending at G, s = G − k·barA, `aLeadSec` = k·barA):
- **Mode:** rand{gate 0.5, pump 0.3, gate + pump 0.2}.
- **Gate ladder** (closed depth in brackets):

  | Phase | k | Ladder | Closed depth |
  |---|---|---|---|
  | E | 1 | rand{[1/8 for 2 beats, 1/16 for 2 beats], [1/4 for 1 beat, 1/8 for 1 beat, 1/16 for 2 beats]} | −15 dB (a partial gate keeps the groove) |
  | M | 1 | [1/8 for 2 beats, 1/16 for 1 beat, 1/32 for 1 beat] | −24 dB |
  | L | 2 | [1/4 for 4 beats, 1/8 for 2 beats, 1/16 for 1 beat, 1/32 for 1 beat] | SILENT |
  | F | 2 | as late | SILENT, plus `bus.hpf` 10 → 300 Hz over A-bar −1 |

  - The duty cycle is rand{0.5, 0.6}, and every step opens on its grid point.
  - Each edge is a 2 ms linear ramp: never a bare `set`.
  - The pattern is rand{straight 0.8, "3-3-2" 0.2}. In 3-3-2 only steps 1, 4 and 7 of each 8 are open, for one beat.
- **Pump:** on each A beat, `A.gain` drops to the depth in 5 ms and recovers to A's level with an `exp` ramp by 0.7·a.
  - The depth goes from −6 to −14 dB across the k bars, and the last beat pumps in eighths.
  - `kicks` sound on each beat at 0.35 → 0.55 and stop on the last beat.
- **Always:**
  - `A.hpf` 20 → rand{300, 500, 800} Hz, exp over the k bars.
  - A riser (noise, 800 → 9000 Hz, from −36 dB to phase{−12, −10, −8, −6} dB).
  - A swell over the last 2 A beats.
  - `A.gain` SILENT at G, then `landB`.
- **Also an S2 exit** ("gate", in R7's `exits`): one bar, mid ladder, ending at e.

**Pick:** S1, and an R7 exit · tempo any · key — · stems — · E M L F · family `gate` · recipe.

**Risk → guard.**
- **Clicks:** use 2 ms ramps on every edge.
- **Low-end buzz at 1/16 and 1/32** (amplitude-modulation sidebands): `A.hpf` must be ≥ 250 Hz before the 1/16 stage starts.
- **Dropouts over a sparse A:** gating a bar without drums sounds like dropouts. If A's drums RMS in those bars is below the song's median − 9 dB, use the pump with kicks instead.
- **Perceived level dip:** add +1 dB on the open steps.

### D2 · Stop-time hits and the crowd gap

Sources: [Second Song: the "silence trick"](https://www.second-song.com/wedding-dj-secrets-how-to-keep-the-dance-floor-packed-all-night) · [MusicRadar: build 'n' gap, overshooter](https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop) · [Plugg Supply: gap lengths](https://plugg-supply.net/articles/snare-rolls-and-build-ups)

**What.**
- **In band terms:** "stops", where the band plays only short hits on chosen beats with silence between: *pam · pam · pam · … HOOK*.
- **For this show:** wedding DJs drop the music for one beat in a sing-along so "the crowd fills it in". Here the silences are where the room shouts "eh!".
  - It is the moment the presenter made by hand last year, which the decisions ask the system to create.
- **In our engine:** `A.gain` stab envelopes on A's beats, `kicks` and a `thunk` sample on each stab, a reverb ring on the last stab, and a forced gap. No new primitive.
  - Optionally, the drum "clunks" one card per stab. That needs a small protocol event for drum ticks, and is not required.

**Spec** (S1; A's last-bar beats are β1…β4 = T − 4a … T − a; A plays normally before the first stab):
- **Patterns:**

  | Phase | Stabs | What you hear |
  |---|---|---|
  | E | β1 β2 β3 | three hits, then silence to P |
  | M | β1 β2 β3 β3½ | rand with E's pattern |
  | L | A-bar −2: β3 β4; A-bar −1: β1 β2 β3 | two bars |
  | F | β1 and β3 of A-bar −2, then β1 β2 β3 of A-bar −1 | the drum crawls in the 2-beat gap |

- **Each stab:** `A.gain` opens in 3 ms, holds rand{0.2, 0.3}·a and closes in 30 ms, with `A.hpf` at 20 Hz (full body).
  - `kicks` at 0.55 and `sfx('thunk', −12 dB)` sound on each stab.
- **Last stab:** `A.reverbSend` 0.4, so it rings. `reverb.return` fades out by P.
- **Silence between stabs:** nothing. A riser at −30 dB is allowed only with rand 0.3 in late.
- **Gap:** at least 1 B beat, whatever the Phase's `gapBeats`; final uses 2. Then `landB`, whose impact gets +0.1 level.

**Pick:** S1 · tempo any · key — · stems: none, but A's drums RMS per bar decides how loud the kicks must be · E M L F · family `hits` · recipe (theatrical in the L and F patterns).

**Risk → guard.**
- **A limp stab** on a beat without a transient (a vocal-only bar): layer `kicks` at 0.7 and the thunk, and snap each stab to the analysed beat time.
- **Gimmick through repetition:** at most 1 in 6 Transitions, and never twice within 4.
- **Presenters talking through it:** the gaps lose their point. Give the console a "crowd moment" preference that raises D2's weight for the next Next.

### D3 · Spiral echo-out

Sources: [Garnish: Beat FX "Spiral", an echo that rises in pitch as it feeds back](https://edu.garnishmusicproduction.com/dj-mixer-effects-colour-fx-beat-fx-slip-mode/) · [DJ TechTools: the improv echo freeze](https://djtechtools.com/2012/05/13/6-clever-ways-to-easily-transition-between-multiple-djs/)

**What.**
- **In DJ terms:** Pioneer's Spiral. A's last beat is caught in the echo, A's dry signal leaves, and the repeats accelerate and climb in pitch into a swirl that is cut dead before the hook.
- **In our engine:** the echo is a `DelayNode`, whose `delayTime` is a-rate. Ramping `echo.time` down resamples every pass through the loop by 1 − d(delayTime)/dt, so the pitch shift is real: a true spiral with existing params (`echo.time`, `echo.feedback`, `echo.hpf`, `echo.return`, `A.echoSend`).

**Spec** (S1, k = phase{1, 1, 2, 2} A-bars, s = G − k·barA):
- **At s:**
  - `echo.time` = rand{1/2, 3/4, 1}·a.
  - `echo.feedback` 0.55 → phase{0.7, 0.75, 0.8, 0.85} by G.
  - `echo.hpf` 300 Hz and `echo.return` 1.
  - `A.echoSend` 0 → 0.8 over a/2.
- **A's dry exit:** `A.gain` → SILENT over one beat, ending at s + 2a (k = 1) or s + barA (k = 2), so the spiral is heard alone.
- **The spiral:** `echo.time` exp-ramps to rand{1/16, 1/12}·a from A's dry exit to G.
  - Near the end each pass rises about 3–7 semitones.
  - `echo.hpf` 300 → rand{1500, 2500} Hz over the same span.
- **At G:**
  - `echo.return` → SILENT in 5 ms, and `echo.feedback` 0 at G + 10 ms, which flushes the loop within one short delay.
  - At G + 50 ms `echo.time` goes back to 0.25 s, and `echo.return` goes back to 1 after P + 0.3 s.
- **Then:** a swell over the last 2 A beats, and `landB`.
- **Variant "spiral down"** (rand 0.25, and only as an R7 exit followed by the bridge): the delay grows from 1/4 to 1·a, so the repeats fall. A falling pitch right before a landing deflates it.

**Pick:** S1, and an R7 exit · tempo any · key — (A is cut at G) · stems: optional (a spiralled A Signature throw) · E M L F · family `spiral` (count it as echo-like, so not three echo-like moves in a row) · recipe.

**Risk → guard.**
- **Harsh runaway feedback:** feedback ≤ 0.85, `echo.hpf` ≥ 1.5 kHz by the end, and the master limiter.
- **The minimum delay in a Web Audio cycle** is 128 frames (about 2.7 ms), far below the 1/16-beat floor.
- **A click at the cut:** use the 5 ms ramp.
- **A linear ramp sounds too tame:** use `exp`.

### D4 · Half-time → double-time build (R7 bridge pattern)

Sources: [EDM Ghost Production: half-time and double-time](https://edm-ghost-production.com/dj-knowledge-base/half-time-and-double-time-explained) · [MusicRadar: the roll-out](https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop) · [Plugg Supply: roll stages](https://plugg-supply.net/articles/snare-rolls-and-build-ups)

**What.**
- **In production terms:** half-time "works best in short bursts that build tension". The bridge opens heavy and spacious, with the kick on 1 and the snare on 3, then snaps to straight time and rolls up into the gap.
- **Why it matters:** it replaces R7's always-identical accelerating roll with a contrast.
- **In our engine:** `kicks` (times), and two `snareRoll` events.
  - A one-stage roll with `stages: [4]` starting on beat 3 puts a snare on every bar's beat 3.
  - Then a normal accelerating roll.
- No new primitive.

**Spec** (S2, bridge n ≥ 2 B bars from e; otherwise classic R7):
- **Bars 1…h, h = rand{1, ⌊n/2⌋}:**
  - `kicks` on beat 1, and rand 0.5 also on 2½.
  - `snareRoll{t0: e + 2b, t1: e + h·barB, stages: [4], velFrom 100, velTo 110, pitchTo 0}`.
  - A downlifter over bar 1 at −18 dB, and the riser starting at −36 dB.
- **Bar h+1** (if any before the last bar): straight time, with the snare on every beat (`stages: [1]`) and kicks on every beat. This is where a stem Tease of B's drums enters: "double time arrives".
- **Last bar:** `stages: [0.5, 0.25, 0.125]` with `pitchTo` from the Phase's `snarePitch`, and `bus.hpf` 10 → 380 Hz as in `buildLayers`. Then the gap and `landB`.

**Pick:** S2 · tempo any (B's grid) · key — (A has left) · stems: optional (B's drums Tease from bar h+1) · M L F · family `build`, a bridge pattern · R7 variant.

**Risk → guard.**
- **The half-time bar sounds like the energy died:** keep the riser running and the kicks at 0.6.
- **Kick lows mudding the presenters:** keep the kicks above 40 Hz and at most 0.6.

### D5 · Riff bed (B's intro riff loops under the bridge)

Sources: [Digital DJ Tips: drop the next track's beat or a recognisable loop over a breakdown](https://www.digitaldjtips.com/5-ways-to-deal-with-a-long-breakdown-that-isnt-working/) · [Crossfader: "Toneplay" (an isolated lead repeated from a hot cue)](https://wearecrossfader.co.uk/blog/12-high-energy-dj-transitions/)

**What.**
- **In DJ terms:** a DJ fills a gap with a "beatgridded and instantly recognisable" loop.
- **Here:** an approved `riff` Signature of B (two bars of its instrumental intro) loops on B's grid as the bridge's bed, so the room recognises B before the hook. It is a strong, clean Tease.
- **In our engine:** consecutive `signature` events, one per riff length, anchored on B's bar lines.
  - Signatures route to `signatureOut` → music bus, past the deck filters. So today the riff can be shaped only by `bus.hpf`.
  - Sending `signatureOut` through B's HPF/LPF is a one-line routing change that makes a low-pass opening possible.

**Spec** (S2 bridge of n ≥ 2 B bars, riff length r = 2 bars usually):
- Loops run from the first B bar line ≥ e until G.
- If (G − e) isn't a multiple of r·barB, the first loop starts mid-riff, so the riff's last bar ends at G (its phrase end meets the Landing).
- **Gain:** phase{—, −8, −7, −6} dB against `signatureDb`. The last loop fades out at G in 10 ms.
- The R7 build plays on top, with the snare roll at −15 velocity so the riff speaks.
- **Variants:** rand{dry; echo throw (0.4) on its last beat; D1 gate on its last bar}.

**Pick:** S2 · tempo any · key — · stems: an approved riff Signature (ten songs have Signature candidates of any kind today) · M L F with chance phase{0, 0.3, 0.5, 0.6} · family-neutral, counts as a Tease · layer.

**Risk → guard.**
- **Seam clicks:** cut on bar lines with 5 ms fades.
- **A riff nobody knows:** only approved riffs play.
- **Overlap with D11 or a Signature call:** at most one B Signature per Transition, as today.

### D6 · Fake drop (the overshooter)

Sources: [Plugg Supply: fake drop, once per track at most](https://plugg-supply.net/articles/snare-rolls-and-build-ups) · [MusicRadar: overshooter and time extender](https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop)

**What.**
- **In production terms:** the build peaks and silence opens where everyone expects the hook. Instead comes one bar of something unexpected, then a short second build and the real landing.
- **For a family crowd:** the surprise bar can be a comedy SFX (`spongebob-boowomp`, `duck-quack`, `anime-wow`), B's drums alone, or A's last bar coming back.
- **Not a Decoy:** no other song plays.
- **In our engine:** R7 machinery split in two (`buildLayers` twice), `stems` or `sfx` for the fake bar, and `impact`.
  - The drum keeps spinning. A drum near-stop at the fake gap would reuse Suspense's crawl, which is drum work and optional.

**Spec** (S2, needs G − e ≥ 3 B bars):
1. Build [e, F], with F = T − 2·barB − gap, then a 1-beat silence at F.
2. The fake bar [F + b, F + b + barB]:
   - `bus.hpf` back to 10 Hz and an impact at 0.5.
   - Content rand{B's drums stem for one bar 0.4, comedy SFX + kicks 0.3, A slices of its last bar 0.3}.
3. A fast re-build over the next bar: `snareRoll` stages [0.25, 0.125] and `pitchTo` snarePitch + 2, the riser −20 dB → loud + 2 dB, and `bus.hpf` 10 → 500 Hz.
4. The Phase gap, then `landB` with the impact one step bigger.

**Pick:** S2 · tempo any · key — · stems: optional · L F only · at most once per climb, and only when the Spin is long enough · family `fake` · recipe, theatrical.

**Risk → guard.**
- **The crowd thinks it landed:** never use B's mix or hook in the fake bar. Only while the drum visibly spins.
- **It costs about 2 bars of Pace:** the planner checks the Spin window.
- **Twice is annoying:** the per-climb cap.

### D7 · Pitch-up rush

Sources: [Richard Pryn: tempo-automation riser, "keep it short"](https://richardpryn.com/risers-the-easiest-way-to-create-tension-in-your-music/) · [Garnish: Beat FX "Pitch"](https://edu.garnishmusicproduction.com/dj-mixer-effects-colour-fx-beat-fx-slip-mode/)

**What.**
- **In production terms:** A becomes the riser. Its tape speed climbs, raising pitch and tempo together, with the high-pass opening, then a breath of silence and the hook. This is the "tempo riser" of producers.
- **In our engine:** `A.rate` (exp ramp), `A.hpf` and a noise riser. No new primitive.

**Spec** (S1, k = phase{—, 1, 1–2, —} A-bars, s = G − k·barA):
- `A.rate` 1 → 2^(st/12), with st = phase{—, +3, +4, —} ± rand 1 (so at most +5), exp, so most of the rise is in the last beat.
- `A.hpf` 20 → rand{400, 700} Hz. `A.gain` +1 dB, then SILENT over 30 ms before G.
- A runs ahead of its grid by about k·barA·(r − 1)/2, roughly 0.1–0.3 beat. So the planner forces gap ≥ 0.5 B beat, and the riser carries the timing.
- **Variant:** rand 0.3 in late puts a D1 gate ladder on top of the rush.

**Pick:** S1 · tempo any · key — · stems — · M L · family `pitch` · recipe, theatrical.

**Risk → guard.**
- **Chipmunk vocals:** cap at +5 semitones, and prefer bars where A's vocals RMS is low. Mild comedy is fine at a family show; never use it in final.
- **Off-grid drift:** the forced gap.

---

## (b) Needs a small new primitive

### The primitives

**P1 · Stem lanes on either deck.** Generalise the B-only `stems` event:

```
{ kind: 'stemLane', deck, part: drums|bass|vocals|other, at, until, direct: Env, echo?: Env, reverb?: Env, rate?: Ramp }
```

- **Direct gain** goes into the deck's trim, before its filters, fader and sends. A *negative* direct gain subtracts that part from the playing mix:
  - A without drums = A.mix − 2·drums (the stems are stored at half scale).
  - This is exact here: stems and `mix.flac` are sample-aligned 48 kHz FLAC, and `other` is defined as the remainder.
  - Lanes start with the same `when` grid as the main source, so subtraction stays sample-exact.
- **Send gains** let one part go to the echo or reverb alone (a vocal throw, a ghost).
- **`rate`** mirrors A's rate automation when A brakes.
- **Effort:** small to medium. One `AudioBufferSourceNode` per lane, two or three gains, a coverage check, and a pipeline test.
  - The test plays mix − 2·drums + 2·drums offline and expects a residual below −60 dB.
- **Guards:**
  - A's position stays inside its stems window [hook − 32, hook + 48] s, minus 0.5 s.
  - After a long slot or a Hold, A may be past it: then fall back.
  - A's rate is 1, or the lane carries the identical rate schedule.
  - Lanes stop with A.

**P2 · Slices from any buffer.**
- Today `slices` re-trigger A's mix only. Add `source: {deck, part: mix|drums|bass|vocals|other} | {signatureId}`, and per-slice `rate`, `fadeMs` and optional `hpf`.
- **Effort:** small.

**P3 · Pre-verb render.**
- At decode time, an `OfflineAudioContext` reverses a short excerpt, convolves it through the existing noise impulse response (RT60 rand 1.5–3 s, 100% wet), and reverses the result.
- The buffer is cached per (song, hook): about 0.1 s of CPU.
- **Effort:** small.

**P4 · Clap voice.**
- A `claps` synth: three noise bursts 8–12 ms apart, band-pass 1–1.5 kHz at Q 1.5, a 120 ms decay, and a little reverb send. `stomp` is a low kick plus a noise thump.
- Real clap one-shots from an SFX pack sound better, and audio stays out of the public repo.
- **Effort:** tiny.

**P5 · Rate-aware landing.**
- B may start with a `B.rate` ramp, and the planner sets B's start offset to hook − pickup − ∫rate dt, so the pickup still sounds at P at full speed.
- `playbackRate` is k-rate, so the error is at most one render quantum (2.7 ms).
- **Effort:** small (planner math and `Deck.start` with a schedule).

**P6 · Filter resonance.**
- Expose `A.q` and `B.q` (the BiquadFilter Q, fixed at 0.707 today) for resonant sweeps.
- **Effort:** tiny. It is used in the variants at the end.

### D8 · Stem peel (strip-down, acapella-out, vocal throw), needs P1

Sources: [StemSplit: strip-down build-up](https://stemsplit.io/blog/dj-stem-separation-guide) · [Digital DJ Tips: acapella in/out with stems](https://www.digitaldjtips.com/djs-do-not-ignore-stems/) · [Digital DJ Tips: Serato Stems FX pads (vocal echo, instrumental echo, ½ or 1 beat)](https://www.digitaldjtips.com/using-stems-in-serato-dj-pro-all-you-need-to-know/) · [MusicRadar: build 'n' gap](https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop)

**What.**
- **In DJ terms:** A is taken apart in front of the crowd. Its drums go, then its bass, and its singer is left alone, so the room sings along. On the last word the voice is thrown into the echo. Silence, then B's hook lands with full drums and bass.
- **Why it works:** the strip-down → full-band contrast is what makes an EDM landing hit.
- **In our engine:** P1 negative lanes for A's drums, bass and other; a positive echo-only lane for A's vocals; a riser; `landB`.

**Spec** (S1, k = phase{1, 2, 2, 2–4} A-bars before G, s = G − k·barA):
- **Removal order:** rand{
  - drums → bass → other, the "acapella-out" (0.5);
  - other + bass → drums last, "beat only" (0.25);
  - bass → other, leaving vocals + drums, a "drums-and-voice bridge" (0.25)}.
- **Timing:** for k = 1, removals land at s, s + 2a and s + 3a. For k ≥ 2, one removal per bar line or half bar.
- **Each removal:** lane direct 0 → −2 over rand{10 ms (a cut "on the one"), one beat (a slide)}.
- **Once the bed is gone:**
  - `A.reverbSend` 0.15 → 0.35, which masks stem artefacts.
  - `A.hpf` 20 → 120 Hz, against kick bleed in the vocal stem.
- **The throw:**
  - At G − a: `echo.time` rand{1/2, 3/4}·a, `echo.feedback` 0.5.
  - The vocals lane switches to direct −2 (removed) and echo +2 (echo only), so A's dry voice stops and its echo carries on.
  - `echo.return` fades over one B beat after P, as R2 does.
- **Around it:** the riser from s at the Phase's loudness, the gap, and `landB`.

**Pick:** S1, or S2 with a short bridge after the throw · tempo any · key — (A plays alone until the gap) · stems: A (window coverage; vocals RMS in A-bar −1 for acapella-out; drums RMS for the drum-led variants) · E M L F (early: k = 1, cuts only) · family `strip` · recipe.

**Risk → guard.**
- **Exposed Demucs artefacts:** expose one stem for at most 1 bar (2 in late), with reverb and the HPF.
- **The throw clips a syllable:** pick the throw beat where the vocals RMS falls (the end of a line) within the last 2 beats, else throw at G − a/2.
- **Subtraction misalignment:** the P1 pipeline residual test, plus the window guard.

### D9 · Ghost Tease (B's voice in the reverb), needs P1

Sources: [DJ TechTools: reverb spreads the outgoing track so the new one has space](https://djtechtools.com/2017/08/21/tutorial-make-space-dj-mix-new-tracks/) · [MusicRadar: alien swell (wet until chaotic, then dry impact)](https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop) · [EDMProd: heavy reverb pushes a sound back](https://www.edmprod.com/ultimate-guide-build-ups/)

**What.**
- **The sound:** over A's last bars, B's vocal stem feeds only the reverb, at B's own tempo and phase-locked to B's landing. The result is a ghostly, rhythm-free cloud of B's voice behind A, rising until the dry hook bursts out of it at T.
- **Why it matters:** the wash hides any tempo mismatch. So this is the Tease for the 63% of pairs without a tempo match on S1 recipes, which today get no Tease at all.
- **In our engine:** a P1 lane on B (direct 0, reverb send), `reverb.hpf` and `reverb.return`.

**Spec** (span [G − m, G], m = phase{—, 1, 1.5, 2} A-bars, capped by B's stems window):
- **The lane:** B vocals, direct 0, reverb 0 → phase{—, 0.4, 0.5, 0.55} (exp). `reverb.hpf` 400 → rand{700, 1200} Hz.
- **Exit:** the send cuts at G (5 ms). `reverb.return` drops −6 dB at P and is out by T + 2b, as R6 does.
- **Keys incompatible, or confidence < 0.7:** `reverb.hpf` ≥ 1.5 kHz and the send at most 0.3 (air more than pitch).
- **Keys compatible:** rand 0.3 adds a dry vocals lane at −18 dB in the last beat ("the ghost becomes a voice").
- **If B's bars before the hook have no singing** (vocals RMS): use B's `other` lane instead, or skip.

**Pick:** S1 (decorates R1, R2, R4, R5, D1, D3, D7) and S2 · tempo any · key: guarded as above · stems: B · M L F with chance phase{0, 0.4, 0.5, 0.5} · Tease layer.

**Risk → guard.**
- **Mud under the presenters' voices:** HPF ≥ 700 Hz and the send cap.
- **The reverb is shared:** never combine with R6 or another reverb layer in the same Transition.

### D10 · Drum swap, needs P1

Sources: [djay: Neural Mix crossfaders "swap or cut stems between the decks"](https://help.algoriddim.com/user-manual/djay-pro-windows/neural-mix/crossfaders) · [Crossfader: rekordbox Groove Circuit replaces a track's drums](https://wearecrossfader.co.uk/blog/ddj-grv6-review/) · [StemSplit: stepped stem crossfade](https://stemsplit.io/blog/dj-stem-separation-guide)

**What.**
- **The sound:** A's own drums vanish on a downbeat and B's drums, stretched to A's tempo, take their place under A's voice and music. The crowd still sings A, but the groove is already B's. Then A leaves and B lands at its own tempo.
- **Unlike R8:** R8 layers B's drums on top of A's full mix, so two kits play at once. A swap never doubles kicks and hats.
- **In our engine:** P1 (a negative A drums lane), the existing stretched B drums render (`blend`), and R8's exit and landing.

**Spec** (S3, n = phase{1, 2, 2–4, 2–4} A-bars, L = G − n·barA on an A downbeat):
- **At L:** the A drums lane goes to −2 in 10 ms on the downbeat. B's stretched drums 0 → 0.9 over rand{0 (cut on the one), one beat}.
- **Juggle variant** (rand 0.3, n ≥ 2): swap for 2 beats, swap back for 2 beats, then swap for good.
- **Tight pairs with compatible keys (≥ 0.7):** also swap the bass in the last bar (A bass lane −2, B stretched bass in), like R8.
- **Last A bar:** A (now drumless) exits by echo, wash or D8's throw, chosen at random. Riser and swell; B's drums continue up to P; the handover at P; `landB` with the impact covering the tempo jump.

**Pick:** S3 · tempo direct ±8% (drums stretch well; tight for the bass) · key — for drums, required for the bass · stems: A drums window and B's render · E M L F · family `swap` (its own, so the rotation alternates R8 and the swap) · recipe.

**Risk → guard.**
- **Drum ghosts left in A's remainder:** acceptable under B's kit.
- **Flams from a bad grid:** skip if `meta.warnings` is over 30 ms or A has grid flags.
- **B's kick against A's syncopated bassline:** rand{A's bass −3 dB; `A.hpf` 80 Hz} during the swap.

### D11 · Vocal-chop stutter build, needs P2

Sources: [Pro Audio Files: 8th → 16th → 32nd stutter edits](https://theproaudiofiles.com/tips-for-better-buildups-and-drops-in-edm/) · [RysUp: pick the slice; vowels survive, consonants click; tiny fades](https://rysupaudio.com/blogs/news/how-to-make-vocal-stutter-effect) · [Boombox: a vocal chop in the pre-drop gap, with a +12 semitone layer](https://boombox.io/blog/edm-build-ups-beat-drops-how-to-nail-your-transitions/) · [EDMProd: a vocal sample in the silence](https://www.edmprod.com/ultimate-guide-build-ups/)

**What.**
- **The sound:** the next song's first word, chopped and repeated faster and faster — "ca-ca-ca-ca-CARAMEL!" — the classic party-remix intro.
- **Why it matters:** it is the strongest Tease there is. The full word then lands with the hook.
- **In our engine:** P2 slices from B's vocal stem at the pickup, on B's grid, with per-slice rate and fades (Signatures are instrumental since the user's first listen, so never from one).

**Spec** (S2: the last 1–2 B bars before G. S1: only inside the gap, as a 1-beat version that overlaps nothing):
- **The grain:** the first syllable of the call, starting on its onset, length g = rand{1/4, 1/8}·b. Skip ≤ 30 ms of noise-like consonant so the grain starts on the vowel.
- **The pattern** over the last B bar: beats 1–2 at 1/4, beat 3 at 1/8, beat 4 at 1/16 then 1/32 on its second half.
  - **Variants:** rand{that build; "call and repeat": the whole call (one bar), then its last word ×4 at 1/8; "tail stutter": the call's last syllable}.
- **Pitch:** the per-slice rate climbs 1 → phase{1.0, 1.06, 1.12, 1.19}. Rand 0.3 adds a +12 semitone layer (rate 2) at −10 dB in the last beat.
- **Slices:** 3 ms fades and HPF 150 Hz. The gain is `signatureDb` + phase{−1, 0, +1, +2} dB.
- **Under the chops:** the snare roll drops −6 dB.
- **Gap:** phase{0.5, 0.5, 1, 1} beat, then the full word on P and the hook at T.

**Pick:** S2; S1 in the gap only · tempo any · key — (A has left) · stems: B vocals · E M L F · family `chop` · recipe in S2, layer in S1.

**Risk → guard.**
- **Clicks:** onset snapping and 3 ms fades.
- **The wrong syllable** (bleed, breath): list the chosen grain in the analysis report's audition queue.
- **Overuse:** at most 2 bars of chops.

### D12 · Pre-verb swell into the hook, needs P3

Sources: [Kern Audio: reverse reverb — reverse, print wet, reverse back, align the end with the dry start](https://kernaudio.io/guides/reverb/reverse-reverb) · [MusicRadar: alien swell, effects off for a dry impact](https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop)

**What.**
- **The sound:** B's own first word, or its hook's first downbeat chord, played backwards through a reverb. It swells out of nothing and sucks into the Landing, so the hook seems to inhale itself.
- **Why it suits us:** it is B's own pitch material, so it agrees with B's key. It is also a more musical replacement for the generic reverse-cymbal swell that today plays on *every* landing.
- **In our engine:** a P3 render, played as a one-shot like a Signature.

**Spec:**
- **Render length:** L = phase{0.5, 0.75, 1, 1} B-bar, with RT60 ≈ 1.25·L.
- **Source:** rand{B's mix from P to P + 1b (the chord); B's vocals from P to P + 1b, if they sing there}.
- **Placement:** the end of the render sits at P − rand{30, 60} ms (a breath before the pickup). Gain phase{−12, −10, −8, −7} dB, HPF 200 Hz.
- **Overlap with A:** the swell should live in the gap. If the recipe's gap is under 0.5 b, the swell overlaps A's tail. Then A must already be HPF ≥ 400 Hz, or the keys compatible.
- **Variety:** keep the reverse cymbal for rand 0.3 of landings.

**Pick:** all shapes · tempo any · key: B's own; guard any overlap with A · stems: optional · E M L F · family-neutral landing layer.

**Risk → guard.**
- **A hook that starts with a pickup word:** align to P, not T.
- **A swell over an incompatible A bed:** the overlap guard above.
- **A cut-off swell start:** render with a 20 ms fade-in.

### D13 · Clap-along build (R7 bridge pattern), needs P4

Sources: [Digital DJ Tips: clap and act like something big is coming; raise volume every 8 beats](https://www.digitaldjtips.com/5-ways-to-deal-with-a-long-breakdown-that-isnt-working/) · [Pro Audio Files: a clap on 2 and 4 in breakdowns](https://theproaudiofiles.com/tips-for-better-buildups-and-drops-in-edm/) · [MusicRadar: the roll-out](https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop)

**What.**
- **The sound:** a clap pattern on B's grid that the room joins, and the presenters can lead: claps on 2 and 4, then every beat, then eighths into the gap.
- **In our engine:** P4 claps, `kicks`, `snareRoll` for the last beats, and `bus.hpf`.

**Spec** (S2 bridge, n ≥ 2 B bars):
- **Bars 1…n−1:** claps on 2 and 4 rand{plain 0.5; "stomp-stomp-clap" (stomp on 1 and 1½, clap on 2) 0.25; every beat 0.25}.
  - `kicks` on 1 and 3 at 0.4, and a riser from −30 dB.
- **Last bar:** claps on every beat, eighths on beat 4. `snareRoll` [0.25, 0.125] over the last two beats. The `bus.hpf` sweep, the gap and `landB`.
- B's drums stem Tease may replace the kicks, since they share a grid.

**Pick:** S2 · tempo any; outside 90–150 BPM use 2 and 4 only · key — · stems — · E M mostly (participation warms the room early in a Round; late leans on rolls) · family `build`, a bridge pattern · R7 variant.

**Risk → guard.**
- **Cheap synth claps:** use a real clap one-shot.
- **A crowd that doesn't join:** harmless, since it is still a build. Pair it with a console button "clap build next".

### D14 · Tape start into the hook, needs P5

Sources: [MusicRadar: VPS Tapestop, power-up 450 ms and power-down 2500 ms](https://www.musicradar.com/how-to/how-to-create-a-classic-turntable-stop-effect-with-vengeance-sound-vps-tapestop) · [Attack Magazine: tape stop curves and timing](https://www.attackmagazine.com/technique/tutorials/creative-tape-stop-effects/)

**What.**
- **The sound:** B doesn't just start, it powers up. Its pickup winds from a growl to full speed exactly at P, like a turntable switched on.
- **Best uses:** after R5's brake, R10's power-down or D2's hits. "Stop → silence → power-up" is a complete gag.
- **In our engine:** a P5 `B.rate` ramp, `B.lpf` and `B.gain`.

**Spec:**
- B starts at P − d, with d = rand{0.35, 0.45, 0.6} s. `B.rate` exp 0.25 → 1, reaching 1 at P.
- `B.lpf` 800 Hz → open by P. `B.gain` −12 dB → 0 over d.
- **No D12 swell** with it: both live in the gap.

**Pick:** all shapes · tempo any · key — · stems — · M L F · family `stop` (as a landing variant it may follow R5 or R10) · landing variant.

**Risk → guard.**
- **A long sung pickup** (≥ 1 beat) slurs comically: use it only when the pickup is short or instrumental.

### D15 · Instrumental braker, needs P1 (with lane rate)

Sources: [Digital DJ Tips: Serato's "vinyl brake the instruments only (leaving the vocals)"](https://www.digitaldjtips.com/using-stems-in-serato-dj-pro-all-you-need-to-know/) · [Crossfader: GRV6 Drum Release (backspin, brake or echo on the drums only)](https://wearecrossfader.co.uk/blog/ddj-grv6-review/)

**What.**
- **The sound:** A's band grinds to a halt while its singer carries on, dry and at speed, for half a bar. Then the voice is thrown into the echo, and B lands.
- **How it differs from R5:** R5 stops everything. Here the voice survives.
- **In our engine:**
  - A's main source brakes, exactly as `EXITS.brake` does (rate → 0.02, LPF closing).
  - A −vocals lane carries the *same* rate schedule, cancelling the voice inside the braking mix.
  - A +vocals lane plays at rate 1, then D8's throw.

**Spec** (S1, s = G − barA):
- The brake over rand{0.75, 1}·barA from s.
- The +vocals lane runs from s to G − a/2, then goes echo-only (the throw).
- The gap, then `landB`.

**Pick:** S1 · tempo any · key — · stems: A vocals (RMS present in A-bar −1) · M L F · family `stop` · recipe, theatrical.

**Risk → guard.**
- **Cancellation:** it needs identical `playbackRate` schedules on the mix and the −lane. Both are k-rate and share block boundaries, so test the residual offline.
- **A voice with nothing to sing in that bar:** skip.

### D16 · Acapella-in mashup, needs P1, plus loading B's stretched vocals

The stretch render (`tools/prep/stretch.py --stems`) already writes vocals and other. The engine loads only drums and bass today.

Sources: [Mixed In Key: acapella + instrumental mashups](https://mixedinkey.com/workflows/make-acapella-instrumental-mashups/) · [StemSplit: acapella drop; keys must match; a 1–2 semitone shift widens options](https://stemsplit.io/blog/dj-stem-separation-guide) · [Crossfader: Wordplay and Sample Switch Up](https://wearecrossfader.co.uk/blog/12-high-energy-dj-transitions/) · [Digital DJ Tips: overlapping a few vocals of the incoming song](https://www.digitaldjtips.com/djs-do-not-ignore-stems/)

**What.**
- **The sound:** A's singer drops out, and B's pre-chorus voice, stretched to A's tempo, sings over A's band for 1–2 bars: a live mashup. It resolves naturally into B's own chorus at T, since a pre-chorus leads into a chorus.
- **Rarity:** it is rare, at about 7.5% of pairs, but it is the biggest "wow".
- **The guides' rule:** never two vocals at once, so A's vocals always go.

**Spec** (S3, n = phase{—, 1, 1–2, 2} A-bars, L = G − n·barA on A's downbeat):
- **At L:**
  - The A vocals lane goes to −2 in 10 ms.
  - The B stretched vocals lane 0 → +2 over 1/4 beat, at HPF 150 Hz.
  - `A.gain` −3 dB and `A.hpf` 120 Hz, which makes room (there is no mid EQ).
- **A's drums stay:** groove continuity.
- **Last beat:** A exits (echo or wash). B's vocals continue to P, then the handover (`LAYERING.handoverSec`) and `landB`.

**Pick:** S3 · tempo tight ±4% only (exposed stretched voice) · key required: hook keys compatible with confidence ≥ 0.7 · stems: A vocals and B's stretched vocals (B must sing in the bars before its hook) · M L F, drawn at a high chance whenever eligible · family `swap` · recipe.

**Risk → guard.**
- **Chord clashes** even with compatible keys (Mixed In Key: a compatible key "does not guarantee that the full songs fit"): keep it to 1–2 bars, and let the audition page tag pairs that sound wrong.
- **Stretch artefacts:** the ±4% limit.

---

## (c) Needs bigger work

### D17 · Meet-in-the-middle tempo ride

Sources: [Crossfader: "Wide Syncing" (raise the tempo over 16 bars into the drop) and "Sample Switch Up"](https://wearecrossfader.co.uk/blog/12-high-energy-dj-transitions/) · [Mixed In Key: a master tempo at the midpoint of two songs](https://mixedinkey.com/workflows/make-acapella-instrumental-mashups/)

**What.**
- **The idea:** A's last bars are also stretched (pitch preserved), gliding A's tempo toward the midpoint m. B's layer is rendered at m too, and B lands at its native tempo.
- **Payoff:** layering-prep measured that S3 eligibility grows from 37% to 58.5% of pairs. That feeds R8, D10 and D16.
- **The engine work:**
  - The relay renders A's exit section at Next. A's exit bar depends on the Pace and any Hold, so render it on demand (≤ 1.5 s, with T ≥ 3 s ahead), or pre-render candidate windows at hook + 8 … 40 s.
  - Rubber Band with a time map ramps the ratio 1 → m over 2 bars.
  - The deck switches A's source to the render on a downbeat, with a sample-aligned 5 ms crossfade.
  - The planner gets an S3 on m's grid.

**Pick:** S3 · |Δtempo| ≤ 16% · key: as the layered parts need.

**Risk → guard.**
- **A late render:** fall back to S1 or S2.
- **An audible glide:** keep it over at least 2 bars.

### D18 · Key-shifted layers

Sources: [StemSplit: a 1–2 semitone shift widens options](https://stemsplit.io/blog/dj-stem-separation-guide) · [Crossfader: key-shift a vocal to match (Sample Switch Up)](https://wearecrossfader.co.uk/blog/12-high-energy-dj-transitions/) · [Mixed In Key: Energy Boost (+2 on the Camelot wheel)](https://mixedinkey.com/harmonic-mixing-guide/energy-boost-dj-mixing-tutorial/)

**What.**
- **The idea:** Rubber Band shifts B's stretched bass and vocals by ±1–2 semitones in the same pass, so D10's bass swap and D16's mashup reach far more pairs.
  - Layering-prep measured that ±1 semitone makes 59% of matchable pairs key-compatible, and ±2 makes 91%.
- **At the landing:** B returns to its native key, and the gap and impact mask the jump.
  - Prefer shifts that make the landing go *up* (+1 or +2, like Mixed In Key's Energy Boost). A downward jump deflates.
- **The engine work:** `stretch.py --pitch`, the cache key, the planner's key search, and an audition approval for shifted voices. The work is mostly ears, not code.

**Pick:** S3 · tight or direct · key: made compatible.

**Risk → guard.**
- **Formant artefacts beyond 1 semitone:** use R3 formant preservation, and voices at ±1 only.

### D19 · Scratch-in

Sources: [djlearn.de: baby scratch, one push and one pull per beat on a hard-attack word](https://djlearn.de/en/how-to-scratch) · [DJ TechTools: "Magic Scratch" (noise + crossfader + echo)](https://djtechtools.com/2012/05/13/6-clever-ways-to-easily-transition-between-multiple-djs/)

**What.**
- **The sound:** B's first word scratched back and forth in rhythm over the last 1–2 beats, then released into the hook. It is the open-format signature.
- **The engine work:** Chrome can't play negative `playbackRate`, so this needs an AudioWorklet "turntable" that reads a buffer along a position curve.
  - It would also give realistic spinbacks and brakes.
  - It needs a stroke library (baby, chirp, forward) and gain gating as the crossfader.

**Spec:**
- The grain is the call's first 1/2 beat.
- Baby strokes are 1/8 push + 1/8 pull per eighth note on B's grid. Chirps close the gain mid-push.
- A forward release lands on P.

**Pick:** S2, S1 gap · tempo any · M L F · family `scratch`.

**Risk → guard.**
- **It sounds fake without vinyl noise and fader dynamics:** tune it by ear, keep it ≤ 2 beats, and layer a little noise.

**Also seen, but not adopted:**
- **Wordplay and tone-play** (Crossfader): these need word-level lyric alignment, a Whisper-class job. Revisit with this year's pool.
- **Polyrhythmic 3/2 loops:** too clever for this crowd.
- **The Energy Boost key ordering:** the Queue is fixed, so it applies only through D18.

---

## Top-8 build order

1. **D1 Trans gate and pump.**
   - **Why first:** it needs no primitive, adds a new family for every Phase and pair, and also becomes an R7 exit.
2. **D3 Spiral echo-out.**
   - **Why:** existing params only, and a sound nothing else makes. As an R7 exit it varies the workhorse at once.
3. **D2 Stop-time hits and the crowd gap.**
   - **Why:** existing primitives. It is the crowd "eh!" moment the decisions ask for. Add the optional drum-tick event later.
4. **P1 stem lanes + D8 Stem peel.**
   - **Why:** P1 is the one small primitive that unlocks D8, D9, D10, D15 and D16, plus stem variants of R2 and R4.
   - **Before using it:** ship it with the subtraction residual test.
5. **D9 Ghost Tease.**
   - **Why:** it is tiny once P1 exists, and gives the first Tease to S1 Transitions between tempo-unmatched pairs (63% of them).
6. **D10 Drum swap.**
   - **Why:** it is tiny once P1 exists. It upgrades the 37% of pairs R8 covers, and no longer stacks two drum kits.
7. **P2 slices from any buffer + D11 Vocal-chop stutter.**
   - **Why:** the strongest Tease, and the party-remix sound.
8. **P3 pre-verb render + D12 Pre-verb swell.**
   - **Why:** it replaces the single most repeated sound in the show, the reverse cymbal on every landing.

**Next, cheap:** D4 half-time (no primitive), D13 clap-along (P4), D14 tape start (P5), D5 riff bed, D6 fake drop, D7 rush and D15 braker. Then D16, then (c).

For each one, `test.html` should render it offline through the real graph (the hook at T, A silent after its exit, no NaNs, peaks under −0.7 dBFS). The planner property tests should cover its events: none before the Spin starts, and lanes inside their stems windows.

**Starting weights** once the top 8 exist (layers are drawn on top with their Phase chances):

| Phase | Recipes (weight) |
|---|---|
| early | R8 1 · D10 0.6 · R7 0.3 · D1 0.25 · D3 0.2 · D8 0.15 · D2 0.1 · R2 0.1 · R4 0.1 · R5 0.08 · R1 0.05 · R6 0.05 |
| mid | R8 0.8 · D10 0.6 · R7 0.4 · D8 0.25 · D1 0.2 · D3 0.2 · D2 0.15 · D11 0.15 · R4 0.12 · R5 0.1 · R2 0.1 |
| late | R7 0.6 · D10 0.4 · R8 0.4 · D8 0.3 · D11 0.25 · D2 0.2 (long) · D3 0.15 · R4 0.15 · R5 0.15 · D7 0.1 |
| final | R10 0.5 · D2 0.4 (final pattern) · D8 0.3 (k = 4, gap 2) · D6 0.25 (with D11 or D14 layers) |

---

## The existing recipes: weakest and most repetitive, and how to vary them

**The landing layer is the most repeated sound.** Every Transition ends with the same reverse-cymbal swell and synth impact.
- **Landing layers to rotate:** D12 pre-verb, D14 tape start, the cymbal (rand 0.3), and a *dry* landing (no swell, every effect cut a beat early: MusicRadar's "alien swell" release).
- **Impact samples to rotate:** boom, orchestra-hit, and for a laugh `horn`.
- **Impact timing to vary:** −20 to −40 ms (see `dj_technique.md`).

**R7 Build & land is the workhorse and the most predictable.** It carries most non-blend Transitions, and its build is always the same three layers:
- a noise riser;
- a snare roll that accelerates 1/4 → 1/32 at fixed stage lengths;
- a `bus.hpf` sweep.

Its variety comes only from the exit. Rotate a **bridge pattern** independently of the exit:
- the classic roll, D4 half-time, D13 clap, a **kick roll** (`kicks` at 1/4 → 1/8 → 1/16; EDMProd high-passes a kick roll as it speeds up, so lower the kick level stage by stage, or give `kicks` a high-pass parameter), D5 riff bed or D11 chops;
- vary the riser between noise, tone and a two-layer "Shepard" stack (two tone risers an octave apart, crossfading);
- start the roll at 1/8 sometimes, and allow 1/12 triplets in the last beat (Plugg Supply);
- vary what fills the gap: silence, a reverb tail, or D12;
- add D1 and D3 to `exits`.

**R10 Power-down is the only final recipe** (`weights: {R10: 1}`). Final covers the last 1–3 songs of *each* climb, so a Round can hear the identical power-down six times. Rotate in D2's final pattern, D6, and D8 with a long gap. Keep R10 for the very last song before a probable Bingo.

**R1 Slam cut is R2 without the echo.** It has the weakest identity: HPF + riser + swell. Vary it with:
- an **LPF dive**: `A.lpf` 22 kHz → 250 Hz over the last bar, the "door closing" that djlearn.de calls the drama move;
- a resonant HPF (P6, Q 4–6, kept low as djlearn.de advises);
- or a single D2-style stab on the last beat.

**R2 Echo-out:** the echo is always ½ or ¾ beat at feedback 0.5. Vary it with:
- a 1-beat echo;
- an **echo freeze**: feedback 0.92 after the catch, A cut, the frozen loop as the bed of a short build (the DJ TechTools improv freeze);
- D3 Spiral;
- once P1 exists, a **vocal-only throw**: Serato's Vocal Echo, through a vocals lane.

**R6 Reverb wash** is the muddiest under the presenters' voices, and the guides collected in `dj_technique.md` warn that a wash can kill momentum. Lower its weight in late, and add a **gated wash**: in the last beat, chop `reverb.return` open and shut at 1/16 with ≈ 10 ms releases. Tapechild gives a hold of about a 1/16 note and a 10 ms release for the classic gated sound.

**R4 Loop roll:** the same 1 → 1/16 ladder from the same slice. Vary it with:
- the slice (A-bar −1's first beat, its last beat, or the vocal's last word);
- a triplet ladder (1/3 → 1/6 → 1/12);
- slices pitching up (P2 `rate`);
- a **drums-only roll** (rekordbox Groove Circuit's Drum Roll): roll A's drums lane while the rest of A carries on under a rising HPF (P1 + P2).

**R5 Brake / spinback:** it is a 50/50 coin. Add D15 (the instrumental braker) and the D14 power-up as the comeback.

**R8 Blend:** always "drums first, bass in the last bar". Alternate it with D10's swap and its juggle variant, and with D16 when a pair qualifies.

---

## Sources (all opened for this catalog)

- Crossfader, 12 high-energy DJ transitions: https://wearecrossfader.co.uk/blog/12-high-energy-dj-transitions/
- Crossfader, AlphaTheta DDJ-GRV6 review (Groove Circuit: Drum Swap, Roll, Trans, Release): https://wearecrossfader.co.uk/blog/ddj-grv6-review/
- Digital DJ Tips, Using stems in Serato DJ Pro: https://www.digitaldjtips.com/using-stems-in-serato-dj-pro-all-you-need-to-know/
- Digital DJ Tips, Do not ignore stems: https://www.digitaldjtips.com/djs-do-not-ignore-stems/
- Digital DJ Tips, 5 ways to escape a long breakdown: https://www.digitaldjtips.com/5-ways-to-deal-with-a-long-breakdown-that-isnt-working/
- DJ TechTools, Make space in your DJ mix for new tracks: https://djtechtools.com/2017/08/21/tutorial-make-space-dj-mix-new-tracks/
- DJ TechTools, 6 clever ways to transition between DJs (improv echo freeze, magic scratch): https://djtechtools.com/2012/05/13/6-clever-ways-to-easily-transition-between-multiple-djs/
- rekordbox FAQ, Track Separation (Active Part, Part ISO, Part FX): https://rekordbox.com/en/support/faq/trackseperation-6/
- Algoriddim djay, Crossfader FX: https://help.algoriddim.com/user-manual/djay-pro-mac/dj-tools/effects/crossfader-fx
- Algoriddim djay, Neural Mix crossfaders: https://help.algoriddim.com/user-manual/djay-pro-windows/neural-mix/crossfaders
- Mixed In Key, Make acapella + instrumental mashups: https://mixedinkey.com/workflows/make-acapella-instrumental-mashups/
- Mixed In Key, Energy Boost: https://mixedinkey.com/harmonic-mixing-guide/energy-boost-dj-mixing-tutorial/
- Garnish, DJM effects (Colour FX, Beat FX): https://edu.garnishmusicproduction.com/dj-mixer-effects-colour-fx-beat-fx-slip-mode/
- djlearn.de, Filters for DJs: https://djlearn.de/en/how-to-use-filters-dj
- djlearn.de, How to scratch: https://djlearn.de/en/how-to-scratch
- StemSplit, DJ stem separation guide: https://stemsplit.io/blog/dj-stem-separation-guide
- Second Song, Wedding DJ secrets (the silence trick): https://www.second-song.com/wedding-dj-secrets-how-to-keep-the-dance-floor-packed-all-night
- MusicRadar, 8 classic recipes for a perfect drop: https://www.musicradar.com/how-to/8-classic-recipes-for-a-perfect-drop
- MusicRadar, Turntable stop with VPS Tapestop: https://www.musicradar.com/how-to/how-to-create-a-classic-turntable-stop-effect-with-vengeance-sound-vps-tapestop
- Attack Magazine, Creative tape stop effects: https://www.attackmagazine.com/technique/tutorials/creative-tape-stop-effects/
- EDMProd, Ultimate guide to build-ups: https://www.edmprod.com/ultimate-guide-build-ups/
- Boombox, EDM build-ups and beat drops: https://boombox.io/blog/edm-build-ups-beat-drops-how-to-nail-your-transitions/
- The Pro Audio Files, Tips for better build-ups and drops: https://theproaudiofiles.com/tips-for-better-buildups-and-drops-in-edm/
- RysUp Audio, Vocal stutter effect: https://rysupaudio.com/blogs/news/how-to-make-vocal-stutter-effect
- Plugg Supply, Snare rolls and build-ups: https://plugg-supply.net/articles/snare-rolls-and-build-ups
- Richard Pryn, Risers: https://richardpryn.com/risers-the-easiest-way-to-create-tension-in-your-music/
- Future Sound Academy, Volume shaper settings (pump, trance gate): https://www.futuresoundacademy.com/blog/free-shaperbox-alternatives-2026
- EDM Ghost Production, Half-time and double-time: https://edm-ghost-production.com/dj-knowledge-base/half-time-and-double-time-explained
- Kern Audio, Reverse reverb: https://kernaudio.io/guides/reverb/reverse-reverb
- Tapechild, Gated reverb: https://tapechild.com/blog/gated-reverb

---

## Built

Built on 2026-11-24 in the order of the top 8 above. Tunables are in `engine/src/config.ts` (`MOVES`, the Phase `weights`, `STEMS.lane*`); the moves are in `plan/moves.ts` (A's side), `plan/layers.ts` (B's side), `plan/bridges.ts` (S2 builds) and `plan/landing.ts` (the landing layer). Every entry is checked by `tests/recipes.test.ts` (landing invariants over random real pairs, plus the technique's own shape) and rendered by `test.html?run=1` in three modes: landing (B's click at T), mix (no NaN, peaks) and silence (A's own path silent after its exit). `force` in `PlanRequest` pins a variant for the tests; the show never uses it.

**Primitives.**
- **P1 stem lanes** (`StemLaneEvent`, `Deck.playLane`, `audio/lanes.ts`): a part of either deck's song, sample-locked to its main source, with breakpoint levels into the deck's chain (`direct`, in part units: −1 removes the part) and alone into the echo or reverb. The deck now starts its main source on a whole frame with a whole-frame offset (within 21 µs of the plan), and a lane starts on whole frames too, so mix − part is exact; `other` plays as mix − (drums + bass + vocals). A's lanes are decoded from 1 s before the hook it landed on to 48 s after it (`StemStore.ensureLanes`, on the landing); the planner uses them only at rate 1 and 0.5 s inside what is decoded. Checked on song 1's real stems: removing the drums leaves −226 dB against the truth, removing every part leaves silence (Node, `tests/lanes.test.ts`, through the Deck's own frame arithmetic), and the same through the real Web Audio graph on `test.html`.
- **P2 slices from any buffer** (`SlicesEvent.source`, `direct`, `fadeMs`, `hpfHz`, `snap`, `Slice.rate`): the mix, a stem or a Signature, per-slice rate, past the fader if asked, and an onset snap that skips at most 30 ms of noise-like consonant.
- **P3 pre-verb render** (`audio/preverb.ts`, `PreverbStore`): B's first beat at each valid best/main hook, reversed, convolved (100% wet, RT60 = 1.25 B bars) and reversed back, rendered when the song is decoded.
- **P4 claps** (`claps` synth, with `stomp`), used by the clap-along bridge.

| Id | What was built | When the planner picks it | Source |
|---|---|---|---|
| D1 `D1` Trans gate | Gate ladder on A's grid (early: ½ then ¼ beat, or 1-½-¼, partial −15 dB; mid: ½-¼-⅛ at −24 dB; late/final: two bars to ⅛ beat, silent), duty 0.5/0.6, 3-3-2 in the 1/16 stage (0.2), 2 ms edges, +1 dB open lift; or the pump (sidechain dips −6 → −14 dB with kicks, eighths on the last beat), or gate + kicks; A's high-pass at 250 Hz before the fast stages then to 300/500/800 Hz; riser; final adds `bus.hpf` to 300 Hz. Sparse drums (stem bars under the median − 9 dB) turn it into the pump. Also the R7 exit `gate` (one bar, mid ladder) | S1, any tempo, any key, every Phase, family `gate` | D1 |
| D3 `D3` Spiral echo-out | Echo at ½, ¾ or 1 beat; A's dry signal gone after 2 beats (1 bar when 2 bars); the delay ramps exponentially to 1/16 or 1/12 beat (the repeats climb), feedback 0.55 → 0.7–0.85, echo high-pass 300 → 1.5/2.5 kHz, cut dead and flushed at the gap. Also the R7 exit `spiral`, which spirals down (¼ → 1 beat) one time in four | S1, any tempo, every Phase, family `spiral`, counted as an echo for "never three in a row" | D3 |
| D2 `D2` Stop-time hits | Stabs on A's beats (early β1-β2-β3; mid that or with β3½; late two bars; final the 2-bar crawl), 3 ms open, ⅕–⅓ beat hold, 30 ms close, a kick and a thunk on each; the last rings in the reverb, out by the pickup; a gap of at least 1 B beat (2 in final); impact +0.1. Stabs that do not fit before the gap move a bar earlier | S1, any tempo, every Phase, family `hits`, theatrical, `cooldown` 5 (never within five transitions: at most one in six) | D2 |
| Landing rotation | The landing layer is drawn per transition: the reverse cymbal, a dry landing (no swell, a smaller sub impact, no samples) or D12's pre-verb; the hit is drawn apart from it (none, the sub drop alone, or with samples); the impact's sample set rotates (boom, a horn from mid, the orchestra hit late and final only, with a cooldown) and sits 20–40 ms before T | Weights per Phase in `MOVES.landing` (dry 0.6 early, 0 in final; pre-verb only when rendered and A is cut low, gone, or in a compatible key by then, else the Phase's lighter plain landing; `impactKinds` none 0.65 / 0.4 / 0.15 / 0; `orchestraCooldown` 6 late, 3 final) | Weakest recipes, the user's first listen |
| Intensity by Phase | Each Phase's `dress`: an S1 or S3 move keeps its riser at chance 0.2 / 0.55 / 0.85 / 1, every riser −6 / −3 / −1 / 0 dB, the Spin's whoosh −12 / −8 / −6 / −5 dB; the early weights favour the clean moves (R8, D10, R1, R2, D8), builds, gates and spirals rare, no theatrical move until mid; early gaps mostly 0 (a cut on the one) | `PHASES.*.dress`, `PHASES.*.weights`, `gapBeats`; `tests/variety.test.ts` checks the impacts, samples and risers grow with the Phase and the orchestra hit stays rare | The user's first listen |
| R7 bridge patterns | Drawn apart from the exit: `roll` (now with a tone riser 0.4, a ⅛ first stage 0.3, sextuplets in its last stage 0.3 late), `halftime` (D4: kick on 1, snare on 3, straight time, then the roll), `kickroll` (¼ → ⅛ → 1/16, quieter each stage), `clap` (D13: claps on 2 and 4, stomp-stomp-clap or every beat, then every beat and a short roll) | Weights per Phase in `MOVES.bridges`; half-time and clap need 1.5 bars of build | R7 notes, D4, D13 |
| Final options | R10 is no longer alone in final: R10 0.5 · D2 0.4 (the crawl) · D8 0.3 (2–4 bars, gap 2) · D1 0.2 · D3 0.15 | Final Phase | Weakest recipes |
| R1 variants | High-pass (0.5), low-pass dive 22 kHz → 250 Hz (0.3), or one stop-time stab on A's last beat (0.2) | Inside R1 | Weakest recipes |
| R2 variants | Echo at ½, ¾ or 1 beat; the echo freeze (0.2: A's last beat caught at feedback 0.92, A cut, the loop rings to the gap); with A's lanes, a vocal-only throw (0.35) while A's band plays on | Inside R2 | Weakest recipes |
| R4 variants | The slice is the bar's first or last beat (0.35), a triplet ladder (0.3), slices pitching up to ×1.12 (P2 rate; mid 0.3, late and final 0.4) | Inside R4 | Weakest recipes |
| R5 variants | Brake length 0.6/0.8/1 s, rewind speed 2.5/3/3.5× over 0.8/1/1.2 s | Inside R5 | Weakest recipes |
| D8 `D8` Stem peel | Lanes remove A's parts one after another (acapella-out drums → bass → other 0.5; other + bass → drums 0.25; bass → other, a drums-and-voice bridge 0.25), cut on the one or slid over a beat; one bar early, 2 mid/late, 2–4 final; a stem is never alone more than 1 bar (2 late); reverb 0.15 → 0.35 and a 120 Hz high-pass once the bed is gone; on A's last beat the voice is thrown into the echo (its lane leaves the mix and feeds the echo alone); riser | S1 with A's drums, bass and vocals lanes covering the move, every Phase, family `strip` | D8 |
| D10 `D10` Drum swap | On one of A's downbeats (1 bar early, 2 mid, 2–4 late) A's drums lane goes to −1 and B's stretched drums come in (cut or over a beat); juggled 0.3 (two beats out, two back, then for good); with B's bass allowed (±4%, compatible keys) the bass swaps in the last bar; A's bass −3 dB or A high-passed at 80 Hz during the swap; A leaves by echo, wash or a vocal throw | S3 with B's render and A's drums lane, every Phase but final, family `swap` | D10 |
| D9 Ghost Tease (layer) | B's vocals lane feeds only the reverb over A's last 1 / 1.5 / 2 bars (mid / late / final), rising, cut at the gap; reverb high-pass 400 → 700/1200 Hz, or 1.5 kHz and a send of at most 0.3 when the keys are not known to agree; the return drops 6 dB at the pickup and is out 2 beats after T | S1 hosts that leave the reverb alone (R1, R2, R4, R5, D1, D3), with B's vocals decoded, chance 0 / 0.4 / 0.5 / 0.5; reported in `plan.layers` | D9 |
| D11 `D11` Vocal-chop build | R7's exit and build (the roll ~6 dB down), and B's first syllable chopped on B's grid in the last bar before the gap (beats at ¼, the next-to-last at ⅛, the last at 1/16 then 1/32; a bar of half notes before it late and final), grain ¼ or ⅛ beat, rate climbing to 1 / 1.06 / 1.12 / 1.19, +12 layer on the last beat 0.3, 3 ms fades, 150 Hz high-pass, onset snap; gap ½ beat early and mid, 1 beat late | S2 when B sings at its hook (vocals decoded, its vocals bar ≥ −30 dB when known); the grain is its vocal stem at the pickup; family `chop` | D11 |
| D12 Pre-verb swell (landing) | B's pre-verb render, ½ / ¾ / 1 / 1 B bar long, ending 30–60 ms before the pickup, −12 / −10 / −8 / −7 dB, 200 Hz high-pass, past B's fader | Drawn as the landing layer when rendered and A cannot clash (S2, a gap of at least ½ beat, a recipe that cuts A low, or compatible keys) | D12 |

**Not built in the first batch, with reasons.** The S1 one-beat chop in the gap (D11's layer form), D9 on S2 bridges, the "ghost becomes a voice" dry line (B's fader is closed then; it needs a lane path past the fader) and D12's vocal-stem source (B's stems are decoded later than the render) were left for later; the second batch below builds all four. D4 and D13 were built as bridge patterns. The drum-tick event for D2 and the console's "crowd moment" preference would change the protocol, so they wait.

**Wiring.** `audio/plan-inputs.ts` gives the planner what the stores hold (A's lane coverage, both songs' stem bar levels and hook keys, B's pre-verbs) through Show's `env.plan`, so the show machine is unchanged; `show/show.ts` could pass these itself later. `plan/decoys.ts` `firstSoundOfB` counts every B event (`stems`, `blend`, `stemLane`, `slices`, `scratch`, `preverb`, `signature`, B params); Decoys are off by default.

### Second batch

Built on 2026-11-24, in the order D5, D6, D7, D14, D15, D16, the first batch's gaps, then D19. Same structure and checks as above: `tests/recipes.test.ts` keeps the landing invariants for every new recipe, variant, layer and landing (B's hook at T on the plan's clock, nothing before the Spin, A silent after its exit, an impact and real effects, lanes inside A's stems) plus each technique's own shape; `tests/rate.test.ts` and `tests/scratch.test.ts` check the new primitives; `test.html?run=1` renders every new case in the three modes and a P1 lane-rate check.

**New primitives.**
- **P1, more lane routes** (`StemLaneEvent.solo`, `.rate`): `solo` plays the part alone past the deck's filters and fader, at its trim (A's voice carrying on over its braking band; B's voice while B's fader is shut). `rate` gives the lane's sources the deck's own rate automation (the same AudioParam calls, so the same k-rate value per render quantum): a −1 lane still cancels its part while the deck brakes. Checked through the real graph: the voice left in a braking mix is −184 dB (`test.html`, "P1 lane rate").
- **P5, rate-aware landing** (`plan/rate.ts`, `Plan.b.powerUp`, `Deck.start(…, powerUp)`): B starts at rate 0.25 and climbs exponentially to 1 on its pickup. `Plan.b.startCtx`/`offset` stay the clock B lands on (where it would be at rate 1), so Show's song clock and every lane stay right; the Deck starts the source at offset − (d − ∫rate) and adds half a render quantum of the rate's climb, because AudioBufferSourceNode reads its k-rate playbackRate at each quantum's start (a left Riemann sum lags by about 1 ms otherwise). A k-rate simulation lands within 0.3 ms (`tests/rate.test.ts`); the real graph lands B's click at T within 0.02 ms.
- **P7, scratch render** (`audio/scratch.ts`, `ScratchEvent`, `Deck.playScratch`): the grain read along the hand's position curve (eased strokes, a steady release), times a crossfader, plus needle noise that follows the hand's speed, rendered into a buffer when the plan is applied (at most two beats: well under a millisecond of CPU per beat). No AudioWorklet: a negative playbackRate is not needed, and nothing runs on a second audio thread. Pure, so Node checks forward, reversed and gated reads.
- **Signature `from` and `fadeSec`** (a loop that comes in mid-riff, 5 ms seams), **Blend `hpfHz`** (D16's voice), **pre-verb `source`** (`PreverbStore.ensureVocals`, keyed `hookId:vocals`), **`OutgoingDeck.rate`**, and a time map for D1's gate (`gateMove({ timeMap })`) so a gate can ride a tape that speeds up.

**Planner rules added.** Recipes may declare `fits(A, i)` (a per-candidate check of A's bars: D15 needs A singing), `minBridgeBars` (D6), `noTease` (D6), `gapHost` (an S1 move whose gap stays silent) and `riffHost` (R7); `ghostHost` now covers S2 bridges (R7, R10; not after a wash exit). `Caps.blendVocals` is B's stretched voice: rendered, tempos within ±4%, keys compatible (`BlendStore`, the bass's rule) and B singing in the two bars before its hook. A recipe that finds no candidate re-draws without the caps it needed before falling back to R7, R2, R1.

| Id | What was built | When the planner picks it | Source |
|---|---|---|---|
| D5 riff bed (layer of R7) | B's approved riff Signature loops on B's bar lines under the bridge, anchored so a loop ends on the hook downbeat (the first one comes in mid-riff), from the bridge's start to the gap, 5 ms seams, cut in 10 ms; −8 / −7 / −6 dB (mid / late / final) on the Phase's Signature level; variants dry 0.4, its last beat thrown into the echo 0.35, its last bar gated in ⅛-beat slices of the riff's file 0.25; the build's rolls step back (×0.88 velocity); counts as B's one Signature | R7 with B's approved riff within ±4% of B's tempo at its hook, at least 1.25 of B's bars to the gap, never under a low-passed Tease (over a stem Tease it is fine); chance 0 / 0.3 / 0.5 / 0.6; its draw is made for every R7, so plans without a riff are the same with or without Signatures | D5 |
| D6 `D6` Fake drop | A exits as in R7; a build peaks into a beat of silence on B's grid (two bars before the hook); the fake bar: a small hit and B's drums alone (0.4, needs B's stems), a comedy sample with kicks (0.35: `spongebob-boowomp`, `duck-quack`, `anime-wow`, now preloaded) or heartbeat kicks with a downlifter (0.25); a faster re-build (⅛ → 1/16 roll at the Phase's snare pitch + 2, tone riser to +2 dB, the bus high-pass to 500 Hz); the gap; the real landing, impact +0.1. Never Teased, so B's mix is never heard before its pickup | S2, late 0.2 and final 0.3, a bridge of at least three of B's bars, family `fake`, theatrical, `cooldown` 8 (about once a climb) | D6 |
| D7 `D7` Pitch-up rush | A's rate climbs exponentially by phase{—, 3, 4, —} ± 1 semitones (2–5; a semitone less when its voice is loud there), over one bar (late: one or two), its high-pass opening to 400/700 Hz, +1 dB, cut 30 ms before the gap; a tone riser. Late, 0.3: a D1 gate on top instead, each step opening on one of A's beats as the faster tape brings it (`timeMap`) | S1, mid 0.12 and late 0.15, a gap of at least ½ beat (A runs ahead of its grid), family `pitch`, theatrical; hosts the ghost and a gap layer | D7 |
| D14 tape start (landing) | B powers up in the gap: it starts 0.35 / 0.45 / 0.6 s before its pickup (shortened to the gap) at rate 0.25 and climbs exponentially to 1 on the pickup (P5), −12 dB and low-passed at 800 Hz rising to open; no swell with it (it is a landing style) | A landing style: weights 0 / 0.15 / 0.25 / 0.25, ×2.5 after a stop (R5, R10, D2, D15); only when at least 0.3 s of silent gap is left, never in S3 or after a low-passed Tease (after a stem Tease it is fine); a gap layer or a pre-verb never shares the gap with it | D14 |
| D15 `D15` Instrumental braker | Over A's last bar its band brakes (rate → 0.02 over ¾ or 1 bar, low-pass closing, a downlifter); a −vocals lane brakes with it (P1 `rate`), so the voice is gone from the braking mix, and a vocals lane carries it on past the fader at A's level (P1 `solo`); half a beat before the gap the voice goes into the echo alone (the throw), which fades a beat after B's pickup; a riser | S1 with A's vocals lane, A singing in its last two bars (stems bars ≥ −28 dB, unknown counts as singing), mid 0.12, late 0.15, final 0.2, family `stop`, theatrical | D15 |
| D16 `D16` Acapella-in mashup | On one of A's downbeats (one bar mid, one or two late, two final) A's vocals lane goes to −1 and B's stretched voice comes in over a quarter beat, high-passed at 150 Hz (a `blend` of the vocals alone); A −3 dB and high-passed at 120 Hz, its drums kept; A leaves by echo (0.6) or wash (0.4) at that lower level; B's own mix takes over on the pickup; riser, swell, impact | S3 with B's stretched voice (`Caps.blendVocals`: ±4% and agreeing keys, B singing before its hook) and A's vocals lane; mid 1, late 0.9, final 0.4 (rare, so drawn often when it qualifies); family `swap` | D16 |
| D19 `D19` Scratch-in | A exits as in R7, the build runs on B's grid (its roll ×0.7), and B's first syllable is scratched on B's eighths over the last 1 / 1 / 2 / 2 beats before the pickup: each eighth a push and a pull through ⅕–³⁄₁₀ of a beat of the source (eased like a hand), baby (both ways) 0.45, chirp (the crossfader shut halfway through the push) 0.3 or forward (pushes only) 0.25; the last eighth is the release, forward at full speed, cut 30 ms before the pickup; P7 render, 150 Hz high-pass, onset-snapped | S2 when B sings at its hook (D11's grain: its vocal stem), mid 0.12, late 0.18, final 0.15, a gap of ½ / ½ / 1 / 1 beat, family `scratch` | D19 |
| Gap layer (D11, D19 in S1) | One beat of B's first syllable right before its pickup, in the silence after A: D11's chop (¼, ⅛, then 1/16 steps, rising, a +12 layer sometimes) 0.6, or D19's one-beat scratch (a stroke and the release) 0.4; in a two-beat gap the first beat stays silent for the crowd | S1 moves whose gap stays silent (R1, R4, R5, D1, D3, D7), a gap of at least a beat (late and final), B's grain; chance 0 / 0.3 / 0.45 / 0.45; never with the tape start or the pre-verb, never in D2's crowd gap; reported as `gapChop` / `gapScratch` | D11, D19 |
| D9 on S2 bridges, and its voice | The Ghost Tease also over a bridge's last 1 / 1.5 / 2 of B's bars (from the bridge's start at the earliest); with agreeing keys, 0.3: "the ghost becomes a voice", the same lane playing B's dry vocals past B's fader at −18 dB in its last beat (P1 `solo`) | R7 and R10 bridges unless A washes out or B's riff is the bed; one voice of B at a time (not with a gap layer); reported as `ghost` and `ghostVoice` | D9 |
| D12 from B's voice | A second pre-verb per hook from B's vocal stem (its first word, not the chord), rendered once B's stems are decoded (`PreverbStore.ensureVocals`, from `main.ts`'s prefetch) | When the pre-verb landing is drawn, B sings at its hook (its vocals bar ≥ −30 dB, or unknown) and the vocal render is ready: 0.5 | D12 |

**Weights now** (docs order; recipes the pair cannot support are left out of the draw, and layers are drawn on top):

| Phase | Recipes (weight) |
|---|---|
| early | R8 1 · D10 0.8 · R1 0.8 · R2 0.7 · D8 0.5 · D1 0.2 · R6 0.15 · D3 0.12 · R7 0.12 · R4 0.05 · R5 0.04 (since the user's first listen: light, quick and clean; the Blend and the drum swap when they fit, else a cut on the one, a short echo or a quick strip-down; builds rare, the theatrical moves wait for mid) |
| mid | D16 1 · R8 0.8 · D10 0.6 · R7 0.4 · R2 0.35 · D8 0.35 · R1 0.3 · D1 0.2 · D3 0.2 · D11 0.15 · D15 0.12 · D2 0.1 · D19 0.1 · D7 0.1 · R4 0.1 · R5 0.1 · R6 0.05 |
| late | D16 0.9 · R7 0.6 · D10 0.4 · R8 0.4 · D8 0.3 · D11 0.25 · D6 0.2 · D2 0.2 · D19 0.18 · D15 0.15 · D7 0.15 · D3 0.15 · R4 0.15 · R5 0.15 · D1 0.12 |
| final | R10 0.5 · D2 0.4 · D16 0.4 · D8 0.3 · D6 0.3 · D15 0.2 · D1 0.2 · D19 0.15 · D3 0.15 |

**Not built, with reasons.**
- **D17 meet-in-the-middle tempo ride:** it needs the relay to render A's exit section on demand (its exit bar depends on the Pace and any Hold) and the deck to switch A's source to that render on a downbeat with a sample-aligned crossfade, plus an S3 on the midpoint's grid. That is relay, deck and planner work together, and the batch had none of it cheap.
- **D18 key-shifted layers:** `stretch.py --pitch`, the cache key, the planner's key search and an audition approval for shifted voices; mostly ears, not code, and not cheap.
- **D19 as an AudioWorklet:** not needed. The scratch is rendered into a buffer (P7), which also keeps it testable in Node; realistic spinbacks and brakes on the same position curve are a possible follow-up.
