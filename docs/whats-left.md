# What's left (verified 28 Nov 2026)

The one list of what's missing for the night, after the user's realistic test of 28 Nov. Sessions work from this list, in priority order. It replaces [status.md](status.md)'s "done" claims, which said what was deployed, not what works.

## How it was checked

- **The sessions' own lists** (28 Nov evening): Frontend's packages/ui/HANDOFF.md with packages/ui/audit-28nov/, Sound engine's apps/show/docs/HANDOFF.md, Backend's apps/cloud/docs/HANDOFF.md, each «What's left (28 Nov)».
- **Then checked again by the orchestrator's agents, without seeing those lists:** one frozen build of main 943b651f, each agent on its own relay and port, with the real 2026 plan (12 rounds, 58 sponsors) in a scratch link folder.
  - the projector: every scene on the real `/show/`, at 16:9 and 4:3, against the pre-redraw and the current boards;
  - the console: a whole night clicked as a presenter, on a 1194×834 tablet and a 390 px phone;
  - the phone: a whole night on the production path (relay → link → a local Worker), 390 px;
  - the setup: docs/night-runbook.md followed literally, the night from the doors to the end, the Plan B rows, Admin;
  - the cards: generated in both layouts, QRs decoded and added on a phone;
  - the playlists: fetched from Spotify and compared (D296: unchanged).
- **Evidence** (git-ignored, on the laptop): temp/verify-28nov/ (projector.md, console.md, phone.md, setup.md, cards.md, playlists.md and their screenshots).
- **Sources in the list:** **V** = seen in the orchestrator's run; **F**, **S**, **B** = the Frontend, Sound engine, Backend lists (F's audits also ran the app; S reproduced in the engine harness). Where V contradicts a session, it says so.
- **Nobody could check:** any sound (the runs were silent), the Wii remote, a real tablet on a real hotspot, real iPhones on iOS 18, the venue's 5G, 400 phones at once.

## Priorities against the dates

- **P0, before the cards (4–5 Dec):** what the cards need, and what breaks the night's start or its fairness. Small fixes, and every rehearsal needs them.
- **P1, before the tech rehearsal** (no date yet; D82: "when everything feels ready"): what the user saw go wrong, the agreed designs, the sound by ear, the prep only the user can do.
- **P2, before the night (27 Dec):** polish.

After the tech rehearsal comes the code freeze (timeline.md), so P1 must be done before it.

## 1. The night's start and flow

