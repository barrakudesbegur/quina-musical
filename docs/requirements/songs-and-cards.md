# Songs and cards

What the song pool, the song preparation and the printed cards must be, as it stands now.

- Every rule here comes from [event.md](../event.md). Why a rule is the way it is, and what it replaced, is in [decision-log.md](../decision-log.md).
- "(pending U34)" points to [open-questions.md](../open-questions.md); the rule states the default in force meanwhile.
- "**Not built yet.**" marks a rule the handoffs list as still to do.
- Dates are in [timeline.md](../timeline.md). Terms follow [GLOSSARY.md](../../GLOSSARY.md).

## The pool

_From event.md › The songs._

- A **Pool** is a curated playlist a side of the cards is printed from. Each round plays one pool, and its Queue is a shuffle of that whole pool.
- **2026 has two pools of 70 songs** with different songs (D101, D178), split by the organizers (D193): pool 1 for Quines 1–5, pool 2 for Quines 6–10. The special card is printed on both sides like the normal one (D226): side 1 from pool 1 for the Desgraciat, side 2 from pool 2 for the Especial. Each pool plays six rounds.
- The team builds it together:
  - over several weeks, everyone adds songs to a shared Spotify playlist;
  - then a few members filter it down to the final count;
  - an archive playlist keeps past songs.
