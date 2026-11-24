# Phase model

How the engine decides the Phase (early, mid, late, final) and a placeholder Heat for every song of a round, from the cards in play and the known Queue. The code is in `engine/js/game/cards.js` (cards in play, Lines, Bingos, possible winners) and `engine/js/game/phase.js` (the Phase plan). Both are pure ES modules checked with `// @ts-check`, and are tested by `tests/cards.test.js` and `tests/phase.test.js`. Every number below comes from those tests or from the same simulation run over more rounds.

## The model

1. **Known future.** The Queue is fixed at the Shuffle, so for each valid card we know the queue index whose Landing completes its Line or its Bingo. The first such index is the **expected win**. If nobody claims it (an unsold card, or a player who missed it), the next completion becomes the expected win.
2. **Public chance.** `winChance` is the probability that at least one valid card completes within the next 5 songs. It uses the songs already landed and the *set* of songs still to come, not their order, so it is what a perfect observer in the room could know. It is exact per card (hypergeometric, with inclusion–exclusion over the 3 disjoint lines) and treats cards as independent. Each card counts as "live" (sold and claimed in time) with probability 0.75. This chance drives early → mid, places false alarms, and nudges Heat.
3. **Blur** (seeded, reproducible):
   - **mid** starts when the public chance crosses a threshold that scales with the number of cards in play (see below), and always at least 2 songs before late.
   - **late**, the pre-final, starts a uniformly random 3–8 songs before the expected win.
   - **final** covers the last 1, 2 or 3 songs up to and including the expected win (weights 30/40/30).
   - **False alarm:** in 35% of approaches the plan tries to go late for 1–2 songs, weighted toward tense moments (a higher public chance). It must start at or after mid and drop back to mid for at least 2 songs before the real late. When there is no room it is skipped, so it happens in about 20% of Line approaches and 20% of Bingo approaches.
   - **After a completion nobody claims:** late for one more song (a late Claim, then Back), and never lower than mid after that. With 200 cards the next completions follow within a few songs, so the round stays hot until someone claims.
4. **Heat** (placeholder, 0..1): each phase has a band (early 0.05–0.3, mid 0.3–0.55, late 0.55–0.8, final 0.8–1). Within the band, the value is half public chance and half seeded noise, plus ±0.06 jitter, smoothed while the phase stays the same.

**Line, then Bingo.** The engine calls `phasePlan({ kind: 'line', startPosition: 0 })` at the start of the round. Once a Line is confirmed, it calls `phasePlan({ kind: 'bingo', startPosition: <next queue index> })`, which is the reset. It reads `plan[position - startPosition]` at each Landing. Presenter overrides stay in the engine. The seed should be drawn secretly at the Shuffle and kept with the Queue, so the plan can be rebuilt after a reload.

## Simulation: when the first Line and the Bingo land

