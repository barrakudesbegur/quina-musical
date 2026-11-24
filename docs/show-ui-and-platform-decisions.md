# Show UI, player app and platform decisions (2026-11-24)

Agreed with the user in a second design interview. This covers the screens left out of the mixer proof of concept, the new player app, and hosting. It builds on [mixer-design-decisions.md](mixer-design-decisions.md) and overrides it where they differ. Terms follow [GLOSSARY.md](../GLOSSARY.md); lasting decisions are in [docs/adr](adr).

## Changes after the first listen and review (2026-11-24, later)

These override the sections below where they differ.
- **No more grace rule.** Phones mark every landed song, the latest included. They still never announce or celebrate a Line or a Quina: players must claim it.
- **Players see only the current round's history.**
- **The drum holds only pending songs.** Landed songs leave it; Back puts one back.
- **Round order can change during the event.** Admin edits upcoming rounds live; the laptop picks the changes up.
- **The Hold button on the console reads "Parlem"**, with a microphone icon.
- **Per-card icons on phones,** always corn for the first card (shape alone tells them apart).
- **Images are JPEG XL**, with a PNG fallback (logos) or a JPEG fallback (covers). Never WebP.
- **A logo library** is kept privately in the cloud, cleaned in bulk; Admin picks from it.
- **Signatures are picked automatically**, with a veto. They are instrumental intro or pre-chorus pieces, teased *before* a landing.
- **Suspense keeps the current song playing.** The drum hovers over about 3 pending songs while their decoys tease, then resolves to the real next song.
- **Transitions have an intensity range.** Lighter, quick and well-made at the start of a round, growing with the phase. Always produced DJ moves, never bare volume fades.
- **The presenters' actions:** Següent; Parlem (Hold: no landing, music ducked); **Aguanta** (Stay: no landing, full volume); Suspens; Enrere (long press); Comprovar cartró; Efectes; Ritme. The Wii remote mapping is still to be decided.
- **The near-win cue on phones is subtle:** the missing song is gently highlighted on that card's grid. There is no banner, and no win is ever announced.
- **Hooks for this year's songs are detected automatically** (the chorus start, an energy jump, the vocals coming in, snapped to phrases), and the user approves, rejects or nudges each one on the audition page.
- **The repo is being reorganised:** `apps/`, `packages/`, `tools/` and `legacy/2025/`. Nothing is called a POC anymore; this is this year's app.

## Who builds what

- **UI/UX session** builds every screen:
  - the projector scenes (drum overlays, Shuffle, Check, Celebration, Interval, Heat, and the before and after states);
  - the whole console, show controls included;
  - the Admin page;
  - the player app;
  - the cheat sheet, on screen and as a basic printable PDF.
- **Builder session** owns:
  - the audio engine;
  - the shared protocol package (`@quina/protocol`);
  - the Game journal;
  - the cloud backend (Worker, Durable Object, Access, media sync).
- **Process:**
  - The protocol is the contract. New commands go into protocol.ts and protocol.md together, and the builder reviews and merges them.
  - UI modules use the bus and never import the engine's internals.
- **Design before code:** every screen and animation starts as a Claude artifact mockup for the user's feedback. The user iterates the final look with the UI/UX session.

## Stack

- TypeScript everywhere, in real `.ts` files with Vite. Never untyped JS.
- Svelte 5 for the console, Admin and player app; plain TypeScript modules for the projector scenes. Same stack as the user's other project, barrakudesbegur/coin-reader.
- Never React. The old React client is only mined for ideas.

## Hosting and architecture (ADR 0003)

- **The cloud owns the Game:**
  - one Cloudflare Durable Object with SQLite, exportable as JSON;
  - songs and media in R2, pre-downloaded to the show laptop;
  - the player app and covers served as static assets;
  - admins log in with Cloudflare Access with Google, copying coin-reader's `requireAccess` pattern.
