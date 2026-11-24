# Academic and MIR literature on automatic DJ mixing, cue points, transitions and highlight detection (for the "Quina musical" bingo mixer)

Context used for the inferences below: about 77 mixed-genre songs (pop, rock, reggaeton, Christmas, Spanish/Catalan), analysed offline. Each song enters at its hook, aligned to beat and phrase. The transition must happen inside a 5–11 s roulette window that ends exactly when B "lands". Hand-tagged best/main/secondary hook timestamps already exist.

---

## 1. Automatic DJ systems: what each did and what worked

### Takeaway
Every classic auto-DJ (Vande Veire 2018, Bittner/Spotify 2017, Ishizaki 2009, Mosaikbox 2024) works the same way. Beat and downbeat grids come first. Transitions are restricted to downbeats and structural boundaries. A small weighted cost or rule set picks the cue pair, and the render uses a tempo-matched crossfade or EQ swap. The most relevant results for us are three. (a) In Bittner's study, beat and downbeat tracking errors, not key, were the main cause of bad transitions. (b) Listeners are sensitive to tempo changes beyond about ±10%. (c) For vocal-rich pop, cue placement matters more than the blending effect (DJustify 2026). Almost all systems assume EDM, which matters because our 77 songs are not EDM.

### Cited Findings

**Vande Veire & De Bie 2018, "From raw audio to a seamless mix" (drum and bass auto-DJ)**
- Published as EURASIP J. Audio, Speech, Music Proc. 2018:13. It grew out of a 2017 Ghent master's thesis. Code is at github.com/lenvdv/auto-dj (thesis code) and github.com/lenvdv/dnb-autodj-3 (Python 3 port) — [Springer](https://link.springer.com/article/10.1186/s13636-018-0134-8); [repo](https://github.com/lenvdv/auto-dj); [py3 repo](https://github.com/lenvdv/dnb-autodj-3)
- Pipeline:
  - Beat tracking uses Davies & Plumbley (autocorrelation of an onset curve, constant tempo assumed), at 98.2% accuracy on 220 DnB songs.
  - A machine-learning classifier labels each beat 1/2/3/4 of the bar, with downbeats chosen by consensus, at 98.1% accuracy. The author notes it "generalizes poorly to other EDM sub-genres."
  - Structural segmentation uses Foote's self-similarity novelty plus rules: boundaries on downbeats, and "a segment never starts in the middle of a phrase." It scores 94.3%, and about 90% of songs are fully annotated correctly — [author blog](https://lenvdv.github.io/2018-03-20-autodj/)
