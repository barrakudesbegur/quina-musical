# Audit: Admin, the cheat sheet, startup, and the design system page (audit-admin)

Checked against origin/main **d3634e28** (a30542e7 plus one handoff commit), in a clean worktree. I ran it as packages/ui/HANDOFF.md says: `npm start -- --port 5870 --repertoire 2026` in apps/show, with a scratch copy of data/link (`QUINA_LINK_DIR`), so the real laptop plan was never touched. I walked it with headless Chrome (Playwright, `channel: chrome`). I didn't run the cloud link or the cloud Admin (both need the laptop's service token or a Google login), so the cloud paths below come from reading the code. Everything I started is stopped, and the worktree is removed.

Screenshots and PDFs: `temp/audit-28nov/shots-admin/` (named below as `shots/…`). The helper's per-board notes on the design system are at `…/scratchpad/audit/ds-notes.md`.

---

## Biggest gaps first (all areas)

1. **The runbook's own show-page command starts round 1 the moment "Start show" is clicked: no intro, no prizes read out, no Shuffle in public.** `?autostart=1` (night-runbook.md step 5; `apps/cloud/laptop/chrome-profiles.ts:37` `RUNBOOK_COMMANDS.show`) makes `unlock()` send `next` (`apps/show/engine/src/main.ts:1233-1237`). From the "before" scene that puts the show straight into play. I reproduced it with `fresh=1`:
   - Without autostart, after the unlock Admin's status reads «Abans de començar · Aturat».
   - With autostart it reads «En joc · Sonant»: the drum spins «QUINA 1», and the console shows «Següent: … 2 s per aterrar» while «No hi ha cartrons en joc» (`shots/show-after-unlock-autostart.png`, `shots/console-after-unlock.png`).
   - This is very likely the cause of "the show jumped straight into a round" in the realistic test.
2. **Following the runbook in order, the preflight fails and tells the tech to switch to last year's songs.**
   - The relay starts with `--repertoire 2026` (step 4), but `npm run preflight` (step 8) has no `--repertoire`, so it loads `default`.
   - Run against a 2026 relay, it printed `FAIL Relay: it serves repertoire "2026", not "default": restart it with --repertoire default` (verified; `apps/cloud/laptop/preflight.ts`, `preflight/checks.ts:494`).
   - README.md › "How to run the night" leaves `--repertoire 2026` out of the relay command altogether, so following the README serves **last year's 77 songs**. The relay says so in one quiet line, `repertoire default … 77 songs`.
   - `npm run setup:laptop` also defaults to `default` (`tools/laptop/setup.ts:26`), so a spare laptop set up by the runbook pulls the wrong media.
3. **A cold start is 4 terminals, 2 long Chrome commands and an English click on the projector, and nothing guides you between steps.**
   - **Terminals:** `caffeinate -dis`, the relay, the link, the preflight.
   - **Chrome:** two `open -na "Google Chrome" --args …` commands of about 300 characters each.
   - **The click:** the kiosk show page always opens on a blurred «START SHOW / Audio needs one click (or launch Chrome with --autoplay-policy=no-user-gesture-required)» overlay. It stays even when Chrome *was* launched with that flag: verified, the overlay was still up after 6 s (`shots/show-start-overlay.png`). Nothing unlocks it but a click or Enter/Space on that window. The window is full-screen on the projector, and the console's red bar says «La pàgina del show espera un clic a «Start show» al portàtil».
   - **The relay's start-up output** gives a localhost URL and the tablet URL, then nothing: no next step, no show-page command, no link, no preflight.
   - **D282** (the `npm run night` command plus a Mac app with a control page) is **not built**: no script, no app, no board on the canvas. Only research exists (docs/research/reports/laptop-app.md).
4. **Opening Admin can overwrite the saved plan with a blank one.**
   - **How:** `PlanSession` starts from a blank plan when the store has nothing cached yet. The cloud and relay stores have nothing until the first `GET /api/plan` or the socket's `relay.plan` push arrives. The autosave fires after 600 ms with `savedJson = null` (`apps/admin/state/plan-session.svelte.ts`, constructor + `start()`; `apps/admin/data/admin-plan-store.ts` `forPage`).
   - **Reproduced:** I delayed the GET by 3 s and held the socket closed. Admin sent `PUT /api/plan` with 1 round, 0 sponsors and the title "Quina Musical".
   - **When it bites:** whenever both answers take longer than 0.6 s, for example a phone over 4G behind Cloudflare Access.
   - **No undo:** neither the relay nor the cloud keeps a history of Admin saves. Only `npm run edition -- upload` makes backups.
