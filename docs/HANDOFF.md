# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D330**, **U246**) and [timeline.md](timeline.md). This file holds only what's in flight.

## How the orchestrator works here

- **Commit from the worktree** (`.claude/worktrees/orchestrator-timeline`), docs only. `git fetch` and `git rebase origin/main`, then `git push origin <sha>:main`. The harness refuses compound git commands, so run each one on its own.
- **The user answers in chat or on the canvas.** Every decision gets a D-entry, the requirement changes, and the U moves to "Answered" the same day. Sessions report their user decisions to the orchestrator, and send docs/ changes to it rather than editing docs/ themselves.
- **How to work with the user** (all in memory too):
  - ask, never assume; use the glossary's words;
  - ask only real choices, one set of options per numbered question, in plain format (the grill format only in the card design session, until the user answers whether it's for everyone);
  - look for a design that removes a trade-off before offering it;
  - record the reason for each mechanic, and push back with it;
  - relayed user decisions count as theirs (D156); event.md facts go in without asking;
  - clock times for the user are in 12-hour format; never invent dates.
- **Team rules from 27 Nov (docs/team.md):**
  - sessions delegate the work to subagents (D240), within the user's limits on parallel agents;
  - canvas comments only when the user says so, all of them in creation order;
  - boards and design docs in English;
  - every change lands in code, mockups and the design system together (D236);
  - the UI code rules (D215);
  - web UI work loads modern-web-guidance first.

## Now (28 Nov, late night): Phase A under way

- **Pushed:** the cards (d97d1f3e, 1156ba15: the A4 default, the A3 test sheets, the proof in temp/cards-proof-2026/, verified); the setup (7dc3ec0a: the night's repertoire by default, the preflight, no autostart, the runbook); Admin's blank-plan fix and plan history (52341dd7, verified; **deployed** from e2250cd6 as version 8e301c84, which also carries f5's D318/D319 journal change); the console's false winners (1b5b803a).
- **Being built:** the engine's night start (1.1's engine side, D304, 2.5, 3.1, 1.6, newRound, the Plan B resume) and the round count, no totals, Parlem's display, 2.4, «Cartró correcte!» (1.2, D305, 2.3). Verifying: the setup, Admin.
- **With the user:** the boards page for D302, D303, D308, D310, D315/D316 and the console's no-cards warning: https://claude.ai/code/artifact/392d0bf3-eee6-42d7-b647-4b66b9840fe8; U244 (the Phase without cards), U245 (the claim pad), U238.
- **Other sessions:** quina-musical-79 (setup: D324–D326 logged; D300's design), quina-musical-f5 (pushed D318/D319 as cf1c13e9; the 14 Hold-music-outside-Pausa paths are with the user), quina-musical-e0 (logos: D320–D323 logged; U16).

## Now (28 Nov, night): the verified list, every question answered, ready to build

**[whats-left.md](whats-left.md) is the one list of what's missing,** by area and priority (P0 before the cards on 4–5 Dec, P1 before the tech rehearsal, P2 before the night), with the plan (phases A–D). It comes from the sessions' «What's left» lists checked again by the orchestrator's agents, without seeing them, on a frozen build of 943b651f: the projector, the console, the phone (on the production path), the setup and the night's flow, the cards, the playlists. Evidence: temp/verify-28nov/ (git-ignored). **How to check a build (reuse it for every "done"):** in apps/show, `npx vite build --outDir <scratch>/dist`; copy data/link's cloud-plan.json, media, media-index.json and the manifests into a scratch link folder per agent; start each agent's relay with `QUINA_LINK_DIR=<copy> node relay/server.ts --dist --dist-dir <scratch>/dist --port <own port> --repertoire 2026 [--test]`; Playwright from the repo's node_modules, `channel: 'chrome'`, headless, `--autoplay-policy=no-user-gesture-required --disable-audio-output`. Never `npm run link` against quina-dev, never the real Chrome profiles or data/.

- **Decided on 28 Nov (all logged, pushed):** D295–D319. The cards are the A4 «Apaïsat sense portades», A3 kept for one or two test sheets (D295, D306); the playlists final and unchanged (D296); the projector's agreed boards per scene (D294, D297, D301–D303, D308, D310), with no prizes on the projector for now and where they were (D311), every sponsor a sticker (D309, D312, D317); the transitions wait until the app works better (D298); nothing on the projector starts the event, the audio unlock only as a completely different button if needed (D299, D313); the projector screen from a website too (D300); the doors' «Començar la nit» (D304); no round totals (D305); businesses' names fine in git (D307); no Celebration screen on phones, the Check's ribbon shows the result, «Tenim desgraciat!» (D315, D316); the Check's song plays on, Parlem loops, the ✗ plays on "broken" (D314, D318, D319).
- **Open with the user:** U238 (four quality-flagged songs; the user is listening, keep it open for the conclusion). The side-by-side page (all picked): https://claude.ai/code/artifact/91dfbce3-8e64-4d2a-b289-e87f4dc50506. Design questions go to the user as images side by side.
- **Boards to show the user before building:** D302 (the drum behind the Line's Celebration), D303 (the squashed nino with its new head drawing), D308 (the Break with the night's timeline), D315/D316 (the phone's ribbon states).
- **Other sessions still open (from ~/.claude/sessions/*.json, which maps names to session ids):**
  - **quina-musical-79, the setup session** (the user plans there): D282 (the Mac app), D299/D313 (the audio unlock), D300 (the web projector), the backup remote, Rubber Band in WebAssembly (T1, waiting on timings), each device's place. It numbers its questions T1, T2… and sends decisions as lines.
  - **quina-musical-f5, the Check's song session:** built D314 (3a83ff0, 20b6a6e, f2b6dda); building D318 (removes «Música d'espera» from the protocol) and D319; will bring the user the remaining cases of Hold music outside Pausa. It changes the engine: coordinate engine work with it.
  - **quina-musical-e0, the sponsor logos session:** sticker logos for D309 (U16).
- **The orchestrator's worktree:** `.claude/worktrees/orchestrator` (docs only; `git fetch`, `git rebase origin/main`, `git push origin <sha>:main`).
- **On 28 Nov night the user chose to start the build from a new session;** its first message says how to work.

## Read this first (28 Nov, after the user's realistic test)

**The realistic test went badly.** The user, verbatim: "I did a realisic test with the appropiate setup and it went HORIBLY WRONG. yes, the songs played and the player app mostly works. but the console logic is very bad, the transitions need a lot of improvement, the setup and startup is confusing, the show page (projected screen) has absolutely nothing to do with the design from the mockups. I feel like you lost notion of the project of what is really left, because i thought that the frontend implemented all of it and aparently he didnt."

**What went wrong with the orchestration:** this orchestrator tracked decisions, deploys and green test runs, and relayed sessions' reports of "built" without checking the running screens against the agreed boards and the requirements. Green tests and deploys aren't the same as "matches the design" or "works for the presenters". So `status.md`, `timeline.md`'s "done" rows and the "Live" list below say what was deployed, not what's right. Treat them as unverified.

**Why the canvas didn't show the drift (Frontend, 28 Nov):** most Projector and Console boards were drawn by Python generators, not snapped from the running app; only the phone boards were snapped from the real player. So the boards show the design, not the build, for the projector and the console. Any check of "built vs designed" must screenshot the running app, never trust a board as evidence of the build.

**Cross-team findings already reproduced (28 Nov; details in the sessions' «What's left»):**
1. **`?autostart=1` starts round 1 the moment «Start show» is clicked** (the runbook's step 5 command, `apps/cloud/laptop/chrome-profiles.ts`; the unlock sends `next`, apps/show engine/src/main.ts:1237): no intro, no prizes, no public Shuffle. Very likely the test's "jumped straight into a round". Owners: Backend (the command and runbook lines, sent to the orchestrator), Sound engine (the unlock).
2. **Following the runbook, the preflight FAILs and tells you to restart with last year's songs:** the relay runs `--repertoire 2026`, but `npm run preflight` and `setup:laptop` default to `default`, and the README's relay command has no `--repertoire`.
3. **Opening Admin can overwrite the cloud's plan with a blank one** (1 round, 0 sponsors) if the plan doesn't arrive within 0.6 s; no history of saves. The plan's source is data/editions/2026.plan.json, re-uploadable with Backend's `edition upload`. Until fixed, avoid opening Admin on a slow connection. Owner: Frontend.
4. **The engine counts 5 rounds whatever the plan says** (12 this year): «Quina 1 de 5» in Admin and the console, and a Celebration panel that calls round 5 the last. Owner: Sound engine.
5. **A cold start is 4 terminals, 2 Chrome commands of about 300 characters, and an English «START SHOW» click,** with no guidance from the relay's output. D282 (the Mac app) has no code.
6. **Sound engine:** the transitions were never tuned by ear; six presenter-action bugs reproduced in the engine; the 2026 repertoire has 0 approved hooks and 111 empty Signatures.

**All three lists are on main:** Backend 89a08058 (apps/cloud/docs/HANDOFF.md), Sound engine bca0a8fa (apps/show/docs/HANDOFF.md), Frontend 93de315a (packages/ui/HANDOFF.md, with the four audits in packages/ui/audit-28nov/: projector.md, console.md, phone.md, phone-reqs.md, admin.md, ds-notes.md; screenshots only locally in temp/audit-28nov/). **The projector's agreed look (D294):** the main play screen is the pre-redraw `Abans-28nov-Projector-Joc` (canvas v131, "THE AGREED LOOK"), and the Desgraciat's play screen follows it. For every other projector scene, ask the user which board is agreed (pre-redraw or redrawn) before building it: some later changes, like D283's thick Check marks, are only in the redrawn boards. Frontend's handoff: 943b651f. Also: an idle session «quina-musical-79» (started 28 Nov) isn't one of the three roles; the user was told to check it.

**What the new orchestrator does first (the user's plan):** find out what is truly missing, then delegate the building to the sessions.
- Each session was asked (28 Nov) to write «What's left (28 Nov, after the realistic test)» at the top of its handoff, checked against the code and the running app: Frontend in packages/ui/HANDOFF.md (the projector vs every agreed board, the console's logic and flow, the phone, Admin), Sound engine in apps/show/docs/HANDOFF.md (the transitions' real state, the engine's presenter actions vs the requirements, the night's flow from the doors), Backend in apps/cloud/docs/HANDOFF.md (setup and startup as a non-developer lives it, the cloud, why the tests passed while the user's test failed).
- Verify those lists yourself (with subagents): run the show (`docs/night-runbook.md`), open the projector, the console and a phone side by side with the canvas ("Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv), and check each requirement in docs/requirements/ against what you see. Then one list of what's missing, by area, with priorities against the dates (the cards 4–5 Dec, the night 27 Dec), for the user.
- Known from today, beyond the user's words: the night's opening isn't modelled (the show jumped straight into a round, with no doors and card-selling state, and the round's intro music played under the presenters' talk; D291's Enrere on the first song undoing the round's start; maybe an entrance audio); the Mac app to start the night (D282) is on hold; the presenters' remote is the genuine Wii remote paired by MacWiiPair (D275), untested on this Mac (U220).

## In flight (28 Nov, evening)

**Resume first: the laptop and its devices (the user's next topic).** The user paused it on 28 Nov: "we will resume this conversation about the mac app, rubber band on web asembly, the remote backup and each device location and connections in another session". Logged so far, all open to revisit with the user:
- D273: a 5G drop isn't a design concern; congestion is the one real risk, so the built offline paths stay.
- D274: no projector stick; the audio on another device (split mode) only a nice-to-have; the presenters' remote is the real problem (eyes on the public, not a screen).
- D275: the genuine Wii remote stays, paired by MacWiiPair (System Settings can't pair it; 2025's WiimotePair fails on macOS 26/27); the user buys a backup. U220 is the user's test of it.
- D276: a second projector, if found: inside, about 12–14 m from the stage, angled to the back tables, the same image from an HDMI splitter; the scenes support 4:3, 16:10 and 16:9.
- D281: the laptop and the mixer at the tech's table by the projector, 6–7 m from the stage; the backup remote is the user's pick (a presenter remote or a mini gamepad). My objection, made once: the Wii remote then links over 6–7 m through people, as in 2025.
- D282: a Mac app with a control page runs one `npm run night`. **Backend and Frontend are on hold for it** until the user resumes. Backend's design note for then: the `npm run night` supervisor itself serves the control page and its status API on 127.0.0.1 (the relay can't, since stopping it would kill the page), runs the relay, link, caffeinate and Chrome as children, and the .app is an osacompile or shell .app built in the repo (no quarantine). U218 was closed as moot, but the user wants to talk about Rubber Band in WebAssembly (the browser Blend).
- The research: docs/research/reports/laptop-app.md, android-show-app.md, wii-remote-mac.md, browser-only-show.md, presenter-remote.md, two-projectors.md.
- **How to ask (the user, 28 Nov):** a stated preference is an answer; never re-ask it, and never turn the user's own purchases into questions (memory: feedback-stated-preference-is-an-answer).

**Chrome's audio clock stopped on this Mac (28 Nov):** the user's fix is to quit every Chrome (including a kiosk from the 27 Nov production test, profile /tmp/quina-show, and that test's relay), then `sudo killall coreaudiod`, then a reboot. Backend's production e2e was red until its Chrome ran with `--disable-audio-output` (057ff2a); D277 then deployed (c9865a9e). D284 adds detection: Sound engine's part (0dd44efe) and Backend's preflight FAIL (1a9714c) are on main; Frontend's Console banner is on main (1fa4ef60).

**Today's production test (D288, U204 answered):** done; the plan is back to 27 Dec's times. Chrome's audio clock runs again on this Mac (Backend's probe). The collapsed cards and the beat bob are approved to build (D289).

**To model, design and build after Frontend's current work (the user, 28 Nov: "dont make him lose focus now"): the night's opening, from the doors to the first round.** In today's production test the show jumped straight into the round, without the doors' card-selling state and its music, and the round's intro music (Zelda's «Parasail Minigame», show-and-music.md › Each round's intro) played while the presenters talked over the intro. To model: the doors phase (card sales, its music, the doors voices, U97); the intro music's span (U99); maybe a special audio for the presenters coming on stage ("i dont know what yet"); D291's Enrere on the first song (undo the round's start); and "the start event should not be shown in the presenter screen, it belongs to the console" (asked the user which screen and which event). Don't brief Frontend before it finishes its list.

**D292's «Proves» section** (Sound engine's `--test` and jumps; Frontend's console card is pushed, 95177485, hidden without `--test`; Backend's cloud refusal and deploy): live; the runbook says the night never uses `--test`.

**The sessions:**
- **Sound engine:** important tasks only. Done today: the README's Chrome profile (9c5ef734), split mode marked a nice-to-have (9d1cb3ac), D277's public Spin target and the Pausa volume fix (a2d0b4af).
- **Frontend:** at most two agents in parallel. D287's sticker module is on main, not wired (953a2d35: die-cut stickers from the real logos with their pixels untouched, a seeded packing collage; no change for Admin or Backend storage); the board Projector-Celebracio-Stickers is on canvas v128; open for the user: a bundle with no sponsor (nothing or the gift sticker), and the go to wire it. Boards for D285/D287 ( the animated fireworks C, the fireworks; the sponsor stickers and fireworks aren't a go to build). Building: the collapsed cards and the beat bob (D289, approved), for today's production test, the phone's edge-to-edge and scroll fixes. Also working on: D277's phone drum, drawing every undrawn screen (D236), D283's thick Check marks on the projector, 16:10 on the projector (D276), D278's near-win sound, D279's items. The canvas redraw is done (v117, v118).
- **Backend:** queue empty apart from D277's feed (Frontend's request) and the held D282; it waits for U204's time. Done today: the Chrome profiles out of /tmp (f63af09f), the plan's title «Quina Quina! 3» uploaded (D280).
- **The card design session (quina-musical-d1):** its work is done; the organizers picked «Apaïsat sense portades» (D295, 28 Nov). Its handoff is tools/card-mockup/HANDOFF.md, the spec tools/card-mockup/README.md, the canvas https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392. Decisions D250–D272.

**Live (last deploy 54fa6b59 = 168d1c2d, 28 Nov: sponsor logos must be uploads here when a plan is saved (stored plans load leniently; the live plan reads back with 56 logos), the preflight names its media fallback, same-origin logo tests; before it b57a3eb6 = e6d95db1: every fix from today's production test (the iOS 18 / Safari 18 Historial fixes, D292's test tools kept off the cloud, one-shot fresh=1, the LAN URL on the default route); the test is over, the laptop side stopped, and the plan is back to 27 Dec 17:00/18:00; before it 885de668 = ac3b54d2: the collapsed cards (D289), the beat bob, the console's announce switch, the sticker module (not wired); the production test at 12:20 with the laptop side up (D288); before it 8b5489e5 = baafcdc7: the phone's slim Check strip, round count pills, the one-line card header (D286's canvas fixes); before it e28ec4f8 = 449ccb2e: the phone's edge to edge, the strip-fade mask (to confirm by the user), no empty scroll; before it a4bcdd18 = 95580b6: D284 complete (the watchdog, the consoles' banner, the preflight FAIL), «Cartró #57»; before it ff40c7c4 = 6ee5d54: D276's 4:3/16:10/16:9 projector, D283's thick Check marks, the pre-night flag and moon from the planned start (c91a7219); before it cf9e4ea9 = 9defcd2: «#57» numbers, the near-win sound back, the console's pre-night cleanup; before it 68340f6f = 843bb85b, D279/D280 in the console; c9865a9e = ebeea86: D277, the public Spin's target from its start and the phone's drum on the projector's trajectory; before it 3e96560a = 90f45de9, the Line and «QUINA!» Celebrations, offline covers; 84998894 = 855935c0, the redraw's bug fixes; 9516f6be, D266's labels; 3aa936b9, the phone's jank pass; b488bafa: the renumbered 2026 repertoire, 135 songs, 70/70 with 5 shared, the remade temporary cards and covers):**
- the realistic run's plan on quina-dev: D192's order, 96 example prizes from the organizers' sheet (temp/wip prizes/2026-example-bundles.json), 58 sponsors and 55 logos, with the 27 Dec times;
- the 2026 cards (699 temporary, both cards two-sided) and covers on the QR domain;
- repertoire 2026 in R2's content-addressed layout (D248: manifests/2026.json, 2,772 blobs, 8.04 GB), with the final playlists (D230, D269: 135 songs, 5 shared), clean print names (D260, D270, D271), provisional hooks and placeholder voices;
- the installable player (D221–D223);
- the drum matching on the phone (D237, D249);
- the console items: D228, D229, D234's sold cards and the two-level lock (engine-enforced, cloud consoles told apart), D237's switches;
- «Quina del Desgraciat» (D251).

**To run the show on the laptop:** docs/night-runbook.md: `caffeinate -dis`, `cd apps/show && npm start -- --lan --repertoire 2026` (it builds first and refuses a stale build), `cd apps/cloud && npm run link`, the show page and the laptop's Console in Chrome with their profiles in ~/Library/Application Support/Quina (rerun `npm run setup:laptop` once to create them), then `npm run preflight`.

**Waiting on the user (open-questions.md › Decisions), most useful first:**
- U188: only the Wii dialog's tap outside is left (U225 answered: D283, thick marks on the projector's Check);
- U230: where the phone's install button goes (replaces U193, after D290);
- U214: the grill format only in a card design session (the default), or plain questions there too;
- U205 (Parlem's 40 s Hold music), U207 (✕ in a stack);
- U194 (push), U196 (App Clip), U197 (TWA): the research says pass; U195 (uncollected prizes);
- U202, U203: the console's in-game admin and second-console sync (they matter more now that the laptop sits at the tech's table, D281);
- U55 (old song data on the laptop), U56 (faster hook approval) and U14 (approving the hooks), before the rehearsals;
- U68–U75: the edition file's details (built and passing; not committed until U75);
- older ones: U157–U160, U163, U166, U168, U169, U173, U176–U179, U181, U36–U39, U12, U50, U79, U97/U99, U103–U114, U128, U129, U136–U139, U150, U85, U89.
- User tasks: U220 (try the Wii remote with MacWiiPair, and the Chrome restart check), U191 (ask the presenters about the notebook), U19 (the real-device checks), U126, U65, U64, U16, U18, U20, U13. Also: the canvas's old versions still hold a WhatsApp paragraph pasted by mistake (never in git); only the user can check who the canvas is shared with.

**Sound engine's later item:** the Pausa, break and Hold music into the repertoire (D268's part C), designed with Backend before the rehearsals.

**Ideas, not decided (docs/ideas.md):** the presenters' notebook on the tablet (U191: ask the presenters), and ordering from the tables to the bar.

**Other threads:**
- Optional, not now: the garland on the beat, an "effect is playing" state, and the relay's asset caching.
- The listening pass and trying the remote (U13).

## Where things are

- **The design canvas:** "Quina Musical look", https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv (= code/artifact/c959a819…). Frontend owns it, and comments are read only when the user says so.
- **The 2025 night in data:** `docs/research/reports/night-2025-data.md`. **The research of 27 Nov:** docs/research/reports/ (push-notifications.md, ios-install-and-app-clip.md, android-twa-and-install.md); of 28 Nov: the six laptop and device reports listed above.
- **Cards:** made on 4–5 Dec with `npm start -- --repertoire 2026` in apps/cards, from the final design.