- **The show laptop owns live playback.** It journals everything, resumes from the cloud after a crash or swap, and runs alone when offline. If it was restarted offline, an admin resumes it by hand from Admin (round and song).
- **The free tier first.** Load-test with 400 simulated phones before the night, and check usage at the rehearsal. Upgrade on the spot if a limit is hit; that only pauses phones and consoles, never the show.
  - Don't use client heartbeats or polling.
  - Reconnect with backoff and jitter.
  - Store one snapshot row, not history reads.
  - Serve covers as static files, not through the Worker.
- **Deployed (2026-11-24):** the Worker `quina-cloud` is live at `https://quina-cloud.barrakudes.workers.dev`, on workers.dev only, with no DNS change. It serves the player app, the phone feed, cards and covers. Organizer and laptop routes refuse every request until Access is set up. Steps and undo are in `experiments/mixer-poc/cloud/docs/deploy-plan.md`. Still to do: the `quina-dev` subdomain, the Access apps and service token, the secrets, the organizer emails, and the R2 bucket.
- **The venue:** a pop-up tent with no Wi-Fi and no router; good 5G and phone hotspots.
  - The laptop is tethered by USB to a phone, with a second phone (another carrier) as a backup hotspot.
  - The laptop sits in the first row or at the side of the stage.
- **Plan B when 5G drops:**
  - **The laptop's keyboard shortcuts and the Wii remote**, listed on the cheat sheet. The Wii remote pairs to the laptop and is optional; the console can do everything it does.
  - **A console on the same hotspot as the laptop** loads from the laptop and talks to it directly.
  - Keep it simple.
  - That LAN console is not a secure context: no Wake Lock, service worker or crypto.subtle. The tablet's auto-lock is set to never instead.
- **Phones:** players use only the cloud, on their own mobile data. The public feed never carries the Queue, the next song or possible winners. Phones learn a song only at its landing.

## Rules of the game that the screens must support

- **On-screen words (Catalan only):**
  - **Rounds:** "Quina 1", "Quina 2"…
  - **Line:** "Línia".
  - **The full-card win:** "Quina!" ("premi de quina").
  - **The whole night:** just "Quina Musical".
- **Shuffle:**
  - It reshuffles deterministically from the same seed until neither the first Line nor the first Bingo is a tie among the cards in play.
  - The rule is public.
  - The animation never reveals the queue order.
  - No fairness code is shown: trust comes from familiar, easy-to-follow animations. Seeds are kept in the Game data for debugging.
- **Claims:**
  - The first to claim wins. Claims on the same landing share the prize; the winners agree on the split.
  - A late claimer wins if nobody else claimed. Other late-claim disputes are decided on the spot, so the console shows when each claimed card became complete ("complete since song 34").
  - An unclaimed win is lost.
  - Several winners per Line or Bingo are possible, and all claimed cards are checked before the round moves on.
- **Validity:**
  - A card number outside the generated cards is invalid.
  - A card of the wrong type for the round (special or normal) is invalid.
  - "Not registered as sold" is only a warning, shown on the console.
  - A presenter always confirms or invalidates a card. Both are recorded.
- **Check:**
  1. The card number is entered on the console.
  2. The card grid shows on the projector.
  3. The songs play in order as 2–3 s hook snippets, each marked ✓ or ✗. ✗ plays "broken", briefly.
  4. A Line check plays the completed row (or the row with the most landed songs, top row on a tie). A Bingo check plays all 12.
  5. The steps are timestamped in advance. Hold music stays ducked throughout.
  6. A failed Check: the Failure fanfare, then the error Hold music until Resume.
- **Celebration:**
  - A big impact, a victory lap of the drum, and the Clear fanfare.
  - The music is a suggested default the presenters can change without being blocked: the Winning song for a Line, the victory track into the Interval for a Bingo.
  - No prize ceremony: winners' names (optional) and notes are recorded, and prizes are collected later.
- **Back:** it undoes the last landing, and phones unmark that song.
- **Rounds start by hand.** Presenters announce the prizes first, so the Interval countdown is only a guide.
- **Special round:** only special cards count, and phones show only special cards then.

## Projector

- **Hardware:** a 4:3 projector, far from the audience, so only big elements and no small text. It must also work at 16:9.
- **Style:** juicy, game-like, plenty of animation, Christmas.
- **States:**