- Pool 1 was final on 25 Nov at 70 songs (D100). Pool 2 (https://open.spotify.com/playlist/0sWgctjhXP6TS1aB4jfaHb) is still being filled by the organizers, then filtered to 70.
- The songs are popular hits from every era and genre, including Catalan, Spanish and Christmas songs.
- Last year's 77 songs are only test material. Everything that depends on the Pool must run again on a new one: preparation, hooks, cards and storage.
- **The songs are never published.** Audio stays out of the public repo and off the public internet.

## The pool's size

_From event.md › The songs, Timing; 2025's song-count notes; the mixer decisions › Phase and Heat._

The size is a hard choice, because it shapes the night: more songs mean longer rounds. Each edition decides its own when it finalises the playlist. Card generation reports, for a given pool size and number of cards sold, the expected songs to the first Line and to the Bingo, to help choose (R1-Q31). For 2026: 70 songs per pool, final (D100), the study's recommendation.

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
- 2025 had 77 songs. Regular rounds averaged 50 songs (42–56) and 16 minutes (11–20); the Desgraciat took 21. The 2026 study is in [research/reports/pool-size-2026.md](../research/reports/pool-size-2026.md) (pending U34).
- 2024 had 87 songs, which was too many. We expected 35 songs a round and got about 60.
- A simulation with 77 songs and about 200 cards in play puts the first Line around song 16 (80% of rounds between songs 11 and 21) and the Bingo around song 50 (45–55).

The storage limit also caps the size: about 100 songs fit in today's format ([operations.md › Storage](operations.md#storage)).

## Hooks

_From event.md › The songs; the decisions doc › Changes; the mixer decisions › Transitions._

- **Every song lands on a Hook:** a moment where its most recognizable part starts on a downbeat, usually a chorus. A song can have more than one. Its first play of the night always starts at its main hook (D174).
- This year's hooks are detected automatically: the chorus start, an energy jump and the vocals coming in, snapped to phrases.
- **They're proposals.** On last year's songs, the top automatic candidate was within a bar of the real hook in only 26 of 77 songs.
- **The user approves, rejects or nudges each hook** on the audition page, about 2 minutes a song (pending U14, before the first rehearsal). A song can't play until its hook is approved.
- A song keeps its id when the playlist is reordered (the id follows its Spotify track), so approvals made on the draft carry over to the final pool (D79).
- **Once a pool is final, its ids are alphabetical (D103):** the user sorts the playlist by hand, leading articles included ("The …" under T, unlike Spotify's sort), and Sound engine checks the order before numbering. pool 1 is 1–70; pool 2 continues from 71 (pending U57).
- A provisional bulk approval of each song's top hook may stand in for rehearsals, marked as provisional everywhere, with a preflight warning. **Not built yet.**

## Song preparation

_From event.md › The songs; the Sound engine handoff._

- The tech prepares every song: download, decode, analysis, snippets, validation, keys, stems, Signatures, hooks and the Interval music. A full run on 86 songs takes about 45 minutes.
- The download method is the tech's call (D66): whatever gets every song through the quality check below with little work for the user. The user downloads by hand only the few songs it can't get. Downloads run with the VPN off: YouTube asks VPN addresses to sign in.
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
- **The normal card is printed on both sides (D102):** side 1 plays Quines 1–5 (pool 1), side 2 Quines 6–10 (pool 2) (D193), with the same number on both. Side 2 has its own design, and each side shows which rounds it's for. Both are designed by the user with Frontend; nobody changes the card's design before then.
- **Last year's cards stay easy to spot** (D85): 2026's carry the year in the branding, the covers and the new side labels.
- **The branding (D254):** beside the logo, «QUINA QUINA!» (no «3»), with «BARRAKUDES · 2026» under it.
- **The style is last year's printed card** (apps/cards/dist/cards-normal.pdf), with covers added: it's a printed document, not the app's look, so no web components (D250).
- **Each side's title, centred on the card's width (D254):** the normal card's «QUINES 1–5» on side 1 and «QUINES 6–10» on side 2, white on black. The special card's «DESGRACIAT» and «ESPECIAL» (D252).
- The faint background stamp is the logo only; the year is in the branding (D254).
- **A sticker circle (D231, D253):** a dotted circle of about 15 mm with «GOMET» centred in it, for a coloured shape sticker matching the card's mark on the phone (D5) (sides pending U201). No name field (D250).
- **One short line:** «MARCA NOMÉS AMB BLAT DE MORO», with no corn icon (D232, D250).
- **The number** has a faded «#» before it (D250).
- **Song covers (D233):** each song shows its cover, so players find it faster, printed in colour. The design is done with the card design session (canvas https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392).
- The price isn't printed.

## Card types

_From event.md › The cards; the decisions doc › Changes._

- The card types come from the card generation, not from Admin. Each type has an id, a name, a pastel colour and a printed title.
- There are two:
  - **normal cards** play the regular rounds;
  - **special cards** ("especial") play the Quina Especial, whose prizes are bigger, so its card is sold separately. They also play the Desgraciat, one card for both rounds (D70, D81).
- Fewer special cards are printed than normal ones. Each type has its own colour.
- Admin only chooses which type each round plays, and shows the types read-only.
- 2026, provisionally: normal and especial, 399 and 300, as in 2025 (D68; may change at print time).

## Numbers and amounts

_From event.md › The cards (Amounts)._

- Card numbers restart each edition, normal cards first (2025: normal #1–399, special #400–699).
- Each type's amount is a multiple of 3, to fill whole pages.
- 2024: 250 of each type printed; 214 normal and 147 special sold.
- 2025: about 250 cards in play expected; about 190 normal and 151 special actually played.

## Generating and printing

_From event.md › The cards (Printing); timeline.md._

- The cards are generated from the final Pool, so no two cards and no two lines are the same.
- The same seed and Pool always give the same cards, so a reprint matches.
- The generator checks everything before it writes: duplicate songs, songs without a title, bad type ids, amounts, a Pool of fewer than 12 songs.
- **Once the cards are printed, no song can change.** A playlist change after the cards go to print means reprinting them; after they're printed, it's not possible.
- **Print well ahead.** Never the day before. Printing takes a few hours at a local print shop, and cards are sold only on the night (D71), The user makes the cards on 4–5 December if the playlist is ready (D83), so the pool is prepared and quality-checked between 1 and 4 December, and swaps happen before then.
- **Duplex (D102):** the PDF alternates front and back pages in the same card order, for a long-edge flip ("dúplex, vora llarga"). Every element stays at least 5 mm inside the cut edges on both sides; the cut lines are on the front only; the back has no full-bleed colour that depends on alignment. One proof sheet comes first (pending U52).
- The PDF needs a native module; the user approved its install script (U17).
- Every card's songs are public, because phones need them (D78).

## Prices

_From event.md › The cards (Prices); the user's answer to U5._

- The price isn't printed on the card. A price list hangs at the bar.
- **A normal card's price drops as rounds are played.** It's the per-round price × the regular rounds still to play, the coming one included. The Desgraciat doesn't count. 2025: 1.50 € a round, so 15 € before round 1 and 1.50 € before the last.
- **A special card has a fixed price** (2025: 5 €).
- **2026 uses 2025's prices** (D69): 1.50 € a round and 5 €.
- Both prices come from the setup data, never from code: a price rule per card type in `card-types.json` (per regular round still to play for normal cards, fixed for special cards), read through one shared helper (D64). Prices are never printed on the cards.
- The projector shows only the coming round's card price ([screens.md › Projector](screens.md#projector)). Until a price is set, it shows none.

## The printed QR

_From event.md › The cards, Players' phones; the decisions doc › Player app._

- Each card's QR opens the player app at `quina.barrakudesbegur.org/<edition>/<number>`, this year `/26/123`.
- The edition tag is the same as the Game plan's edition, so phones keep each year's cards apart.
- Last year's links show "Aquest cartró és de l'any passat".
- The QR keeps its own white background, so it scans on any paper colour.
- The address points at the new app since 25 Nov (D76); last year's app lives on at its GitHub Pages address. A printed card is checked against it once the cards are printed.
