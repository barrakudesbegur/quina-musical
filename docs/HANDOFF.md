# Orchestrator handoff

Resume the orchestrator from this file after a clear. The durable state is in [status.md](status.md), [open-questions.md](open-questions.md), [decision-log.md](decision-log.md) (next free: **D294**, **U231**) and [timeline.md](timeline.md). This file holds only what's in flight.

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
- **The card design session (quina-musical-d1):** its work is done except U212. Its handoff is tools/card-mockup/HANDOFF.md, the spec tools/card-mockup/README.md, the canvas https://claude.ai/code/artifact/8af06588-238f-4095-8d67-a594d91c7392. Decisions D250–D272.

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
- U212: the organizers pick the card, «Quadrat amb portades» (the default) or «Apaïsat sense portades»; the cards are made on 4–5 Dec, after a proof sheet;
- U188: only the Wii dialog's tap outside is left (U225 answered: D283, thick marks on the projector's Check);
- U230: where the phone's install button goes (replaces U193, after D290);
- U214: the grill format only in a card design session (the default), or plain questions there too;
- U205 (Parlem's 40 s Hold music), U207 (✕ in a stack);
- U194 (push), U196 (App Clip), U197 (TWA): the research says pass; U195 (uncollected prizes);
- U202, U203: the console's in-game admin and second-console sync (they matter more now: the tech drives from a phone at the table, D281);
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
