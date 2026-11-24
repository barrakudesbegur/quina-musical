# DJ transition technique, mixing theory and hype/tension design: parameterized recipes for an automated music-bingo mixer

Timing reference used throughout (arithmetic, not sourced): beat = 60/BPM s; bar (4/4) = 4 beats.
| BPM | beat | bar | 8 bars | bars in a 5 s window | bars in an 11 s window |
|---|---|---|---|---|---|
| 70 | 857 ms | 3.43 s | 27.4 s | 1.5 | 3.2 |
| 95 | 632 ms | 2.53 s | 20.2 s | 2.0 | 4.3 |
| 100 | 600 ms | 2.40 s | 19.2 s | 2.1 | 4.6 |
| 120 | 500 ms | 2.00 s | 16.0 s | 2.5 | 5.5 |
| 128 | 469 ms | 1.875 s | 15.0 s | 2.7 | 5.9 |
| 140 | 429 ms | 1.71 s | 13.7 s | 2.9 | 6.4 |

Implication: the 5–11 s roulette window is only about **2–6 bars**. Club-style 16–32-bar blends don't fit, so every recipe below is compressed to 1–6 bars.

---

## Q1. Fundamentals: beats, bars, phrasing, where to start and end, beatmatching, tempo tolerance, harmonic mixing

### Takeaway
Transitions should start and land on phrase boundaries (the "one" of an 8/16/32-bar unit). Keep tempo changes within about ±3–6% for vocal material. Beyond that, pitch shift (without keylock) or time-stretch artifacts (with keylock) become audible. The Camelot rules are: same key, ±1, or a relative-major/minor switch is safe; +2 or +7 is an "energy boost". Key clashes matter when sustained melodic or vocal content overlaps for more than about 8 beats. They matter little for drum-only overlaps or hard cuts.

