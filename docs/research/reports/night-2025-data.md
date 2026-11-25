# The 2025 night in data

What last year's app recorded about the night of 27 December 2025, beyond what the other docs already say. A study commissioned by the orchestrator on 2026-11-25.

- **Source:** the 2025 app's database export in `legacy/2025/last-year-data/` (git-ignored), read against 2025's printed cards (`legacy/2025/server/db/default/cards.json`). The export holds no names or contact details. This page still keeps to aggregates, card numbers and song titles, and the scripts stay outside the repo.
- **Times are local.** The export is in UTC; December is UTC+1.
- **Already covered, not repeated here:**
  - [event.md](../../event.md): how the night works, and 2025's main numbers;
  - [pool-size-2026.md](pool-size-2026.md): songs and minutes per round, the Pace, Checks, Intervals and the cards in play (about 190 normal, 151 special).

## What the export holds, and what it doesn't

**It holds** the app's final state:
- when the Game was started and when the last round was closed;
- for each of the 12 rounds: the drawn order, each landed song with its time, the rest of the Queue, and one winning card;
- the last list of cards in play;
- the 77 songs, with their hand-marked hooks and volumes;
- the volumes of six sound effects.

**It doesn't hold:**
- **card sales:** each update of the cards in play replaced the list, so only the last one survives;
- **claims:** no Line winners, no failed or false claims, and no time for a claim or a Check;
- **phones:** 2025's public page kept a player's card numbers in its own link, so nothing reached the database. There's no count of phones, cards followed, reconnects or offline periods;
- **undos:** an undone song that lands again leaves no trace;
- which sound effects or hooks were used, the DJ set, the bar, or money.

So most questions about sales, claims and phones can only be bounded, not answered.

## The night's timeline

| Round | First song | Closed | Songs | Interval before (min) |
|---|---|---|---|---|
| Quina 1 | 18:19 | 18:39 | 48 | |
| Quina 2 | 18:41 | 18:58 | 49 | 1.6 |
| Quina 3 | 19:03 | 19:24 | 56 | 5.0 |
| Quina 4 | 19:27 | 19:45 | 49 | 3.7 |
| Quina 5 | 19:50 | 20:07 | 49 | 5.2 |
| Quina 6 | 20:08 | 20:25 | 53 | 1.5 |
| Quina 7 | 20:26 | 20:41 | 50 | 1.3 |
| Quina 8 | 20:42 | 20:55 | 52 | 0.7 |
| Quina 9 | 20:55 | 21:06 | 42 | 0.7 |
| Quina 10 | 21:07 | 21:22 | 49 | 0.5 |
| Desgraciat | 21:25 | 21:33 | 21 | 2.7 |
| Especial | 21:36 | 21:56 | 55 | 2.3 |

- **Against the plan** (cards from 17:30, the first round at 18:00): the Game was started at 18:13 and the first song landed at 18:19, 19 minutes late. The rounds still ended at 21:56, against "about 22:00".
- **The welcome** took 5 minutes, from the Game's start to the first song.
- **The throws aren't marked.** The two 5-minute Intervals, after Quina 2 and Quina 4, are probably them.
- **No sign of a crash or restart:** one Game, started once, with 12 rounds in a row. No stop inside a round lasted over 2.3 minutes, and no Interval over 5.2.

### Where the time went

| Part | Minutes | Share |
|---|---|---|
| Songs landing (gaps up to 45 s) | 140 | 65% |
| Stops over 45 s inside rounds: Line claims and a few others | 21 | 10% |
| From each round's last song to its close: Check, Celebration, winner noted | 31 | 14% |
| Intervals, throws included | 25 | 12% |
| **First song to last close, 18:19–21:56** | **217** | |

### The night sped up

| | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Desgraciat | Especial |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Seconds per song (gaps up to 45 s) | 22.9 | 18.1 | 16.7 | 15.5 | 16.6 | 13.3 | 13.2 | 11.6 | 11.0 | 12.4 | 17.5 | 16.9 |
| Next song within 8 s | 0 | 0 | 3 | 3 | 1 | 4 | 3 | 8 | 7 | 10 | 0 | 5 |

- **The two halves took very different times.** Quina 1–5 took 108 minutes for 251 songs, and Quina 6–10 took 74 minutes for 246.
  - The rounds were 22 minutes shorter in all, mostly because the songs came faster: from about 18 s in Quina 2 to 11 s in Quina 9.
  - The Intervals shrank: 1.6–5.2 minutes before Quina 2–5, then 0.5–1.5 minutes. That saved about 12 minutes.
- **It's a steady trend, not noise.** Rounds 2–10 got faster one after another, and only the two special rounds were slower again. The pool-size model varies each round's Pace at random around 14.3 s instead, which gets the night's total right but not its shape.
- **Why isn't recorded:** catching up on a late start, or a crowd that knew the songs by then.

## Card sales over the night

**Not recorded.** The 2025 app held one list of cards in play for all types, and each edit replaced it. The last list holds only the special cards #400–550, entered as one range: by the end, the tech had replaced the normal range with the special one. The normal range used in Quina 1–10 is lost.