| State | Projector |
|---|---|
| Before the Game | "Quina Musical", a "scan your card" QR, how to play in 3 lines, sponsors, a rough countdown; Interval music |
| Round start | "Quina N" with its Line and Quina prizes and sponsors while presenters announce them, then the Shuffle (grid into the drum, item-box sound) |
| In play | Drum; current song big after each landing; **only the last 3 songs**; "Quina N"; Heat. No QR or URL during play |
| Hold (talking) | No visible change |
| Claim and Check | "Comprovant el cartó 123…", the card grid, songs ✓/✗ one by one, the result |
| Celebration | "LÍNIA!" or "QUINA!" huge, winning card number(s), prize and sponsor, confetti, ninos; then back to play (Line) or into the Interval (Bingo) |
| Interval | Next round's name, its prizes and sponsors in rotation, a rough countdown, "Quina 4 de 12", sponsor thanks, last round's winning card numbers, the QR |
| After the Game | Thanks, sponsor credits, every round's winning card numbers |
| Technical pause | "Tornem de seguida" |

- **Heat:**
  - It follows the Phase on its own smoothed clock and never jumps at a landing.
  - It cools down visibly after a confirmed Line.
  - It never reveals how many songs are left.
  - The final design will be iterated with the user.

## Console

- **Basics:**
  - One shared tablet (model unknown: iPad or Android), in landscape. The same page works in portrait on an admin's phone.
  - Several consoles can be open at once and stay in sync. Each is labelled ("Tauleta", "Mòbil admin") so everyone sees who did what.
  - Next, Hold and Claim stay in the same place in both orientations.
  - A simpler design than the player-facing screens is fine, but the layout must be very well thought out.
- **Confirming risky actions** (like Back): a long press with a progress animation. A normal tap shows a brief "mantén premut per confirmar" popover.
- **Always visible:**
  - the round name, Phase and the real Heat;
  - the clock, the expected end of the round, and the Drift;
  - connection status (cloud or LAN, feed to phones, Wii remote);
  - the device label.
- **During a round:**
  - **Now playing,** with a countdown ring to the next auto-advance.
  - **Next song** (private), with a countdown to its landing, so a presenter can say it on the hit.
  - **Big buttons:** Next, Hold, Suspense (hold to build, let go to land), Back (long press), and Claim (opens a number pad).
  - **Pace:** presets, −/+, lock. Auto-advance is off by default in the final phase.
  - **Possible winners** (private and **hidden by default**, revealed with a button, so the presenters stay curious too). They are flagged "not registered as sold" where it applies.
  - **Cheat sheet:** the round's prize lines with sponsors, special-round rules, a reminder of the claim rules.
  - **Sound pad:** effects and fanfares.
- **During a Hold:** the reason, a Hold music switch, and Resume.
- **During a Claim and Check:**
  - the queue of claimed cards;
  - progress through the Check, song by song;
  - the result with any warnings;
  - Confirm or Reject;
  - a Celebration music override;
  - a winner-name field and a notes box.
- **During the Interval:**
  - the next round and its prizes to announce;
  - a guide countdown;
  - Interval music skip and volume;
  - **Start round**, which triggers the Shuffle.
- **Rarely used, tucked away:** start and end the night, the Schedule, Panic, and Wii pairing.

## Admin

A simpler design is fine.
- **Setup:**
  - Cards in play, as ranges;
  - the rounds plan (name, normal or special, Line and Quina prizes);
  - Prizes and Sponsors, with **bulk JSON import and export** so an AI agent can load the organizers' Google Sheet;
  - the Schedule.
- **Logos:** sponsors deliver JPEGs with white backgrounds or big padding, so they get a clean-up step (trim, remove the background, normalise size, WebP). ArtCraft is available as a tool.
- **On the night:**
  - start and end the Game;
  - Plan B manual resume;
  - the winners list with names and notes;
  - **cards opened on phones** (anonymous card numbers).
