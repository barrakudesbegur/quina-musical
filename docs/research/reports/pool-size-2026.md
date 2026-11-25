# How many songs should the 2026 pool have?

A study commissioned by the orchestrator on 2026-11-25, at the user's request, to pick the pool size from candidate night schedules. It's a dated record: the decision, once taken, goes in [decision-log.md](../../decision-log.md). The scripts and `results.json` were kept outside the repo, since they read last year's personal data; only aggregates appear here.

**Short answer: 70 songs.** With 2025's crowd, rounds take about 15 minutes (46 songs) and the Desgraciat about 9 minutes (21 songs, like 2025). The rounds end around **21:34**, or **21:46** in the bad case, if the first song lands at 18:05. They still end by 22:00 if one usual thing goes wrong: a start as late as 2025's, 3-minute Intervals, or a 10% slower pace. The draft's 86 songs would end after 22:00 even with an on-time start, with 56-song rounds, close to 2024's "about 60" that felt long.

All times are local. "Bad case" is the 90th percentile over 3,000 simulated nights with an on-time start; a late start moves everything by its delay.

## 1. The model against 2025

The model used 77 songs, 2025's printed cards and 2025's real cards in play, with no tie rule (2025's app had none).

| Measure | Model (median, 10–90%) | 2025, real |
|---|---|---|
| Regular round, songs to the Bingo | 51 (44–55); the average of 10 rounds is 50.3 (48.5–52.1) | 49.7 average, 49 median (42–56) |
| Regular round, songs to the first Line | 16 (11–21) | 17.6 average (13–25) |
| Round 1, minutes | 23.3 (20.0–26.4) | 20.7 |
| Rounds 2–10, minutes | 16.2 (14.1–18.3) | 15.8 average (11.0–20.2) |
| Desgraciat | 23 songs (19–27), 9.5 min | 21 songs, 8.6 min |
| Especial | 52 songs (45–56), 18.6 min | 55 songs, 20.3 min |
| Rounds end (2025's start at 18:19 and its real gaps) | 22:01 (21:54–22:09) | 21:56 |
| Plays per song across the night | 7.5 on average; the most-played song 11 times; none unheard | 7.4; 4 to 11 times; none unheard |

**A replay is closer still.** With 2025's real Queues, the model's first Line falls exactly where the Line Check started, in all 11 rounds that had a Line. Its first Bingo is the round's last song in 9 of 11:
- in round 9, the claim came one song late;
- in the Especial, a card in the sold range completed one song earlier and nobody claimed it.

The Desgraciat stopped at song 21, the exact song that left one card of #400–550 standing.

**What the calibration corrected:**
- **Cards in play.** About 190 normal cards played in 2025, not the 250 expected: the Lines and Bingos match cards #1 to between #179 and #195. The special cards in play were #400–550 (151). Every sold card that completed was claimed on time, so the model treats every card in play as sold and watched.
- **Pace.** 2025's measured gaps between songs were 22.9 s in round 1 and 14.3 s in rounds 2–10, which match the 2026 defaults (22 s and 14 s). The Desgraciat and the Especial ran slower, at 17.5 s and 16.9 s, so the model keeps those.
- **Checks and Intervals** are drawn from 2025's real ones:
  - a Line Check of 70–134 s;
  - 1.9–3.7 min from the Bingo to the round's end;
  - 0.5–2.7 min from a round's end to the next first song, prizes and intro included.
- **Residual.** The model runs about 5 minutes long against the one real 2025 night. That night sits at about the 20th percentile, mostly because it drew slightly fewer songs than the median. The model is kept as it is, on the cautious side.
- **2024 check.** 87 songs and 214 cards give 57 songs a round (49–62). The organizers remember "about 60".
- **The 2026 tie-free Shuffle** shortens rounds by about half a song (Bingo 51 → 50 on 2025's cards). About 22% of first draws have a tied Line or Bingo and get redrawn.

The repo's own report (`apps/cards/src/report.ts`), run unchanged from a scratch copy, gives the same song counts for the Line and the Bingo: 13/40 at 60 songs, 15/46 at 70, 18/56 at 86 and 20/65 at 100.

## 2. Numbers per pool size

The night modelled has 10 regular rounds, then the Desgraciat, then the Especial, with special cards playing both of the last two. The first song lands at 18:05, and there are throw breaks after Quina 3 and Quina 7.

### Main numbers

2025's cards in play: 190 normal, 151 special. Each cell is the median / the bad case.

| Songs | Line: songs | Line: min | Bingo: songs | Bingo: min | Round: min | Round 1: min | Desgraciat: songs, min | Especial: songs, min | Rounds end | Bad case |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 | 11 / 14 | 2.3 / 3.1 | 34 / 36 | 9.4 / 10.8 | 12.1 / 13.8 | 16.8 / 18.9 | 14, 6.9 / 17, 8.0 | 34, 13.6 / 37, 15.6 | 20:58 | 21:07 |
| 55 | 12 / 15 | 2.5 / 3.4 | 37 / 40 | 10.1 / 11.6 | 12.8 / 14.6 | 17.9 / 20.4 | 16, 7.4 / 19, 8.5 | 37, 14.5 / 41, 16.5 | 21:07 | 21:16 |
| 60 | 13 / 16 | 2.7 / 3.7 | 40 / 43 | 10.8 / 12.4 | 13.6 / 15.4 | 19.2 / 21.7 | 17, 7.9 / 21, 9.1 | 40, 15.4 / 44, 17.5 | 21:16 | 21:26 |
| 65 | 14 / 18 | 3.0 / 4.0 | 43 / 47 | 11.5 / 13.3 | 14.3 / 16.3 | 20.3 / 23.2 | 19, 8.3 / 23, 9.6 | 44, 16.3 / 48, 18.5 | 21:25 | 21:36 |
| **70** | 14 / 19 | 3.2 / 4.3 | 46 / 50 | 12.3 / 14.1 | 15.1 / 17.1 | 21.5 / 24.6 | 21, 8.8 / 25, 10.2 | 47, 17.2 / 51, 19.6 | **21:34** | **21:46** |
| 75 | 15 / 20 | 3.4 / 4.6 | 49 / 54 | 13.0 / 15.0 | 15.8 / 18.0 | 22.6 / 25.9 | 22, 9.2 / 26, 10.7 | 50, 18.1 / 55, 20.5 | 21:43 | 21:56 |
| 77 | 16 / 21 | 3.5 / 4.8 | 50 / 55 | 13.3 / 15.4 | 16.1 / 18.3 | 23.1 / 26.3 | 23, 9.4 / 27, 11.0 | 52, 18.5 / 56, 21.1 | 21:47 | 22:00 |
| 80 | 16 / 21 | 3.6 / 5.0 | 52 / 57 | 13.8 / 15.9 | 16.5 / 18.8 | 23.8 / 27.3 | 24, 9.7 / 28, 11.4 | 53, 18.9 / 58, 21.6 | 21:53 | 22:06 |
| 85 | 17 / 23 | 3.8 / 5.2 | 55 / 61 | 14.5 / 16.7 | 17.3 / 19.7 | 25.0 / 28.5 | 25, 10.2 / 30, 12.0 | 56, 19.9 / 62, 22.6 | 22:02 | 22:15 |
| 86 | 17 / 23 | 3.9 / 5.3 | 56 / 61 | 14.7 / 17.0 | 17.4 / 19.9 | 25.2 / 28.8 | 26, 10.2 / 30, 11.9 | 57, 20.1 / 62, 22.9 | 22:04 | 22:18 |
| 90 | 18 / 24 | 4.1 / 5.6 | 59 / 64 | 15.2 / 17.6 | 18.0 / 20.5 | 26.2 / 29.9 | 27, 10.6 / 32, 12.5 | 60, 20.8 / 65, 23.7 | 22:11 | 22:25 |
| 95 | 19 / 25 | 4.3 / 5.9 | 62 / 68 | 16.0 / 18.5 | 18.8 / 21.4 | 27.3 / 31.6 | 28, 11.1 / 34, 13.1 | 63, 21.7 / 69, 24.8 | 22:21 | 22:36 |
| 100 | 20 / 27 | 4.5 / 6.2 | 65 / 71 | 16.7 / 19.3 | 19.5 / 22.3 | 28.5 / 32.8 | 30, 11.5 / 36, 13.7 | 66, 22.6 / 72, 25.9 | 22:30 | 22:45 |

How to read it:
- The Line and Bingo columns are for rounds 2–10.
- Minutes count from the round's first song. The Bingo's minutes include the Line Check, and a round's minutes add the Bingo's Check and the round's end.
- **Each extra song in the pool adds about 1.8 minutes to the night**, so 5 songs add about 9 minutes.

### Cards in play barely matter; the pool size does

| Songs | Bingo songs, low / 2025 / high | Rounds end, low / 2025 / high | Bad case, low / 2025 / high |
|---|---|---|---|
| 60 | 41 / 40 / 39 | 21:19 / 21:16 / 21:15 | 21:29 / 21:26 / 21:25 |
| 65 | 44 / 43 / 42 | 21:28 / 21:25 / 21:23 | 21:40 / 21:36 / 21:34 |
| 70 | 47 / 46 / 45 | 21:37 / 21:34 / 21:33 | 21:49 / 21:46 / 21:43 |
| 77 | 52 / 50 / 49 | 21:50 / 21:47 / 21:45 | 22:04 / 22:00 / 21:57 |
| 86 | 57 / 56 / 55 | 22:06 / 22:04 / 22:01 | 22:20 / 22:18 / 22:14 |
| 100 | 66 / 65 / 64 | 22:33 / 22:30 / 22:27 | 22:50 / 22:45 / 22:41 |

Low is 140 normal and 100 special cards; high is 250 and 200. Going from 140 to 250 cards saves only about 2 songs a round.

### Repetition, and what players feel

2025's cards in play.

| Songs | Songs played in the night | Plays per song | Never heard | Same song back every | One card marks a song every | Songs that mark one of 3 cards | Songs from Line to Bingo | Cards 1 song short when the Bingo lands |
|---|---|---|---|---|---|---|---|---|
| 50 | 381 | 7.6 | 0 | 22 min | 4.2 songs (60 s) | 56% | 23 | 6 (bad case 16) |
| 60 | 452 | 7.5 | 0 | 24 min | 5.0 songs (72 s) | 49% | 27 | 6 (15) |
| 65 | 488 | 7.5 | 0 | 25 min | 5.4 songs (77 s) | 46% | 29 | 6 (15) |
| **70** | 523 | 7.5 | 0 | 26 min | 5.8 songs (83 s) | 43% | 31 | 5 (15) |
| 77 | 573 | 7.4 | 0 | 28 min | 6.4 songs (92 s) | 40% | 34 | 5 (15) |
| 86 | 638 | 7.4 | 0 | 30 min | 7.2 songs (102 s) | 36% | 38 | 5 (15) |
| 100 | 738 | 7.4 | 0 | 33 min | 8.3 songs (119 s) | 32% | 44 | 5 (14) |

At every size the most-played song plays 11 times.

What this means for the players' night:
- **The pool size doesn't change how often a song repeats.** Every round needs about two thirds of the pool for a Bingo, whatever its size. So each song plays about 7.5 times in the night, and none goes unheard. A smaller pool just means fewer different songs, each coming back a little sooner: every 26 minutes at 70 songs, against 30 at 86.
- **The real trade is round length against variety,** and a smaller pool keeps only the strongest hits. Cutting the 86-song draft to 70 drops its 16 weakest songs, and players enjoy what they recognise.
- **Players stay busier with a smaller pool.** At 70 songs, one card gets a song about every 83 s, and a player with 3 cards marks something on 43% of songs. At 86 that's 102 s and 36%.
- **The tension at the end doesn't depend on size.** About 5–6 cards are one song short when the Bingo lands.
- **The Line comes about 3 minutes into a round at 60–70 songs:** an early win to cheer. After it comes the longest stretch of the round, which grows from 27 songs at 60 to 38 at 86.
- **At 70 songs a card holds 17% of the pool.** That's almost exactly a classic bingo card's 15 of 90 (16.7%), the yardstick 2025's notes used.

### Ties and similar cards

| Songs | First draw tied (regular / Especial / Desgraciat) | Redraws per round | Repeated lines, normal / all 699 cards | Most songs two normal cards share | Normal card pairs sharing 6+ songs |
|---|---|---|---|---|---|
| 50 | 32% / 30% / 18% | 0.47 | 2.4 / 8.1 | 8.4 | 1,963 |
| 60 | 27% / 26% / 16% | 0.38 | 2.2 / 5.4 | 8.1 | 730 |
| 65 | 25% / 24% / 14% | 0.34 | 1.0 / 2.9 | 8.1 | 468 |
| 70 | 24% / 23% / 13% | 0.31 | 1.0 / 2.9 | 7.8 | 294 |
| 77 | 21% / 20% / 11% | 0.27 | 0.5 / 1.8 | 7.4 | 179 |
| 86 | 19% / 19% / 10% | 0.24 | 0.4 / 1.1 | 7.5 | 93 |
| 100 | 17% / 15% / 9% | 0.20 | 0.2 / 0.6 | 6.9 | 42 |

- **Ties are harmless at any size.** The Shuffle redraws them out invisibly, with under one redraw per round on average.
- **Repeated lines do happen,** because the generator doesn't prevent them (§5). 2025's printed set has 2. In play, two cards sharing a line can only tie, which the Shuffle avoids.
- **Below about 60 songs the cards start to look alike:** hundreds of card pairs share half their songs.
- **Hook approval** takes about 2 minutes a song: about 2.3 hours at 70, against 2.9 at 86.

## 3. Candidate schedules

These use 2025's cards in play. Each cell gives the round's first song and its end (median), with its songs in brackets.

| Round | 60 songs | 65 songs | **70 songs** | 77 songs | 86 songs |
|---|---|---|---|---|---|
| Welcome, round 1's intro and Shuffle | 18:00 | 18:00 | 18:00 | 18:00 | 18:00 |
| Quina 1 | 18:05–18:24 (40) | 18:05–18:25 (43) | 18:05–18:26 (46) | 18:05–18:28 (50) | 18:05–18:30 (56) |
| Quina 2 | 18:26–18:39 (40) | 18:27–18:41 (43) | 18:28–18:43 (46) | 18:30–18:46 (51) | 18:32–18:49 (56) |
| Quina 3 | 18:41–18:55 (40) | 18:43–18:57 (43) | 18:45–19:00 (46) | 18:48–19:04 (50) | 18:51–19:09 (56) |
| *Throw break, about 5 min* | | | | | |
| Quina 4 | 19:00–19:14 (40) | 19:03–19:17 (43) | 19:06–19:21 (46) | 19:09–19:25 (50) | 19:14–19:32 (56) |
| Quina 5 | 19:16–19:29 (40) | 19:19–19:33 (43) | 19:22–19:37 (46) | 19:27–19:43 (50) | 19:33–19:50 (56) |
| Quina 6 | 19:31–19:44 (40) | 19:35–19:49 (43) | 19:39–19:54 (46) | 19:45–20:01 (50) | 19:52–20:10 (56) |
| Quina 7 | 19:46–20:00 (40) | 19:51–20:05 (43) | 19:56–20:11 (46) | 20:02–20:19 (50) | 20:11–20:29 (56) |
| *Throw break, about 5 min* | | | | | |
| Quina 8 | 20:06–20:19 (40) | 20:11–20:25 (43) | 20:16–20:31 (46) | 20:24–20:40 (50) | 20:34–20:52 (56) |
| Quina 9 | 20:21–20:34 (40) | 20:27–20:41 (43) | 20:33–20:48 (46) | 20:42–20:58 (50) | 20:54–21:11 (56) |
| Quina 10 | 20:36–20:50 (40) | 20:43–20:57 (43) | 20:50–21:05 (46) | 21:00–21:16 (50) | 21:13–21:30 (56) |
| Quina del Desgraciat | 20:51–20:59 (17) | 20:59–21:07 (19) | 21:07–21:15 (21) | 21:18–21:27 (23) | 21:32–21:42 (26) |
| Quina Especial | 21:01–21:16 (40) | 21:09–21:25 (44) | 21:17–21:34 (47) | 21:29–21:47 (52) | 21:44–22:04 (57) |
| **Rounds end** | **21:16** | **21:25** | **21:34** | **21:47** | **22:04** |
| Bad case (90%) | 21:26 | 21:36 | 21:46 | 22:00 | 22:18 |
| A regular round | 13.6 min, 40 songs | 14.3 min, 43 songs | 15.1 min, 46 songs | 16.1 min, 50 songs | 17.4 min, 56 songs |

The close and the DJ set follow the last round.

**Each candidate's character:**
- **60, short and punchy:**
  - 13.5-minute rounds and the busiest cards, done by about 21:15;
  - room for a 30-minute late start (like 2024's) or a third throw;
  - but it cuts 26 songs from the draft, and cards look alike.
- **65, brisk, with a margin:**
  - 14-minute rounds, ending about 21:25;
  - still before 22:00 even if the start slips like 2025's *and* the Intervals take 3 minutes.
- **70, balanced (recommended):**
  - 2025's feel, a notch quicker: 15-minute rounds, ending about 21:35;
  - a Desgraciat just like 2025's;
  - only the 16 weakest draft songs go.
- **77, 2025 again:**
  - 16-minute rounds, ending about 21:47;
  - makes 22:00 only if the start is on time and nothing else slips.
- **86, keep the whole draft:**
  - the most variety;
  - but 17.5-minute rounds of about 56 songs, close to 2024's "felt long" 60;
  - it ends after 22:00 even on time.

### Sensitivity: when the rounds end (median / bad case)

| Plan | 60 | 65 | 70 | 77 | 86 |
|---|---|---|---|---|---|
| As planned (above) | 21:17 / 21:27 | 21:25 / 21:35 | 21:35 / 21:46 | 21:47 / 22:00 | 22:03 / 22:17 |
| First song at 18:19, as in 2025 | 21:30 / 21:40 | 21:39 / 21:49 | 21:49 / 22:00 | 22:01 / 22:14 | 22:17 / 22:30 |
| 3-min Intervals (Admin's default) instead of 2025's 1.4 | 21:31 / 21:40 | 21:39 / 21:49 | 21:49 / 22:00 | 22:02 / 22:14 | 22:18 / 22:31 |
| Pace 10% slower all night | 21:28 / 21:39 | 21:37 / 21:48 | 21:48 / 22:00 | 22:02 / 22:16 | 22:20 / 22:34 |
| 3 throw breaks (after Quina 3, 6, 9) | 21:20 / 21:31 | 21:29 / 21:40 | 21:39 / 21:50 | 21:51 / 22:04 | 22:08 / 22:21 |
| Desgraciat and Especial at the 14 s default | 21:14 / 21:24 | 21:22 / 21:32 | 21:32 / 21:43 | 21:44 / 21:56 | 22:00 / 22:13 |

The sensitivity runs use 2,000 nights each, so their medians can differ by a minute from the tables above.

### Recommendation: 70 songs

Against what event.md asks for:
- **End on time.** The rounds end at about 21:35, with a bad case of 21:46. Any single usual slip still ends by 22:00 in the bad case: a start as late as 2025's, 3-minute Intervals, or a 10% slower pace.
- **2024 felt long.** Rounds would be 46 songs, against 2024's 60 and 2025's 50.
- **Steady rounds.** Rounds 2–10 sit within about 2 minutes of each other: 15.1 median, 17.1 bad case.
- **2025's numbers.** It keeps what worked: a Line about 3 minutes into each round, and a 21-song Desgraciat of about 9 minutes.
- **The players' night.** Each song still plays about 7.5 times whatever the size, so cutting to 70 costs little variety. It keeps the 70 strongest songs, marks a card more often, and leaves time for the DJ set before people get cold and hungry, which is what emptied 2024's.

Choose **65** for a clear margin, for example for longer prize readings or the risk of a 2024-style late start. Choose **77** only if a 22:00 finish with no margin is acceptable.

**Outside comparison.**
- Commercial music-bingo nights run 2–4 rounds of 15–25 minutes, in 1.5–2 hours. Hosts favour "three or four short rounds", because they bring more winners and keep the energy up.
- The Quina's 12 rounds already make a long night, so short, steady rounds matter more here.
- Those nights' usual pools of 40–60 songs are for 25-square cards with few players, and those cards need about 90% of the playlist for a full card. The Quina's 12-song cards with about 190 players need only about 65%, which is why 70 songs gives rounds of a similar length.

## 4. Method and assumptions

- **Cards** are made the way the generator makes them: 12 different random songs in 3 lines of 4, with no two identical cards. Each pool size has 8 printings of 399 normal and 300 special cards. The cards in play are the first 140, 190 or 250 normal cards and the first 100, 151 or 200 special ones, all sold and claimed on time, as 2025's data shows.
- **Rounds.**
  - Each Queue is a fresh shuffle with the engine's tie-free rule: up to 500 redraws, with no tied first Line or Bingo.
  - In the Desgraciat, the rule is that the last two cards never fall on the same song.
  - A round ends at the first Bingo. The Desgraciat ends when one card stands.
- **Time** comes from 2025's measurements (§1).
  - **Pace:** on top of each round kind's pace, each night varies ±5% and each round ±8%.
  - **Holds:** 2 rounds in 11 get a second hold of about 50 s.
  - **Intervals:** each gets an extra 0.25 min for the new show's steps (the Shuffle's 8 s animation and the Celebration).
  - **Throw breaks:** 4.5–6.5 min each, after Quina 3 and Quina 7.
  - **Start:** the first song lands at 18:05, the planned 18:00 plus the 5 minutes 2025 took from the Game's start to its first song.
- **Volume:** 3,000 nights per size for 2025's cards in play, and 1,000 for the low and high cases. Sizes 50–100 in steps of 5, plus 77 and 86 (the draft).
- **Not modelled:**
  - the engine's Drift catch-up, which would pull late nights earlier;
  - Suspense, long Aguanta moments and presenter improvisation;
  - unsold cards inside the entered ranges, which would make rounds very slightly longer;
  - a late start, which simply shifts every time.

## 5. Problems found in the docs and data

1. **The generator doesn't stop repeated lines.** event.md and songs-and-cards.md say no two lines are the same, but its line check compares a whole card's key with line keys, so it never fires. 2025's printed cards have 2 repeated lines.
2. **2025's start.** 18:13 is when the Game was started; the first song landed at 18:18:42.
3. **"48 songs (42–56)" mixes two sets of rounds.** The 48 average includes the 21-song Desgraciat, but the range excludes it. The 10 regular rounds averaged 49.7 (median 49).
4. **Cards in play in 2025** were about 190 normal (#1 to #179–195) and 151 special, not 250. The repo report's default `--sold 250` overstates 2025.
5. **The engine's Schedule is fixed for 77 songs.** `SCHEDULE` in `apps/show/engine/src/config.ts` sets `bingoAtSong` 50, `lineAtSong` 16 and `desgraciatAtSong` 24, and show-and-music.md says about 24 songs for the Desgraciat. At 70 songs they should be 46, 14–15 and 21. Otherwise the Drift reads about a minute late per round and speeds up the Pace for nothing.
6. **Admin's default round length** of 25 minutes (`apps/admin/logic/plan-edit.ts`, `packages/protocol/plan.ts`) would put the expected end near 23:00. At 70 songs it should be about 15.
7. **Round 1's recorded winner in 2025's export.** Card #2 only completes at song 73, while card #4 completed on the round's last song (48): probably a typo in the record.

## Sources (outside comparison)

- [Bingotastic: Music & Disco Bingo (simulation of playlist sizes)](https://www.bingotastic.com/music-bingo/)
- [Bingofy: How many songs for music bingo?](https://www.bingofy.co/blog/how-many-songs-for-music-bingo)
- [Bingofy: Music bingo for bars](https://www.bingofy.co/blog/music-bingo-for-bars-business-guide)
- [QRSong: How to make music bingo cards](https://www.qrsong.io/en/blog/how-to-make-music-bingo-cards)
- [Wasingo: How to host a music bingo night](https://www.wasingo.com/music-bingo-night)
- [Fat City Entertainment: How to run a music bingo night](https://www.fatcityentertainment.com/triviahostresources/how-to-run-a-music-bingo-night/)