### Cited Findings
**Bars and phrases**
- Most popular music is 4/4 with 16-bar phrases, so it is "often enough" to start the incoming track at a phrase boundary of the track playing — [Wikipedia: Phrasing (DJ)](https://en.wikipedia.org/wiki/Phrasing_(DJ))
- A bar = 4 beats; 8 bars = 32 beats; music "changes naturally" at 32-beat phrase ends. At 128 BPM an 8-bar phrase lasts about 15 s, and intros, breakdowns and drops tend to run about 32 bars — [mixready.art](https://mixready.art/guides/song-structure-bars-and-phrases); [djkit "Rule of 32"](https://www.djkit.com/blogs/news/djing-rule-of-32)
- A 16- or 32-bar blend "feels deliberate", while an 11-bar one "feels like an accident". Starting a transition mid-phrase is "the single most common reason a mix feels 'off' even when the beats are matched" — [vibesdj phrasing](https://vibesdj.io/learn/techniques/phrasing) (via search summary)
- Start on a phrase boundary, usually 16 or 32 bars before the outgoing track runs out of energy. With incoming LOW fully down, press play on the first beat of a new 16/32-bar phrase — [Setflow](https://www.setflow.app/blog/dj-transitions-how-to-mix-between-songs)
- Crash cymbals almost always mark a phrase start. Count in 8s from the first kick — [Wikipedia: Phrasing (DJ)](https://en.wikipedia.org/wiki/Phrasing_(DJ)); [vibesdj phrasing](https://vibesdj.io/learn/techniques/phrasing)
- Hip-hop/R&B/pop usually run a 16-bar verse plus an 8-bar chorus/hook, so a quick 8-bar blend or a drop cut on bar 1 works — [sirenmix phrasing guide](https://sirenmix.com/blog/dj-phrasing-guide) (via search summary; may be from [vibesdj](https://vibesdj.io/dj-tools/dj-transitions))
- Hot-cue layout used by working DJs: A = first clean downbeat; B = 16 bars before bassline/vocal (mix-in); C = main drop/chorus; D = 16 bars before outro end (mix-out) — [SirenMix hot cues](https://sirenmix.com/blog/hot-cues-guide). DJ Record Pool puts mix-out 16–32 bars before the end and a "drop cue" at the chorus/drop to "jump directly to the peak moment for a quick mix-in" — [DJ Record Pool](https://djrecordpool.com/how-to-use-hot-cues/)
- "A Hot Cue is only as tight as the beatgrid underneath it." Use a hot cue on the next phrase, not the nearest beat — [Digital DJ Pool hot cues](https://digitaldjpool.com/blog/hot-cues-for-djs/)

**Beatmatched blend gain staging**
- Bring the incoming track in at -18 dB (with an intermediate step to -9 dB), reaching unity over 16–32 beats. Start 32 beats before the outgoing section change. Grid drift tolerance is ≤20 ms over 64 beats. Keep channel peaks around -6 dB. A master jump of more than 3 dB during a blend signals stacked basslines. Resonant filters can add about 6 dB near cutoff — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)
- Bass swap: outgoing LOW to -∞ (or at least -18 dB), incoming LOW to 0 dB, on beat 1 of a phrase change, typically at bar 9, 13 or 17 — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)
- Mixer EQ reference: original DJM-900nexus EQ centres were LOW 70 Hz, MID 1 kHz, HI 13 kHz, range -26 to +6 dB. Isolator mode goes to -∞ — [DJM-900nexus manual](http://www.revolution.pt/pdfs/djm900n.pdf); [DJM-900NXS2 manual](https://c3.zzounds.com/media/DJM-900NXS2_manual_EN-0703f22a06f23c5041e63da3db269aa6.pdf) (the NXS2 manual lists 20 Hz/1 kHz/30 kHz as measurement points, not crossovers)

**Tempo tolerance**
- A 6% speed change is about one semitone: +5.95% raises it one semitone and -5.61% lowers it one. Shift in semitones = 12·log2(new/old). Up to about ±3% is "barely noticeable"; beyond ±6% vocals sound "chipmunked or dragged" unless keylock is on — [bpmtech pitch range](https://bpmtech.no/tools/pitch-range)
- Most DJs stay inside about 6%, the CDJ default range. "Vocals give the change away long before the beat does." ±6% (≈1 semitone) moves a track 7 positions on the Camelot wheel — [Mixgraph pitch fader](https://www.mixgraph.io/glossary/pitch-fader)
- With keylock, changes within ±4–6% sound natural on lossless/320 kbps sources. Beyond ±8–10%, time-stretch artifacts become noticeable on exposed vocals and cymbals — [SirenMix BPM guide](https://sirenmix.com/blog/bpm-guide)
- Past roughly ±10%, transients smear and vocals sound phasey; for 10–25% changes, pre-render a stretched edit from a lossless source — [edm-ghost-production](https://edm-ghost-production.com/dj-knowledge-base/mixing-across-different-bpms) (via search summary)
- Practice pitch range is ±6% (±16% is "too coarse"). The Ghost Production's BPM tolerances: bass swap within ±4 BPM; loop exit within ±6 BPM; drop mix up to ±8 BPM if the tracks don't overlap — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)
- Grabbing 5–8% tempo without master tempo can shift a track a semitone or more and break a harmonic match — [OpenKeyScan](https://www.openkeyscan.com/key-and-bpm-guide) (via search summary)

**Harmonic mixing (Camelot)**
- Camelot Wheel was created by Mark Davis / Mixed In Key (2007 per most sources), a numbered circle of fifths — [Wikipedia: Harmonic mixing](https://en.wikipedia.org/wiki/Harmonic_mixing)
- Safe moves: same key; ±1 number (e.g. 8A→7A/9A); same number with the other letter (8A↔8B, relative major/minor) — [Digital DJ Pool Camelot](https://digitaldjpool.com/blog/harmonic-mixing-camelot-wheel/); [Setflow harmonic](https://www.setflow.app/blog/harmonic-mixing-camelot-wheel)
- Mixed In Key "Energy Boost" = mix into a key **two numbers higher** (e.g. 5A→7A). Advice: "use it every 20-30 minutes, but not ALL the time"; "if you do it too much, you'll overwhelm your audience". Learn -1/0/+1 first. A variation is **-5** (the "Armin Van Buuren variation", e.g. 8A→3A) paired with a higher Energy Level — [Mixed In Key Energy Boost](https://mixedinkey.com/harmonic-mixing-guide/energy-boost-dj-mixing-tutorial/)
- **+7** on the wheel = +1 semitone (seven fifths add up to a semitone), "like the key change many pop songs make before the last chorus". Sources disagree on whether +7 or +2 is gentler. A boost should be mixed quickly because the melodies eventually clash — [ClubDJSoftware](https://www.clubdjsoftware.com/camelot-wheel); [Camelot overview, MuseHub](https://www.musehub.com/tools/camelot-wheel) (via search summary)
- When key matters: for long melodic blends (overlap over 8 beats), match keys; for drum-only blends key matters less; "vocal outro into vocal intro: usually a bad idea"; key "matters less for a clean hard cut" — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)
- Echo-out tails with melodic stabs "can sound wrong depending on key" — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)

### Inferences
- **Grid rule for software:** every transition event (start, bass swap, cut, impact) should be quantized to a downbeat. Each major event should land on a phrase boundary (bar index mod 4 or mod 8 = 0) of the governing track. In a 2–6-bar window you only control the *last* boundary, so plan **backwards from the incoming hook's downbeat (t_land)**.
- **Tempo policy:** let r = BPM_in/BPM_out, folded by ×2/÷2 to the nearest 1. If |r-1| ≤ 3% → stretch freely (keylock on). 3–6% → stretch only the *non-vocal* deck, or ramp during a build where vocals are muted or high-passed. 6–10% → no beatmatched overlap; use tempo-independent recipes or a short ramp hidden under noise/riser. >10% → never stretch; cut, echo, brake or bridge.
- **Key policy:** compute Camelot distance d. If d ∈ {0, ±1, relative} → melodic overlap allowed (≤ the full window). If d = +2 or +7 → treat as "energy boost": OK, but keep the overlap ≤ 1–2 bars. Otherwise → no tonal overlap longer than about 1 beat. Overlap only drums/noise/FX, high-pass the outgoing echo tail, or put a beat of silence between them.
- The outgoing track's own pitch can be moved up to ±1 semitone (≈±6%) to fix a clash. This doubles as an energy-boost device: +1 semitone ≈ +7 Camelot steps.

### Gaps
- Could not verify the frequently quoted Phil Morse / Digital DJ Tips "5% rule" from its original article; it appears only secondhand in search summaries.
- No official crossover frequencies for the current Pioneer DJM-900NXS2/A9 EQ bands were found.
- No controlled listening study quantifying "how much tempo change before vocals sound wrong" was found. The ±3/±6/±8–10% thresholds are practitioner consensus, not measured data.

---

## Q2. Transition catalogue with recipes (durations, automation curves, when they work or fail, difficulty to automate)

### Takeaway
Practitioner sources give concrete enough parameters to code roughly 12 recipes. Echo-out (1/2–1-beat echo, 35–50% feedback, wet <40%), cut-on-the-one, filter fade (about 8 bars), loop roll (halving 1 bar→1/32), brake or spinback (1 beat, about 1–2 s), and reverb wash (wet 50–70%, 1–2 s decay) all work across tempo and key gaps. Blends and bass swaps need matched BPM and key. The white-noise riser plus snare roll build-up is fully specified by production sources: 8 bars at 1/4→1/8→1/16→1/32 per quarter of the build, velocity 50→120+, pitch +7–12 st, HPF 100–200 Hz→0.8–2 kHz, bus HPF to 200–400 Hz, a 1-beat gap, then an impact.

### Cited Findings
**1. Fade / long blend and bass swap**
- Fade: raise B over 8 or 16 bars while lowering A over the following 8 or 16 bars. Start B on the first beat of a phrase. Works with instrumentals or sparse intros; two vocals together clash — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)
- Bass swap: B's LOW down before opening its fader; bring B in over 8 or 16 bars; at the next phrase raise B's bass while lowering A's, then fade A. Don't boost both lows past centre. Fails when two basslines overlap (mud) — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)

**2. Filter sweep / filter fade**
- Bring B in quietly on a phrase with its bass reduced. Over 8 bars, turn A's filter toward high-pass. Swap basslines as A thins, and drop A's fader before the filter sounds harsh. "High-pass keeps energy up. Low-pass makes the track feel like it's moving away" — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)
- The HPF "takes the bass away and makes room" for the new track, and some guides use the HPF instead of the low EQ — [Digital DJ Tips effects](https://www.digitaldjtips.com/do-you-know-how-to-use-these-3-essential-dj-effects/) (via search summary)

**3. Echo-out / delay throw**
- Settings: 1/2 or 3/4-beat echo; feedback about 35–50% (keep under 50%); wet below 40%; close the channel fader "once the echo has caught". Keep the delay tail shorter than one bar if the next track has a busy drop — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)
- On A's final word or drum hit, engage a 1/2- or 1-beat echo, close A's fader while the tail continues, start B on the next downbeat, and switch the echo off before it crowds B. Native Instruments suggests 1/16, 1/4 or 1/2 values. Use a modest wet/dry, since full feedback is "not subtle". Works for tempo changes and tracks without clean outros — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)
- The echo rings out over 4–8 beats. It "ends any track cleanly and works between any two tempos", but at peak energy it risks deflating the room — search summary of echo-out guides ([djlearn.de transitions](https://djlearn.de/en/dj-transitions-and-mixing-techniques), [Digital DJ Tips 3 essential effects](https://www.digitaldjtips.com/do-you-know-how-to-use-these-3-essential-dj-effects/)); exact page not verified
- Pioneer DJM-V10 manual (as quoted in a guide): "delay" repeats once per beat setting, while "echo" repeats several times, attenuating by beat — [djlearn.de effects guide](https://djlearn.de/en/dj-effects-guide) (search summary; exact page not verified)
- Myloops pushes delay feedback to 70–80% on the last melodic hit before a drop and snaps it to zero on the downbeat — [Myloops](https://www.myloops.net/building-tension-before-a-trance-drop)

**4. Reverb wash / freeze**
- Wash-out: pick an exit with little percussion; raise wet/dry to 50–70%; cut lows and mids, leaving "atmospheric highs"; bring the new track in at full volume as the tail decays — [djatodocolor](https://www.djatodocolor.com/blog/en-fx-transitions-pro)
- Rhythmic delay wash-outs suit beat-synced mixes; reverb wash-outs are "ideal for transitions between tracks with different BPMs". The wash makes a neutral "black hole" with no rhythmic clash — [Thomann blog](https://www.thomann.de/blog/en/gear/the-5-most-important-dj-transitions/)
- Use a long decay (1–2 s), fade the channel while the tail trails, and hard-cut the incoming track on a downbeat under the tail — [DJ Record Pool](https://djrecordpool.com/dj-transition-techniques/)
- Pioneer-style SPACE/REVERB colour FX: wash on for the bar before the change, cut the fader on the downbeat; leaving it longer muds the incoming track — [Setflow effects](https://www.setflow.app/blog/dj-effects-transitions-echo-out-filter-sweep) (via search summary)
- Freeze plays the current reverb tail endlessly; "Infinite" mode makes all incoming reverb infinite. Use two automations: feed and engage the freeze, then crossfade — [sonible](https://www.sonible.com/blog/reverb-tricks-part2/)
- A wash-out "creates a pause that can kill momentum" — [Setflow effects](https://www.setflow.app/blog/dj-effects-transitions-echo-out-filter-sweep) (via search summary)

**5. Loop roll (1 bar → 1/2 → 1/4 → 1/8 …)**
- A loop roll loops a slice while the playhead keeps advancing, so on release playback resumes "as if the loop had never interrupted it" and phrasing is preserved — [Soundstock glossary](https://www.soundstock.com/glossary/what-is-a-loop-roll-dj)
- Variants: hold 1/2 beat → 1/4 → 1/8 → 1/16 just before a drop; or 4 beats → 2 → 1 → 1/2 → 1/4 — [djlearn.de](https://djlearn.de/en/hot-cues-and-loops). "Loop Roll Exit": capture a 4-beat loop near the phrase end, halve on the beat (2, 1, 1/2, 1/4), then cut to the new track on the one or throw into an echo — [vibesdj transitions](https://vibesdj.io/dj-tools/dj-transitions) (search summary; page fetch failed with HTTP 429)
- Cautions: use it "once or twice an hour"; loops longer than 16 beats make the crowd notice nothing is happening; it needs clean grids — [vibesdj transitions](https://vibesdj.io/dj-tools/dj-transitions); [djlearn.de](https://djlearn.de/en/dj-transitions-and-mixing-techniques) (search summary)
- rekordbox beat-loop lengths: 1/32 … 32 beats. Serato's hidden "trancifier" sets a 1-beat loop and auto-halves it on each pass — [djlearn.de](https://djlearn.de/en/hot-cues-and-loops) (search summary)
- Loop blend: loop a clean 4–8-beat non-vocal section; if it sounds obvious after the second repeat, choose a less melodic passage — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)

**6. Spinback / vinyl brake / tape stop / power-down**
- Trigger on A's final beat of the phrase, close A before the effect "turns to noise", and drop B on the next "one". No set length; "keep the shortest one that works". It is theatrical, so use it sparingly — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)
- "Cuts and spinbacks take one beat" — [vibesdj transitions](https://vibesdj.io/dj-tools/dj-transitions) (search summary). After a spinback the track slows to a standstill in about 1–2 s; a spinback mid-phrase "feels clumsy" — [djlearn.de transitions](https://djlearn.de/en/dj-transitions-and-mixing-techniques) (search summary)
- Brakes: "most good decks stop in about a second". Overuse makes guests conclude "you simply can't mix" — [DJingTips](https://www.djingtips.com/how-to-dj/backspins-stops-and-power-offs/)
- Variation: spin on the final bar so A's last beat is effectively reversed, then cut straight into B; "works best if track B comes in with a very strong beat" — [OnlineDJTips](http://onlinedjtips.com/dj-techniques/) (search summary)
- Tape-stop plugins can be tempo-synced or free-time. Decide where the next clean beat lands first — [MusicRadar tape stop](https://www.musicradar.com/how-to/tape-stop-start)
- Serato stems "Instrumental Braker" slows only the instrumental and leaves the vocal at speed — [stemsplitterpro Serato](https://stemsplitterpro.com/blog/how-to-use-stems-in-serato/) (search summary)

**7. Hard cut / drop swap on the "one"**
- Count A's final phrase; on the next "one", close A and open B together; start B on the first beat of a recognizable section. Fits hip-hop, pop, open format and large BPM changes — [Digital DJ Pool transitions](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)
- Drop mix tolerates up to ±8 BPM if the tracks don't overlap, and key matters less for a clean hard cut — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)
- "Build and Drop": BPMs can be unrelated (120→72, 80→140). Cue B at its drop and fire it just as A's build-up ends, then cut A — [DJ.Studio tempo techniques](https://dj.studio/blog/dj-tempo-change-techniques)

**8. Acapella over instrumental / stems**
- The usual set-up is deck A playing the incoming track as instrumental (vocal stem muted) and deck B playing the outgoing vocal, synced. Or remove the outgoing vocals while bringing in the incoming acapella, then restore drums. Example: a reggaeton acapella chorus over an Afro instrumental for 8 measures, faded with a vocal echo — [stemsplit.io](https://stemsplit.io/blog/dj-stem-separation-guide); [djalevibes](https://djalevibes.com/en/effets-stems-set-multi-genre/) (search summary)
- Keys must match ("an Am vocal over a track in F# will sound painful"). Shift 1–2 semitones to open more combinations. Cut the instrumental's mids rather than boosting the acapella — [The Ghost Production acapellas](https://theghostproduction.com/acapellas-in-dj-sets-traktor-serato-rekordbox/) (search summary)
- rekordbox 7 offers 3-stem (vocals/drums/inst) and 4-stem (vocals/bass/drums/inst) modes. Serato has Acapella/Instrumental buttons and stem FX (Vocal Echo, Instrumental Echo, Drums Echo, Instrumental Braker) — [The DJ Mixtape stems comparison](https://thedjmixtape.com/virtualdj-stems-vs-serato-stems-vs-rekordbox-stems/) (search summary)

**9. Silence / pause before the drop**
- "Try muting everything for one beat before the drop … a moment of nothing is often more powerful than adding another riser" — [Point Blank](https://www.pointblankmusicschool.com/blog/how-to-make-your-drops-hit-harder-tips-for-edm-producers/)
- Gap options: 1/2 beat is subtle (house/techno); 1 beat is the default (EDM/trap); 1/2–1 bar is dramatic, keeping a vocal tag, reverb tail or riser peak playing. A "fake drop" is a gap, then one bar of something unexpected, then the real drop, at most once per track — [Plugg Supply](https://plugg-supply.net/articles/snare-rolls-and-build-ups)
- At 128 BPM: 1/4-beat gap = 117 ms; 1/2-beat = 234 ms; 1 beat = 469 ms. "Count a pre-drop gap as musical time" — [CMUSE drop timing](https://www.cmuse.org/drop-timing-calculator) (search summary)
- Ramp the riser to about -6 dB in the last bar, then cut it entirely one beat before the drop — [Karanyi Sounds](https://karanyisounds.com/blogs/production-tips/how-to-make-a-drop-that-actually-lands) (search summary)
- The kick must not re-enter until the exact first beat of the drop. Cut everything but reverb tails on beat 4 of the final bar — [MusicProductionWiki](https://musicproductionwiki.com/articles/how-to-build-tension-and-drops-in-edm) (search summary)

**10. White-noise riser + snare roll build-up**
- Build length by genre: mainstage EDM 8 or 16 bars; house 4–8; techno 8–16; dubstep 8; trap 1–4 — [Plugg Supply](https://plugg-supply.net/articles/snare-rolls-and-build-ups)
- 8-bar roll at 128 BPM: bars 1–2 at 1/4 (469 ms apart); bars 3–4 at 1/8 (234 ms); bars 5–6 at 1/16 (117 ms); bar 7 and most of bar 8 at 1/32 (59 ms). Optional 1/16-triplet or 1/64 on the last beat only. "Each stage lasts a quarter of the build"; keep the fastest stage ≤1 bar — [Plugg Supply](https://plugg-supply.net/articles/snare-rolls-and-build-ups)
- Automation lanes: velocity 50–60 → 110–127; track volume -8 dB → 0 dB; snare pitch 0 → +7 to +12 st in the last bar, reset at the drop; snare HPF about 100–200 Hz → 800 Hz–2 kHz, off at the drop; **music-bus HPF off → 200–400 Hz in the last bar, off instantly at the drop**; reverb send low → high, cut at the drop — [Plugg Supply](https://plugg-supply.net/articles/snare-rolls-and-build-ups)
- Trance variant (last 16 bars): 8ths from about bar 9, 16ths by bar 11, 32nds in bars 13–15; HPF the snare at about 300–400 Hz; the kick plays through bar 15 and vanishes for bar 16; bar 16 is silence or a reversed crash; reverb returns HPF'd from about 400–500 Hz upward. At the drop: the pitched riser cuts on the downbeat; the impact sits **20–40 ms early** with a sub boom at 40–60 Hz, a body at 200 Hz–1 kHz and a reverse crash peaking on beat 1; reverb/delay snap to zero; the impact is quieter than kick and lead — [Myloops](https://www.myloops.net/building-tension-before-a-trance-drop)
- Pitched riser: saw/supersaw over 4–8 bars from the 5th to the root; ghost-kick sidechain on pads/risers at 4–6 dB GR, release shortening from about 200 → 80 ms over the last 4 bars — [Myloops](https://www.myloops.net/building-tension-before-a-trance-drop)
- Noise riser: a noise-only synth on an 8-bar note, filter cutoff about 1 kHz → 10 kHz, volume low → high into the drop — [MusicRadar build-up/breakdown](https://www.musicradar.com/how-to/build-up-break-down) (search summary)
- MusicRadar snare build (127 BPM): 8 bars of constant 16ths; velocity 16 → max (linear) controlling volume; snare tuned -3 st; filter at 5.6 kHz, res 35%; automate reverb plus heavy chorus up and raise an HPF so the snare becomes "a wash of stereo noise, like a riser"; delete the final 4 hits for a vocal fill — [MusicRadar snare roll](https://www.musicradar.com/how-to/how-to-create-the-ultimate-snare-roll-build-up)
- Conflict: one source says to pitch the snare *down* a semitone or two across the roll, against the +7–12 st up of Plugg Supply — [beatmakingtools](https://beatmakingtools.com/how-to/how-to-create-buildups) (search summary) vs [Plugg Supply](https://plugg-supply.net/articles/snare-rolls-and-build-ups)

**11. Breakdown crossover / tempo bridges**
- Play A until a sparse/beatless breakdown, bring in B, silence A before its beats return. Works best when the tracks are harmonically compatible — [DJ.Studio tempo techniques](https://dj.studio/blog/dj-tempo-change-techniques)

### Inferences
Recipe specs for implementation, derived by compressing the cited parameters into a 2–6-bar window. `t_land` = incoming hook downbeat = wheel stop. Times are in the governing track's bars.

- **R1 HARD_CUT (1 beat):** A plays to the last beat before a phrase boundary; at t_land A→0 and B starts at its hook downbeat at 0 dB. Optional 1/4-beat gap (≈117 ms at 128). Works at any BPM and key. Fails if the hook isn't a strong downbeat. Automation difficulty: trivial (needs an accurate downbeat on both tracks).
- **R2 ECHO_OUT → HOOK (1–2 bars):** at t_land − 1 bar (or −2 beats at slow tempos), engage echo at 1/2 beat (outgoing tempo), feedback 40%, wet 35%, HPF on the echo return rising 200 Hz → 1 kHz. A's dry fader goes to 0 in 1 beat. B drops at t_land. Cap the tail at <1 bar after t_land (fade the echo return over 1 beat). Works for any BPM. Key-sensitive only if the echoed material is melodic, so HPF it harder when the keys clash. Difficulty: easy.
- **R3 FILTER_SWEEP_BLEND (2–4 bars, |Δtempo| ≤ 3–4%, Camelot-compatible):** B enters 2–4 bars before t_land, LPF'd at about 300–500 Hz (identity hidden; see Q4) or with LOW at -∞. A's HPF sweeps 20 Hz → about 400 Hz on an exponential curve. Bass swap at t_land: A LOW -∞ and fader out over 1 beat; B filter fully open and LOW 0 dB. Difficulty: medium (beatmatch plus grid quality).
- **R4 LOOP_ROLL_EXIT (1–2 bars):** take A's last full bar before t_land − 2 bars. Loop 1 bar, then at each beat boundary halve: 2 beats → 1 → 1/2 → 1/4 → 1/8 (last beat). Ramp A's HPF 0 → 600 Hz and volume -0 → -3 dB, then 1 beat of silence or an echo freeze, then B at t_land. Works at any BPM. Difficulty: easy if the grid is clean.
- **R5 BRAKE/SPINBACK (1 beat + optional gap):** on A's last beat before t_land − 1 beat, apply a pitch/speed ramp from 1.0 → 0 over about 0.5–1 s (brake). Spinback is reverse playback at about −3× decaying to 0 over about 1 s, with a 1-beat LPF close to 1 kHz. B at t_land. Works at any BPM. Comedic or theatrical, so cap it at about 1 in 10 transitions. Difficulty: easy (DSP resampling).
- **R6 REVERB_WASH_FREEZE (1–2 bars):** at t_land − 1 bar, A into reverb with wet ramping to 60%, decay 2 s, A's dry fader → 0 by t_land − 1 beat. Freeze the tail and HPF it (cut lows and mids). B at t_land, freeze tail fades over 1–2 beats. Works for any BPM. Low-energy feel, so best into ballads or emotional songs. Difficulty: easy.
- **R7 NOISE_RISER_SNARE_BUILD (N = 2, 4 or 8 bars; tempo = incoming BPM so the roll locks to the hook):** roll stages are each N/4 bars at 1/4 → 1/8 → 1/16 → 1/32 (for N = 2 the stages are 2 beats each). Velocity 55 → 120. Snare pitch 0 → +7 st. Snare HPF 150 Hz → 1.5 kHz. Noise riser BP/HP cutoff 1 kHz → 10 kHz (exponential), volume -24 dB → -6 dB. Master/outgoing bus HPF off → 300 Hz. Outgoing track volume dips about -3 to -6 dB in the final bar. Kick (from A) muted for the last bar. Last beat: silence (1 beat; 1/2 beat in early game). Impact (sub 40–60 Hz + crash) placed 20–40 ms before t_land, B's hook at t_land with every filter reset. Works for any BPM/key: the noise and snare are atonal and the outgoing music is filtered thin. Difficulty: easy to synthesize; the main risk is level management.
- **R8 STEMS_TEASE (2–4 bars, late game):** over A's last bars, play B's *drums only* (or bass+drums), tempo-locked if Δtempo ≤ 6% and LPF'd. Mute A's vocals. At t_land, B's full mix including vocals starts at the hook. Difficulty: needs offline stem separation (feasible), plus beatmatch.
- **R9 ACAPELLA_BRIDGE (late game, compatible keys):** B's hook vocal (acapella) enters 1–2 bars early over A's instrumental, then B's full mix at t_land. Recognition comes early, which may be undesirable (see Q6). Difficulty: hard (stem quality, key and tempo).
- **R10 POWER_DOWN / SILENCE_SUSPENSE (late-game finale):** brake A over 1–2 s, then 1/2–1 bar of near-silence carried only by the wheel's ticking SFX or a heartbeat, then the impact and hook. Difficulty: easy.
- Difficulty ranking for automation (easiest → hardest): R1, R6, R5, R2, R7, R10, R4 (grid quality), R3 (beatmatch + key), R8 (stems), R9 (stems + key + timing).

### Gaps
- Scratch / "rewind" effect: no source with concrete parameters (scratch speed curves, number of baby scratches, duration) was found.
- Power-down: only "about a second" for deck stops and "1–2 s" for spinbacks were found. No source gave pitch-ramp curve shapes (linear vs exponential).
- "Mashup teaser" technique: no source with concrete bar counts beyond the 8-measure acapella example.
- Most "via search summary" items come from secondary DJ blogs whose pages were not individually fetched.

---

## Q3. Mixing across very different BPMs and genres (70 BPM ballad → 128 BPM dance → 95 BPM reggaeton)

### Takeaway
Open-format, wedding and party DJs largely avoid beatmatching across big gaps. They use cuts on the one, echo-outs, spinbacks, drops/build-and-drop, wordplay, and acapella/loop/FX bridges. They exploit 2:1 (halftime/doubletime) relationships and ride the tempo only for small differences or across a series of tracks. Above about 4% difference, tempo-independent moves are preferred.

### Cited Findings
- Open format is "especially popular in clubs, bars, weddings, private events and corporate parties where the audience is diverse" — [We Are Crossfader](https://wearecrossfader.co.uk/blog/open-format-djing/)
- Open-format DJs "often use quick cuts, echo outs, spinbacks, drops, and wordplay to move between genres with different BPMs", plus acapella, loop or effect bridges — [djsondemand](https://www.djsondemand.co.uk/open-format-djing-explained-for-beginners/); [slappersnbangers](http://slappersnbangers.com/open-format-dj/) (search summary)
- Sync is a legitimate tool for drastic tempo jumps, but "only as reliable as your beat grids", and older or live-drummed records often have failing grids — [NaJade open format](https://djnajade.com/open-format-djing/) (search summary)
- Above roughly a 4% tempo difference, an echo out, a cut on the one or a spinback works better than riding the pitch fader — [vibesdj transitions](https://vibesdj.io/dj-tools/dj-transitions) (search summary)
- Halftime / doubletime: a 120 and a 60 BPM track beatmix "smoothly", as do 70 and 140. For doubletime, B's 3rd beat lines up with A's 2nd and 4th beats. Prefer a "faster cut" over a long crossfade, and time the switch to A's build-up and B's drop — [DJ.Studio tempo techniques](https://dj.studio/blog/dj-tempo-change-techniques)
- Speeding up / slowing down: sync B to A, then gradually move A's tempo to B's and fade. No rate is given. "Transition tracks" that change tempo internally can bridge e.g. 120 house → 140 techno across three tracks — [DJ.Studio tempo techniques](https://dj.studio/blog/dj-tempo-change-techniques)
- Polyrhythmic matching of 60 with 120 or 180 BPM is possible (divide by 3, 4 or 5) — [DJ.Studio tempo techniques](https://dj.studio/blog/dj-tempo-change-techniques)
- Genre tempos: hip-hop/R&B about 70–100 BPM; house 120–130 (sweet spot 125–128); techno/trance 130–145; DnB 170–176 (85–88 half-time) — [SirenMix BPM guide](https://sirenmix.com/blog/bpm-guide)
- Software often misreads tempo by half or double; a "70 BPM" track can read as 140 — [edm-ghost-production half-time](https://edm-ghost-production.com/dj-knowledge-base/half-time-and-double-time-explained) (search summary)
- Wedding practice: mini-sets of about 15 minutes per genre so each age group gets a turn — Phil Morse, [Digital DJ Tips](https://www.digitaldjtips.com/how-to-get-people-dancing-earlier-at-weddings/), as cited by [djtechreviews](https://djtechreviews.com/guides/tutorials/how-long-should-a-dj-play-a-song-for)
- Wedding/party DJs tag tracks by era, crowd, function, BPM, key and reliability to pull bridges like "floor filler, 100 to 110 BPM" quickly — [DJ Phoenix](https://dj-phoenix.com/open-format-dj/)
- Example arc: Afrobeats 100–110 → Amapiano 110–115, "mixed into one continuous arc, with tempo and key bridges" — [BDJ](https://bdjofficial.com/guides/what-is-an-open-format-dj/)
- The drop mix tolerates up to ±8 BPM if there is no overlap — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)

### Inferences
- **Effective tempo ratio:** fold r = BPM_in/BPM_out by powers of 2 into [0.75, 1.5). If |r-1| ≤ 4% → "matched" (blends allowed). 70→128 folds to 140 vs 128 (+9.4%), so not matched → tempo-independent recipe. 95→128 folds to 95 vs 64 (doubletime 190 vs 128, ratio 1.48) → not matched. 95↔100 reggaeton/pop → matched.
- **Governing tempo for builds:** generate risers and snare rolls at the *incoming* track's BPM and phase so the 1/32 roll resolves on the hook's downbeat. The outgoing track exits *before* the roll's tempo becomes evident (echo/brake/wash out within the first 1–2 bars). This "FX bridge" removes any need to beatmatch the songs themselves.
- **Tempo ramp under a build (optional, mid/late game):** if |r-1| is 4–12% and the outgoing material is reduced to an echo/loop of drums with vocals muted, ramp the loop's playback rate linearly to the incoming tempo over the build bars. Artifacts are masked by the noise riser and HPF. This is untested; no source gives a ramp rate.
- **Ballad in/out:** ballads (60–80 BPM, often free-time or with weak grids) should use R6 (reverb wash) or R2 (echo) out, or R1/R10 in. Don't trust their beat grids for loop rolls.
- **Christmas/novelty or older tracks** (live drums, swing) likely have drifting grids, so prefer cut/wash/echo over loop/blend.

### Gaps
- No source gave a numeric tempo-ramp rate (e.g. % per bar) that sounds acceptable; DJ.Studio says only "gradually".
- No source specifically on reggaeton (dembow, about 90–100 BPM) ↔ house transitions beyond generic halftime advice.

---

## Q4. Quick mixing styles (hip-hop/open format, radio/megamix, mashups, TikTok era) and how short a clip can be

### Takeaway
Quick mixing plays only the strongest sections (verse-hook-out, or hook-only) and switches by cut on the one, often with hot cues straight to the chorus. "The quicker the mixing, the higher the energy." Perceptual research shows familiar recordings can be identified above chance from 100–200 ms excerpts, mainly through high-frequency timbre (>1 kHz). Bingo practice treats 3–5 s as a reflex test, 15–20 s as "social", and 30–45 s as standard.

### Cited Findings
- Phil Morse: "the quicker the mixing, the higher the energy", but don't quick-mix a whole set. A quick verse, chorus and out covers an older hit or request. "Open-format quick mixing has value, has an audience" — [djtechreviews](https://djtechreviews.com/guides/tutorials/how-long-should-a-dj-play-a-song-for)
- Peak-time DJs play more tracks using only their strongest sections — [djtechreviews](https://djtechreviews.com/guides/tutorials/how-long-should-a-dj-play-a-song-for)
- Double a short hook by beat-jumping back 16 bars. Loop the outgoing outro and hot-cue the next track's first verse — [We Are Crossfader hip-hop](https://wearecrossfader.co.uk/blog/how-to-mix-hip-hop/)
- Grandmaster Flash's "Quick Mix Theory": cutting, pasting, repeating and extending very small pieces of records — [Wikipedia: Grandmaster Flash](https://en.wikipedia.org/wiki/Grandmaster_Flash)
- Hip-hop toolkit: backspins, cuts on the one, acapella layers. Open format: cuts, echo outs and word cues — [vibesdj transitions](https://vibesdj.io/dj-tools/dj-transitions) (search summary)
- TikTok-era: a DJ with 10.4 M TikTok followers says sped-up remixes exist because "the audience has a shorter attention span … the only way to allow listeners to stick through the best parts of a song is to speed up the BPM" — [NBC News](https://www.nbcnews.com/pop-culture/viral/tiktok-sped-up-fast-songs-sounds-rcna79256)
- Songwriters and A&R attribute shorter songs to streaming skip behaviour and short-form video ("making songs shorter") — [Billboard via PressReader](https://www.pressreader.com/usa/billboard/20221119/281745568379990). Current tracks "front-load their strongest moments" — [Berkeley Economic Review](https://econreview.studentorg.berkeley.edu/hooked-in-30-seconds-how-supply-and-demand-are-shrinking-pop-songs/)
- Listeners matched **200 ms** excerpts of familiar popular recordings to title/artist well above chance, and **100 ms** lower but still above chance. High-pass-filtered 100 ms excerpts were still recognized; low-passed or reversed ones were not. "Timbre is more important than absolute pitch"; time-varying high-frequency information (>1 kHz) mattered — Schellenberg, Iverson & McKinnon (1999), *Psychon. Bull. Rev.* 6(4):641–646 — [ResearchGate](https://www.researchgate.net/publication/12633703_Name_that_tune_Identifying_popular_recordings_from_brief_excerpts)
- Krumhansl (2010): listeners identified artist and title for 25% of **400 ms** popular-music clips — cited in [Music Perception 2022 plink paper](https://doi.org/10.1525/mp.2022.39.3.289) (search summary)
- Bingo clip-length tiers: 3–5 s makes it "a reflex test"; 15–20 s makes it "social" — [BingoCardOnline mixtape bingo](https://www.bingocardonline.com/mixtape-bingo/). "Name That Intro" variant: first 5 s only — [Quizado](https://quizado.com/blog/music-bingo)

### Inferences
- **Recognition is near-instant if the hook is presented cleanly.** The constraint is not perception but enjoyment and the time to find and mark the card. For a bingo clip, the minimum "enjoyable" length is probably about one full hook phrase (8 bars, ≈15–20 s at 100–128 BPM). Speed formats can go to 4 bars (≈8–10 s).
- **Filter design for suspense, based on Schellenberg:** a **low-pass** teaser of the incoming song (cutoff ≤ 500–800 Hz) should largely hide its identity, while a **high-pass** teaser preserves it. So LPF = "mystery tease" and HPF = "reveal". Opening the LPF on the hook downbeat is an identity-reveal moment that pairs naturally with the wheel stopping. This extrapolates from 100 ms clips, and longer LPF'd passages may still be recognizable through rhythm, so it needs testing.
- Radio megamix and quick-mix logic map directly onto the early-game phase: hook in, hook out, cut on the one, minimal FX.

### Gaps
- No primary source for radio megamix editing conventions (e.g. bars per song in a megamix) was found.
- No research found on how short a clip can be while remaining *enjoyable* (as opposed to identifiable).
- The "TikTok transition" trend (fast meme-style cuts) has no rigorous source; only song-length and sped-up-remix journalism was found.

---

## Q5. Hype and tension design: energy curves, tension/release, build-ups, crowd psychology, stingers, end-of-round escalation

### Takeaway
Empirical work on EDM's breakdown → build-up → drop routine shows dancers move less in the breakdown and rate the build-up and drop as most pleasurable, with skin-conductance peaks. Huron's ITPRA model explains why: pre-outcome tension raises arousal, and the confirmed prediction rewards. Game-show scoring (Who Wants to Be a Millionaire) escalates by transposing cues up a semitone per level. Radio imaging uses 1–3 s stingers and 4–15 s sweepers that resolve on the song's first downbeat. Escalation tools for late rounds are therefore longer builds, rising key, deeper filtering, a longer silence before the hit, and a bigger impact.

### Cited Findings
- 16 participants danced to a DJ mix under motion capture. Quantity of motion changed markedly across breakdown, build-up and drop; participants rated build-up and drop as "particularly pleasurable and motivational". Tracks with a break routine produced bigger movement changes and higher pleasure ratings than flat tracks — Solberg & Jensenius, *Empirical Musicology Review* 11(3–4) — [ResearchGate](https://www.researchgate.net/publication/316469270_Pleasurable_and_Intersubjectively_Embodied_Experiences_of_Electronic_Dance_Music); [arj.no announcement](http://www.arj.no/2017/05/03/emr2016/)
- Break routines produce "energizing and uplifting experiences" with increased skin conductance and bodily pleasure — Solberg & Dibben (2019), *Music & Science* — [White Rose eprints PDF](https://eprints.whiterose.ac.uk/id/eprint/145911/1/Solberg&Dibben2019.pdf)
- Dancers' motion is reduced in breakdowns and "gradually rebuilt during buildup" — [Grosz et al. 2025, Musicae Scientiae](https://journals.sagepub.com/doi/10.1177/10298649251321709)
- ITPRA (Imagination–Tension–Prediction–Reaction–Appraisal): the tension response produces "pre-outcome optimum arousal and attention in preparation for the event", and the prediction response rewards accurate prediction after the outcome — Huron, *Sweet Anticipation* (MIT Press 2006) — [MIT Press preview](https://direct.mit.edu/books/monograph/1961/bookpreview-pdf/2429413); [MTO review](https://mtosmt.org/issues/mto.09.15.3/mto.09.15.3.aversa.html)
- *Who Wants to Be a Millionaire*: the Strachans' question cues rise **one semitone per question** in the later stages "to emphasise the rising tension". The score plays through almost the whole show — [Wikipedia: Who Wants to Be a Millionaire?](https://en.wikipedia.org/wiki/Who_Wants_to_Be_a_Millionaire%3F_(British_game_show)); [Millionaire wiki music scores](https://millionaire.fandom.com/wiki/Music_scores). The narrator of a GSN special said the tracks were "mimicking the sound of a beating heart" — [Wikipedia: Who Wants to Be a Millionaire](https://en.wikipedia.org/wiki/Who_Wants_to_Be_a_Millionaire)
- Radio imaging: sweepers are 4–10 s — [Nobex](https://www.nobexradio.com/blog/radio-imaging-and-jingles) — vs 12–15 s / up to 30 words — [LFM Audio](https://www.lfmaudio.co.nz/wfp_faq/what-are-stingers-sweepers-and-cold-mixouts/); [Zeno.fm](https://zeno.fm/blog/radio-imaging/) (conflicting). Stingers run 1–3 s — [Zeno.fm](https://zeno.fm/blog/radio-imaging/) — or ≤5 s — [RadioKeysDan](http://radiokeysdan.com/Voice_Imaging.html)
- Imaging "should resolve into the song, not stop dead in front of it … ends on a chord, an impact or a filter release that arrives on the song's first downbeat". Effects are a whoosh, riser, filter sweep or impact; 2–4 sweepers per hour; rotation rules so the same sweeper doesn't repeat within an hour; never two voiced elements back-to-back — [Nobex](https://www.nobexradio.com/blog/radio-imaging-and-jingles)
- Energy Boost key changes should be used "every 20-30 minutes" since overuse overwhelms the audience — [Mixed In Key](https://mixedinkey.com/harmonic-mixing-guide/energy-boost-dj-mixing-tutorial/)
- A short gap before the drop creates contrast so "the returning kick and bass feel much bigger"; 1/2 bar to 1 bar is the "dramatic" setting — [Plugg Supply](https://plugg-supply.net/articles/snare-rolls-and-build-ups)
- Loop rolls are best "once or twice an hour"; spinbacks and stops are theatrical and should be rare — [vibesdj](https://vibesdj.io/dj-tools/dj-transitions) (search summary); [DJingTips](https://www.djingtips.com/how-to-dj/backspins-stops-and-power-offs/)

### Inferences
- **Escalation axes driven by `songs_remaining_to_likely_winner`** (map each linearly or stepwise from early → late):
  - Window length: 5 s → 11 s (≈2 → 4–6 bars), quantized to whole bars of the incoming BPM.
  - Build complexity: cut/echo → riser only → riser + snare roll (stages 1/4→1/32) → riser + roll + loop roll + bus HPF + silence beat + layered impact.
  - Pre-hit silence: 0 → 1/4 beat → 1/2 beat → 1 beat → 1/2–1 bar (the finale only).
  - Riser/drone base pitch: transpose +1 semitone per song once "near the end" (the Millionaire technique), anchored in the incoming key so the final pitch lands on the hook's tonic or 5th. Cap at about +5–7 st to avoid novelty.
  - Snare pitch rise: +3 st (early) → +7 st → +12 st (late).
  - Outgoing-track treatment: plain cut → echo out → HPF + loop roll → brake/power-down into silence.
  - Wheel deceleration SFX: tick rate following the wheel's real angular velocity, so the tick spacing lengthens as tension rises (heartbeat analog). Inference from the Millionaire "heartbeat" description; no direct source.
- **Novelty budget:** limit "theatrical" recipes (spinback, brake, power-down, loop roll, fake drop) to about 1 in 6–10 transitions and never twice in a row. This mirrors the DJ advice of "once or twice an hour" scaled to a fast bingo pace. Rotate stingers so the same one doesn't repeat within about 10 songs (radio rotation-separation logic).
- **Bingo-specific ideas:** (a) a "near-bingo" mode, where the announcer drop or stinger plus a longer build plays when the app detects a player one square away; (b) "fake drop" once per round, with gap → 1 bar of the wheel's tick → real hook; (c) muffled LPF tease of the next song during the wheel spin, opened on the stop (see Q4); (d) semitone-rising drone across the last N songs; (e) impact SFX layered on the wheel-stop frame. Everything should resolve *on* the hook downbeat, per the radio-imaging rule.

### Gaps
- No specific source on game-show "drum roll" lengths or impact/whoosh SFX durations was found. Radio sources gave only element-level lengths.
- No empirical study on optimal build-up length vs pleasure (beyond Solberg's qualitative break-routine findings) was found.
- No source on "energy curves across a set" with numeric shapes was fetched.

---

## Q6. Music bingo practice: clip lengths, pacing, round structure, end-of-round excitement

### Takeaway
Hosts typically play 15–30 s clips (Bingofy: 30–45 s standard, 15–20 s speed, about 60 s when people sing along). Rounds run about 15–30 minutes and 20–30 songs. Clips start at or near the hook/chorus, not the intro. Speed or "shotgun" rounds use about 15 s clips, and reflex formats 3–5 s. Several hosts prefer short silences between clips (no crossfade) so players can mark cards. Suspense near the end comes mostly from host talk: calling out near-winners, telling the room a winner is close, and bigger final prizes.

### Cited Findings
- 15–30 s is "the sweet spot". Longer clips slow the game because once recognized "the rest of the clip is dead air" — [101planners](https://www.101planners.com/music-bingo/); similar in [Wasingo](https://www.wasingo.com/how-to-play-music-bingo); [BingoDaubers](https://bingodaubers.co/how-to-play-music-bingo/)
- "Try 30 to 45 seconds and adjust after the practice song". Let recognizable party tracks play "closer to a minute". "Avoid starting every song at the quiet opening"; queue tracks "near the hook". Turn off crossfade to control the gap. Use the gap for pattern reminders and prize details. Shotgun rounds use "roughly 15-second clips" and should be announced first. Minimum unique songs: 20 (3×3), 25 (4×4), 30 (5×5) — [Bingofy host guide](https://www.bingofy.co/blog/music-bingo-host-guide)
- 30 s is standard; 60 s for less familiar genres or older audiences — [Bingwow](https://bingwow.com/blog/how-to-play-music-bingo). Muzingo says 30–60 s — [Muzingo rules](https://playmuzingo.com/music-bingo-rules-everyone-should-follow/)
- "A few seconds of silence between clips builds suspense and gives players time to find and mark the square. Avoid crossfading songs together" — [Wasingo](https://www.wasingo.com/how-to-play-music-bingo) (search summary). Long pauses, however, "make the night feel disorganised" — [Boogie Bingo](https://www.boogiebingo.live/guides/how-to-run-a-music-bingo-night) (search summary)
- Round length: about 20–30 min; three 20-minute rounds is "a good night" — [BingoCardOnline](https://www.bingocardonline.com/mixtape-bingo/). A single-line round of 24–30 songs at 10–15 s clips runs about 15–20 min; set a limit of about 20–30 clips per round — [BingoCardOnline](https://www.bingocardonline.com/mixtape-bingo/) (search summary; attribution not verified)
- Near the end: "if someone is close to winning, build suspense!"; call out near-winners by name with hints and jokes — [Muzingo rules](https://playmuzingo.com/music-bingo-rules-everyone-should-follow/); [Muzingo spice up](https://playmuzingo.com/spice-up-your-music-bingo/). Tell guests when a round is close to a winner — [Ultimate Music Bingo bar guide](https://ultimatemusicbingo.com/how-to-host-a-bar-music-bingo-night/). Smaller early prizes and a stronger final prize build anticipation — [Boogie Bingo](https://www.boogiebingo.live/guides/how-to-run-a-music-bingo-night) (search summary). Use dramatic music during calls in a grand finale — [Casino Supply](https://www.casinosupply.com/blogs/news/14-tips-to-make-your-bingo-event-unforgettable) (search summary)
- Reveal title/artist after each clip as a "natural applause/groan moment". Read back the winning line to verify; false calls are "part of the fun" — [Boogie Bingo](https://www.boogiebingo.live/guides/how-to-run-a-music-bingo-night) (search summary)
- Rockstar Bingo (app): host picks a playlist (predefined, or any Spotify playlist with **75+ songs**), shares a code, plays "a short snippet" of each song; players dab virtual cards and call bingo in-app; the host verifies with a click. Pro "Jumbotron" shows the last 3 songs played, game code and QR, and can use YouTube/Vimeo music videos — [Rockstar Bingo FAQ](https://rockstar.bingo/faq); [Rockstar Bingo home](https://rockstar.bingo/); [Jumbotron](https://rockstar.bingo/blog/music-video-bingo-jumbotron)

### Inferences
- **Clip-length schedule for the app:** early game about 4–8 bars of hook (≈8–15 s at 100–128 BPM); mid game 8 bars (15–20 s); late game 8–16 bars (15–35 s), extended when singing is detected or the presenter holds. Always end clips on a phrase boundary.
- **Bingo-specific tension vs crossfades:** hosts warn against crossfading because overlapping songs confuse identification and marking. The roulette window is therefore best treated as an *FX bridge* (outgoing exits early via echo/wash/brake; noise/drum/stinger material fills the gap), not a two-song vocal blend. Keep any vocal overlap below about 1 beat.
- The roulette window functions like a radio sweeper (4–15 s, resolving on the song's first downbeat), and its length range matches the sweeper conventions.
- The "song count to winner" signal enables automatic end-of-round escalation that human hosts do verbally (calling out near-winners). The app can trigger announcer drops ("one away!") or stingers instead.

### Gaps
- No primary product documentation was found for Rockbot music bingo (search returned nothing) or for clip-length settings in Rockstar Bingo (only "short snippet").
- No source found on how professional bingo apps automate end-of-round escalation. All end-game suspense advice was host-performed (verbal) rather than audio-design.
- No data found on how many songs a typical 77-song game takes to produce a winner.

---

## Q7. Decision table: choosing a recipe given phase, BPM difference, key compatibility, intro or hook position, energy; entering at the hook

### Takeaway
No published source gives a full decision table, so the table below is a synthesis. Cited thresholds drive it: tempo match within ±3–4% (blend OK) vs more than 4% (use tempo-independent moves); a 2:1 ratio counts as matched; Camelot 0/±1/relative is safe, +2/+7 a boost, anything else means no tonal overlap; drop mixes tolerate ±8 BPM without overlap. Game phase sets the window length and FX complexity. The incoming song should always be entered on the **first downbeat of its chorus/hook** (a pre-marked hot cue), timed to coincide with the wheel stop, optionally with a 1–2-bar pre-roll of its pre-chorus kept filtered.

### Cited Findings
- Cue the chorus/drop as a "drop cue" to jump straight to the peak moment for a quick mix-in — [DJ Record Pool](https://djrecordpool.com/how-to-use-hot-cues/). Assign the chorus to the same pad on every track — [Name On The Beat](https://nameonthebeat.com/en/blogs/tips-tricks-voor-djs/how-to-set-hot-cues-dj)
- Start B "on the first beat of a recognizable section" for cuts — [Digital DJ Pool](https://digitaldjpool.com/blog/dj-transitions-for-beginners/)
- Bingo: play the most recognizable part (usually the chorus) and skip long or quiet intros — [Bingofy](https://www.bingofy.co/blog/music-bingo-host-guide); [101planners](https://www.101planners.com/music-bingo/)
- Above about 4% Δtempo, prefer echo out, cut on the one or spinback — [vibesdj](https://vibesdj.io/dj-tools/dj-transitions) (search summary). Bass swap ±4 BPM, loop exit ±6 BPM, drop mix ±8 BPM without overlap; long melodic overlaps of more than 8 beats need key match — [The Ghost Production](https://theghostproduction.com/dj-transitions-clean-two-weeks/)
- Halftime/doubletime relationships are beatmixable — [DJ.Studio](https://dj.studio/blog/dj-tempo-change-techniques)
- Build-and-drop works with unrelated BPMs: fire B's drop cue as A's build ends — [DJ.Studio](https://dj.studio/blog/dj-tempo-change-techniques)
- Low-pass removes the cues listeners use to identify recordings; high-pass preserves them — [Schellenberg et al. 1999](https://www.researchgate.net/publication/12633703_Name_that_tune_Identifying_popular_recordings_from_brief_excerpts)

### Inferences
**Inputs:** phase ∈ {early, mid, late, final}; Δt = folded tempo difference (%); K = Camelot class {compatible (0, ±1, rel), boost (+2, +7), clash}; hook_entry ∈ {hook at a clean downbeat with an instrumental/pre-chorus lead-in, hook with a vocal pickup/anacrusis before the downbeat, no clean entry}; E_out, E_in (energy 0–1 from analysis).

**Window and complexity by phase (wheel duration quantized to whole bars of the incoming BPM):**
| Phase | Wheel | Bars (≈) | Allowed recipes | Pre-hit gap | Stinger |
|---|---|---|---|---|---|
| early | 5–6 s | 2 | R1 cut, R2 echo-out, R5 brake (rare) | 0–1/4 beat | none or tiny whoosh |
| mid | 6–8 s | 2–4 | R2, R4 loop roll, R6 wash, R7 (2-bar), R3 if matched | 1/4–1/2 beat | whoosh + impact |
| late | 8–11 s | 4–6 | R7 (4-bar) + R4, R8 stems tease, R3 if matched, Millionaire-style semitone drone | 1/2–1 beat | riser + impact + announcer drop |
| final (1–2 songs left) | 11 s (or extended) | 4–8 | R10 power-down → silence → R7 full + fake drop (once) | 1/2–1 bar | full impact stack |

**Recipe choice (apply after the phase filter; first matching row wins):**
| Δt (folded) | K | E_in vs E_out | Recipe |
|---|---|---|---|
| any | any | E_in ≪ E_out (into a ballad) | R6 reverb wash → B at hook (or R2), no riser; gentle impact or none |
| ≤ 3–4% | compatible | any | R3 filter blend (2–4 bars) with bass swap at t_land; late game add R7 noise over it |
| ≤ 3–4% | boost (+2/+7) | E_in ≥ E_out | R3 compressed to ≤ 1–2 bars overlap, or R7 → cut; mark as "energy lift" |
| ≤ 3–4% | clash | any | R2 echo-out (HPF'd tail) or R7 with A thinned to drums only; no melodic overlap > 1 beat |
| 4–8% | compatible/boost | any | R4 loop roll → cut, or R7 at B's tempo with A echoed out in bar 1 (optional hidden tempo ramp) |
| > 8% or unrelated | any | E_in > E_out | R7 build (A exits by brake/echo early) → impact → hook |
| > 8% or unrelated | any | E_in ≈ E_out | R2 echo-out → R1 cut on hook; mid/late add 1/2-beat gap + impact |
| any | any | A has poor grid (ballad, live drums) | avoid R3/R4; use R1/R2/R6/R10 |

**Entering at the hook (all recipes):**
1. Offline: detect the chorus start (section analysis) and snap it to the nearest *downbeat that is also a phrase start* (bar index mod 4 = 0). Store `hook_downbeat_t` and `hook_bpm`.
2. Detect pickup vocals (anacrusis) that begin before the downbeat (common in pop). If present, start B's audio at `hook_downbeat_t − pickup_len` and align so the *downbeat* (not the first syllable) lands on the wheel stop. Otherwise the first word gets clipped and recognition suffers.
3. Optional pre-roll: start B 1–2 bars early (pre-chorus) behind an LPF (≤ 500–800 Hz) or with only its drums stem, and open fully at the hook downbeat. That is a tease without giving away identity, followed by a reveal at the stop.
4. Wheel timing: choose N bars from the phase table, set `wheel_duration = N × 240/hook_bpm` s (clamped to 5–11 s; pick the N that fits), and start the spin at `t_land − wheel_duration`. The wheel animation's deceleration curve is then solved to stop exactly at t_land.
5. Land: every filter and FX resets at t_land, the impact goes 20–40 ms early, and B plays at 0 dB for its clip of 4/8/16 bars, exiting on a phrase boundary.

### Gaps
- The decision table is a synthesis; no source provides a validated recipe-selection matrix, so thresholds need listening tests with the actual 77-song library.
- No source quantified recognition loss when a hook's first syllable is clipped, or how much LPF is needed to hide a song's identity over multi-second teasers.
