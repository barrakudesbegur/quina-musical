# Waiting on the user

The only list of what waits on the user: decisions with the default in force meanwhile, and tasks only the user can do. Requirements, handoffs and the timeline refer to these by ID (U1, U2…).

- **Adding one:** sessions send it to the orchestrator, who adds it here with the next free ID. Sessions never edit this file directly: several share one checkout. Say which default you took, so the user only answers when they disagree.
- **Answering one:** the orchestrator records the answer in [decision-log.md](decision-log.md), updates the requirements, and moves the entry to "Answered" with its decision ID. IDs are never reused.
- Dates are in [timeline.md](timeline.md); the night is Sunday 27 December 2026.

## Decisions

### U84 · After a discard: Parlem alone, or the "aturat" setting
Sound engine's facts: "Avanç automàtic aturat" on the console isn't an override. It's the auto-advance setting itself switched off; it stays off across songs and rounds, and "Següent" doesn't bring it back. The override is the Hold: Parlem (like Aguanta and a claim) already suspends the auto-advance, and "Següent" ends the Hold, with the auto-advance as it was set.
- (a) **Parlem alone:** after a discard the music from before the Check comes back in Parlem. "Següent" ends it, and the auto-advance carries on as set. Nothing to remember or restore.
- (b) **The "aturat" setting:** the auto-advance is switched off too. After "Següent" it stays off until a presenter turns it back on.

### U77–U79 · The tablet, music and phones during a review (D118, D119)
A Check under review gets its own screen on the projector and the tablet; the music keeps playing, and Pausa is only by hand. To decide:
- **U77 · The tablet while under review:** the card under review with its private marks, the four choices (continue, win by hand, lose by hand, discard, with a warning when a choice goes against the card), and the usual Pausa and Parlem buttons. Anything to add or remove?
- **U78 · The music's level while under review:** (a) still far down, as during the Check; (b) back to the claim's level, under the presenters' voices, as before the Check; (c) full volume.
- **U79 · Phones while under review:** during a Check, phones show "Comprovant el cartró 123…". On a review: (a) that line just closes, with no mark (what Backend built for now, a one-line change); (b) it stays, still pending, until the card is checked again or dropped; (c) it changes to a neutral line, like the projector's.
No default: the user decides.

