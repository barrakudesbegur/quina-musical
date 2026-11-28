# Player app (apps/player): requirements against the code

Audited: the clean checkout of origin/main at `49a962b7`, worktree `scratchpad/wt-audit-phone`. Paths below are relative to that worktree. Everything was checked against the code, not handoffs or commit messages. Nothing was run in a browser. A status of "met" means the code does it as written; it does not mean anyone has seen it work on a phone.

Status key: **met** · **partly** (what's missing) · **NOT met** · **can't tell** (what would show it).

## Tests

`cd apps/show && npm run test:ui`: **pass.** `tsc` is clean, and `svelte-check` reports 671 files with 0 errors and 0 warnings. `node --test`: 1042 tests, 1042 pass, 0 fail (log: `scratchpad/audit/phone-test-ui.log`).

**What green means:** the player's 29 test files (`apps/show/tests/ui/player/*.test.ts`) test only pure logic (view.ts, status.ts, timeline.ts, drum.ts and similar) with fakes. No test mounts a component, runs the model's wiring or touches a real DOM or browser. Bugs 1–4 in the biggest-gaps list below can't fail any existing test.

---

## 1a. screens.md › Every screen (the rules that apply to phones)

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Everything in Catalan; round names; «#123»; am/pm | met | `strings.ts` throughout; `packages/rules/time.ts:64-67` `formatClock` → "6:00 pm" | Other copy problems are listed under D188, D192 and D201 below. |
| Festive mobile-game look, juicy, animated | can't tell | — | Needs eyes on a phone. The hooks exist (§2). |
| Every animation planned in ANIMATIONS.md before coding; motion never tells a secret (D277) | partly | `logic/drum.ts:260-325`, `components/Reel.svelte:94-98` (the words wait for the landing) | The phone holds `spin.targetId` and rests on its tile at `landAtMs`, as D277 allows. The words, Historial and the marks wait for the public landing. A few phone hooks differ from the spec (§2). |
| Ninos family-friendly | can't tell | `NowPanel.svelte:22-24` (`ninoFor`) | — |
| Londrina always in capitals (D96, D114) | can't tell | `player.css` › `@layer defaults` (outlined titles) | No lint covers it. Needs a visual pass. |
| Buttons fully round only when floating (D189) | can't tell | `actions.ts:12-48` (`floating: true` only on «+ Cartró», the empty state's two, the hint) | The presets look right. The CSS wasn't checked. |
| Every press: travel + sound + Android vibration (D215) | met | `device/touch-rules.ts:8-29`; `packages/ui/sounds/delegate.ts:119-153` (`haptics` → `buzz()` 10 ms) | `buzz()` returns false before the first user activation (delegate.ts:61-68), as browsers require. |
| "On" = panning stripes; a locked state never striped | can't tell | `packages/ui` `pattern-pan` | The design system's job; not phone-specific. |
| Equal corner insets, even ring gaps, balance/pretty wrap | partly | `packages/ui/base.css:63` (balance); `pad.css:130-194` | `text-wrap` is set in places, not systematically. Insets need a visual check. |
| Images JPEG XL with fallback, never WebP | met | `config.ts:28-31` (`coverJxl`), `App.svelte:37` | Covers and logos. |
| Browser floor Safari 18 / Chrome 131, lint (D219, D293) | met | `packages/ui/baseline.ts:20` `FLOOR`; `apps/show/tests/ui/ds/baseline-lint.test.ts` (passes) | On iOS 18 the fallbacks mean **no strip-fade, no history-edge, and a stepped drum collapse instead of the morph** (`home.css:129-191, 225, 322`). That's within D293, but iPhone players never see these animations. |
| The ending stays secret (no next song, Queue, possible winners, closeness) | met (phone side) | `feed/project.ts:7-21` (dev whitelist); `packages/protocol/public.ts:1-16,140-180` | Production's whitelist is `apps/cloud/src/domain/projection.ts`, outside this audit. The phone gets `targetId` (D277), `beat` (it can be ahead of now for a landing, `public.ts:120-128`) and the full printed catalogue (D78). |