5. **The engine's round count (5) ignores the plan's 12 rounds, and the screens show it.**
   - **The default:** `roundsTotal: 5` (`apps/show/engine/src/config.ts:194`, `show.ts:838`) is never taken from the plan.
   - **What shows it:** Admin's «Quina actual: Quina 1 de 5» and the console menu's «Quina 1 de 5» with the «Quines en total 5» stepper (`shots/console-menu-planB.png`). Admin even warns «El show compta 5 quines i el pla en té 12» with a manual «Enviar el nombre de quines al show» button (`shots/admin-logo-cleaner.png`, top).
   - **The worst consequence, read from the code but not played through:** the console's Celebration panel calls round 5 the last one, «Era l'última quina: acabeu la nit des del menú.» (`apps/console/components/CelebrationPanel.svelte:21`).
   - **The tech must remember to fix it by hand.** No checklist says so.
6. **The printed cheat sheet drops the claim rules and the special round's rules.** Chrome's print to PDF of `/admin/#xuleta` comes out as 5 pages. Page 4 starts with a blank band where «Normes per cantar» and «Quina especial» should be. Their text is absent from both PDFs I made (`shots/xuleta-print.pdf`, `shots/xuleta-print-2.pdf`), but they're in the DOM, visible, in black. The keys, checklist and Wii sections print.
7. **The two "laptop keys" lists contradict each other, and the keys can't run a night.**
   - **The contradictions:** Admin's sheet says Espai = «Espera / continuar» and → = «també deixa anar el Suspens» (`apps/admin/strings.ts:493-508`). The console's «Xuleta del pla B» says Espai = «Parlem / Reprèn» and → = «no durant Aguanta ni el suspens» (`apps/console/strings.ts:720-735`).
   - **What the keys can do:** the show page's keys (`main.ts:1267-1299`) only land songs and do Back, hold, Suspense, Panic, pace and phase. Nothing starts a round's intro or Shuffle, checks a card, validates or rejects it, or ends a round.
   - **Where they work:** only while the kiosk window on the projector has focus.
   - **So:** the runbook's "tablet won't connect → drive from the laptop keys" can't carry a night. Its real plan B is the console on the laptop.
8. **The cheat sheet doesn't meet its requirement** (screens.md › Cheat sheet):
   - **Running order:** there's no presenters' checklist for the night's running order (show-and-music.md › The night's running order: the welcome's six points, the intro, the close…). The «Abans de començar» list is the tech's hotspot checklist.
   - **Layout:** pages don't hold three rounds each (page 1 has 4, page 2 has 5).
   - **Missing note:** no "turn the PA up about 6 dB" note, although operations.md › The day itself says the cheat sheet carries it.
   - **Three checklists that disagree:** Admin has 7 items, the console 6, the runbook its own steps.
9. **Admin is barely usable at this plan's size.**
   - **On a laptop:** Preparació is **58,325 px** tall at 1280 px, about 65 screens, with 134 `<select>`s and 508 inputs. Every prize row repeats a 58-sponsor dropdown, and the sponsors section alone is about 20,000 px (`shots/admin-desk-preparacio.png`).
   - **On a phone** (D89: "Admin's UI is only for last-minute edits on a phone"): 84,607 px tall, and wider than the screen (scrollWidth 448 at 390 px), so it scrolls sideways.
   - **No navigation:** no search, collapsing or jump links.
10. **Three places to edit the plan, with no merge between them.**
    - **The git file:** `data/editions/2026.plan.json` (`npm run edition -- upload`).
    - **The cloud's Admin.**
    - **The laptop's Admin:** saves `local-plan.json`, which the link pushes up later.
    - **What happens:** Admin's edits never reach the git file, and the next `edition upload --yes` replaces them (after a backup).

---

## 1. Admin (apps/admin)

Requirements: screens.md › Admin; R2-Q23, R2-Q28, R2-Q36, P5, P11, D12, D22/D280, D89, D111, D116, D197, D208, D227, D234.