### U68–U75 · The edition file (D116): Backend's and Sound engine's joint proposal, 26 Nov
The proposal: `npm run edition -- build 2026` assembles `data/editions/2026.json` (the plan with rounds, prizes, sponsors' names, schedule and cheat sheet; the songs per Part; card types and cards; the pool it came from), checking that it all fits. It never holds audio, covers, hooks, Games, winners' names, resume codes, seeds or money. `npm run edition -- upload <file> [--reset]` validates, saves the cloud's current state, then replaces it. Local seeding is the same upload against the local Worker, plus the plan for the relay. Facts: logos and prize pictures are in the cloud's own database today, not in the bucket; cards and card types are static files deployed with the Worker.
- **U68 · Cards:** (a) uploaded data, so one upload configures everything; (b) static files deployed with the Worker, as today. Proposed: (a).
- **U69 · Where the old settings are saved:** (a) the cloud keeps every replaced version, restorable by number; (b) a timestamped local backup, gitignored since Games hold winners' names; (c) both. Proposed: (c).
- **U70 · What a rehearsal reset clears:** (a) the plan and settings, plus a fresh Game, with old Games kept; (b) also deletes the rehearsal Games, after backing them up. Phones keep their saved cards either way. Proposed: (a).
- **U71 · Logos:** (a) move to the R2 bucket; (b) stay in the cloud's database. The file only names them. Proposed: (a).
- **U72 · The path:** (a) `data/editions/2026.json`, like the pools; (b) `data/editions/26.json`. Proposed: (a).
- **U73 · Tests and development:** (a) a test edition file built from the default pool replaces the hand-written test plans; (b) keep both. Proposed: (a).
- **U74 · After an upload, if Admin edits the plan:** (a) `npm run edition -- pull` writes the cloud's plan back into the file before each commit; (b) Admin can't edit what the file holds; (c) the file is only a starting point, and Admin wins afterwards. Proposed: (a).
- **U75 · One file or split:** (a) one assembled file, as the user said; its cards (about 1 MB two-sided) change with every song swap; (b) the plan by hand in one file, with songs and cards referenced from the pool. Two files can drift. Proposed: (a).
- Their Q9 (one edition = one night pool with three Parts) is U54.
**Default:** nothing built until the user answers.

### U67 · Two status labels despite the UI freeze · blocking
Sound engine's step 1 for the new Check (unpushed) adds two Claim statuses, under review and dropped. The console doesn't build until `apps/console/strings.ts` has their labels, "En revisió" and "Descartat". Frontend has written them (two lines), but the freeze stops it committing them, so Sound engine is holding its push.
Options: (a) allow this two-line commit; (b) Sound engine keeps the new statuses out of the shared types until the console is unfrozen, which is more work and a temporary shape.
**Default:** nothing is pushed until the user answers.

### U66 · Publishing the Check boards
Frontend has drawn the new Check locally: the console's pad, a card mid-Check, automatic reveal, the two cues, the Celebration panel, several cards, a stopped Check, a wrong card, the Desgraciat, and the projector's stop fade.
**Default:** they stay local until the user says to publish them on the design canvas.

### U12 · The theme pass
Pending your go on the visual theme pass across the screens. Not ready yet (25 Nov).

### U13 · Listening pass on the new sound
Not heard yet: phrase landings, the lighter early palette and rare impacts, Signatures before the landing, the new Suspense, Aguanta's loop, vocal entries, Count-in. Two defaults to confirm while listening:
- **Suspense release:** it lands on the outgoing song's phrase boundary, up to about 9 s after the release. The alternative is a 2-bar boundary, about twice as fast. **Default:** the phrase.
- **Signatures are rarer:** about 5% of transitions (38 of last year's 77 songs get one). Options: keep it; lower the automatic pick's score (0.6); pick more by hand. **Default:** keep, and pick by hand while reviewing this year's songs.

### U59 · The special card's back
The special card plays the special rounds' own playlist (D105) on one side.
**Default:** a blank back. It could carry something instead, like house rules or sponsors; that needs deciding before print.

### U52 · Duplex printing and the paper
Printing both sides (D102) means telling the print shop "dúplex, vora llarga" (long-edge flip: with 3 cards in one column, each card's back lands behind it). Shops misalign duplex by up to about 2 mm, and songs may show through thin paper.
**Default:** today's coloured paper, printed duplex, with one proof sheet first to check the alignment, the show-through and both QRs held up to the light. Thicker paper (about 120–160 g/m²) only if the proof shows through. Printing costs more, and the page count doesn't change.

### U55 · Preparing Part 1 now, and the laptop's disk
Pool 1 is final, so it can be prepared now: analysis, hooks proposed, stems. Sound engine measured about 6 GB per set of 70 fully prepared, so about 18 GB for three, with 20 GB free today. Preparing one set at a time, as each is final, fits. Last year's test cache (7.3 GB) could be freed once this year's are prepared, but nothing is deleted without the user's OK (D80).
**Default:** nothing is prepared until the user says go. Last year's cache stays.

### U56 · Cutting the hook approval from 7 hours
About 2 minutes a song is about 7 hours for 210 songs. Sound engine's options: (a) a quick-review mode on the audition page, playing the top automatic hook (Enter accepts, the arrows step through candidates, the next song loads by itself), so 30–40 s a song and about 2 hours, at half a day of work; (b) one approved hook per song instead of two, which also cuts stems, disk and storage (each song plays in 5 rounds now, not 10); (c) other organizers review one set each, on the same page over the local network.
**Default:** (a) and (b); (c) if the user wants it.

### U57 · Part 2's song numbers
D103 numbers a final Part's songs alphabetically, so Part 1 is 1–70. Every session's agreed plan needs ids unique across the night's songs.
**Default:** Part 2 continues at 71–140 (and a third Part at 141–210), not 1–70 again.

### U58 · The alphabetical convention
Part 1's playlist is in title order with no song out of place (Sound engine, 25 Nov). It sorts word by word, the usual convention, which matters in three spots: #2 "A quién le importa" before #3 "AL GOLPITO"; #23–24 "El Ultimo Vals" and "El universo sobre mí" before #25 "Elefants"; #34 "L'Empordà" before #35 "La Gozadera", because the apostrophe sorts before letters. Letter by letter, ignoring spaces and punctuation, those would swap. Renumbering takes minutes, any time before the cards.
**Default:** word by word, as the playlist is now.

### U61 · A Part's song we can't download
D106 lets the Interval leave out a track nobody can get. A Part's songs are printed on the cards, and 70 is the count (D100). Part 1 has no such song today; Part 2 and the special rounds' playlist aren't fetched yet.
**Default:** as D66 says: the user downloads it by hand or swaps it in the playlist before the cards are made, so the Part keeps 70.

### U63 · A credential so agents can edit the cloud's plan
D116 has the user or an agent upload the edition's JSON to the cloud by hand, saving the old settings first. The upload tool is being proposed by Backend and Sound engine. To push without a Google login it needs its own Cloudflare Access service token, `quina-agent`, allowed only to read and save the plan, kept on the dev Mac only and revocable on its own. The user creates it in Zero Trust (a few clicks). About half a day of Backend's work.
**Default:** nothing built until the user says yes.

### U54 · What to call each set of 70 songs
The model now calls each set a "pool" (D101). Every tool, though, prepares and deploys one pool, so Backend proposes one prepared pool of 210 songs with three lists inside. Sound engine proposes the same single pool, with each song marked by its playlist and ids unique across the night. The user's own words are "playlist 1, playlist 2" and, for the covers, "part 1, part 2, especial".
**Default:** "Pool" stays the edition's whole set of songs, prepared together; each set of 70 is a "Part" (Part 1, Part 2, Especial); a round plays one Part, and a card's side is printed from one Part.


### U50 · How the screens point to the right side
The presenters explain the sides in rounds 1 and 6 (D102).
**Default:** the phone shows the side of the current or coming round by itself; the console reminds the presenters at the intros of rounds 1 and 6; the projector shows the side's mark at each regular round's intro and Interval, matching the printed one. Designs only, with Frontend.

### U51 · Round 6's pace
Songs come slower in the night's first round, when every song is new (about 22 s, then about 14 s). Round 6 starts a new pool, so its songs are all new too.
Sound engine: easy, since the rule becomes "the first round of each pool". That makes the first special round slow too, because its songs are new.
Related: in 2025 the night sped up (about 18 s a song early, 11 s late). The expected end is now worked out from each round's own Pace, so a faster default Pace for later rounds is also the user's call.
**Default:** round 6, and the first special round, play at round 1's slower pace (about 22 s); every other round stays at about 14 s.

### U36–U39 · How prizes really work
Asked in chat on 2026-11-25 after checking event.md against the 2025 hamper sheet and the 2026 sponsors sheet:
- U36: the Line's prize in 2025 and 2026;
- U37: a hamper's three tiers (the big item, sponsor gifts with logos, the basics uncredited), with a sponsor's units split across rounds;
- U38: a gift known only by its sponsor;
- U39: money donors are thanked, never tied to a prize;
- U40: answered (D89).

**Default:** the prizes drawer stays on hold until these are answered.

### U30 · Pick the prizes drawer
Corner style B and drawers J2 are picked (D87). For the prizes drawer, Frontend redraws P1–P3 with real 2025 prizes and sponsor logos (on the private canvas or local boards only, never in the public repo), with P3's dashed circle cut out properly and its left corners rounded.
**Default:** nothing built for the prizes drawer until the user picks.

## Tasks only the user can do

### U65 · Rotate the relay's pairing token · optional, before the tech rehearsal
The relay's pairing secret (`data/cache/relay-token`) sat in the private R2 bucket from 24 to 26 Nov, readable only with the laptop's service token. Backend removed it and excluded it from the sync (6397550). To rotate it: delete `data/cache/relay-token` on the show laptop; the relay makes a new one, and the tablet pairs again.
**Default:** rotate it when the tablet next gets paired anyway.

### U64 · Check R2's payment method
D113 lets R2 go past the free 10 GB. Backend can't see billing. In Cloudflare: Manage Account → Billing → Payment info, check a payment method is there.

### U14 · Approve this year's hooks · before the first rehearsal
On the audition page: about 2 minutes a song, so about 3 hours for 90 songs, and about 7 hours for 210 unless U56 cuts it. A song can't play until its hook is approved. It starts once the playlist is handed over and prepared (D80).

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

- **U82 · Where Discard leads** (2026-11-26) → D122: back to the music from before the Check, in Parlem with the auto-advance off, until "Següent".
- **U76 · The projector during a review** (2026-11-26) → D123: the Check screen, showing "Revisió manual".
- **U83 · `dropped` or `discarded`** (2026-11-26) → D124: `discarded`.
- **U81 · The internal status name for "under review"** (2026-11-26) → D120: `reviewing`.
- **U80 · A temporary-sounding name for the stopped Check** (2026-11-26) → D119: "under review", "En revisió" on the tablet, button "Revisió manual".
- **U62 · The Check's remaining details** (2026-11-26) → D117: a stop goes into Pausa; automatic reveal runs through the fanfare and stops there; the rest stands.
- **U46 · Londrina's two lowercase exceptions** (2026-11-26) → D114: both, as drawn.
- **U47 · The card icon picker's style** (2026-11-26) → D115: A; the QR icon is too sharp next to the others.
- **U43 · Which copy wins on the night** (2026-11-26) → D111: the cloud, always; no git-tracked settings file; development runs on a test plan.
- **U48 · Sponsors' names and money in the settings file** (2026-11-26) → D112: no sponsors, prizes or money in git.
- **U53 · Storage past the free 10 GB** (2026-11-26) → D113: fine to go past it; upload as soon as the files are ready, prune after the night.
- **U60 · Two Interval tracks by hand** (2026-11-26) → D106: left out; the Interval plays its 37.
- **U49 · The special rounds' pool** (2026-11-26) → D105: their own playlist (79G8VcNrkih9GGjIzb47Gt), using Part 1's songs until it's final. The special card's back moved to U59.
- **U34 · How many songs in the pool** (2026-11-25) → D100: 70, final, for each pool.
- **U42 · Where the night's settings file lives** (2026-11-25) → D97 and D98: in this public repo, every prize included; hiding prizes is only for the hype on the players' screens.
- **U45 · The shake icon** (2026-11-25) → D94: option C with a smaller, medium "×3" (size option 2 for now), no frame.
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
