# Songs and cards

What the song pool, the song preparation and the printed cards must be, as it stands now.

- Every rule here comes from [event.md](../event.md). Why a rule is the way it is, and what it replaced, is in [decision-log.md](../decision-log.md).
- "(pending U3)" points to [open-questions.md](../open-questions.md); the rule states the default in force meanwhile.
- "**Not built yet.**" marks a rule the handoffs list as still to do.
- Dates are in [timeline.md](../timeline.md). Terms follow [GLOSSARY.md](../../GLOSSARY.md).

## The pool

_From event.md › The songs._

- The **Pool** is the curated playlist the cards are printed from. Every round's Queue is a shuffle of the whole Pool.
- The team builds it together:
  - over several weeks, everyone adds songs to a shared Spotify playlist;
  - then a few members filter it down to the final count;
  - an archive playlist keeps past songs.
- This year's list is final on **1 December 2026**. The draft has 86 songs.
- The songs are popular hits from every era and genre, including Catalan, Spanish and Christmas songs.
- Last year's 77 songs are only test material. Everything that depends on the Pool must run again on a new one: preparation, hooks, cards and storage.
- **The songs are never published.** Audio stays out of the public repo and off the public internet.

## The pool's size

_From event.md › The songs, Timing; 2025's song-count notes; the mixer decisions › Phase and Heat._

The size is a hard choice, because it shapes the night: more songs mean longer rounds. Each edition decides its own when it finalises the playlist. Card generation reports, for a given pool size and number of cards sold, the expected songs to the first Line and to the Bingo, to help choose (R1-Q31).

**2025's planning numbers:**

| Measure | 2025 plan |
|---|---|
| Songs in the Pool | About 80 (fewer was fine) |
| Songs per card | 12 (3 lines of 4) |
| Cards in play | About 250 of 350 printed |
| Songs per round | 46–56, 51 on average |
| Round length | 12–14 minutes, at about 15 s a song |
| Chance of a tie | 11% |
| A card's share of the Pool | 12 songs = 15% (16.6% in classic bingo) |

**What happened:**
- 2025 had 77 songs. Rounds averaged 48 songs (42–56) and 16 minutes (11–20).
- 2024 had 87 songs, which was too many. We expected 35 songs a round and got about 60.
- A simulation with 77 songs and about 200 cards in play puts the first Line around song 16 (80% of rounds between songs 11 and 21) and the Bingo around song 50 (45–55).

The storage limit also caps the size: about 100 songs fit in today's format ([operations.md › Storage](operations.md#storage)).

## Hooks

_From event.md › The songs; the decisions doc › Changes; the mixer decisions › Transitions._

- **Every song lands on a Hook:** a moment where its most recognizable part starts on a downbeat, usually a chorus. A song can have more than one.
- This year's hooks are detected automatically: the chorus start, an energy jump and the vocals coming in, snapped to phrases.
- **They're proposals.** On last year's songs, the top automatic candidate was within a bar of the real hook in only 26 of 77 songs.
- **The user approves, rejects or nudges each hook** on the audition page, about 2 minutes a song (pending U14, by 10 December). A song can't play until its hook is approved.
- A provisional bulk approval of each song's top hook may stand in for rehearsals, marked as provisional everywhere, with a preflight warning. **Not built yet.**

## Song preparation

_From event.md › The songs; the Sound engine handoff._

- The tech prepares every song: download, decode, analysis, snippets, validation, keys, stems, Signatures, hooks and the Interval music. A full run on 86 songs takes about 45 minutes.
- The download method is open (pending U1). Default: nothing downloaded yet.
- **The quality check.** Every source must pass, or be flagged for the user to check by ear:
  - a bitrate of about 128 kbps or more;
  - no brick-wall low-pass under 15 kHz;
  - a length within 5 s of Spotify's;
  - no wrong version (live, cover, karaoke, sped up).
- Downloads keep the source's own audio stream, with no re-encode.
- Unusable songs are flagged the day the Pool is prepared, so the user can swap them before the cards are printed.
- Generated song data never goes in git. It lives in the private R2 bucket and the database, so any prepared laptop can run the Quina.

## The card

_From event.md › The cards._

- A card has 12 songs in 3 lines of 4, a number (written "#123") and a QR code. Three cards print on each page.
- Each edition has a new paper colour and title, so last year's cards are easy to spot (pending U2). Default: last year's title ("QUINA QUINA!") and colour.
- Each card carries a faint year stamp.
- The price isn't printed.

## Card types

_From event.md › The cards; the decisions doc › Changes._

- The card types come from the card generation, not from Admin. Each type has an id, a name, a pastel colour and a printed title.
- There are two:
  - **normal cards** play the regular rounds and the Desgraciat;
  - **special cards** ("especial") play only the Quina Especial. Its prizes are bigger, so its card is sold separately.
- Fewer special cards are printed than normal ones. Each type has its own colour.
- Admin only chooses which type each round plays, and shows the types read-only.
- This year's types and amounts are open (pending U3). Default: normal and especial, in 2025's amounts.

## Numbers and amounts

_From event.md › The cards (Amounts)._

- Card numbers restart each edition, normal cards first (2025: normal #1–399, special #400–699).
- Each type's amount is a multiple of 3, to fill whole pages.
- 2024: 250 of each type printed; 214 normal and 147 special sold.
- 2025: about 250 cards in play expected.

## Generating and printing

_From event.md › The cards (Printing); timeline.md._

- The cards are generated from the final Pool, so no two cards and no two lines are the same.
- The same seed and Pool always give the same cards, so a reprint matches.
- The generator checks everything before it writes: duplicate songs, songs without a title, bad type ids, amounts, a Pool of fewer than 12 songs.
- **Once the cards are printed, no song can change.** A playlist change after the cards go to print means reprinting them; after they're printed, it's not possible.
- **Print well ahead.** Never the day before. The plan: generated and proofed by 3 December, printed by 11 December. When the cards are handed out, and the print lead time, are open (pending U4). Default: sold from about 12 December, printed in about a week.
- The PDF needs a native module whose install script the user must approve (pending U17).
- Every card's songs are public, because phones need them (pending U22). Default: public.

## Prices

_From event.md › The cards (Prices); the user's answer to U5._

- The price isn't printed on the card. A price list hangs at the bar.
- **A normal card's price drops as rounds are played.** It's the per-round price × the regular rounds still to play, the coming one included. The Desgraciat doesn't count. 2025: 1.50 € a round, so 15 € before round 1 and 1.50 € before the last.
- **A special card has a fixed price** (2025: 5 €).
- Both prices come from the setup data, never from code: a price rule per card type in `card-types.json` (per regular round still to play for normal cards, fixed for special cards), read through one shared helper (D64). Prices are never printed on the cards.
- The projector shows only the coming round's card price ([screens.md › Projector](screens.md#projector)). Until a price is set, it shows none.

## The printed QR

_From event.md › The cards, Players' phones; the decisions doc › Player app._

- Each card's QR opens the player app at `quina.barrakudesbegur.org/<edition>/<number>`, this year `/26/123`.
- The edition tag is the same as the Game plan's edition, so phones keep each year's cards apart.
- Last year's links show "Aquest cartró és de l'any passat".
- The QR keeps its own white background, so it scans on any paper colour.
- The address must point at the new app before the cards are handed out, checked with a printed card (pending U15).