| Requirement | State | Where / evidence |
|---|---|---|
| Edition name, edition year | **Built** | `PlanMeta.svelte`; `shots/prep-01-top.png`. The section is headed «La nit», which is also a tab name. |
| Cards in play as ranges | **Built, live only** | `CardsInPlay.svelte` sends `setCardsInPlay` to the show. It isn't part of the plan, and it needs the show page open. D234 adds the same on the console («Cartrons venuts»). |
| Rounds in order: kind, card type, side; one Desgraciat | **Built** | `RoundsEditor.svelte`, `logic/plan-edit.ts`, `logic/plan-check.ts`. Played rounds lock (`lockedRoundCount`), so the upcoming ones are live-editable (D12). |
| Prize bundles (Line, Quina, headline) | **Built** | `PrizeFields.svelte`. Very long, see gap 9. A layout glitch: the Line column's single prize card stretches to the Quina column's height, with big gaps between its fields (`shots/prep-top.png`). |
| Sponsors (SponsorsEditor) | **Built** | Rename keeps the prizes, remove clears them, and «Dona N premis» is shown per sponsor. |
| SponsorImport (CSV of the organizers' sheet) | **Built** | Reads only the safe columns (`logic/sponsor-sheet.ts`, `docs/sponsor-sheet.md`). |
| LogoCleaner (background removal, trim, 512×256, PNG) | **Built** | `shots/admin-logo-cleaner.png`. Its help text is stale: «De moment el logo es guarda dins del pla, en aquest navegador. Quan hi hagi núvol…». The cloud exists. |
| Logo library + bulk upload, JPEG XL | **Built, cloud only** | `LogoLibrary.svelte`, `LogoBulkUpload.svelte`, `data/jxl-encoder.ts`. On the laptop, cleaned logos stay in that browser's localStorage until the cloud takes them. |
| Bulk JSON import (diff, every error) and export | **Built** | `JsonImport.svelte`, `JsonExport.svelte`; README documents the shape for agents. |
| Schedule with throw breaks (D197) | **Built** | `ScheduleEditor.svelte`. Its header comment still says "5 minutes on top of the Interval"; the UI text follows D197. |
| Card types read-only (R2-Q36) | **Built** | From `/cards/card-types.json`. |
| Cloud store and save | **Built, with the overwrite risk** | `data/admin-plan-store.ts`: cloud / relay / local / demo. Autosaves valid plans only. Another tab's save prompts. **Gap 4** (a blank plan can be saved on open). No save history anywhere. |
| On the night: start and end | **Built** | `GameControls.svelte` (`roundIntro`; end needs ACABAR). It duplicates the console's «Començar la nit» / «Acabar la nit» under other names («Començar / Acabar la Quina Musical»). |
| Plan B resume | **Built** | `ManualResume.svelte`: the code, plus the cloud's Games when served from the cloud. The README's "Stubs and why" still calls it a disabled form, which is stale. |
| Winners list | **Built** | `WinnersList.svelte`. |
| Cards opened on phones (P11) | **Not built** | `PhoneCards.svelte` is a "Pendent del núvol" stub. |
| Player-app settings (sounds default, banner) | **Partly** | Cloud only (`PUT /api/sounds`, `/api/notice`). On the laptop the panel says it only saves on this device, behind a big «DESAR EN AQUEST DISPOSITIU» (`shots/admin-desk-nit.png`). The limit is 140 characters in Admin and 200 in the README and the cloud. |
| Tools: hook audition | **Partly** | A link to `/show/audition.html`. The cloud doesn't serve `/show/` (`apps/cloud/scripts/assets.ts`), so on the cloud Admin it's a dead link. |
| Tools: full JSON export | **Built** | `ToolsPanel.svelte`. |
| Tools: Shuffle seeds | **Not built** | Stub («Pendent: el diari… l'Admin encara no el pot llegir»). |
| No interface sounds (D208) | Not checked live | The DS's default control sounds would need silencing in Admin; I didn't test it. |
| The approved look (screens.md: "still has to be applied to … Admin", U12) | **Not done** | A mix of plain controls and one DS-styled giant Londrina button (`shots/admin-desk-nit.png`). The gallery has no admin density (see §4). |
| Preflight (in Admin) | **Not in Admin** | The preflight is the CLI `npm run preflight` (§3). Admin has no preflight or status view beyond its two header chips. |

README drift (`apps/admin/README.md`): it says logos are WebP data URLs (code: PNG), and lists Plan B resume as a stub (it's built).

## 2. The cheat sheet

Requirement (screens.md › Cheat sheet, R2-Q17): printed and on the tablet. Every prize with its sponsor, three rounds to an A4 page and never splitting a round. «Altres patrocinadors: agraïu-los també». The claim rules and the special rounds' rules. The presenters' running-order checklist. The Wii mapping and the laptop's keys.

| Part | Printed (Admin `#xuleta`) | Tablet |
|---|---|---|
| Prizes per round with sponsors | **Built.** No round splits (`tr { break-inside: avoid }`), but it's 4 and 5 rounds a page, not 3 | **Built** as the console's «Premis» tab: one round at a time (`PrizesPanel.svelte`) |
| «Altres patrocinadors» | **Built** | — |
| Claim and special-round rules | **Broken in print** (gap 6); visible on screen | **Built** in the Premis tab |
| Running-order checklist (welcome, intro, close) | **Not built** | **Not built** |
| Laptop keys | **Built, but contradicts the console** (gap 7) | **Built** in the menu's «Xuleta del pla B», behind a disclosure |
| Wii mapping | **Built** (`WiiGuide`, the console's own mapping; page 5) | **Built** («Comandament» dialog) |
| Setup checklist | Admin's 7 items | Console's 6 items (ticks kept per device) — different lists |

**Could a presenter run the night from it? No.**
- **The keys:** they can't start a round, Shuffle, check a card or end a round, and they need the projector window focused.
- **The printout:** it doesn't carry the claim rules.
- **The welcome:** nothing tells them the order of the welcome (rounds, the Desgraciat, the Especial's special card, the throws, how prizes are collected, the bar) or of the close.
- **The Wii sheet:** good, but it says «És opcional», while D54 and screens.md make the remote the intended controller.

The runbook (docs/night-runbook.md) is the tech's document, not the presenters'. It is thorough on failures, but see §3 for its startup errors.

## 3. Setup and startup from a cold laptop

**What exists:**
- **Docs:** docs/night-runbook.md (10 setup steps, "Without the tablet", spare laptop, failure table), the README's table, docs/setup.svg.
- **Commands:** `npm run setup:laptop` (spare laptops), `npm run preflight`.
- **The show page's** start overlay; **the console's** red "the show page waits for a click" bar and its «Per començar la nit: Menú → Començar la nit» hint.

**What's missing:**
- D282's `npm run night` and the control page: not built, on hold (docs/HANDOFF.md), with no board.
- No single command opens Chrome with the right profiles.
- Nothing unlocks the show page's audio without a click.

**What's confusing or wrong, verified:**
- **`?autostart=1`** jumps into round 1 (gap 1).
- **Repertoire mismatches:** the README omits `--repertoire 2026`, and the preflight and `setup:laptop` default to `default` (gap 2). The preflight's own fix text says `npm start -- --lan` without the repertoire.
- **The start overlay** is English, blurred over the Before screen, and claims the Chrome flag avoids it, which is false (`apps/show/engine/show.html:71-74`; `shots/show-start-overlay.png`).
- **The relay's start-up output** (with `--lan`): `show relay (dist/) on http://localhost:5871/show/ (audition…, Admin: /admin/)`, the repertoire line, the tablet's URL with its token, and a "dev test remote" URL. It doesn't print the show-page URL the runbook wants (`?autostart=1`, kiosk), the link, or the preflight. Without `--lan` it adds "This laptop only". Without `--repertoire` it says `repertoire default … 77 songs` and nothing louder (`audit/relay-lan.log`, `audit/relay-default.log`).
- **Before the night, the console's biggest button is «LLANÇAMENT»** (play the throw song). Starting the night is a MiniButton inside the menu (`shots/console-before-unlock.png`).
- **The console header** says «QUINA MUSICAL» before the start, while the projector says «QUINA QUINA! 3» (same screenshots).
- **«Quines en total 5»** has to be fixed by hand (gap 5).
- **Two start buttons and two end buttons** with different names: the Admin's «Començar/Acabar la Quina Musical» and the console's «Començar/Acabar la nit».
- **Plan B by keys** (gap 7).

## 4. The design system page (apps/ds `/ds/`) vs the DS-* boards

From the helper's read of the 24 boards and `apps/ds/**` at d3634e28 (`audit/ds-notes.md`). I didn't re-render /ds/ myself.
- **Generic components:** covered. Every A1–A9, B1–B10, C1–C4, D1–D8, E1–E6, F1–F2, G1–G5, H1 and R* specimen on the boards has a gallery cell with the same caption (the boards are snapshots of /ds/).
- **On a board but in no code:**
  - the Celebration's music pick with a cover per option (DS-Controls-1, pending U157/U158; `SegmentedControl` has no cover option);
  - the "Before the start" countdown Ring as used on the projector: it's a Ring specimen only, and `apps/stage/render/before.ts` uses a CountdownChip.
- **In code but missing from the gallery** (the boards paste screenshots instead):
  - the projector's Check grid and Verdict looks (`apps/stage/render/check.ts`);
  - the projector's drum (`apps/show/engine/src/wheel/drum.ts`);
  - the finale stage (`apps/stage/render/finale.ts`);
  - the your-song effect (`apps/player/components/YourSong.svelte`);
  - the console's multicolour `SoundIcon` (the gallery's SoundPad draws line icons, so it isn't the real pad);
  - `StickerIcon` on its own;
  - the error-music cover (DS-Cartrons-2 wrongly says no code draws it; `apps/console/console.css` does, in `#a31d27`, not the board's `#A82028`).
- **Only live, never frozen:** the hold fills of LongPressButton and TwoLevelButton, CornerButton pressed, and the open sheets and dialogs. A snapshot of /ds/ can't reproduce those board cells.
- **No Admin density:** the Botons-1 and Controls-4 boards tag Admin, and Admin has its own `.notice*` in `manage.css`.
- **On no board:** the gallery's ConsoleMenu pieces (D228, D237, D229, D234) and the console's dark-theme page.