The simulation uses 77 songs and shuffled Queues, with 2,000 rounds per row. Song numbers are 1-based (the song's queue index + 1).

| Cards | Cards in play | First Line (median, 10–90%) | Line in songs 11–21 | Bingo (median, 10–90%) | Bingo in songs 45–55 |
|---|---|---|---|---|---|
| cards.json normal | 50 | 22 (14–29) | 46% | 56 (49–61) | 42% |
| cards.json normal | 120 | 18 (12–23) | 74% | 53 (46–57) | 69% |
| **cards.json normal** | **200** | **16 (11–21)** | **85%** | **51 (44–55)** | **80%** |
| cards.json normal | 300 | 15 (10–19) | 86% | 49 (43–54) | 81% |
| synthetic random cards | 200 | 16 (11–21) | 85% | 51 (44–55) | 81% |
| cards.json special | 200 | 16 (11–21) | 85% | 51 (44–56) | 81% |
| cards.json normal, 76-song Queue (song 70 excluded, as in the mixer today) | 200 | 16 (11–21) | 83% | 51 (44–56) | 79% |

With 200 cards this matches the design decisions (a Line around song 16 with 80% between songs 11 and 21, a Bingo about song 50) and last year. The card generator's de-duplication makes no measurable difference compared with purely random cards.

## How the thresholds scale with the number of cards in play

The public chance already sums over every valid card, so a fixed threshold already moves earlier in the round when more cards are in play. Measured against the win, it drifts only a little: with few cards the chance rises earlier relative to the win. A gentle correction removes that drift:

`midThreshold(kind, cards) = base[kind] × (cards / 200) ^ −0.2`, clamped to ×0.5–×2, with base 0.10 for the Line and 0.05 for the Bingo.

The exponents fitted to hold the lead constant were −0.23 for the Line and −0.18 for the Bingo, over 1,000 rounds per point; −0.2 serves both. The table shows the mean number of songs between the public chance crossing the threshold and the win:

| Cards in play | Line threshold | Lead, fixed 0.10 | Lead, scaled | Bingo threshold | Lead, fixed 0.05 | Lead, scaled | Median chance at the Line's landing |
|---|---|---|---|---|---|---|---|
| 50 | 0.132 | 9.6 | 8.5 | 0.066 | 10.1 | 9.5 | 0.53 |
| 120 | 0.111 | 8.6 | 8.3 | 0.055 | 10.1 | 9.9 | 0.64 |
| 200 | 0.100 | 8.4 | 8.4 | 0.050 | 9.6 | 9.6 | 0.69 |
| 300 | 0.092 | 7.8 | 8.0 | 0.046 | 9.8 | 9.9 | 0.76 |

The crossing is noisy round to round (10–90%: about 3–13 songs before a Line, 4–15 before a Bingo), which is part of the blur. In the full plan, mid is also forced to start at least 2 songs before late, so mid starts on average 9–10 songs before the Line and 10.5–11 before the Bingo.

The late lead (3–8) and the final length (1–3) are given in songs, as decided, so they don't scale. What changes with the number of cards is *when* the win comes (songs 22 → 15 for the Line from 50 to 300 cards), and the plan follows it because it is anchored on the known completions.

## Plan statistics

The plans use cards.json normal cards, 600 rounds per row. Lead = how many songs before the expected win.

| Kind | Cards | mid lead (mean, 10–90%) | late lead | final covers 1/2/3 songs | Rounds with a false alarm | Plan starts early | Mean Heat early / mid / late / final |
|---|---|---|---|---|---|---|---|
| Line | 50 | 10.0 (6–15) | 3–8, mean 5.5 | 28/43/30% | 17% | 99% | 0.13 / 0.42 / 0.68 / 0.92 |
| Line | 120 | 9.9 (6–14) | 3–8, mean 5.5 | 28/43/30% | 21% | 95% | 0.13 / 0.42 / 0.68 / 0.92 |
| Line | 200 | 9.5 (6–14) | 3–8, mean 5.5 | 28/43/30% | 20% | 94% | 0.13 / 0.42 / 0.68 / 0.93 |
| Line | 300 | 9.2 (6–12) | 3–8, mean 5.4 | 28/43/30% | 17% | 93% | 0.13 / 0.42 / 0.68 / 0.93 |
| Bingo | 50 | 10.5 (7–15) | 3–8, mean 5.5 | 28/43/30% | 17% | 100% | 0.12 / 0.41 / 0.68 / 0.92 |
| Bingo | 120 | 10.6 (7–15) | 3–8, mean 5.5 | 28/43/30% | 19% | 100% | 0.12 / 0.41 / 0.68 / 0.92 |
| Bingo | 200 | 10.7 (7–15) | 3–8, mean 5.5 | 28/43/30% | 22% | 100% | 0.12 / 0.41 / 0.68 / 0.93 |
| Bingo | 300 | 10.9 (7–15) | 3–8, mean 5.4 | 28/43/30% | 23% | 100% | 0.12 / 0.41 / 0.68 / 0.93 |

- **final** is never more than 2 songs before a completion, and the winning song always lands in final.
- **late** starts 3–8 songs before the win in every round; the only exception would be a win within the first 3–8 songs of a plan.
- **"Plan starts early" < 100% for the Line:** those are rounds with a very early Line (around songs 7–9), where the 2-song mid ramp starts at song 1.

With a typical 200-card round, the phase runs roughly: early for songs 1–6, mid for 7–10, late for 11–14, final for 14–16 (Line). After the Line it resets to early until about song 40, then mid, late from about 43–48, and final for the last 1–3 songs to the Bingo near 51.

## Tunables

Every number above is in `PHASE_MODEL_DEFAULTS` (deep-frozen), and `phasePlan({ config })` takes overrides, merged per key for the nested ones:

| Key | Default | Meaning |
|---|---|---|
| `liveCardProbability` | 0.75 | Chance that a card in play is sold and claimed in time |
| `chanceWindowSongs` | 5 | "The next few songs" for the public chance |
| `midThreshold` | line 0.10, bingo 0.05 | Public chance that starts mid, at 200 cards |
| `thresholdReferenceCards`, `thresholdExponent`, `thresholdScaleLimits` | 200, −0.2 / −0.2, [0.5, 2] | Scaling with the number of cards in play |
| `midMinSongs` | 2 | Songs of mid at least before late |
| `lateLeadSongs` | [3, 8] | late starts this many songs before the expected win |
| `finalSongWeights` | [0.3, 0.4, 0.3] | final covers 1, 2 or 3 songs |
| `falseAlarmChance`, `falseAlarmSongWeights`, `falseAlarmGapSongs` | 0.35, [0.6, 0.4], 2 | False alarms: chance, length (1 or 2 songs), songs back at mid before the real late |
| `unclaimedGraceSongs` | 1 | Songs kept at late after a completion nobody claims |
| `heatBands`, `heatChanceWeight`, `heatJitter`, `heatSmoothing` | see code, 0.5, 0.06, 0.6 | Placeholder Heat |

## Card ids and song ids

- The song ids on the cards are the mixer's song ids. Cards are generated from `card-generator/src/songs.json`, and the mixer's analysis reads `server/db/default/songs.json`.
- Both files have the same 77 ids with the same titles and artists, and every song on every card matches `data/analysis/index.json` by id, title and artist.
- `server/db/default/cards.json` is identical to `card-generator/dist/cards.json`.
- **Mismatch:** song 70, "Una Vaina Loca", is `excluded` in the mixer index (duration mismatch, hooks past the end), so the engine's Queue has 76 songs. It is printed on 70 normal and 52 special cards. While it stays excluded, those cards can never get a Bingo, and the line that holds song 70 can never make a Line. Round timing barely changes (see the 76-song row above). A test reports this as a diagnostic.

## Open questions

1. **Song 70:** fix its audio or hooks so it can play, or accept that 122 cards can never win a Bingo? Fixing it is strongly preferred, since players would notice.
2. **`liveCardProbability` (0.75):** roughly what share of the entered ranges is actually sold? It only shifts the public chance a little.
3. **False alarms in about 20% of Line approaches and 20% of Bingo approaches** (about a third of rounds have at least one). Is that the right amount of "sometimes"?
4. **After an unclaimed completion** the Line plan stays at late/final, because with 200 cards new possible winners appear almost every song. Should it calm down to mid after a few songs with no Claim instead?
5. **After the Line, early lasts about 25 songs** before mid starts about 11 songs before the Bingo. Should mid start earlier in the second half? Lowering `midThreshold.bingo` would do it.
