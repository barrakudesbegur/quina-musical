# Waiting on the user

The only list of what waits on the user: decisions with the default in force meanwhile, and tasks only the user can do. Requirements, handoffs and the timeline refer to these by ID (U1, U2…).

- **Adding one:** sessions send it to the orchestrator, who adds it here with the next free ID. Sessions never edit this file directly: several share one checkout. Say which default you took, so the user only answers when they disagree.
- **Answering one:** the orchestrator records the answer in [decision-log.md](decision-log.md), updates the requirements, and moves the entry to "Answered" with its decision ID. IDs are never reused.
- Dates are in [timeline.md](timeline.md); the night is Sunday 27 December 2026.

## Decisions

### U12 · The theme pass
Pending your go on the visual theme pass across the screens. Not ready yet (25 Nov).

### U13 · Listening pass on the new sound
Not heard yet: phrase landings, the lighter early palette and rare impacts, Signatures before the landing, the new Suspense, Aguanta's loop, vocal entries, Count-in. Two defaults to confirm while listening:
- **Suspense release:** it lands on the outgoing song's phrase boundary, up to about 9 s after the release. The alternative is a 2-bar boundary, about twice as fast. **Default:** the phrase.
- **Signatures are rarer:** about 5% of transitions (38 of last year's 77 songs get one). Options: keep it; lower the automatic pick's score (0.6); pick more by hand. **Default:** keep, and pick by hand while reviewing this year's songs.

### U34 · How many songs in the pool
The study ([research/reports/pool-size-2026.md](research/reports/pool-size-2026.md)) gives candidate nights from a first song at 18:05: 60 songs (rounds end about 21:16), 65 (21:25), 70 (21:34, bad case 21:46), 77 (21:47, no margin before 22:00), 86, the whole draft (22:04).
**Default:** 70, the study's recommendation.

### U36–U39 · How prizes really work
Asked in chat on 2026-11-25 after checking event.md against the 2025 hamper sheet and the 2026 sponsors sheet:
- U36: the Line's prize in 2025 and 2026;
- U37: a hamper's three tiers (the big item, sponsor gifts with logos, the basics uncredited), with a sponsor's units split across rounds;
- U38: a gift known only by its sponsor;
- U39: money donors are thanked, never tied to a prize;
- U40: answered (D89).

**Default:** the prizes drawer stays on hold until these are answered.

### U42 · Where the night's settings file lives
D89 puts the whole night's settings in one git-tracked JSON file. But this repo is public: anyone could read every prize before its round's intro (prize secrecy) and each sponsor's money amount.
**Default:** nothing moves until the user answers.

### U43 · Which copy wins on the night
Before the night the file is the source and is pushed to the cloud. On the night, a last-minute edit from a phone changes the cloud.
**Default:** after the night (or after any phone edit) an agent pulls the cloud's plan back into the file, so git records what really happened.

### U45 · The shake icon
The first shake icon was rejected. Canvas board "Component · icona de sacsejar el comandament (tria)", options A–F.
**Default:** none until the user picks.

### U30 · Pick the prizes drawer
Corner style B and drawers J2 are picked (D87). For the prizes drawer, Frontend redraws P1–P3 with real 2025 prizes and sponsor logos (on the private canvas or local boards only, never in the public repo), with P3's dashed circle cut out properly and its left corners rounded.
**Default:** nothing built for the prizes drawer until the user picks.

## Tasks only the user can do

### U14 · Approve this year's hooks · before the first rehearsal
On the audition page: about 2 minutes a song, so about 3 hours for 90 songs. A song can't play until its hook is approved. It starts once the playlist is handed over and prepared (D80).

### U16 · Upload the logo library in Admin
It needs your Google login: Admin → "Pujar logos a la biblioteca" with the cleaned logos in `temp/logos-clean/`, then "Triar de la biblioteca" per sponsor. Two logos are small sources; ask those sponsors for bigger ones.

### U18 · The night's plan in Admin · before the first rehearsal
Rounds in order, a card type per round, prize bundles, sponsors (money donors too), the Schedule with throw breaks.

### U19 · Checks on real devices · before the rehearsals
1. An iPhone with Safari and an Android phone with Chrome: scan a test QR, add a second card by number, lock and unlock (it reconnects, and the screen stays awake), sounds after the first tap.
2. An older phone: smooth scrolling with 3–4 cards, usable at the end of a round.
3. Last year's offline cache (can be checked now): open the QR address on a phone that used last year's app; it must load this year's player, not the cached old one.
4. The projector at 4:3, then 16:9: the drum, the last-3 row and the Check readable from the back.
5. The console on the actual tablet (iPad and Android) over the hotspot, then pair a phone as the tech's console.
6. The real Wii remote: every button, the shake for Suspens, and its range from the stage to the laptop.

### U20 · More Hold music and victory tracks
Only 3 Hold loops and 1 victory track exist, so they repeat a lot (`data/media/hold`, `data/media/celebration`). You'll add more.

## Answered

- **U44 · The menu's rare, risky holds** (2026-11-25) → D92: they keep "Mantén premut", as a tag beside the label.
- **U41 · A Celebration while a drawer is open** (2026-11-25) → D90: a Celebration closes Premis, Horari and Ajustos, not the pad; the your-song flashes and particles play on top of everything.
- **U35 · What the print shop needs** (2026-11-25) → D88: the same as last year, just the PDF.
- **U40 · How contributions get into hampers** (2026-11-25) → D89: the organizers use their own spreadsheet; the orchestrator parses it into the plan; the night's settings live in a git-tracked JSON file that agents edit.
- **U17 · The PDF install script** (2026-11-25): approved by the user; `canvas` is built and loads.
- **U26 · One special card for both special rounds** (2026-11-25) → D81: yes, one card plays both.
- **U27 · The rehearsal dates** (2026-11-25) → D82: no fixed dates; a tech rehearsal when ready, maybe a presenters' one a day or two before or on the day.
- **U28 · When the cards are printed** (2026-11-25) → D83: the user makes them on 4–5 December, if the playlist is ready.
- **U29 · How far "no fallbacks" goes** (2026-11-25) → D84: no fallback versions in the code; the operational plan Bs stay.
- **U31 · A new colour each edition?** (2026-11-25) → D85: a new title each edition; the colour may stay.
- **U24 · Stray local files** (2026-11-25): `legacy/2025/last-year-data/` is git-ignored; the rest of `legacy/2025/` stays; the old `ci-head` worktree is removed (all of it was already on main). Useful aggregates from the export go into a doc.
- **U32 · Storage past 100 songs** (2026-11-25) → D80: moot; the final playlist will almost surely be under 100 songs. No work on the draft until the user hands over the playlist.
- **U33 · Disk space** (2026-11-25): withdrawn by D80; nothing is deleted.
- **U23 · Frontend's session can't reach GitHub** (2026-11-25): resolved; the user ran `ssh -T git@github.com` there and it authenticates.
- **U1 · How to download the songs** (2026-11-25) → D66: the method is Sound engine's call, as long as the quality is right and the user does little work; the user downloads only the few leftovers by hand.
- **U2 · The printed card's title and colours** (2026-11-25) → D67: "QUINA QUINA! 3" with last year's colours, provisionally; may change at print time.
- **U3 · Card types and amounts** (2026-11-25) → D68: as in 2025, provisionally.
- **U25 · This year's card prices** (2026-11-25) → D69: as in 2025, 1.50 € a round and 5 € for a special card.
- **U4 · When cards are handed out** (2026-11-25) → D71: only on the night, at the start and during it; printing takes a few hours.
- **U7 · Two Desgraciat board points** (2026-11-25) → D72: no standing count on the projector; the sitting nino.
- **U8 · The prizes corner icon** and **U10 · The player app's layout** (2026-11-25) → D73: drawers and two corner buttons, no fallback; proposals to pick from (U30).
- **U9 · The effect when the landed song is yours** (2026-11-25) → D74: spotlights and flashes, no bolt drawing, smooth in and out.
- **U11 · The card-stacking scroll** (2026-11-25) → D75: discarded for now.
- **U15 · The QR domain switch** (2026-11-25) → D76: now.
- **U21 · Card text size on phones** (2026-11-25) → D77: the current design is fine.
- **U22 · The printed cards are public** (2026-11-25) → D78: public, and anything may be public unless there's a reason.
- **U5 · Card prices on the projector** (2026-11-25): show only the price for the coming round, on that round's Interval screen (the before-the-start screen is round 1's). A normal card costs the per-round price × the regular rounds still to play, the coming one included, not counting the Desgraciat (2025: 1.50 €, so 15 € before round 1); before the Quina Especial, the special card's fixed price. The prices come from setup data, never hard-coded.
- **U6 · The Desgraciat's celebration title** (2026-11-25): none. "DEMPEUS!" is dropped; the rest of its Celebration stays. The phones' per-card "Dempeus" / "Assegut" labels stay.
- **Rehearsal dates:** withdrawn. The 13 and 19 December written in event.md were the orchestrator's defaults, not the user's; reopened as U27.
- **Late claims (R2-Q12):** a late claimer wins if nobody else claimed; any other case is decided on the spot (event.md).
- **The Desgraciat when the last players fall together:** they share the win (event.md).
- **The Efectes pads:** icons, with the word version kept as a board (canvas, 24 Nov).
- **Wii remote mapping (R2-Q38):** decided and built.
- **Where the show runs (R2-Q26):** A+, an installed laptop with media from R2.