| # | P | What's wrong | Source | Owner |
|---|---|---|---|---|
| 1.1 | P0 | **The runbook's show page `?autostart=1` lands round 1's first song at the «Start show» click:** no doors, no intro, no public Shuffle; round 1 plays the Queue drawn secretly at boot. The user's "jumped straight into a round". `next` and `newRound` are also accepted before the night. Fix: no autostart on the night; the engine refuses play commands before the night starts; a round's Queue is drawn at its Shuffle (main.ts:1237, show.ts:864-866, scenes.ts:65,73, night-runbook.md:14, chrome-profiles.ts:37) | V (all), F, S, B | Sound engine; Backend for the runbook and the command |
| 1.2 | P0 | **The engine counts 5 rounds; the plan has 12** (config.ts:194): the console's «Quina 6 de 5» (no total at all, D305), «Era l'última quina» from round 5, a dead «Quines en total» stepper; after the last round the projector says «SEGÜENT: QUINA 13 DE 12» and offers round 13 | V, F, S | Sound engine; Frontend's panels |
| 1.3 | P0 | **Starting the night is hidden in the menu** (☰ → «Començar la nit»); the doors' big button is «Llançament», the throw song. The user couldn't find it | V, F, B | Frontend (D304: the doors' big button, a tap only) |
| 1.4 | P1 | **The doors are silent:** no doors music set; `before`, a resumed Game and a reloaded show page are silent until Next. Against "the music never stops" (show-and-music.md) | V, S | Sound engine; the music, U97 |
| 1.5 | P1 | **The night's opening isn't modelled:** the doors and card selling, a welcome moment (today «Començar la nit» *is* round 1's intro, so a welcome runs over its music), the intro music's span (U99), the presenters' entrance audio, D291's Enrere on the first song | S, the user | Orchestrator with the user, then Sound engine and Frontend |
| 1.6 | P0 | **A show-page reload lands a song by itself** at the Start click; reloaded during a Check, the Check restarts at 0 reveals | V | Sound engine |
| 1.7 | P1 | **A stale second show page** gets every command, the console flips to its old Game, and the preflight passes it | V, B, S | Sound engine (one show page); Backend (preflight) |

## 2. The console

| # | P | What's wrong | Source | Owner |
|---|---|---|---|---|
| 2.1 | P0 | **The claim pad hides Parlem, Aguanta and Següent, and songs keep landing while numbers are typed** (fairness; game-rules: the presenters stop new songs on a claim) | V, F | Frontend |
| 2.2 | P0 | **False winners after a discarded Bingo:** the button read «CELEBREM! el #76 i el #261 han guanyat», #76 being the Line's winner; the projector showed an empty screen (logic/check.ts:230-232) | V (new) | Frontend |
| 2.3 | P0 | **Parlem shows as on (striped) at every intro, Interval and Celebration**, and a tap there ends a Line's Celebration straight into the next song (D117: Parlem only ducks) | V, F, S | Frontend and Sound engine |
| 2.4 | P0 | **Engine presenter actions reproduced wrong by Sound engine:** Back after a Check's cue leaves the round stuck; Pausa from Aguanta blocks Next; the two-level lock refuses every other console's hold; `newRound` kills the intro track; Aguanta in a Spin's last 0.15 s becomes Parlem; Parlem off over Hold music lands a song; `newRound` mid-play throws the round away. V found the plain cases of Parlem, Pausa and Aguanta right | S | Sound engine |
| 2.5 | P1 | «Següent» names the pre-drawn Queue's song at the doors, intros and breaks, then another after the Shuffle | V, F | Sound engine (1.1) and Frontend |
| 2.6 | P1 | A console that joins late or reloads has no song history («Aquesta consola no ha vist…») | V (new) | Frontend, Sound engine |
| 2.7 | P1 | «Ara sona» wrong (D196): «No sona cap cançó» under the Celebration's and victory music, two cards stacked in Pausa, none at the intro; the doors show Enrere and Comprovar greyed (D195) | V, F | Frontend |
| 2.8 | P1 | Auto-advance stops at every final Phase while «Auto» stays green | F | Sound engine, Frontend |
| 2.9 | P1 | Sizes: at 1194×834 the doors, Celebration and Pausa pages overflow (header and cluster scroll away); on a 390 px phone the cluster takes a third of the screen and the Check's buttons fall off it | V, F | Frontend |
| 2.10 | P1 | Not built: the remote's drawing (Comandament, D93), the voices and drum roll (Veus-Redoble, D198), Horari in the menu, D291 | V, F | Frontend, Sound engine |
| 2.11 | P2 | The menu's «Xuleta del pla B» can't close; generic «ara no es pot fer»; the header keeps the finished round; tablet-portrait header clipping; «Llançament» after every round; Pace messages before the night | V, F | Frontend |
| 2.12 | P1 | **The Heat meter (the thermometer) didn't work** in the user's realistic test: to reproduce first | the user | Frontend, Sound engine |

## 3. The projector

| # | P | What's wrong | Source | Owner |
|---|---|---|---|---|
| 3.1 | P0 | **The public Shuffle shows all 135 covers of the repertoire, not the round's 70:** half the covers flying into the drum can never come up (fairness: event.md › Fairness) | V, F | Sound engine and Frontend |
| 3.2 | P1 | **In play, and the Desgraciat's play: not the agreed look (D294, `Abans-28nov-Projector-Joc`).** Live: three huge flat covers, a thin window, a small «QUINA 1» over the left cover, a plain title and lilac artist, the current song plus two earlier. Agreed: about 9 covers on a curved drum with a floor shadow, a thick glowing gold window and ink pointer, the gold «QUINA N» plate, an ink-stroked title with a gold artist, the oval-lamp garland, the starfield, the three earlier songs | V, F | Frontend |
| 3.3 | P1 | **The other scenes: built to the board the user picks** (before the night D297, the Check D303, the Line D302, the finale D301, the Break D308, «QUINA POTRA!» D310; every sponsor a sticker, D309), with the agreed look's starfield and ink-stroked titles | V, F | Frontend, after the answers |
| 3.4 | P1 | Wrong whatever the board: the Check's «CARTRÓ #N» grey from the first reveal (orange until a fail on both boards); the type badge's ✓ an empty disc from the second Check; the failed ✗ half size and low; «Cartró correcte!» never shown for the last card (the engine goes straight to the Celebration); a round total «de 12» shown (D305: none on any screen); the intro's drum shows the last round's song; an empty lower half between the Shuffle and the first Spin; a «?» and a blank cover in the grid; no rough countdown before the night | V, F | Frontend; Sound engine for «Cartró correcte!» |
| 3.6 | P1 | **No prizes on the projector for now (D311):** take them out of a round's intro (the Especial's and the Desgraciat's too), the Quina's Celebration and «QUINA POTRA!»; D311 lists every place, as the starting point for later | the user | Frontend |
| 3.7 | P1 | The projector's "playing" mark per reveal still lasts 2.5 s, while the revealed song now plays on (D314) | f5 | Frontend |
| 3.5 | P2 | At 16:9 the sponsor strips and end credits stay in a centred 4:3 box; the end roll has small logos, text-only sponsors and 10–15 s of empty screen between loops (Projector-Final draws a big static grid); 9 finalists' plates touch; the Shuffle's and the finale's sound cues aren't played | V, F | Frontend, Sound engine |
| — | — | Not a go to build: the sponsor sticker collage (D287), fireworks C (D285) | F | — |

## 4. The phone

What works, seen live on the production path: the QR link, the pad, the scan, the empty state (D290), blurred Spins, the your-song gold, marking, your own Celebrations, the Desgraciat's falls, Pausa, Premis (D244), reloads with no welcome flash, «Sons» across a reload, and privacy across 286 feed messages.

| # | P | What's wrong | Source | Owner |
|---|---|---|---|---|
| 4.1 | P1 | **During an intro and the Descans the phone shows the last round's cards as playing and the coming round's as «No juguen…»:** the moment people turn their paper cards over (D102) | V, F | Frontend |
| 4.2 | P1 | **A feed that goes quiet without closing (a half-open 5G socket) leaves the phone frozen on «Connectat»:** no heartbeat from the cloud | V, F | Backend and Frontend |
| 4.3 | P1 | **No Celebration screen on the phones (D315):** the Check ribbon shows the result («Comprovant #332»; red «… incorrecta!» until the next Spin; green «Línia correcta!» until the next Spin; green «Quina correcta!» until the Break); today's Celebration screens and their prize panel go | the user | Frontend |
| 4.5 | P1 | Horari: «Quina 1 · ARA» at the show page's boot, before the night; the plan's times kept while «Fi» uses the engine's end (so «Fi» comes before the Especial); «Primer descans» (D192); «ARA» on the Especial after the end | V, F | Frontend |
| 4.6 | P1 | Before the night the home shows no rounds and no card types; round 1's prizes only in Premis. The agreed countdown ring and the card-types panel went in the redraw, with no decision | V, F | Frontend |
| 4.7 | P1 | The pad's leave question says «Continuar / Descartar», rejected in D188 («Descarta els canvis / Segueix editant») | V, F | Frontend |
| 4.8 | P1 | The «Toca per veure'l!» hint never shows at 390×844 with 4 cards; it flips place 549 times a second (battery) | V | Frontend |
| 4.9 | P1 | The iPhone install steps describe iOS 26 Safari, not the Safari 18 floor (D293) (read, not seen on a device) | V | Frontend |
| 4.10 | P1 | The relay's own feed has no plan: laptop-only rehearsals show «0 premis»; phones have no LAN fallback | F, B | Backend |
| 4.12 | P1 | **The phone during a Break isn't designed** (the user, 28 Nov); a hand-drawn board existed before the redraw (Abans-28nov-Mobil-MitjaPart, a countdown ring) and the build shows text. Boards side by side, with D315's ribbon states | the user | Frontend |
| 4.13 | P1 | Every sponsor as a sticker on the phones too (D309): the Premis drawer, the end of the night | the user | Frontend, with the logos session |
| 4.11 | P2 | The Check ribbon truncates at 390 and 320 px; the end pill wraps; «Encara no ha sonat cap cançó» twice; at 320×640 the last tiles sit behind the corner buttons; a one-card phone never gets «LÍNIA!»/«QUINA!» (D289); the last-year drawer is a dead end; the floating «+ Cartró» covers the tab switch; the link opens scrolled; agreed phone designs dropped in the redraw (the Shuffle's «Ara comença la», «El teu premi d'aquesta nit», the three-level QR stack) | V, F | Frontend |

## 5. Transitions and music (the user's ears; no agent can check these)

**Waiting (D298):** "i will take care of transitions latter, when the app works better". Nothing in this section starts until the night's start, the console and the projector work; then the listening reel and the user's session.

| # | P | What's wrong | Source | Owner |
|---|---|---|---|---|
| 5.1 | P1 | **Nothing has been tuned by ear on the 2026 songs** (U13 never happened on this sound). First a listening reel (the night's transitions rendered and labelled by recipe and Phase), then the user's listening session, then the tuning | S | Sound engine, then the user |
| 5.2 | P1 | Every late or final Suspense release plays the orchestra hit, with no cooldown, and a cymbal swell, bypassing the Phase's gating; the release waits up to about 5 bars (10–14 s) | S | Sound engine |
| 5.3 | P1 | Every effect except the boom, orchestra hit, horn and comedy sounds is a synth (risers, rolls, impacts, claps): a likely cause of a cheap sound | S | Sound engine |
| 5.4 | P1 | Signatures: 111 of 135 files empty, so 0.8% of transitions against about 5%; re-cut with `--force`, then the user vets them | S | Sound engine, the user |
| 5.5 | P1 | Hold music has 3 tracks, so a long Parlem plays a chiptune placeholder (U20, U205); Back plays the error music; one victory track | S | Sound engine, the user |
| 5.6 | P1 | All 23 voices are placeholders; the welcome's `start` cue never plays | S | Sound engine, the user |
| 5.7 | P1 | Phrase landings count bars from provisional hooks; FADE (the plain fade the user rejected) is still the last fallback; "call and response" is only a weighting; one hook per song | S | Sound engine |
| 5.8 | P1 | The Blend renders live, one pair at a time; never checked on the show laptop under load; the relay crashes if tools/prep/.venv is missing | S, F | Sound engine |

**Built since (28 Nov, quina-musical-f5):** no silence in a Check, Aguanta always loops, songs hand over before their silent tails (D314). Not heard by ear yet. The ✗ case: the song plays on "broken" until the cue (D319), being built by f5; Parlem's ducked song loops, no Hold music (D318).

## 6. Setup, startup and Plan B

| # | P | What's wrong | Source | Owner |
|---|---|---|---|---|
| 6.1 | P0 | **The preflight, `setup:laptop`, the README's relay command and `media pull` default to last year's repertoire:** following the runbook, the preflight FAILs and says to restart on last year's songs; a spare laptop pulls the wrong media | V, F, B | Backend |
| 6.2 | P0 | **The runbook:** never says how to start the night or when to enter the sold cards; its "press Next" after a relaunch is wrong (the click lands a song); its "laptop lost its Game" row is a dead end (autostart disables «Recuperar al portàtil», and the resume is refused until the sold cards are entered again, with a half-English message); Admin wants only the code, not "the code and the song" | V | Backend; Frontend for Admin's message |
| 6.3 | P0 | The preflight says "no Game on this laptop yet" with round 1 playing, and passes a stale second show page | V, B | Backend |
| 6.4 | P1 | **A cold start is 4 terminals, about 10 commands, about 770 characters typed on the laptop and 53 on the tablet, about 11 clicks,** and a «START SHOW» click on the projector's own screen that no console can do. D282 (a Mac app, one start button) is on hold until the user resumes it | V, F, B | Backend, Frontend (D282) |
| 6.4b | P0 | **The projector's «Start show» click** (D299): nothing on the projector starts the event; the click goes unless the audio can't start without it | V, the user | The user's setup session |
| 6.4c | P1 | **The projector screen from a website** (D300), for a second projector on another computer and network | the user | The user's setup session |
| 6.5 | P1 | Port 5174 is hard-coded in about 15 places; the first tablet pairing is always typed (the console's QR shows only on a console already on a LAN address) | V, B | Backend, Frontend |
| 6.6 | P1 | Never done for real: a spare-laptop takeover, the laptop-only rehearsal, Admin's manual resume by a person, `setup:laptop` end to end since D248 | B | Backend, with the user at a rehearsal |

## 7. Admin and the cheat sheet

| # | P | What's wrong | Source | Owner |
|---|---|---|---|---|
| 7.1 | P0 | **Opening Admin can overwrite the cloud's plan with a blank one** when neither the plan nor the socket push arrive within 0.6 s; no save history (F reproduced it; V, with only the plan request delayed, lost nothing) | F | Frontend |
| 7.2 | P1 | The cheat sheet lacks the presenters' running order, the Desgraciat's and the special round's rules and the "+6 dB" note; it lists the debug keys D and H, calls Space «Espera», and its keys disagree with the console's; a presenter couldn't run the night from it | V, F | Frontend |
| 7.3 | P1 | Preparació at this plan's size is about 58,000 px tall; three places edit the plan with no merge (the git file, the cloud's Admin, the laptop's Admin) | F | Frontend, Backend |
| 7.4 | P1 | The cloud's plan holds the example prizes, not the organizers' (U18); two sponsors have no logo (U16); no organizer has used Admin's login yet | B | The user, the organizers |
| 7.5 | P2 | Admin's message limit is 140 characters, the README and the cloud say 200; «Desat» before anything was saved | V | Frontend |

## 8. The cards (4–5 Dec)

The generator works today: the final cards in both layouts from repertoire 2026, every decoded QR adds the right card with its printed songs, no repeated card or line, 50 card tests pass.

| # | P | What's left | Source | Owner |
|---|---|---|---|---|
| 8.1 | P0 | D295's A4 card (`3x1-h-bw`) as the generator's default; the A3 layout kept for the test sheets | the user | Frontend |
| 8.2 | P0 | data/repertoires/2026.json's `cardsJson` points at the «TEMPORARY not for print» folder and calls pool 2 provisional; apps/cards' README says to commit dist/ (last year's) and counts 136 songs; the card-mockup README and handoff are stale | V | Sound engine (the repertoire), Frontend (apps/cards) |
| 8.3 | P0 | The four quality flags: #90, #117 (low bitrate), #18, #83 (remix titles). The user is listening (U238, (b), 28 Nov). A swap needs a download, prep, an R2 push and new cards before printing | V, S | The user |
| 8.4 | P0 | The A3 test sheets repeat the last numbers of each run; those A4 cards stay off sale with the user (D306) | the user | Frontend (generate both), the user |
| 8.5 | P0 | The proof sheet (D267), before 4 Dec: #100's nearly white cover, a QR scanned from paper, the duplex alignment on the shop's machine | V | The user, Frontend |
| 8.6 | P2 | The QR could be a size bigger at the same 16 mm (upper-case URL, version 2), once checked on real phones; a few artists keep Spotify's capitals | V | Frontend |

## 9. Songs and prep, before the tech rehearsal

| # | P | What's left | Source | Owner |
|---|---|---|---|---|
| 9.1 | P1 | **0 approved hooks** (U14): about 4.5 h of the user's time, less with U56's quick review; then stems re-cut where a hook moves, and an R2 push | S | The user, Sound engine, Backend |
| 9.2 | P1 | Real voices and real Hold and victory tracks (U20); the Pausa, break and Hold music into the repertoire (D268's part C, designed with Backend) | S | Sound engine, Backend, the user |

## 10. The cloud and the night's scale

| # | P | What's left | Source | Owner |
|---|---|---|---|---|
| 10.1 | P1 | **Never load-tested against the deployed Worker.** The only test (24 Nov) was 400 phones on `wrangler dev`, 3 rounds, before the 12-round plan, the logos (about 22,000 Worker requests for 400 phones), the beat and the drum seeds | B | Backend |
| 10.2 | P1 | «Daily usage» counts only the GameRoom's requests, not the Worker's | B | Backend |
| 10.3 | P1 | Real devices (U19): the iOS 18 fixes only seen on a simulator; the tablet never on a real hotspot; the cloud console never with a login on the night's network | B, F | The user, with Backend |
| 10.4 | P2 | R2's payment method (U64); the QR domain's Access destinations | B | The user, Backend |

## 11. Tests, and how "done" is decided from now on

- **Why everything was green:** the 1042 UI tests never mount a component or open a browser. The e2e plays last year's 77 songs over 2 rounds, sends the commands itself instead of tapping the console, runs with the audio off, compares no screenshot, and never runs the runbook. Green meant "the plumbing agrees".
- **Needed (P1):** an end-to-end night on the 2026 repertoire and the 12-round plan, started with the runbook's commands and driven by tapping the console (Backend); screenshots of every projector scene and console page compared with the agreed boards, at 4:3 and 16:9 (Frontend); a phone following it on the production path.
- **Done means seen:** a session reports an item done with screenshots of the running app, never a generated board. The orchestrator's agent then checks the pushed build against the agreed board or requirement, as on 28 Nov. Only then does status.md say done. Agreed boards are never regenerated "as built"; as-built snapshots go beside them.

## 12. Later, by the user's choice

- **The transitions** (D298): after the night's start, the console and the projector work.
- **How to show prizes** (D311): on the projector and wherever else it makes sense; D311 lists where they were. The orchestrator suggests before the tech rehearsal, since a round's intro is where the room learns what it plays for.

## The plan

Sessions keep their lanes (team.md) and their limits on parallel agents (Frontend: at most two). Each works through its items in the order below.

**Phase A, now to 3 Dec: P0.**
- **Sound engine:** 1.1 (refuse play commands before the night, the Queue drawn at its Shuffle, no `next` on unlock), 1.2 (the plan's round count; nothing after the last round but the end), 1.6, 2.3 and 2.4 (the engine's presenter actions), 3.1 (the Shuffle shows the round's 70, with Frontend), 8.2 (the repertoire's `cardsJson`). No transition work (D298).
- **Frontend (at most two agents):** 8.1 and 8.2 (the A4 card by default, the A3 kept; apps/cards' README) and the proof sheet before 4 Dec; 7.1 (Admin's blank plan); 2.1, 2.2, 2.3 (the console side); D304 (the doors' «Començar la nit»); D305 (no round totals); 2.12 (reproduce the Heat meter). Then the boards side by side for the user: D302 (the drum behind the Line's Celebration), D303 (the squashed nino), D308 (the Break with the timeline), D315 and D316 (the phone's ribbon states); then the in-play projector (3.2, D294) and 3.6 (no prizes on the projector, D311).
- **Backend:** 6.1 (the night's repertoire as the default for the preflight, setup, the README and `media pull`), 6.3 (the preflight), the launch command without `autostart` (chrome-profiles.ts; the runbook's lines go to the orchestrator), 4.10 (the relay's plan for phones); then the end-to-end night (§11).
- **The setup session (quina-musical-79), with the user:** D282 (the Mac app), D299 and D313 (the audio unlock), D300 (the projector from a website), the backup remote, Rubber Band in WebAssembly, each device's place.
- **The Check's song session (quina-musical-f5), with the user:** the ✗ case (D314) and U205.
- **The orchestrator:** checks every pushed item with a verify agent on a frozen build, as on 28 Nov, before it counts as done; logs the decisions the sessions send.

**Phase B, 4–5 Dec: the cards.** Frontend generates them in D295's layout; the user checks the proof and prints.

**Phase C, from 6 Dec to the tech rehearsal: P1.**
- **Frontend:** the projector's scenes (3.2–3.4, 3.7, as the user picked: D297, D301–D303, D308–D311), every sponsor a sticker (D309, D312, D317), the phone's Break (4.12), the console's P1 (2.5–2.10), the phone's P1 (4.1–4.9), the cheat sheet (7.2), the screenshot comparisons (11).
- **Sound engine:** once the app works better (D298), the user's listening session and the tuning (5.1–5.3, 5.7); the doors music and the night's opening (1.4, 1.5), Hold music and voices (5.5, 5.6), the quick hook review (U56) before the user's approval pass (9.1).
- **Backend:** the feed's heartbeat (4.2), the relay's plan for phones (4.10), the load test and the usage counter (10.1, 10.2), the Plan B drills (6.6), D282 when the user resumes it.

**Phase D:** the tech rehearsal when the user says; then the code freeze; P2 only if there's time.

**What needs the user, by phase:**
- A: U238's conclusion (the user is listening) (answered: D297, D301–D306, D308–D311).
- B: the proof sheet and the print.
- C: the listening session (a couple of hours), the hook approval (about 4.5 h, U14), vetting the Signatures, the voices and Hold music (U20), D282's conversation, the real-device checks (U19), the organizers' plan in Admin (U18).