## 1b. screens.md › Player app

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Desktop/tablet: phone layout with a max width (D212) | met | `player.css:74` `--player-column: 32rem`; `player.css:733-740` | — |
| Installable PWA (D221) | met | `public/player.webmanifest`; `index.html:9-20` | — |
| SW network first, aggressive update (D222) | met | `sw/player-sw.ts:49-63` (skipWaiting + claim), `:70-88` (network first, cache only on failure); `sw/routing.ts:18,39-53` (only player pages + `/assets/`); `device/updates.ts:30-97` (`updateViaCache:'none'`, a check on focus or visibility at most every 30 s, every 5 min while visible, a reload at a quiet moment) | It waits for 4 s without input and never reloads with a drawer open, a number typed, or during a Celebration or your-song (`main.ts:138`). On a phone left open on the home all night, a reload can land mid-round. That's intended. |
| Icons: maskable + monochrome badge from the afro nino (D223) | met | `public/icons/*`, `icons/app.svg`, `icons/badge.svg` | `player-badge-96.png` exists but nothing references it (no notifications), so it's unused. |
| Install button on the home only when installable and not installed; Ajustos offers it or says installed; iPhone: Ajustos only, with a steps drawer | met (place pending U230) | `AraHome.svelte` (`InstallPrompt` as CardsList's `end`), `CardsList.svelte:80`; `MenuView.svelte:104-122`; `App.svelte:139-142` | It shows at the end of the cards list, and never with no cards (the `end` slot is only in the non-empty branch, CardsList.svelte:38-81). |
| QR opens the right flow per platform, grandma-proof (D224) | partly | `logic/router.ts` (`/26/123` adds the card, `settledHref` → `/26/`); `main.ts:92-101` | Every platform gets the web app, which adds the card. There's no platform-specific flow (App Clip, TWA, install prompt from the QR). D224 says "how pending (research)". |
| Reload never flashes the welcome (D225): 5-min last state; empty sky; no first-paint fades; «Sense connexió» after 20 s with no feed | met | `logic/boot-cache.ts:10,21-53` (sessionStorage, 5 min); `main.ts:107-108`; `App.svelte:89-91` (`{#if app.state}`: empty sky); `player.css:183-189` + `model.svelte.ts:78,202-209` (transitions off until two frames after the first state); `logic/status.ts:44-47` (state null + feed down 20 s → offline) | Only CSS *transitions* are suppressed, not keyframe animations. If the feed never comes, `booting` never clears, so drawers open with no transition on a phone with no feed. That's minor. |
| A card without a name shows only its number; a non-playing card shows its header alone, three to a row (D289) | met | `logic/storage.ts:49` `cardLabel`; `CardsList.svelte:59-78` | — |
| App feel (D220): no tap highlight, no pull-to-refresh, no text selection, large-viewport layers | met | `packages/ui/base.css:20-22`; `home.css:30`; `player.css:161-179`; offline veil `player.css:2785-2792` (100lvh); your-song `player.css:3735-3738` (100lvh) | — |
| Home (D220): swipe/tap switch, one axis, the indicator follows, each tab keeps its scroll; scroll collapses the drum, stuck on both tabs; Historial's bottom-edge shrink; drum tug | met (Chrome) / partly (iOS 18) | `AraHome.svelte:414-480` (gesture), `logic/home-swipe.ts`; `home.css:160-191` (collapse); `home.css:322` (history-edge behind `@supports view()`); `components/Reel.svelte:100-160` + `logic/drum-tug.ts` | On iOS 18: no history-edge, and the collapse switches at once. |
| Drawers (D220): drag closed from any point at the top; QR as its own stacked drawer; «Editar» with number field + QR + green «Desar» | met | `packages/ui/components/Sheet.svelte:108-118`; `components/Drawer.svelte:38-50`; `NumberPad.svelte:248-252`; `RenameSheet.svelte:74-112`; `actions.ts:39` | — |
| Getting in: scan the QR in the browser, nothing to install, no account | met | `model.svelte.ts:260-268` `openRoute` | — |
| «+ Cartró» only with 1..max−1 cards (D188) | met | `HomeFloats.svelte:21,29-33`; max = 30 (`config.ts:9`) | Ajustos: `MenuView.svelte:99-101` (shows with 0 cards too, which is fine). |
| Empty state (D290): «Afegir cartrons» + «Escanejar el QR» (pad with the camera over it) + «Escriure el número»; on Cartrons whenever there are no cards, on Historial only with no song; all-resting cards don't count as empty | met | `logic/empty-cards.ts:9-12`; `HistoryList.svelte:23,28-29`; `CardsList.svelte:36-37`; `NumberPad.svelte:67-74` (scan opens the camera stacked) | — |
| Leaving the pad with a number typed asks first, each button saying what happens («Descarta els canvis», «Segueix editant») | **NOT met** (it asks, but the wording is wrong) | `PadLeave.svelte:16-19`; `strings.ts:78,82-83`: title «Descartar el #123?», buttons **«Continuar»** and **«Descartar»** | This is the exact wording the user objected to in D188 ("Descartar? … Continuar. I understand that the discarding continues"). `PadLeave.svelte:6` says "The words wait for U175". |
| "Add another?" (D241): ✓ mark, «Cartró #N afegit!», the phone's cards, «Vols afegir un altre cartró?», «+ Un altre» / «Fet» (rings the new card) | met | `NumberPad.svelte:121-151,213-246`; `model.svelte.ts:315-340` (cue `added` + 16-60-24 vibration) | — |
| The pad's QR keeps the name and icon (D141) | met | `NumberPad.svelte:114-119` | Only the number is set. |
| One full-width save, tick icon, always visible on a small screen; no «Desar i afegir-ne un altre» | met | `NumberPad.svelte:237-246` (footer pinned outside the scrolling stage); `actions.ts:33` | Square corners: can't tell without seeing it. |
| **"Not built yet: the board's name field, QR button and smart keypad"** | **built** (the doc is stale) | `NumberPad.svelte:172-181` (QR button), `:192-203` (name field), `:210` + `logic/pad.ts` (`rules.digits`: the smart keypad) | screens.md should drop the note. |
| Icon picker B+C mix (D131) | can't tell | `components/IconPicker.svelte`, `packages/ui/components/IconPicker.svelte:65-72` | Visual. |
| Name cards; own icon + colour, corn first, then nine more; removing asks first | partly | `logic/marks-identity.ts:8` (corn first); `logic/storage.ts:101-105`; `App.svelte:163-174` (remove ConfirmSheet «Treure el cartró #N?» / «Sí, treure'l» / «Mantén el cartró») | There are 10 identities but up to 30 cards. From the 11th card, icons and colours repeat (`nextColor` wraps), so "its own icon" fails above 10 cards. |
| Cards kept for the whole edition | met (with a risk) | `logic/storage.ts:68-77,188-191` | `noteEdition` **wipes every card** if the feed ever reports a different `edition` (`model.svelte.ts:429-434`). A misconfigured cloud edition would empty every phone. |
| Last year's links show «Aquest cartró és de l'any passat» | met | `logic/router.ts:56-76`; `LegacyNotice.svelte:10-16`; `strings.ts:242` | — |
| Layout (D73): one home, two corner buttons, stacked drawers; tabs gone | met | `App.svelte:49-182`; `logic/drawers.ts` | — |
| Premis corner (D244): round selector P1, P2 content, locked round «Premis sorpresa» + sponsors, bigger sponsor cards, scrolls | met | `PrizesView.svelte:47-91` | — |
| Sponsors: big logos in a scrolling list; a tap opens it larger in a dialog (D216) | met | `packages/ui/components/SponsorList.svelte:31-126` (native modal `<dialog>`, view-transition morph) | Used in Premis (locked round), the Interval and the end (`NowPanel.svelte:60-65`). |
| Horari: real times done, "~" predictions next; «Venda de cartrons» first (D152); the rounds with the night's **one «Descans»**; «Fi»; am/pm (D150, D192) | **partly** | `logic/timeline.ts:32-68`; `ScheduleView.svelte:21-25`; `strings.ts:226-230` | (1) The throw row reads **«Primer descans»** even though the night has one (`strings.ts:228`, and a test asserts it: `tests/ui/player/timeline.test.ts:55`). D192 says one «Descans». (2) "~" predictions for rounds are the **plan's** starts (`timeline.ts:43,49-50`), never re-forecast. If the night runs 30 min late, Horari still shows the planned times; only «Fi» uses the cloud's `gameEndMs`. (3) The descans time is planned start + roundMinutes. «Comencem» and «+ llançament» are not built (pending U168). |
| More drawers: add card, the menu (cards, sounds, last year's card, «Esborrar dades»), last year's card | met | `MenuView.svelte:59-137`; `App.svelte:131-176` | — |
| Corner style B, drawer hierarchy J2, menu titled with a settings word (D87) | partly | `strings.ts:34` «Ajustos»; `actions.ts:84-87` | Style B and J2 are visual: can't tell. |
| Card side (D102, pending U50): the phone shows the side of the **current or coming** round by itself | **partly** | `logic/view.ts:115-128` (`cardViews(…, currentRound)`), `model.svelte.ts:117,127` | It only follows the round already started (`state.rounds`' last). A round joins `rounds` at `round.started`, after its intro (`apps/cloud/src/domain/projection.ts:26-41`). So **during every break and every intro the phone shows the previous round's side and type.** In the 10-min Descans after the Desgraciat, every normal card shows as a header under «No juguen en aquesta quina» (and the special card on its Desgraciat side). Before the Especial, the special card rests while the normal cards show Quina 10's marks. |
| Before the Game: the night's rounds and the card types, round 1's prizes, adding cards; no how-to-play | **partly** | `NowPanel.svelte:75-86` | The home shows only «Benvinguts a la Quina Musical!» and «Comencem cap a les 6:00 pm» (with a countdown in the last hour). The rounds and round 1's prizes are only in the Horari and Premis drawers. The card types' preview isn't built (the doc says so). |
| Collapsed cards (D286, D289): tiles with 2+ playing cards (full card for one; the Desgraciat keeps full cards); the playing cell's dashes in step; «LÍNIA!» / «QUINA!» in the map until the next landing or validation, «LÍNIA!» only before the round's Line; presenters' switch; beat bob; one-time scribble | met | `logic/collapsed.ts:22-77,99-117`; `CardTiles.svelte`; `model.svelte.ts:135-140`; `logic/beat.ts`, `device/bob.ts`; `AraHome.svelte:94-106` | A phone with **one** playing card never gets «LÍNIA!» or «QUINA!» (`showsTiles` needs 2 cards, collapsed.ts:22-24). The docs don't cover the single-card case. |
| Marking: every landed song marked, latest included; the playing song has the running ring; no near-win marking; near-win chime + 30-40-30 buzz (D278); no banner | met | `logic/view.ts:122-123`; `CardsList.svelte:26,53`; `logic/remaining.ts:35-42`; `logic/feedback.ts:65,78-82`; `config.ts:72`; `device/sounds.ts:41-45` | — |
| The drum matches the projector's (D237) | met in code | `components/Reel.svelte`; `logic/drum.ts` (shared `solveSpin`, `drumOrder` from `drumSeed`, `targetId`); `device/drum-solver.ts` (a worker) | Parity can only be confirmed by watching both screens. screens.md still says "how it lands … is U206", which D277 answered. |
| Desgraciat: «Dempeus» / «Assegut», sits at the sinking landing | met | `logic/desgraciat.ts`; `logic/feedback.ts:56-62`; `strings.ts:109` | — |
| Only the current round in Historial; only the round's card type counts | met | `logic/view.ts:189-194` (`historyOf` = the last round only); `view.ts:122-123,145-157` (marks only for `valid` cards) | Between rounds Historial keeps the last round's songs until the next round starts (documented). |
| A confirmed win only celebrates on a phone holding the winning card; the Desgraciat winner says «Quina potra!» (D190) | **partly / contradicts ANIMATIONS** | `logic/view.ts:308-315`; `Celebration.svelte:36-69` | **Every** phone gets a Celebration (an "other" win: «LÍNIA!»/«QUINA!», confetti, the prize), and the winner's phone gets «La teva …». That follows ANIMATIONS `celebrate`, not the screens.md wording (see §3). The Desgraciat part is met. |
| Sounds: interface sounds only, on by default, **Admin's default for everyone, a player's choice wins**, one «Sons» switch | **partly: bug** | `model.svelte.ts:164` (`soundsOn` derived correctly), but `device/sounds.ts:62` `enabled = true` is only synced in `saveData` (`model.svelte.ts:492`) and `toggleSounds` (`:360`) | **The player's "off" is lost on a reload or reopen:** `Sounds.enabled` starts `true`, and nothing syncs it until some unrelated save, while the switch shows "off". **Admin's default changed mid-night never reaches a phone** until that phone saves something. (A first-ever open syncs at the first snapshot via `noteGame`.) This covers touch sounds and game cues. |
| Touch sounds wobbly/bouncy; a disabled tap → dull thud + "no" motion (D206–D208) | met in code / can't tell on devices | `delegate.ts:97-131`; `touch-rules.ts:11-15` (`refuse: true` on keys, «Desar», icon options); `player.css:4015-4030` | The pad's keys and «Desar» are **native `disabled` buttons** (`packages/ui/components/NumberPad.svelte:78`, `Button.svelte:83`). The thud depends on the browser dispatching `pointerdown` to a disabled `<button>` (it never dispatches `click`). That has to be tried on iOS 18 Safari and Android Chrome. The icon picker (a label with `data-disabled`) is safe. |
| Screen stays awake from the round's start to the end, the Interval included; never before or after, never in the background | met | `logic/awake.ts:9-11` (roundStart, play, check, celebration, interval); `App.svelte:42-44`; `packages/ui/client/wake-lock.ts:7-31` (re-acquired on visible) | Offline keeps it (the last state is live). |
| Vibration only a bonus | met | `device/screen.ts:9-15` | — |
| Reconnects by itself; offline keeps the normal screens, marked offline | partly / can't tell | `feed/cloud-feed.ts:1-4,156-190` (backoff on close, a reconnect on foreground); `logic/status.ts:41-50`; `App.svelte:115-117` | **No heartbeat** (by design, `public.ts:11-13`). A half-open socket (a venue wifi or 5G hand-off without a close) while the page stays in the foreground is never detected: no reconnect, and no offline strip (`connection.online` stays true). Only a real-network soak test would show it. |
| It never shows: "you won" or any win announcement | **contradicted by the code and D289** | `strings.ts:184` «La teva línia!»; `collapsed.ts:52-65` «LÍNIA!» / «QUINA!» on tiles | The tiles announce wins (D289), and so does the winner's Celebration. `strings.ts:3`'s "COPY RULE: … never announces a Line or a Quina" is stale. |
| It never shows: the next song / Queue before a landing | met | `Reel.svelte:94-98`; `drum.ts:212-215` | The phone *holds* `targetId` from the Spin's start (D277). |
| It never shows: earlier rounds' songs | met | `logic/view.ts:189-194` | The feed carries all rounds' landings; the UI shows only the last. |
| It never shows: a prize before its round's intro | met (phone side) | `logic/view.ts:56-90` `planOf` (locked rounds' bundles emptied); `packages/protocol/plan.ts:372-414` | Round 1 is revealed from the start, by design. |
| It never shows: other players' cards, the standing count | met | No standing field in `PublicState` (`public.ts:140-180`) | The Check ribbon shows the checked card's number to every phone (`CheckStrip.svelte:18`), as ANIMATIONS `check` specifies; see §3. |
| Your-song look (D74) | met per ANIMATIONS, **not** per D74/screens.md | `components/YourSong.svelte:78-123` (the particles are the cards' **marks** + a comet), `logic/your-song.ts:31-37` | The flash, the gold, two beams, the end at the next Spin, never in the Desgraciat, two in a row: all met. The particles follow ANIMATIONS/D237 (marks + comet), not D74's "shooting-star streak, rising corn and hearts" (see §3). Over drawers via `popover="manual"` (`YourSong.svelte:57-67,101`). |
| A Celebration closes Premis/Horari/Ajustos, not the pad while typing (D90) | met | `logic/drawers.ts:56-58`; `model.svelte.ts:421-426` | While the pad stays open, the Celebration (a plain div) is drawn *under* the pad's modal dialog. |
| A fallen card shows the sitting nino (D72) | met | `CardPanel.svelte:8,74` | — |
| Printed 3×4 grid in the current style (D77); no card-stacking scroll (D75) | met | `CardGrid.svelte`; `card-stack` is nowhere in the code | — |

## 1c. screens.md › The grandmother test

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Large, clear, simple, plain Catalan | can't tell | `strings.ts` | Needs a test with a real person. The copy is plain apart from the pad-leave question. |
| Big tap targets, high contrast, large text, one thumb | can't tell | — | Visual and device check. The corner buttons and the floating «+ Cartró» are thumb-placed. |
| Anything at most 2 taps away | met | Premis (1), a round's prizes via Horari (2), Sons (Ajustos → switch: 2), add a card (1), edit a card (2) | Stepping to a far round in Premis takes more taps; Horari → round is 2. |
| Sounds can be muted | partly | see "Sounds" in 1b | The mute doesn't survive a reload (bug). |
| Screen stays on | met | see 1b | — |
| Reconnects by itself | partly | see 1b | No heartbeat. |

---

## 2. ANIMATIONS.md › Player app hooks (and the Desgraciat, garland, sound map)

All hooks below are named in code under `apps/player` or `packages/ui` unless marked. Timing and easing were spot-checked, not measured.

| Hook | Status | Evidence | Note |
|---|---|---|---|
| `heat` + garland patterns | met | `components/Heat.svelte:2,37`; `packages/ui/motion/garland.ts`; `App.svelte:69` (party, win, covered, off) | — |
| `home-swipe` | met | `AraHome.svelte:414-480`, `logic/home-swipe.ts`; reduced → view-transition crossfade (`AraHome.svelte:380-383`) | — |
| `drum-collapse` | met (Chrome) / stepped (iOS 18) | `home.css:160-191` | — |
| `history-edge` | met (Chrome) / absent (iOS 18) | `home.css:322`, `HistoryList.svelte:34` | — |
| `add-card-float` | met | `HomeFloats.svelte:29-33` | — |
| `card-hint`, `drum-pick` | met | `HomeFloats.svelte:34-56`; `AraHome.svelte` `pickCard`, `scrollToHolder` | — |
| `collapsed-grid`, `tile-open`, `tile-peek`, `tile-scribble`, `line-card`, `quina-card` | met | `CardTiles.svelte`, `CardPopover.svelte`, `logic/collapsed.ts`; `config.ts:57-61` (peek 600 ms / 2400 ms) | — |
| `corner-press` | met | `packages/ui/components/CornerButton.svelte`; `touch-rules.ts:16` | — |
| `drawer-open`, `drawer-drag`, `drawer-close`, `drawer-stack` | met | `packages/ui/components/Sheet.svelte`; `model.svelte.ts:284-288` (`drawerOpen` sound) | "The phone's back gesture" relies on the dialog's `cancel` event (Android Chrome). There's no history entry and no CloseWatcher, so an **iPhone's edge swipe can't close a drawer** (in a Safari tab it navigates back). Can't tell without a device. |
| `card-reorder` | met | `MenuView.svelte:25-93` | — |
| `switch-toggle` («Sons») | met | `MenuView.svelte:125`; `model.svelte.ts:356-364` (sound only when turning on) | — |
| `pad-keys` | met | `packages/ui/components/NumberPad.svelte:60,78`; `logic/pad.ts` | — |
| `icon-pick` | met | `IconPicker.svelte` | — |
| `pad-leave` | met (motion) / wording NOT met | `PadLeave.svelte` | The ANIMATIONS row itself still specifies «Continuar» and «Descartar» (see §3). |
| `pad-saved`, `pad-again` | met | `NumberPad.svelte:154-158,166-246` | — |
| `toast-drop` | met | `components/Toast.svelte`; `App.svelte:181` | — |
| `logo-open` | met | `SponsorList.svelte:4-6,31-126` | — |
| `prizes-step` | met | `PrizesView.svelte:36-44,68-69` | — |
| `qr-scan`, `qr-found`, `qr-other` | met | `QrScan.svelte`; `NumberPad.svelte:171-181,248-252` | — |
| `install-offer`, `install-row`, `install-steps` | met | `InstallPrompt.svelte`; `MenuView.svelte:104-122`; `InstallSteps.svelte` | — |
| `press` (frameless travel included) | met | `packages/ui/components/*` with `data-anim="press"` | — |
| `refused-tap` | met in code; can't tell on devices | `delegate.ts:97-131`; `player.css:4015-4030` | See the disabled-button caveat in 1b. |
| `reel-spin` (targetId, motion blur, never «?», «Sona la ruleta…») | met | `Reel.svelte:66-98,174-251`; `logic/drum.ts` | Silent (§8 Y4): no tick sound. |
| `drum-tug` | met | `Reel.svelte:100-160`; `logic/drum-tug.ts` | — |
| `shuffle` | **partly** | `components/Shuffle.svelte:1-16` | The fan, the jiggle and «Barrejant…» are there. **The cue blip never plays.** The `'cue'` blip is defined (`device/sounds.ts:20,28`), but `feedbackFor` never emits it and nothing calls `play('cue')`. |
| `landing` | met | `Reel.svelte:236-251`; `HistoryList.svelte:47`; `AraHome.svelte` `smoothHeight` | — |
| `mark-in` | met | `CardGrid.svelte`, `CardTiles.svelte` (`fresh`); `config.ts:47` stagger 80 ms | — |
| `mark-bob` | met | `logic/beat.ts`, `device/bob.ts`, `AraHome.svelte:94-106` | — |
| `your-song` | met (to ANIMATIONS) | `YourSong.svelte`; `logic/your-song.ts`; `config.ts:76` 70-50-70 | Reduced motion → `still`: the gold and the beams, no particles (`your-song.ts:40-43`). |
| `strip-fade` | met (Chrome) / absent (iOS 18) | `home.css:204-238` | — |
| `card-stack` | discarded, absent | — | As D75 says. |
| `near-win` | met | `logic/remaining.ts:35-42`; `feedback.ts:65`; `sounds.ts:41-45` (660→990 Hz) | — |
| `check` ribbon | met | `CheckStrip.svelte:13-27`; `AraHome.svelte` (placed under the drum) | The board's green ribbon with a small nino on a valid result wasn't checked in CSS. |
| `celebrate` | met (to ANIMATIONS) | `Celebration.svelte`; `drawers.ts:56-58` | — |
| `countdown` | met | `components/Countdown.svelte` | — |
| `reconnect`, `offline` | met | `ConnectionStrip.svelte:15-17`; `App.svelte:116`; `logic/status.ts` | — |
| `pause` | met | `AraHome.svelte` (`{#key app.paused}`), `PauseNotice.svelte` | — |
| Cards and songs: `cell-playing`, `card-playing`, `cell-played` | met | `packages/ui/components/card-cell.css:50-58` and others | — |
| Desgraciat `stand-up` | met | `feedback.ts:50-53`; `sounds.ts:29-30` (the cue blip) | — |
| Desgraciat `card-fall` | met | `feedback.ts:56-62,66`; `sounds.ts:46-50`; `config.ts:74` (60 ms) | — |
| Desgraciat `mark-in` (no sound on a fallen card) | met | `feedback.ts:68` | — |
| Desgraciat `celebrate` («Quina potra!» on the winner; no title elsewhere) | met | `Celebration.svelte:39-44`; `packages/ui/i18n/ca.ts:29-31` | — |
| Sound map, phones: one switch, touch + cues, cues win, nothing while hidden or on the show laptop, typing sounds, haptics | partly | `device/sounds.ts:61-148`; `touch-rules.ts:26-28` | The one switch is broken after a reload (see 1b). The Shuffle's cue is missing. |

---

## 1d. decision-log.md: the player decisions

| Decision | Status | Evidence / note |
|---|---|---|
| D72 (sitting nino on a fallen card; no count on public screens) | met | `CardPanel.svelte:74`; no count in `PublicState`. |
| D73 (one home, corners, drawers, no fallback layout) | met | `App.svelte`. |
| D74 (your-song) | met, with a doc conflict | The code follows ANIMATIONS/D237 (marks + comet), not D74's "shooting-star streak, rising corn and hearts". D74 has no amendment recorded. |
| D75 / D77 | met | — |
| D87 (style B, J2, «Ajustos») | partly | The title is met; the visuals can't be judged from code. |
| D90 | met | `drawers.ts:56-58`; YourSong popover. |
| D95 (one save) | met | — |
| D102 / U50 (the side of the current or coming round) | **partly** | Current round only; wrong during every intro and break (1b). |
| D131 / D132 | can't tell | Visual. |
| D141 | met | — |
| D149 (Descans) | met | `ca.ts:128` «Descans» for every Interval (matches GLOSSARY › Break). |
| D150 → **D192** (one «Descans» in Horari) | **NOT met** | `strings.ts:228`, `timeline.ts:3,52-57`: «Primer descans». The code still follows D150. |
| D152 | met | `timeline.ts:59-63`. |
| D188 | **partly** | «+ Cartró» and the sticky «Desar» are met. **The leave question still reads «Descartar el #N?» with «Continuar» / «Descartar»** (`strings.ts:78-83`). |
| D189 | can't tell | — |
| D190 | met | — |
| D200 → D241 | met | — |
| D201 | partly | «+ Cartró» everywhere, including Ajustos: met. Marks corn first: met. "One that only closes says «Tanca»": the phone says **«Tancar»** (`strings.ts:84`, used by the Celebration's close, `actions.ts:47`). |
| D206–D208 | partly | The sound sync bug (1b). The refused thud is unverified on devices. |
| D212 | met | — |
| D215 | met in code | `focus-lint.test.ts` passes; haptics wired. |
| D216 | met | — |
| D218 | met | — |
| D219 → D293 | met | Lint and fallbacks. iOS 18 loses strip-fade, history-edge and the collapse morph. |
| D220 | met | — |
| D221 (U193 → U230) | met; the place is pending | — |
| D222 | met | — |
| D223 | met | The badge icon is unused. |
| D224 | partly | No per-platform flow; research pending. |
| D225 | met | — |
| D237 | met | Wake lock, silent drum, vibration, card-hint, drum-pick, sticky garland. |
| D241 | met | — |
| D242 → D285 / D287 | met for now | No prize panel in a Line's Celebration (`Celebration.svelte:36`). D285's sponsor logos are not built and not a go yet. |
| D244 | met | — |
| D249 | met (phone follows) | `drum.ts:276-286` (glide). |
| D277 | met | `drum.ts:263-325`. |
| D278 | met | — |
| D286 → D289 | met | One-card phones get no «LÍNIA!» or «QUINA!» (a doc gap). |
| D290 | met | — |

---

## 2'. Biggest gaps, by how much a player at the event would notice

1. **During the Descans and every round's intro, the cards show the wrong round** (`logic/view.ts:115-128` uses the last *started* round). After the Desgraciat and through the whole 10-min Descans, every normal card drops to a header under «No juguen en aquesta quina». The special card shows its Desgraciat side until Quina 6 starts. Before the Especial, the special card rests and the normal cards keep Quina 10. This is the moment people look at their phones and turn their cards over (D202, D226). U50's "current **or coming**" round isn't implemented.
2. **Sons off doesn't stick** (`device/sounds.ts:62` vs `model.svelte.ts:492`). A grandparent who mutes the phone and reopens it later hears clicks and blips again, while the switch says off. Admin's default changed during the night doesn't reach phones that are already open.
3. **The pad's "leave?" question is the confusing one the user rejected** (D188): «Descartar el #123?» with «Continuar» / «Descartar» (`strings.ts:78-83`, `PadLeave.svelte:16-19`).
4. **Horari says «Primer descans»** for the night's only break (D192), and its "~" round times are the plan's, never adjusted for a late night (`timeline.ts:43-57`). Players checking "when is the next quina" see stale times.
5. **Before the Game the home shows only a welcome and a start time** (`NowPanel.svelte:75-86`). The night's rounds, the card types and round 1's prizes aren't on it (only in drawers), and the card types' preview isn't built.
6. **A silently dead connection is never detected** (no heartbeat, `public.ts:11-13`, `cloud-feed.ts`). On flaky venue wifi or 5G a phone can freeze on a stale state with no "Sense connexió" strip until it's backgrounded. This needs a real-network test before the night.
7. **iPhones get a reduced home** (iOS 18 fallbacks): no strip-fade, no Historial edge effect, a stepped collapse. There's probably no back-swipe to close a drawer (no history entries). The refused-tap thud on native-disabled keys is unproven on Safari.
8. **Only multi-card phones get «LÍNIA!» / «QUINA!»** (`collapsed.ts:22-24`). A one-card phone gets nothing, while its neighbour's two-card phone announces. The docs don't decide this case.
9. **The Shuffle's cue blip never plays** (`device/sounds.ts:20,28`; never emitted).
10. **Card icons repeat from the 11th card** (10 identities, max 30: `storage.ts:101-105`).
11. **Risk:** a feed with a different `edition` wipes every phone's cards (`storage.ts:188-191`, `model.svelte.ts:431-434`).
12. **Coverage:** the 1042 green tests are pure-logic only. No component or DOM test would catch 1–3 or 5. That's one reason the suite was green while the realistic test went badly.

---

## 3. Contradictions between the requirement documents

1. **Your-song particles.** D74 and screens.md › Player app say "option A's particles (a shooting-star streak, rising corn and hearts)". ANIMATIONS `your-song` ④ (27 Nov, Y1) and D237 ("particles from the card marks") say the particles are the phone's cards' marks plus a falling comet. The code follows ANIMATIONS. D74 has no "amended by", and screens.md was never updated.
2. **Win announcements.** screens.md › Player app "It never shows: 'you won' or any win announcement" contradicts screens.md › Collapsed cards and D289 («LÍNIA!» / «QUINA!» on tiles) and the winner's «La teva línia!». `strings.ts:3`'s copy rule is stale too.
3. **Who celebrates.** screens.md: "A confirmed win only celebrates on a phone that holds the winning card". ANIMATIONS `celebrate`: someone else's win also gets «Línia!» / «Quina!», rays, 40 confetti pieces and the prize on every phone. The code follows ANIMATIONS.
4. **Pad-leave wording.** screens.md and D188 want «Descarta els canvis» / «Segueix editant». ANIMATIONS `pad-leave` still specifies «Descartar el #123?», «Continuar» and «Descartar». The code follows ANIMATIONS.
5. **"Not built yet"** in screens.md for the pad's name field, QR button and smart keypad: all three are built (`NumberPad.svelte:172-210`).
6. **U206 vs D277.** screens.md › Player app: "How it lands before the song is public is U206". D277 answered U206, and ANIMATIONS `reel-spin` and `landing` already describe the answer.
7. **The install button's place.** screens.md: "pending U230 (U193's place went with D290)". D221's header still says "Pending (U193)", and its text places the button where the empty list's add-card button was, a spot D290 removed. ANIMATIONS `install-offer` says "U193 pending: under the floating «+ Cartró»".
8. **One Descans vs ordinals.** D192 (one «Descans») amends D150 («Primer/Segon descans»). `timeline.ts` and its test, and the ScheduleView comment, still describe D150. GLOSSARY › Break says every between-round time is «Descans», and the phone uses that for every Interval. So Horari has a "throw descans" row while every Interval screen is also «Descans». Which of them is "the night's one Descans" isn't stated anywhere.
9. **The Desgraciat status line.** ANIMATIONS › The Desgraciat round: "Status: a draft … Nothing here is coded yet", but `stand-up`, `card-fall` and the «Quina potra!» Celebration are coded. Its open points still say "~~DEMPEUS!~~ … no title in this round, on any screen", which D186 and D190 superseded («QUINA POTRA!» / «Quina potra!»).
10. **Winning card numbers.** ANIMATIONS `celebrate`: "No winning card numbers, ever". ANIMATIONS `check` puts «#123 LÍNIA Cartró correcte!» on every phone, and the projector shows «CARTRÓ #123» during the Check. The rule only holds for the Celebration screen. The docs should say so.
11. **Big cards only on tiles.** screens.md › Collapsed cards and ANIMATIONS `line-card` limit «LÍNIA!» / «QUINA!» to tiles ("never on the opened card"), which leaves the one-card phone with no announcement. Nobody decided that explicitly.
12. **Terminology.** screens.md uses "Interval" throughout ("the Interval included"); GLOSSARY › Break says to avoid "Interval".
13. **Sound map vs code.** The Sound map lists "the cue blip (the Shuffle, the stand-up)". The stand-up has it; the Shuffle doesn't. This is a code gap, not a doc conflict, but the map doesn't flag it as missing.