**What the rounds imply.** This assumes the normal cards in play were #1 up to some top card, and that every card in play was claimed on the song it completed:

| Round | Top normal card at least | At most | From |
|---|---|---|---|
| Quina 1 | #52 | | the first Line |
| Quina 2 | #67 | #204 | the first Line; #205 completed 5 songs before the Bingo, unclaimed |
| Quina 3 | #75 | #279 | the winner; the Line |
| Quina 4 | #11 | | the winner |
| Quina 5 | #142 | #195 | the winner; #196 completed 2 songs before the Bingo, unclaimed |
| Quina 6 | #157 | #236 | the winner; the Line |
| Quina 7 | #122 | | the first Line |
| Quina 8 | #179 | #209 | the first Line; the Bingo |
| Quina 9 | #106 | | the first Line |
| Quina 10 | #12 | #243 | the winner; the Line |

- **The lower bound jumps up and down** (#157 in Quina 6, #122 in Quina 7), because each round's winners fall where they fall. It says nothing about when cards were sold.
- **Every round fits one fixed range of #1 to #179–195**, entered before Quina 1. It also fits normal cards added during the night. The export can't tell these apart.
- **The upper bounds are soft:** a range can include unsold cards.

**Special cards:**
- **At the Desgraciat, at least #400–457 were in play.** With fewer, it would have ended earlier.
- **At the Especial, at least #400–482** (the first Line).
- Both fit the final #400–550. Whether special cards were sold between the Desgraciat and the Especial can't be told.
- In the Especial, card #514 (inside #400–550) completed one song before the winner and nobody claimed it. It was either unsold or missed, as pool-size-2026.md notes.

## Claims

| Round | Line: song | Line stop (s) | Cards with the first Line | Other stops over 45 s | Bingo: song | Bingo song to close (min) | Cards 1 song short at the Bingo |
|---|---|---|---|---|---|---|---|
| Quina 1 | 13 | 70 | 1 | | 48 | 2.0 | 3 |
| Quina 2 | 17 | 75 | 1 | | 49 | 1.9 | 9 |
| Quina 3 | 25 | 126 | **2** | 52 s after song 28 | 56 | 2.4 | 17 |
| Quina 4 | 19 | 85 | 1 | | 49 | 3.7 | 9 |
| Quina 5 | 14 | 134 | 1 | | 49 | 1.9 | 5 |
| Quina 6 | 19 | 95 | 1 | | 53 | 3.4 | 6 |
| Quina 7 | 13 | 93 | 1 | | 50 | 2.7 | 4 |
| Quina 8 | 17 | 78 | 1 | | 52 | 2.3 | 7 |
| Quina 9 | 18 | 71 | 1 | 73 s after song 41 | 41; closed after song 42 | 2.6 (1.4 after song 42) | 1 |
| Quina 10 | 21 | 98 | 1 | | 49 | 3.6 | 3 |
| Desgraciat | no Line | | | 68 s after song 14 | 21, last card standing | 1.9 | |
| Especial | 11 | 76 | 1 | 48 s after song 2 | 55 | 3.6 | 11 |

The cards counted are those in play (normal #1–190, special #400–550). A stop is the time from one song's landing to the next, so it includes about 15 s of the song itself.

- **Every Line was claimed on time.** In all 11 rounds with a Line, the songs stopped right after the song that completed the first line among the cards in play.
- **Every winning card was claimed on its song, except perhaps in Quina 9.** There, the songs stopped right after the winning song (41), but one more song landed before the round was closed. Song 41 to the close took 2.6 minutes, like the other rounds. So the claim was probably on time, and a song was played during the Check.
- **One probable shared Line.** In Quina 3, two cards completed the first Line on the same song. That stop was the second longest (2.1 minutes), and the songs stopped again for 52 s three songs later. Whether both cards were claimed isn't recorded.
- **No Bingo was tied.** Every winning song completed exactly one card in play.
- **False claims look rare.** Apart from each round's Line and Bingo, only 3 stops lasted over 45 s all night, and two of them can't be claims:
  - the Desgraciat's came with 8 cards still standing, probably time with the crowd;
  - the Especial's came after song 2, too early for any Line.

  Another 14 gaps of 30–45 s, all in Quina 1–5 and the special rounds, could be quick false claims or talk.
- **Timing:** no claim or Check has a time of its own, so the shout, the walk to the player and the Check can't be told apart. The median Line stop was 85 s. From the Bingo's song to the round's close, the median was 2.6 minutes (1.9–3.7).

## The Desgraciat, song by song

Cards of #400–550 still standing after each song, if all 151 played:

| After song | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 21 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Standing | 129 | 100 | 85 | 74 | 58 | 46 | 34 | 31 | 23 | 14 | 8 | 6 | 4 | 2 | 1 |

- **Fast at first:** half the cards sat within 4–5 songs.
- **Slow at the end:** the last 7 songs took down the last 7 cards, about one each. The 68-s stop came at 8 cards.
- **Each song sits about 16% of the cards still standing** (a card's 12 songs out of 77), so the curve scales with the pool: about 17% at 70 songs.

## Songs

- **The drawn order was kept.** In all 12 rounds the songs landed exactly in the drawn order: none was picked by hand, reordered, replaced or repeated.
- **Some songs counted without being heard:**
  - in the Especial at 21:41, three songs landed within 10 ms. Nobody presses that fast, so it was a software or connection glitch, and two songs counted unheard;
  - in Quina 3, two songs landed 0.3 s apart, probably a double press.

  All night, 7 gaps were under 5 s.
- **Plays per song:** 573 landings over 77 songs, 4 to 11 each (7.4 on average), none unplayed.
  - The spread is what chance gives: a standard deviation of 1.5 plays, against 1.6 expected.
  - No song missed more than 4 rounds in a row.

| Plays | Songs |
|---|---|
| 11 | Ni tú ni nadie (Alaska y Dinarama) |
| 10 | All I Want for Christmas Is You; La Plena; Titanium |
| 9 / 8 / 7 / 6 | 15 / 21 / 19 / 8 songs |
| 5 | Barbie Girl; Besos; Dancing in the Moonlight; Gasolina; Greased Lightnin'; Love Story; Sense Tu; Vivir Así Es Morir de Amor |
| 4 | All Night (Icona Pop); Ave María (David Bisbal) |

## Song preparation in 2025

This is what the tech prepared by hand, for the 2026 prep pipeline to compare against.

- **Hooks:** every song had one "best" hook plus up to 9 other marked points, 386 in all (5 per song at the median). 14 songs had only the best hook.
- **Where the best hook sits:** a median of 97 s into the song. 10% of songs had it within 44 s, and 10% after 171 s. It's rarely near the start.
- **Volume:** 18 of 77 songs (23%) were turned up by hand, by ×1.19 to ×2. None was turned down.
- **Transitions:** 344 crossfades, most of them 1 s (0.1–5 s), and 42 fade-out-and-in.
- **Songs** last 3.5 minutes at the median (2.2–6.8).
- **Sound effects:** six, with tuned volumes: `anime-wow`, `tada`, `correct`, `among-us`, `spongebob-boowomp` and `boom`. How often each was used isn't recorded.
- **Round images:** the app could set an image per round, but no round had one.

## Data-quality issues

1. **Quina 1's winner is recorded as #2, but it was almost surely #4.** #4 is the only printed normal card that was complete when the round ended (song 48). #2 would complete only at song 73.
2. **Quina 9's Bingo:** one song landed after the winning song (see Claims).
3. **The Especial:** #514, inside the entered range, completed a song before the winner, unclaimed.
4. **Three landings within 10 ms** in the Especial (see Songs).
5. **What the times mean:**
   - a round's start is its first landing, so the intro and the Shuffle sit in the Interval before it;
   - a round's close is when the tech closed it, after the Check and the Celebration;
   - the Game's start (18:13) is a button press, not the welcome.
6. **Only the last list of cards in play survives** (#400–550). The normal range is lost.
7. **The special rounds are named by emoji** ("😢", "⭐️"), not by name.
8. **The legacy text report** (`quina_analysis_report.txt`):
   - it prints the UTC start (17:13) as if it were local;
   - it takes 15 s off every round and adds them to every Interval, assuming a round closes when its last song stops;
   - its average of 47.8 songs includes the Desgraciat, as pool-size-2026.md notes.
9. **Use 2025's own card file.** `apps/cards/dist/cards.json` was regenerated on 2026-11-25 and now differs from 2025's cards in #398 and #492. Analyses of 2025 should read `legacy/2025/server/db/default/cards.json`. The pool-size study ran before the change, and neither card affects its results.

## What this changes for 2026

- **Log events, not just state.** Record each card-range edit, claim, Check result, undo, Hold and Pause with its time, and count phones and their reconnects anonymously. 2025's export can't say when cards sold, how many claims failed, or how phones were used. Take each winner from its Check, not from a typed number (Quina 1's is wrong).
- **Make "Següent" safe to repeat.** Each command should name the song it expects to replace, and the engine should drop duplicates. In 2025, three songs landed within 10 ms and two counted unheard.
- **Plan for a night that speeds up.** 2025's first five rounds took 108 minutes and the next five 74, with the same number of songs. If 2026's presenters behave like 2025's, a schedule built on a flat 14 s after Quina 1 will read late in the first half and early in the second. Either shape the schedule like 2025's, or tell the presenters to expect it.
- **Plan the Desgraciat's ending.** Half the cards sit within 5 songs, and the last 7 songs take one card each. That slow ending, with fewer than 10 cards standing, is where the presenters' crowd moments belong.
- **Normalise loudness and search whole songs for hooks.** A quarter of 2025's songs needed a manual boost, and the best hook sat about 1.5 minutes in. The 77 hand-marked hooks from 2025 make a ready test set for the hook finder.

## Method

`night_2025.py` reads the export and 2025's cards, and writes `night-2025-aggregate.json`; `run-output.txt` is its printout. Both were kept outside the repo. A gap over 45 s between two landings counts as a stop. Cards in play are taken as #1–190 and #400–550, as in pool-size-2026.md.