- **Player-app settings:** the default for interface sounds, and a message banner to all phones.
- **Tools:** a link to the hook audition page, a full JSON export, and the Shuffle seeds.
- **Privacy:** winners' names stay in the cloud data only, never in git or on the projector.

## Player app

- **Opening it:**
  - Players scan their card's QR. The new year-tagged link shape is, for example, `quina.barrakudesbegur.org/26/123`.
  - It works straight in Safari or Chrome. Installing it as an app is optional. No account.
  - Scanning more cards adds them, and a big "Afegir cartró" number pad does the same.
  - Each card has its own colour and an optional name ("Àvia"). Removing one needs a confirmation.
  - Cards are saved only on the phone, tagged with the Game.
- **Last year's leftovers:**
  - On first open, clear last year's service worker, caches and storage. Last year's `?c=` links show "Aquest cartró és de l'any passat".
  - Data from another Game is wiped automatically.
  - An "Esborrar dades" button sits in the help screen.
- **Tabs:**
  - **Ara:** the current song with its cover, a simple reel synced to the projector's spin (generic until the landing; never the right card in advance), and the Heat.
  - **Cartrons:** the player's cards as grids with marks.
  - **Historial:** with covers.
  - **Premis.**
  - **Programa:** the schedule, progress and countdown.
- **Marking:**
  - The latest song is marked for Lines but never announced. If it would complete a whole card it stays unmarked (a quiet grace feature).
  - The copy may say "the last song isn't marked, pay attention", but never explains that it gets marked later.
  - A completed Line shows just plain marks: no glow, no row highlight.
  - When the round ends, everything is revealed.
- **The "1 song away" banner:**
  - Unmissable but beautiful.
  - It names the card and the missing song (for a Bingo, counting only marked songs), with no "playing now!" effect.
  - The Line banner stays up until someone's Line is confirmed.
  - The phone never says "you won".
- **States:** before the Game (add cards, how to play, schedule, prizes), round start (prizes, a simple Shuffle), in play, Check ("Comprovant el cartó 123…" and the result), Celebration (confetti and the winning card numbers), Interval (next prizes, countdown), after the Game (thanks and a summary), and "Tornem de seguida".
- **Behaviour:**
  - **Sound:** interface sounds only, **on by default**. Admins can change the default for everyone remotely, but a player's own choice wins.
  - **Wake lock** to keep the screen on.
  - **Vibration** only as a bonus: iPhone Safari has none, so nothing may rely on it.
  - **Reconnection:** reconnects with backoff and catches up from a snapshot.
  - **Small footprint:** covers as small WebP, about 1–2 MB on first load.
- **Usable by a grandmother:**
  - big tap targets, high contrast, large text, one thumb;
  - anything at most 2 taps away;
  - plain Catalan.
- **Style:** a mobile game in the Clash Royale genre plus Christmas. No Supercell assets, fonts or copied UI.

## Style and assets

- **Who gets the full style:** the projector and player app get the full juicy game look. The console and Admin can be simpler.
- **One design system everywhere.** Barrakudes colours and the ninos are a starting point; the user may drop them after seeing the mockups.
- **Ninos:**
  - in `brand/ninos/`: 49 figures, 9 objects, examples, `STYLE.md`;
  - adapt them (flat colour, sticker border, soft shadow) or drop them;
  - never use `nino-sexe.svg`, and use the drinking ones with care.
- **Audio** (all gitignored; sources in `client/public/audios/README.md`):
  - `hold/` holds the failure and error loops;
  - `celebration/` holds the victory track;
  - `stingers/` holds Final Lap, Mission Clear, Mission Failure, the Low Place fanfare, and the item box for the Shuffle;
  - `interval/` holds the Interval playlist.
  - khinsider is the go-to source for more game sounds.
  - The Final Lap fanfare plays when the Phase first reaches late, once per climb.

## This year's data

- The song pool and cards aren't decided yet. The final playlist will be `0EOwwaDVItDHMRkYoO1m8y`, still being curated.
- Until then, last year's 77 songs are test material only.
- Cards and the full song preparation come once the playlist is final.