- Segments are labelled only "high energy" or "low energy." There are three transition types:
  - **Double drop:** both songs are cued 16 measures before a drop, and the drops are aligned.
  - **Rolling:** the main section of A goes into B's drop.
  - **Relaxed:** A is cued 16 measures before a high-to-low boundary.
  - Fade-in and fade-out are reported as 16 and 32 measures. The next type is chosen by a Markov transition matrix (e.g. after a rolling transition: rolling 0.8, relaxed 0.2) — [paper via search extract](https://link.springer.com/article/10.1186/s13636-018-0134-8); [blog](https://lenvdv.github.io/2018-03-20-autodj/). Caveat: the 16/32-measure figures and the matrix come from search-engine extracts of the paper; I could not fetch the full text (Springer auth redirect).
- Transition lengths and volume/filter progressions are fixed per transition type, using a 3-band EQ (bass/mid/treble). Next-song selection runs in order: key filter (harmonic mixing, optional small pitch shift), then a 3-D "theme" descriptor (energy and spectral content), then rhythmic similarity of onset curves, then vocal-clash avoidance via a vocal activity detector — [blog](https://lenvdv.github.io/2018-03-20-autodj/)
- **It does not transfer outside DnB.** On Zehren's multi-genre EDM cue dataset, the DnB auto-DJ cue detector performed worse than all other algorithms: "the design of DNB-autoDJ, specific to drum and bass, does not transfer to the genres present in our dataset" — [Zehren et al. 2022, CMJ (DiVA PDF)](https://www.diva-portal.org/smash/get/diva2:1811100/FULLTEXT02.pdf)

**Bittner et al. 2017 (Spotify), "Automatic playlist sequencing and transitions," ISMIR 2017 pp. 442–448**
- Sequencing is a shortest Hamiltonian path over a feature space. Features are an 8-D acoustic embedding, key mapped onto a 3-D circle of fifths with major/minor relatives, and log2 tempo, optionally octave-invariant. The path is found with greedy HAM-1/HAM-2 or a TSP 2-approximation — [ISMIR PDF](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- **Transition algorithm (the most directly reusable formalization):**
  - Given a fixed transition length n beats, candidate start points are restricted to downbeats.
  - Candidates are pruned: A's fade-out ends in A's last 25%, and B's fade-in starts in B's first 20%.
  - For every candidate pair (i, j), cost matrices are computed over the overlap: timbre distance, chroma distance, inverse loudness (quiet regions sound awkward), vocalness sum (penalizes vocal overlap), and penalties if the region does not end on a drop or section boundary.
  - Each matrix is min-max standardized and a weighted sum is taken. The cue pair is the argmin — [ISMIR PDF](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- **Drops are found from crowd data, not audio.** Peaks of aggregated playhead-scrubbing data (Lamere's "drop machine") are found with a median-filter adaptive threshold, snapped to the previous downbeat, and peaks in the first 15 s are discarded — [ISMIR PDF](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- **Tempo ramp formula.** Each beat in the overlap is time-stretched so the beat duration interpolates linearly: d_out(n) = ((N−n)/N)·d1 + (n/N)·d2. Beat n of A is stretched by d1/d_out and beat n of B by d2/d_out — [ISMIR PDF](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- **Evaluation and adoption:**
  - On 48 dance-genre pairs with ≤5 BPM tempo difference, curators rated transitions 64.1% Good, 28.3% OK and 7.6% Bad.
  - Reasons for bad transitions: "beats do not align" 15.2%, mid-vocal transition 6.5%, not on downbeat 2.2%, key clash 0%. The authors conclude beat/downbeat tracking is the main bottleneck.
  - About 95% of Spotify users do not enable plain crossfade. An A/B test adding DJ-curated transitions raised daily return rate by 1.4 percentage points — [ISMIR PDF](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- The authors note their constraints target "party" music and quadruple meter, and may not suit e.g. rap — [ISMIR PDF](https://archives.ismir.net/ismir2017/paper/000086.pdf). Page-range note: dblp and the PDF say 442–448, while some later papers cite 472–478 — [arXiv 2407.06823](https://arxiv.org/pdf/2407.06823)

**Ishizaki, Hoashi & Takishima 2009, "Full-automatic DJ mixing system with optimal tempo adjustment…," ISMIR 2009 pp. 135–140**
- **Listening study.** 96 subjects heard 18 RWC pop songs with progressive tempo changes, stretched with SoundTouch and SOLA. Average discomfort onset was at a speed-up factor of 1.227 or a slow-down factor of 0.852, and listeners are more sensitive to slowing down. Peak discomfort counts sat at 1.10 and 0.90. From this the paper defines a "stricter" applicable range of 0.90 < f < 1.10 and an "average" range of 0.852 < f < 1.227. SoundTouch preserved comfort better than SOLA near f = 1 — [ISMIR PDF](https://archives.ismir.net/ismir2009/paper/000043.pdf)
- **Discomfort function.** L_dc(f) = a(f−1) for f > 1 and b(1/f−1) for f < 1, with a = 0.765 and b = 1.0 — [ISMIR PDF](https://archives.ismir.net/ismir2009/paper/000043.pdf)
- **"Optimal tempo adjustment."** First octave-fold A's tempo (T'_A = 2^C·T_A, C ∈ {−2..2}, pick the C closest to T_B, prefer smaller |C|). Then pick a common target tempo that splits the discomfort equally between the two songs, so both are stretched a little instead of one being stretched a lot. Example: 60 vs 120 BPM needs no stretching. Strong beats are aligned by cross-correlating beat powers over the crossfade range, to avoid matching strong beats to weak ones — [ISMIR PDF](https://archives.ismir.net/ismir2009/paper/000043.pdf)
- A third-party Python mashup project says it implements this paper — [GitHub poke19962008/Mash-Up](https://github.com/poke19962008/Mash-Up)

**Kim et al. 2020 (mir-aidj), "A computational analysis of real-world DJ mixes using mix-to-track subsequence alignment," ISMIR 2020**
- **Data.** 1,557 mixes from 1001Tracklists with 13,728 tracks and 20,765 transitions, mostly House and Trance. Average tempo is 127 BPM — [arXiv PDF](https://arxiv.org/pdf/2008.10267)
- **Method.** Beat-synchronous chroma (CENS) plus 12 MFCCs, aligned with subsequence DTW (librosa), with key invariance via 12 circular chroma shifts. Cue-out is the last beat where the previous 32 beats follow a diagonal warping path. Cue-in is the first beat where the next 32 beats do — [arXiv PDF](https://arxiv.org/pdf/2008.10267)
- **Tempo and key.**
  - 86.1% of played tracks are tempo-adjusted by less than 5%, 94.5% by less than 10%, and 98.6% by less than 20%.
  - Only 2.5% of tracks are key-transposed, and 94.3% of those by just one semitone. DJs leave "master tempo"/key-lock on — [arXiv PDF](https://arxiv.org/pdf/2008.10267)
- **Phrasing.** The transition-length histogram peaks at every 32 beats, the dance-music phrase — [arXiv PDF](https://arxiv.org/pdf/2008.10267)
- **Cue agreement across DJs playing the same track.**
  - 23.6% of cue pairs coincide exactly.
  - 40.4% are within 1 bar, 73.6% within 8 bars, and 86.2% within 16 bars — [arXiv PDF](https://arxiv.org/pdf/2008.10267)
- **Cue-in versus human-labelled track boundaries.** The cue-in point (where the next track fully appears) is the best estimate of a human-labelled boundary, closest in 52% of cases versus 30% for cue-out and 18% for cue-mid. Human boundary annotations disagree with a standard deviation of about 9 s — [arXiv PDF](https://arxiv.org/pdf/2008.10267)
- **Code.** [mir-aidj/djmix-analysis](https://github.com/mir-aidj/djmix-analysis) (Python, madmom 0.16.1); companion site [mir-aidj.github.io/djmix-analysis](https://mir-aidj.github.io/djmix-analysis/)

**Schwarz & Fourer (IRCAM), DJ-mix reverse engineering**
- **Pipeline.** Rough alignment finds track start and time-stretch factor. Sample-precise alignment follows. Cue points and fade curves are then estimated in the time-frequency domain to resist interference from the other track — [Springer LNCS chapter (CMMR 2019)](https://link.springer.com/chapter/10.1007/978-3-030-70210-6_2); [Semantic Scholar](https://www.semanticscholar.org/paper/Methods-and-Datasets-for-DJ-Mix-Reverse-Engineering-Schwarz-Fourer/aa41bf97c789779692dc2a9fd28822be61b9d256)
- **UnmixDB (ISMIR 2018 LBD).** Synthetic beat-synchronous mixes built from 229 free track excerpts, with 12 effect/time-scaling variants and ground truth. DOI 10.5281/zenodo.1422385, generation code at [Ircam-RnD/unmixdb-creation](https://github.com/Ircam-RnD/unmixdb-creation). Its switch points are algorithmic, not expert — [Semantic Scholar](https://www.semanticscholar.org/paper/UnmixDB:-A-Dataset-for-DJ-Mix-Information-Retrieval-Schwarz-Fourer/183f66521035ab03af50b94f99e4fdc825bcb8a9)

**Mosaikbox (Sowula & Knees, ISMIR 2024)**
- **Scope and pipeline.** An EDM-focused fully automatic DJ.
  - **Beat grid:** fitted by dual-annealing minimization of the beat-grid vs detected-beat error, which avoids octave and 1/3 tempo errors.
  - **Mixability:** a weighted sum of rhythm, timbre, key, harmony and spectral balance per beat shift. Rhythm compares kick, snare and hi-hat patterns on a 12-subdivision grid, following AutoMashUpper. Timbre uses MFCCs plus flatness and "dirtiness."
  - **Lyrics:** lyric similarity via sentence embeddings.
  - **Stems:** source separation into four stems, with rule-based stem removal (e.g. vocals) to avoid clashes.
  - **Play length:** a minimum play time of 55 s per song.
  - **Evaluation:** a listening test showed it significantly outperforming a baseline — [ISMIR paper PDF (TU Wien)](https://repositum.tuwien.at/bitstream/20.500.12708/212628/1/Sowula-2024-Mosaikbox%20Improving%20Fully%20Automatic%20DJ%20Mixing%20Through%20Rule-ba...-vor.pdf); [dblp](https://dblp.org/rec/conf/ismir/SowulaK24.html)
- Code is linked from the paper at github.com/robaerd/mosaikbox — [search result summarising paper footnote](https://repositum.tuwien.at/bitstream/20.500.12708/212628/1/Sowula-2024-Mosaikbox%20Improving%20Fully%20Automatic%20DJ%20Mixing%20Through%20Rule-ba...-vor.pdf). I did not open the repo.

**DJustify (Hsu, Lin, …, Yi-Hsuan Yang; arXiv 2610.33434, Oct 2026), the first auto-DJ explicitly for vocal-rich pop**
- **Motivation.** Prior auto-DJs "mostly target electronic dance music." With pop, the choices of next track, cue points and technique are coupled — [arXiv](https://arxiv.org/pdf/2610.33434)
- **Inputs.** Each track gets a beat/downbeat grid and functional segmentation from All-In-One, chords, a singing-voice-activity CRNN, and valence/arousal. Cue anchors are restricted to phrase ends, section boundaries, harmonic restarts and low-frequency onsets — [arXiv](https://arxiv.org/pdf/2610.33434)
- **Planner and techniques.** A local LLM (Qwen3.6-35B-A3B) proposes the cue-out, cue-in, overlap length and technique. Techniques range from "blend" (long overlap) to "cut" (abrupt handover plus echo, brake, backspin or filter) — [arXiv](https://arxiv.org/pdf/2610.33434)
- **Deterministic checker gates on the rendered audio, each with a repair action (directly reusable without an LLM):**
  - Vocal cut mid-phrase → shift the cue to the phrase end.
  - Vocals collide in the overlap → shorten the overlap or cut.
  - Silent gap or energy hole → adjust the length or technique.
  - Early cut in A or late entry in B → move the cue.
  - Entry stays in B's intro → re-cue to the verse or chorus — [arXiv](https://arxiv.org/pdf/2610.33434)
- **Results.** Blind test with N = 103, 400 pop tracks at 75–140 BPM, mean ratings 1–10:
  - Human DJ 6.7, DJustify 5.6, the same pipeline seeded with Bittner's cues 4.8, Bittner/Spotify-style beat-matched crossfade 4.7, Mosaikbox 4.0.
  - Swapping only the cue points dropped the score from 5.6 to 4.8. The authors conclude "transition quality depends on the cue candidates the planner starts from."
  - The checker improves reliability (it fixed rare mid-phrase vocal cuts) rather than mean quality — [arXiv](https://arxiv.org/pdf/2610.33434)
- **Code.** [ddman1101/DJustify](https://github.com/ddman1101/DJustify) and demos at [jamie930625.github.io/djustify](https://jamie930625.github.io/djustify/) (links as stated in the paper; not opened).

**Other systems and surveys**
- **TIME 2025 survey.** Williams et al. (QMUL/Sony CSL) list the transition techniques used in the literature:
  - Beat-matched fixed-length crossfade (the most common), 3-band EQ mixing, vocal-clash avoidance, and the double-drop/rolling/relaxed types.
  - Loop-out, looped drum roll, samples or MC voice-over, slam/cut, echo-out, and power-down.
  - The survey warns that repeated use of the same few techniques makes machine transitions recognisable and disliked. "No automatic DJ transition generation system has matched the performance of human DJs" — [TIME 2025 PDF](https://drops.dagstuhl.de/storage/00lipics/lipics-vol355-time2025/LIPIcs.TIME.2025.20/LIPIcs.TIME.2025.20.pdf)
- **Kim et al. 2017, "Automatic DJ mix generation using highlight detection"** (ISMIR LBD). A fully automatic mix generator that picks a clip from each track with a highlight-detection model plus key and tempo estimation. This is conceptually the closest prior art to a "hook-clip medley" — [ResearchGate](https://www.researchgate.net/publication/322007163_Automatic_DJ_Mix_Generation_Using_Highlight_Detection)
- **DJ StructFreak (Kim & Nam, ISMIR 2023 LBD).** Uses music-structure embeddings to find the best-matching segment in another track for a user-chosen mix point — [ISMIR 2023 LBD page](https://ismir2023program.ismir.net/lbd_328.html)
- **Apple Music AutoMix (iOS 26, 2025).** Apple describes it as AI-based transitions "with time stretching and beat matching." Third-party reviewers report it sometimes skips 30–40 s of intro to find a beat-match and gets confused by false endings — [9to5Mac](https://9to5mac.com/2025/06/16/automix-apple-music-ios-26/); [MacRumors](https://www.macrumors.com/how-to/ios-enable-automix-feature-apple-music/); [mystats.music blog (lower reliability)](https://mystats.music/blog/apple-music-automix-2026)
- **Mixxx AutoDJ (2.3+).** It has four modes. "Full Intro + Outro" (the default) aligns the end of A's outro with the end of B's intro, using user- or auto-set intro and outro markers. "Fade At Outro Start" aligns the starts. Silence before the first sound and after the last is skipped — [Mixxx manual](https://manual.mixxx.org/2.3/en/chapters/djing_with_mixxx.html); [Mixxx 2.3 news](https://mixxx.org/news/2020-07-09-intro-outro-sections/)

### Inferences
- Bittner's Algorithm 1 is the right skeleton for our "fixed pair, fixed duration window" problem: standardized feature costs on a downbeat-candidate grid, then argmin. We just replace "B's first 20%" with "B's hook candidates," and n beats with the roulette window.
- Real DJ transitions are long: peaks at 32-beat multiples, about 15 s+ at 127 BPM. A 5–11 s window (roughly 2.5–5.5 bars at 120 BPM) falls in the "cut/short blend" part of the technique continuum, not the 16–32-bar blends of Vande Veire or the House/Trance data.
- Bittner's curators flagged beat misalignment (15%) far more often than key clashes (0%). For our short overlaps, the quality of the beat/downbeat grid (verify it by hand for 77 songs) matters more than harmonic matching.

### Gaps
- I could not fetch the full Vande Veire & De Bie text (Springer auth redirect). Listener-study numbers and exact EQ curve shapes are unverified.
- Mosaikbox listening-test numbers and repo maturity were not checked.
- Apple AutoMix internals are not documented by Apple. Third-party descriptions are speculative.

---

## 2. Cue-point detection (Zehren et al., Mixxx/rekordbox heuristics, phrase/downbeat approaches)

### Takeaway
Cue-point detectors are rule-based or learned, and essentially all are EDM-only. Three rules dominate: on a downbeat, at the start of a 4-, 8- or 16-bar period, and at a point of high novelty in drums, loudness, timbre or harmony. A fourth comes from Zehren: the section that follows must be salient enough to stand alone. For pop hooks, use these rules to snap and validate our hand-tagged hooks. Do not try to discover hooks with them.

### Cited Findings
- **Zehren, Alunno & Bientinesi 2020 (arXiv 2007.08411).** Rules come from DJ interviews:
  - **(1) Novelty:** a switch point marks high novelty in rhythmic density, loudness, timbre and/or harmony.
  - **(2) Sections:** it always lies on the downbeat at the start of a period, i.e. a 4-bar period in EDM.
  - **(3) Salience:** the following section must "stand on its own in the mix."
  - **Implementation:** kick, snare and hi-hat onsets from Vogl's drum transcription, HPSS energies, CQT and PCP; features aggregated on strong beats (beats 1 and 3, via madmom); a Foote checkerboard kernel spanning 8 bars (4-bar segments); peak picking; period-phase estimation; and a harmonic-energy salience filter — [arXiv PDF](https://arxiv.org/pdf/2007.08411)
- **Zehren 2020 results.** On 134 annotated EDM tracks (99–147 BPM), precision is 86% and recall 49% with all rules enabled. Mixed In Key reached 65% precision. MSAF and "every period" heuristics were about 30%. After expert listening, about 96% of generated points were usable. Code is [MZehren/Automix](https://github.com/MZehren/Automix) and the dataset is [MZehren/M-DJCUE](https://github.com/MZehren/M-DJCUE) — [arXiv PDF](https://arxiv.org/pdf/2007.08411)
- **Zehren et al. 2022 (Computer Music Journal 46(3)).** Two variants. EXPERT uses rules and few false positives. STAT uses statistics and gives more candidates at the same precision. Both reach about 85% objective precision, versus 67–68% for Mixed In Key and lower for the DnB auto-DJ. Subjective precision is about 90%, dropping to about 76% when 2+ annotators must agree. An average novelty above 0.2 across features almost always marks a switch point — [DiVA PDF](https://www.diva-portal.org/smash/get/diva2:1811100/FULLTEXT02.pdf); [MIT Press DOI](https://direct.mit.edu/comj/article-pdf/46/3/67/2164818/comj_a_00652.pdf)
- **CUE-DETR (Argüello, Lanzendörfer, Wattenhofer, ISMIR 2024).**
  - **Model:** a COCO-pretrained DETR object-detection transformer fine-tuned on mel spectrograms.
  - **Dataset:** EDM-CUE, 4,710 EDM tracks with 21k cue points from 4 professional DJs plus beat, downbeat and tempo, "35x larger" than M-DJCUE. Most tracks use 16-bar phrases, then 8-bar, and DJs often cue at the start of irregular sections.
  - **Results:** it beats Automix and Mixed In Key on precision. The best F1 is only 0.46 (8-bar model vs 16-bar phrase ground truth).
  - **Code and weights:** [ETH-DISCO/cue-detr](https://github.com/ETH-DISCO/cue-detr) — [arXiv PDF](https://arxiv.org/pdf/2407.06823)
- **Mixxx.** "Intro start" defaults to the first notable sound. Intro end and outro start are manual, and AutoDJ aligns the intro and outro sections. An open issue notes there is no fallback when markers are missing — [Mixxx PR #2103](https://github.com/mixxxdj/mixxx/pull/2103); [issue #11648](https://github.com/mixxxdj/mixxx/issues/11648)
- **rekordbox phrase analysis.** It first classifies a track's "mood" as HIGH, MID or LOW from tempo, rhythm, kick drum and sound density, which picks the label vocabulary:
  - HIGH: Intro/Up/Down/Chorus/Outro.
  - MID: Intro/Verse 1–6/Chorus/Bridge/Outro.
  - LOW: Intro/Verse 1–2/Chorus/Bridge/Outro.
  - A Fill-in marker of up to 4 beats is placed at the end of an Intro, Up or Chorus.
  - If a pop song is misclassified as "dance," all labels are wrong, and the mood cannot be chosen manually — [Pioneer lighting guide PDF](https://cdn.rekordbox.com/files/20200520205106/rekordbox6.0.1_lighting_operation_guide_EN.pdf); [Deep Symmetry ANLZ docs](https://djl-analysis.deepsymmetry.org/rekordbox-export-analysis/anlz.html); [vibesdj guide](https://vibesdj.io/how-to/see-phrases-in-rekordbox)
- **Phrase evidence from real mixes.** Transition lengths peak at every 32 beats. 73.6% of different DJs' cue points for the same track fall within 8 bars of each other — [Kim et al. 2020](https://arxiv.org/pdf/2008.10267)
- **Downbeat and beat trackers usable on pop:**
  - **All-In-One** (beats, downbeats, segments) — [mir-aidj/all-in-one](https://github.com/mir-aidj/all-in-one)
  - **Beat This!** (Foscarin, Schlüter, Widmer, ISMIR 2024; MIT; beats and downbeats without DBN post-processing; on PyPI; about 20M parameters; supports non-CUDA accelerators since v1.1.0) — [CPJKU/beat_this](https://github.com/CPJKU/beat_this); [JKU page](https://research.jku.at/en/publications/beat-this-accurate-beat-tracking-without-dbn-postprocessing/)

### Inferences
- Our hand-tagged "best/main/secondary" points are effectively expert switch-in points, a better ground truth than any detector for these 77 songs. The detectors' role is to (a) snap each tag to the nearest downbeat and phrase start, (b) check Zehren's salience rule (energy or vocal/harmonic onset after the point), and (c) propose fallbacks.
- The "period" in Zehren's rule 2 should be computed from All-In-One segment starts plus bar counting (multiples of 4 or 8 bars from the segment start). Do not assume a global 4-bar phase: pop has pickup bars, 2-bar tags and odd-length bridges. rekordbox's dance-versus-pop misclassification shows how brittle a global assumption is.
- Pop hooks often begin with a vocal pickup (anacrusis) before the chorus downbeat. For recognition, B's audible entry may need to start 1–2 beats or 1 bar before the chorus downbeat while the alignment target stays on that downbeat. This is an inference; I found no paper that measures it.

### Gaps
- No public cue-point dataset or detector covers pop, reggaeton or Spanish/Catalan repertoire. M-DJCUE and EDM-CUE are EDM only.
- I found no published evaluation of cue detectors against "recognizability" (time-to-recognition), which is our real objective.

---

## 3. Learned transitions, differentiable mixers, and DJ-mix datasets: is any of it usable off the shelf?

### Takeaway
Not really for production. DJtransGAN is the only released learned DJ-transition model with weights (MIT). It needs cue points as input, was trained on EDM, and in its own listening test was not significantly better than a linear crossfade or a rule-based EQ mixer. Differentiable-console and diffusion work is either general multitrack mixing or has no DJ-transition release. The valuable, reusable parts are the parametric EQ/fader curve shapes and the reverse-engineering tools for measuring real DJ curves.

### Cited Findings
- **DJtransGAN (Chen, Hsu, Liao, Martínez Ramírez, Mitsufuji, Yang; ICASSP 2022).**
  - **Mixer:** a differentiable DJ mixer whose fader and multi-band EQ are time-frequency masks. Fade curves are parameterized by start s and slope δ (PReLU-based), and EQ bands are built from cascaded differentiable low-pass "fade curves in frequency." The result goes back through iSTFT with the input phases.
  - **Training:** a GAN, so no paired data is needed.
  - **Results:** the listening test found "no significant difference among GAN, Linear and Rule," all below human — [arXiv 2110.06525](https://arxiv.org/pdf/2110.06525)
- **DJtransGAN repo.** MIT licence. A pretrained generator downloads with `--download`. Inference takes `--prev_track`, `--next_track`, `--prev_cue` and `--next_cue`. Training data (Livetracklist mixes plus MTG-Jamendo EDM) is not shareable, a separate data-generation pipeline repo exists, and the README describes the code as about 3/4 complete — [ChenPaulYu/DJtransGAN](https://github.com/ChenPaulYu/DJtransGAN)
- **The TIME 2025 survey on DJtransGAN.** It "employed unfamiliar mixing techniques and subsequently its performance was only considered on par with rule-based methods" — [TIME 2025 PDF](https://drops.dagstuhl.de/storage/00lipics/lipics-vol355-time2025/LIPIcs.TIME.2025.20/LIPIcs.TIME.2025.20.pdf)
- **Steinmetz, Pons, Pascual, Serrà (arXiv 2010.10291).** A differentiable mixing console of neural audio effects for multitrack mixing (stems to stereo mix). It outputs human-readable parameters and beat baselines with audio engineers. It is not a DJ-transition model — [arXiv](https://arxiv.org/abs/2010.10291)
- **Kim, Yang & Nam, DAFx 2022, "Joint estimation of fader and EQ gains of DJ mixers using convex optimization."**
  - **Method:** each EQ is modelled as a fixed filter response times a gain, which makes joint fader + 3-band EQ gain estimation convex.
  - **Assumption:** the previous track's gains only decrease and the next track's only increase.
  - **Results:** the EQ3-Fader model is best on synthetic and MixesDB data.
  - **Data and code:** the [mir-aidj/djmix-dataset](https://github.com/mir-aidj/djmix-dataset) repo and `pip install djmix` (downloads mix and track audio; JSON metadata) — [DAFx PDF](https://mac.kaist.ac.kr/pubs/KimYangNam-dafx2022.pdf). Predecessor: NIME 2021 sub-band reverse engineering — [ResearchGate](https://www.researchgate.net/publication/353369837_Reverse-Engineering_The_Transition_Regions_of_Real-World_DJ_Mixes_using_Sub-band_Analysis_with_Convex_Optimization)
- **Other datasets and tools:**
  - **1001Tracklists-derived:** 1,557 mixes, mostly House and Trance — [Kim et al. 2020](https://arxiv.org/pdf/2008.10267)
  - **UnmixDB:** synthetic — [Zenodo via Semantic Scholar](https://www.semanticscholar.org/paper/UnmixDB:-A-Dataset-for-DJ-Mix-Information-Retrieval-Schwarz-Fourer/183f66521035ab03af50b94f99e4fdc825bcb8a9)
  - **EDM-CUE:** 4,710 tracks — [arXiv 2407.06823](https://arxiv.org/pdf/2407.06823)
  - **M-DJCUE:** [GitHub](https://github.com/MZehren/M-DJCUE)
  - **Raveform (TISMIR):** metrical and functional structure annotations for EDM tracks in DJ mixes — [TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.288)
  - **DJ-mix transcription with multi-pass NMF:** [arXiv 2410.04198](https://arxiv.org/pdf/2410.04198)
  - The TIME 2025 survey says no large public corpus of DJ mixes with audio and track labels exists — [TIME 2025 PDF](https://drops.dagstuhl.de/storage/00lipics/lipics-vol355-time2025/LIPIcs.TIME.2025.20/LIPIcs.TIME.2025.20.pdf)
- **Generative-model transitions.** DJustify cites "DJ AI" (Kınay et al., Audio Mostly 2025), which sequences a playlist and synthesizes transitions with generative and embedding models — [DJustify refs](https://arxiv.org/pdf/2610.33434). A search for diffusion- or transformer-based DJ-transition generators (2023–2026) found no dedicated, released model. The nearest work is general music inpainting/continuation (e.g. "Arrange, inpaint, and refine," arXiv 2402.09508) — [search-surfaced reference list in arXiv 2409.06096](https://arxiv.org/pdf/2409.06096)

### Inferences
- For a live bingo with 77 known songs, a deterministic parametric mixer is the pragmatic choice. It needs per-deck gain automation, a 3-band EQ (low-cut "bass swap" at the switch beat), a high-pass/low-pass filter sweep, and echo/brake FX. DJtransGAN's curve parameterization (start + slope per band) is a compact way to encode these curves as data.
- Learned generators add risk (artifacts, the EDM prior) and no proven benefit over rules for short transitions.

### Gaps
- No pop-trained or short-transition (under 10 s) learned DJ model was found.
- The djmix-dataset counts and licence are not stated on its README.
- I did not verify whether any diffusion "transition infill" model ships weights usable for 5–11 s bridges.

---

## 4. Highlight, hook and chorus detection: accuracy on pop and ease of use

### Takeaway
On pop, a plain loudness/RMS-energy window is a strong baseline for chorus/highlight finding: F ≈ 0.76 on RWC-Pop, against 0.80 for the attention model, 0.48 for repetition and 0.36 for "middle 30 s." Repetition-based RefraiD finds the right chorus in 80 of 100 RWC songs. All-In-One is the easiest modern tool: pip-installable, MIT, it outputs beats, downbeats and "chorus" segments, and it is trained on Harmonix pop. Boundaries are only about 66% accurate within ±0.5 s, so snap results to downbeats and check them against our hand tags.

### Cited Findings
- **Pop Music Highlighter (Huang, Chou, Yang; TISMIR 2018).**
  - **Method:** an attention model trained only on emotion labels, whose attention peaks give the highlight.
  - **Evaluation:** RWC-Pop 100 songs, 30 s highlight against the nearest chorus (Goto's R/P overlap metric).
  - **F-measure:** NAM-LF(pos) 0.799 (R 0.902, P 0.740). Spectral energy 0.756. Spectral centroid 0.539. Roll-off 0.508. Repetition (MSAF) 0.480. Middle 0.356. Oracle upper bound 0.949.
  - **Interpretation:** the authors say "chorus sections tend to be louder than other parts" — [arXiv 1802.10495](https://arxiv.org/pdf/1802.10495)
- **Highlighter repo.** TensorFlow 1.2 / Python 3.6, MP3 input, outputs per-second attention scores. Code is GPL-3.0 and the pretrained model is CC BY-NC 4.0 — [remyhuang/pop-music-highlighter](https://github.com/remyhuang/pop-music-highlighter)
- **Goto's RefraiD (IEEE TASLP 2006).**
  - **Method:** chroma-based repeated-section analysis that finds all chorus sections and both ends of each, including modulated (key-shifted) choruses.
  - **Accuracy:** 80 of 100 RWC-Pop songs correct (mean F 0.938 on those). 9 of 10 modulated-chorus songs were correct.
  - **Use:** powered the SmartMusicKIOSK "jump to chorus" listening station — [Goto TASLP PDF](https://staff.aist.go.jp/m.goto/PAPER/IEEETASLP200609goto.pdf); [ISMIR 2003 paper](https://staff.aist.go.jp/m.goto/PAPER/ISMIR2003MSDgoto.pdf)
- **pychorus.** A simplified Goto-style chroma-repetition method. `pip install pychorus`, then `find_and_output_chorus(input, output, clip_length)` returns the chorus start in seconds. Minimum clip length is 15 s, the licence is MIT, and it is unmaintained (v0.1, 6 commits) — [vivjay30/pychorus](https://github.com/vivjay30/pychorus)
- **All-In-One (Kim & Nam, WASPAA 2023).**
  - **Outputs:** BPM, beats, downbeats, beat positions, and segments labelled start/end/intro/outro/break/bridge/inst/solo/verse/chorus.
  - **Architecture:** Demucs-separated stems plus neighborhood attention, about 300K parameters, trained on Harmonix (8-fold).
  - **Harmonix scores:** beat F1 0.958, downbeat F1 0.915, segment boundary HR.5F 0.660, label PWF 0.738 (better than SpecTNT's 0.558 HR.5F) — [arXiv 2307.16425](https://arxiv.org/pdf/2307.16425)
  - **Practicalities:** MIT licence, `pip install allin1`. NATTEN auto-installs on macOS. Runs on CPU or GPU (10 songs, 33 min, took 73 s on an RTX 4090). MP3 decoding can shift timing by 20–40 ms, so convert to WAV first — [mir-aidj/all-in-one](https://github.com/mir-aidj/all-in-one)
- **Supervised chorus detection (Wang, Smith, Chen, Song, Wang; ByteDance; ICASSP 2021).** A CNN with multi-task "chorusness" plus boundary activation curves and joint post-processing. It significantly outperformed public segmentation and chorus baselines on 3 datasets — [arXiv 2103.14253](https://arxiv.org/abs/2103.14253)
- **SpecTNT functional structure (Wang, Hung, Smith; ICASSP 2022).** A 7-class taxonomy (intro, verse, chorus, bridge, outro, instrumental, silence) with framewise "chorusness/verseness." It outperforms the earlier chorus detectors in cross-dataset tests. Harmonix Set = 912 Western pop songs — [arXiv 2205.14700](https://arxiv.org/html/2205.14700.pdf). Follow-up: MuSFA (partially labelled data) — [arXiv 2211.15787](https://arxiv.org/pdf/2211.15787)
- **Crowd-sourced highlights.**
  - **Spotify scrubbing:** Spotify used aggregated playhead-scrubbing peaks as "drop" points — [Bittner et al. 2017](https://archives.ismir.net/ismir2017/paper/000086.pdf)
  - **YouTube "Most Replayed":** 100 bins per video, shown for videos with roughly ≥50K views. It has been used as highlight supervision for video (Mr. HiSum, NeurIPS 2023) and podcasts (Rhapsody), but I found no music/chorus study — [Mr. HiSum](https://proceedings.neurips.cc/paper_files/paper/2023/file/7f880e3a325b06e3601af1384a653038-Paper-Datasets_and_Benchmarks.pdf); [Rhapsody arXiv 2505.19429](https://arxiv.org/pdf/2505.19429)
  - **Feature status:** one blog claims the graph may have been removed recently — [lilachbullock.com](https://www.lilachbullock.com/youtube-most-replayed/)
- **Why the chorus.** For pop/rock there is stronger agreement that the chorus is the representative part, and a user study found the chorus most important for getting familiar with a song — [Huang et al. 2018](https://arxiv.org/pdf/1802.10495)

### Inferences
- **Recommended stack:**
  - **(1)** Hand-tagged hooks are primary.
  - **(2)** All-In-One "chorus" segment starts are the secondary candidates.
  - **(3)** A max-RMS sliding window of about 8–16 bars, snapped to a downbeat, breaks ties and catches songs where All-In-One mislabels sections. Christmas songs and Catalan folk-pop may lack a clear verse/chorus contrast.
  - **(4)** pychorus or RefraiD-style repetition is only a cross-check.
- **Validation.** Use our tags as ground truth, with Goto's overlap R/P or a hit-rate at ±1 beat and ±1 bar. This gives a per-song confidence and flags the songs that need manual attention before the event.
- **Pickup lines.** "Recognizable fast" probably favours the *first* line of the chorus, or a signature riff or intro (e.g. iconic intros), over the loudest point. The "best/main/secondary" tags capture this, and no detector models it.

### Gaps
- I found no public SpecTNT or ByteDance chorus-detector code or weights, so they are not usable off the shelf.
- I found no accuracy figures for All-In-One's "chorus" label specifically. PWF covers all labels.
- I found no evaluation on Latin/reggaeton or Spanish/Catalan repertoire, or on Christmas songs.
- I found no research on "time-to-recognition" as a function of entry point. That is the metric that matters for bingo.

---

## 5. Compatibility scoring (tempo, key/Camelot, energy, timbre) for choosing the transition type for a fixed pair

### Takeaway
Because our order is random, compatibility should choose *how* to transition, not *what* to play next. The literature supports three tiers by tempo ratio after octave folding:
- within about ±5–6%: beat-matched blend (where 86% of real DJ adjustments fall)
- within ±10%: short beat-matched or ramped overlap (Ishizaki's "strict" comfort range)
- beyond that: a non-beatmatched "cut move" (echo-out, filter, brake or SFX into a hard hook entry)

Key matters for long overlaps of harmonic content. It mattered little in Bittner's short-transition test, where curators flagged key clash in 0% of cases.

### Cited Findings
- **Tempo:**
  - 86.1% of real DJ tempo adjustments are under 5% and 94.5% under 10% — [Kim et al. 2020](https://arxiv.org/pdf/2008.10267)
  - Listener discomfort starts on average at 1.227× speed-up or 0.852× slow-down, with a stricter comfort band of 0.90–1.10, and slow-down is more noticeable — [Ishizaki 2009](https://archives.ismir.net/ismir2009/paper/000043.pdf)
  - Octave folding (2^C) removes half/double errors and lets e.g. 60 and 120 BPM mix untouched — [Ishizaki 2009](https://archives.ismir.net/ismir2009/paper/000043.pdf)
- **Key:**
  - DJs transpose only 2.5% of tracks, almost always by ±1 semitone — [Kim et al. 2020](https://arxiv.org/pdf/2008.10267)
  - Spotify's key embedding places circle-of-fifths neighbours and relative major/minor equidistant, the same idea as Camelot adjacency — [Bittner et al. 2017](https://archives.ismir.net/ismir2017/paper/000086.pdf)
  - Curators flagged "key clash" in 0% of transitions — [Bittner et al. 2017](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- **Psychoacoustic alternative to Camelot (Gebhardt, Davies, Seeber).** Score consonance (roughness plus pitch commonality) between the two excerpts over pitch shifts of ±6 semitones in 1/8-semitone steps, and pick the most consonant shift. It was judged more pleasant than the baselines in listening tests — [DAFx 2015](https://www.ntnu.edu/documents/1001201110/1266017954/DAFx-15_submission_36.pdf); [Applied Sciences 2016](https://www.mdpi.com/2076-3417/6/5/123)
- **Per-region costs (Bittner's transition step).** Timbre distance, chroma distance, low loudness (penalized), simultaneous vocals (penalized) and structural-boundary alignment — [Bittner et al. 2017](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- **Vande Veire's next-song filter order:** key, then a "theme" of energy and spectrum, then onset-curve rhythmic similarity, then vocal clash — [blog](https://lenvdv.github.io/2018-03-20-autodj/)
- **Mosaikbox's beat-wise mixability:** M = ω_R·rhythm(drum patterns on a 12-subdivision grid) + ω_T·timbre(MFCC, flatness, dirtiness) + ω_K·key + ω_H·harmony + ω_L·spectral balance — [Mosaikbox PDF](https://repositum.tuwien.at/bitstream/20.500.12708/212628/1/Sowula-2024-Mosaikbox%20Improving%20Fully%20Automatic%20DJ%20Mixing%20Through%20Rule-ba...-vor.pdf)
- **Technique repertoire.** DJustify chooses among "blend" moves (long overlap) and "cut" moves (echo, brake, backspin, filter) per pair, and repairs on vocal collision or energy holes — [DJustify](https://arxiv.org/pdf/2610.33434). The TIME 2025 survey lists slam/cut, echo-out and power-down as standard non-blend techniques — [TIME 2025](https://drops.dagstuhl.de/storage/00lipics/lipics-vol355-time2025/LIPIcs.TIME.2025.20/LIPIcs.TIME.2025.20.pdf)

### Inferences
- **Pairwise "transition-type selector":**
  - ρ = octave-folded BPM ratio; ΔK = Camelot distance, or Gebhardt consonance if implemented; ΔE = loudness/energy difference between A's exit region and B's hook; V = vocal activity in A's exit bar and B's pre-hook bars.
  - |ρ−1| ≤ 0.06 and ΔK ≤ 1: beat-matched blend with bass swap.
  - |ρ−1| ≤ 0.10: short (1–2 bar) ramped overlap, drums/filtered only.
  - Otherwise, or with a vocal clash: a cut move, where A echoes out or filter-sweeps on its phrase end, the roulette SFX or riser bridges, and B enters hard on its hook downbeat at T.
- **Mixed tempos.** With reggaeton (about 90–100 BPM, or double-time), ballads, Christmas songs and 120+ BPM pop all in the pool, a large share of random pairs will fall in the "cut" tier. Design that tier to sound intentional, e.g. a "drop" at the roulette stop, rather than treating it as a failure mode.
- **Don't transpose.** Avoid pitch-shifting B. Recognition depends on the original key and timbre, and real DJs almost never transpose (Kim 2020). Use key only to decide whether harmonic parts may overlap.

### Gaps
- I found no study of transition-type choice for non-EDM, wide-tempo pools, nor any listening data on "cut" transitions versus blends for pop.
- I found no evidence on how roulette or visual SFX masks tempo or key mismatch.

---

## 6. Mashability (AutoMashUpper) and beat-synchronous overlay of the incoming hook

### Takeaway
AutoMashUpper's mashability combines harmonic, rhythmic and spectral-balance compatibility, computed on beat-synchronous features at phrase sections and searched over allowable key shifts and tempo changes. It is the formal tool for deciding whether B's hook can be *layered* over A for a bar or two, as opposed to cutting. With stems available (Demucs, as All-In-One already produces), the safer modern pattern is Mosaikbox-style stem rules: overlay B's drums or instrumental, or tease B's vocal hook over A's drums, and never overlap two lead vocals.

### Cited Findings
- **AutoMashUpper (Davies, Hamel, Yoshii, Goto; ISMIR 2013 / IEEE TASLP 22(12) 2014).** Mashability is computed between phrase sections of the input song and candidates. It is defined by harmonic similarity of beat-synchronous chromagrams (over a user range of key shifts and tempi), rhythmic compatibility and spectral balance. Its contribution is making segments fit via transposition and tempo change — [ACM DL](https://dl.acm.org/doi/10.1109/TASLP.2014.2347135); [ResearchGate](https://www.researchgate.net/publication/265130656_AutoMashUpper_Automatic_Creation_of_Multi-Song_Music_Mashups); [Semantic Scholar](https://www.semanticscholar.org/paper/AutoMashUpper:-An-Automatic-Multi-Song-Mashup-Davies-Hamel/876ff2f6c3aa8a0bd3f801e7c8dec8126fbdcafa)
- **Phrase boundaries.** AutoMashUpper constrains transitions to phrase boundaries found with Foote's novelty — [Zehren et al. 2020](https://arxiv.org/pdf/2007.08411)
- **Reimplementation.** An open-source version exists ([migperfer/AutoMashupper](https://github.com/migperfer/AutoMashupper)) but lacks the rhythmic component. Neural Loop Combiner (ISMIR 2020) criticizes treating similarity as compatibility, since segments can match despite different harmony and rhythm — [Neural Loop Combiner arXiv 2008.02011](https://arxiv.org/pdf/2008.02011)
- **Stem-level compatibility** for mashups — [arXiv 2103.14208](https://arxiv.org/pdf/2103.14208)
- **Mosaikbox stems.** It separates 4 stems, detects vocal segments on the vocal stem, removes incompatible stems by rule, and EQs the vocal and drum stems during the blend — [Mosaikbox PDF](https://repositum.tuwien.at/bitstream/20.500.12708/212628/1/Sowula-2024-Mosaikbox%20Improving%20Fully%20Automatic%20DJ%20Mixing%20Through%20Rule-ba...-vor.pdf)
- **Vocal overlap is penalized everywhere:**
  - Bittner's vocalness cost — [Bittner](https://archives.ismir.net/ismir2017/paper/000086.pdf)
  - DJustify's vocal collide/cut gates — [DJustify](https://arxiv.org/pdf/2610.33434)
  - Vande Veire's vocal-clash detector — [blog](https://lenvdv.github.io/2018-03-20-autodj/)

### Inferences
- A cheap mashability check per pair, on 1–2 bars at A's exit and B's pre-hook, is enough at our scale: cosine similarity of beat-synchronous chroma (no transposition) plus vocal-overlap = 0. Pass gives a short layered teaser (e.g. B's hook instrumental or drums under A's last bar). Fail gives a cut.
- Precomputing Demucs stems offline for 77 songs is feasible: All-In-One already runs Demucs internally. It enables "drums-only" blends between songs whose harmony clashes.

### Gaps
- I found no published evaluation of mashability on pop/Latin material.
- The original AutoMashUpper code is not public, as far as I found.

---

## 7. Practical algorithm sketch: exit in A, hook entry in B, tempo ramp, and landing B's hook downbeat at time T

### Takeaway
The problem is a small constrained search, formalized the way Bittner et al. do it: a weighted, standardized cost over candidate downbeat pairs. Add three constraints: B's hook downbeat must land exactly at T; the lead-in must fit inside the roulette window (t0+5 ≤ T ≤ t0+11 s, with the target length set by round progress); and the tempo factors must respect Ishizaki's comfort bounds. Tempo uses Ishizaki's octave folding and split adjustment. Bittner supplies the per-beat linear tempo ramp. DJustify's deterministic gates check the rendered result. No single paper formalizes the roulette version, so the sketch below is our synthesis.

### Cited Findings (building blocks this sketch relies on)
- **Candidate pairs.** Restrict to downbeats, weight toward section boundaries, score timbre, chroma, loudness, vocals and boundaries over the overlap, and take the argmin of the weighted standardized costs — [Bittner et al. 2017](https://archives.ismir.net/ismir2017/paper/000086.pdf)
- **Switch points:** on the downbeat at the start of a period, high novelty, and a salient following section — [Zehren et al. 2020](https://arxiv.org/pdf/2007.08411)
- **Alignment by structural events:**
  - Vande Veire's double drop aligns both songs' drops, cueing 16 measures before — [Vande Veire & De Bie](https://link.springer.com/article/10.1186/s13636-018-0134-8)
  - Mixxx aligns the end of A's outro with the end of B's intro — [Mixxx manual](https://manual.mixxx.org/2.3/en/chapters/djing_with_mixxx.html)
- **Tempo:**
  - Per-beat linear interpolation of beat durations across an N-beat overlap — [Bittner et al. 2017](https://archives.ismir.net/ismir2017/paper/000086.pdf)
  - Octave folding, a discomfort function, a split target tempo, and strong-beat cross-correlation — [Ishizaki et al. 2009](https://archives.ismir.net/ismir2009/paper/000043.pdf)
- **Render checks:** vocal-cut, vocal-collision, energy-hole and "entry stuck in intro" gates with repair actions — [DJustify](https://arxiv.org/pdf/2610.33434)
- **Beat accuracy.** Beat-grid errors are the main source of bad automatic transitions — [Bittner et al. 2017](https://archives.ismir.net/ismir2017/paper/000086.pdf). A fitted constant beat grid fixes jitter and octave errors — [Mosaikbox](https://repositum.tuwien.at/bitstream/20.500.12708/212628/1/Sowula-2024-Mosaikbox%20Improving%20Fully%20Automatic%20DJ%20Mixing%20Through%20Rule-ba...-vor.pdf)

### Inferences (proposed algorithm; synthesis, not from a single paper)

**Offline, per song (all 77):**
1. Run All-In-One (WAV input) and Beat This! for beats and downbeats. Fit a constant (or piecewise-constant) beat grid, Mosaikbox-style, and hand-verify the downbeat phase, since that is Bittner's #1 failure cause.
2. Collect the segments and labels (All-In-One); a vocal activity curve per beat (RMS of the Demucs vocal stem, thresholded); per-beat loudness; and the key.
3. Build **hook candidates H_B**:
   - hand tags (best > main > secondary), each snapped to the nearest downbeat;
   - then All-In-One chorus starts;
   - then the max-RMS 8-bar window start.
   - Store each with a confidence, plus a **pre-roll anchor**: the downbeat 1, 2 or 4 bars before the hook. Prefer a pre-roll that starts at a phrase start and does not begin mid-vocal-phrase.
4. Build **exit candidates E_A**: every downbeat, tagged with phrase-start status (bar index mod 4 or 8 from its segment start, or a segment boundary), "inside a sung line" status, and local energy.

**Online, when "next" is pressed at wall time t0, with A at position p0:**
1. **Window:** D_min = 5 s, D_max = 11 s, and D_target(round) grows from about 5–6 s early in the round to about 10–11 s late.
2. **Tempo plan:**
   - Octave-fold, giving ρ = BPM_B' / BPM_A with B' = 2^C·BPM_B.
   - **Blend tier (|ρ−1| ≤ 0.06):** split the stretch between A and B as Ishizaki does, or keep B native and ramp only A, because B must sound natural at the hook.
   - **Short-ramp tier (≤ 0.10):** stretch only during the overlap and reach B's native tempo exactly at T, using Bittner's per-beat interpolation.
   - **Cut tier (> 0.10):** no beat-matching.
3. **Enumerate (e ∈ E_A, h ∈ H_B, L ∈ {0, 1, 2, 4} bars of lead-in):**
   - **Blend and ramp tiers:** T is the wall time at which A reaches downbeat e, with B's hook downbeat placed at T, B starting at h − L·bar_B, and the overlap spanning [T − L·bar, T]. A fades or bass-swaps out at T, or within 1 bar after.
   - **Cut tier:** A exits at its own phrase end e (via echo-out, filter sweep or brake, any time in [t0, T]). The roulette SFX fills the gap, B starts at h − L·bar_B, and T is free to equal t0 + D_target. Snap T to the roulette's own animation frame or beat.
   - **Feasibility:** D = T − t0 must lie in [D_min, D_max], and the lead-in must fit after t0.
4. **Cost:**
   - J = w1·|D − D_target| + w2·[e not a phrase start] + w3·[e cuts a sung line] + w4·vocal-overlap(A[e−L..e], B[h−L..h]) + w5·L_dc(f_A) + w5·L_dc(f_B) + w6·keyClash·harmonicOverlap + w7·(1 − hookConfidence(h)) + w8·energyHole + w9·[B pre-roll starts mid-phrase].
   - Min-max standardize each term as Bittner does, then take the argmin.
   - Prefer a hook rank of best > main > secondary, and use secondary only when it fits the window clearly better. Optionally use the hook confidence to vary which hook is used across repeats.
5. **Render.** Automate the fader and 3-band EQ: A's low band cut at T (bass swap), a B high-pass that opens during the lead-in, and FX. Then run DJustify-style gates on the rendered buffer: vocal collision, a cut mid-line, silence or an energy hole longer than X ms, and "B entry still in intro." On failure, repair: move e to the next phrase end, shorten L, or switch tier to cut.
6. **Commit.** Send T to the roulette animation so it stops exactly on B's hook downbeat. Precompute plans for every (A, B) pair and for every exit candidate, so the online step is a lookup of about 77 × 77 × |E_A|.

**Why this fits the cited evidence:**
- Every decision point is on a downbeat or phrase boundary (Bittner, Zehren, Kim).
- The tempo change stays inside documented comfort bounds (Ishizaki, Kim).
- Cue quality dominates perceived quality for pop (DJustify).
- Rendered-audio gates catch the rare audible failures, such as vocal cuts (DJustify).
- Clip length can be "until the presenter presses next." Optionally pre-mark safe exits at chorus ends (All-In-One segment end) so an early-round short clip ends on a phrase.

### Gaps
- No paper addresses transitions constrained to an externally timed window with a visual or SFX event at the landing point.
- No paper gives the optimal lead-in length for *recognition* (versus smoothness).
- The weights w1..w9 need tuning by ear on our own 77 songs. Using the hand-tagged hooks plus a small A/B listening session among the organizers is the only realistic calibration source found.
