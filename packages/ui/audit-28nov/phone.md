# Audit: the player app (apps/player), 28 Nov

By audit-phone. Read-only: nothing changed, committed or pushed. Every process I started has stopped, and my worktree is removed.

## What I checked

- **Code:** a clean worktree of origin/main at **49a962b7**, which contains a30542e7 (two handoff-only commits after it). Built with `vite build` and served by the relay with `--dist` on port 5850.
- **Boards:** the Player app page's 30 boards, plus the hand-drawn versions agreed before the 28 Nov redraw (`temp/design-canvas/look/backup-pre-redraw-28nov/`, 24 Mobil-* files) and the Archive's «Picked:» / «Built» boards.
- **Board drift:** I re-ran the board snapshotter (`gen/phone_snap.mjs`, all 147 shots, from a scratch copy, so the canvas was not touched) against today's app. Then I pixel-diffed every shot against the snapshot the published boards use.
- **A real local Game, with a phone following it:**
  - The setup: the engine page (`/show/show.html?fresh=1&auto=0&mute=1&pace=8&queue=…`), a tablet driving it over the protocol, and a phone at 390 × 844 (touch, Android user agent) on `/player/?feed=relay#/26/12`.
  - The phone added card #34 with the pad, then followed Before, round 1's Intro and Shuffle, the landings, Parlem, Suspense, a Line claimed, checked and celebrated (its own), 25 s with the browser offline, a reload, a Bingo (its own), the Descans, and round 2's Intro and first landing.
  - It opened Premis, Horari and Ajustos before the start, during play and in the Descans.
- **Spot checks:** 320 × 640 and 430 × 932.
- **iOS 18:** by reasoning, from `packages/ui/baseline.ts`, the built CSS and JS, and the source.
- **Requirements against the code:** a helper did this; its report is `phone-reqs.md` next to this file. I use its findings below and say where I confirmed them live.

### Screenshots

All under `temp/audit-28nov/`:

| Folder | What it holds |
|---|---|
| `boards/now/<Board>.png` | The 30 published boards as rendered |
| `boards/pre/<Board>.png` | The hand-drawn boards before the 28 Nov redraw |
| `boards/pre-singles.png` | Six of those cropped side by side |
| `boards/archive/` | The Archive's Picked / Built boards |
| `snapgen/snaps/<shot>.png` | Today's app, re-shot with the boards' own script |
| `snapdiff/<shot>.png` | Old snapshot \| new snapshot \| red = differing pixels; only shots that differ by more than 1 % |
| `snapdiff.txt` | The share of differing pixels, for every shot |
| `game/NN-*.png` | The real-Game run, 41 frames; `game/sheet-*.png` are contact sheets |
| `game1/` | The first run, which stopped when the relay crashed (bug B4) |
| `live/t*.png` and `live/sheet-t*.png` | Targeted live checks: the pad, Celebrations, the QR layering, the overlaps, 320 / 430 px |

## Key fact about the boards: the snapped boards cannot show a gap

**28 of the 30 Player app boards are DOM snapshots of the app.** `mobil_boards.py` composes them from `phone_snap.mjs`. **Mobil-Premis-D244** is a hand-drawn drawer over snapped screens (`premis_d244.py`).

- **No drift since the snapshots:** 92 of 147 shots are pixel-identical to today's app. The others differ only in animation timing: beams, garland lights, a mark caught mid-drop, the peek ring (see `snapdiff.txt`). So each snapped board "matches the app" because it is the app, as of the snapshot.
- **What a snapped board cannot do:** it is not a design reference, and it can't reveal a gap. A gap shows up only in four places:
  1. hand-drawn parts inside a board: the card-types panel, the camera switch, the browser's own dialogs, the system bars;
  2. the hand-drawn boards the user agreed to before the redraw, now in `backup-pre-redraw-28nov`. The redraw replaced them with the app's look, and each board's «Changed since the old board» note lists what was dropped;
  3. frames whose demo or fixture is wrong, so the board shows something other than its caption;
  4. behaviour no demo reaches, such as a real Game, a real network or Safari 18.

**Hand-drawn parts inside the Player app boards:**

| Board | What is drawn by hand |
|---|---|
| Mobil-Afegir-QR | ② the browser's camera prompt; ③ the camera switch (**not built**) |
| Mobil-Abans | ③ the card-types panel (**not built**), injected into the DOM; ② the start-time line, injected (the code exists in `NowPanel.svelte:78-84`, but no demo reaches it) |
| Mobil-Inici-Buit-Historial | ① composed: words and the empty Historial injected into the spin demo |
| Mobil-Instal-la | ③ Chrome's install dialog |
| Mobil-Inici-Vores | the system bars and the safe-area lines |
| Mobil-Premis-D244 | the whole drawer, with the real 2025 data |
| Mobil-Teva-Final | the timeline bar |

## Every board

"Built" means today's app matches the board's phone frames. The notes give what differs, what's wrong in the board itself, and what the hand-drawn version it replaced had.

| # | Board | Verdict | Notes | Screens |
|---|---|---|---|---|
| 1 | Mobil-B-J2 | **Built as drawn**, but the board has two errors | Frame ⑤ shows «#6» while the caption says «36»: the snapshotter's `tap('3')` hit another button. Live, the pad types 36 correctly (`live/t1-pad-36.png`).<br>③ Horari shows «Primer descans» and «Segon descans»: **D192 says one «Descans»**, so the agreed board carries a superseded decision (the code too: `strings.ts:227`). | `boards/now/Mobil-B-J2.png`; `snapgen/snaps/home-*.png`, `horari.png`, `ajustos*.png` |
| 2 | Mobil-D90 | **Partly built** | The over-drawers flash and particles and the Celebration closing Horari are built.<br>⑥ "a Celebration leaves the typed pad open" is not shown: the demo can't do it (its caption says so). Only the code (`drawersOnCelebration`) backs it.<br>⑤ «La teva línia!» shows a card with **no complete row** (fixture bug F1).<br>①② Horari under the yourSong demo has no breaks and no "~" times for future rounds. | `boards/now/Mobil-D90.png`; `snapgen/snaps/ys-*.png`, `cel-horari.png` |
| 3 | Mobil-Afegir-Estats | **Built**, with a wording gap; frame ① is wrong | ① claims «Ja el tens: és el cartró d'Àvia», but the frame shows an **empty number field** (the snapshotter's taps failed). Live, «Ja el tens» works (`live/t2-pad-owned.png`).<br>② «Descartar el #88?» with «Continuar» / «Descartar» is the wording **D188 / screens.md reject** (they want «Descarta els canvis» / «Segueix editant»): `strings.ts:78-83`. | `snapgen/snaps/pad-owned.png`, `pad-leave.png`; `live/sheet-t2.png` |
| 4 | Mobil-Afegir-Altre | **Built as drawn** | pad-saved, pad-saved-first, pad-again and pad-max are identical live. «+ Un altre» / «Fet» work in the real Game too (`game/05-pad-saved.png`, `06-after-add.png`). | `snapgen/snaps/pad-saved*.png` |
| 5 | Mobil-Afegir-QR | **Partly built** | **Camera switch not built** (tagged on the board).<br>The agreed hand-drawn board showed three readable levels (Ajustos › Afegir cartró › Escaneja el QR). In the app, the scanner covers the pad almost entirely: the pad's top is 138 px, the scanner's 150 px (`live/t5-qr-over-pad.png`), so the middle level can't be seen.<br>In the snapped frames the scanner looks short, with the home's corners below it. That's a snapshot artifact: live it reaches 844 px.<br>The camera paths (found / denied / other QR) were shot with a fake camera only; **no real-device scan was tested here**. | `boards/pre/Mobil-Afegir-QR.png` against `boards/now/…`; `snapgen/snaps/qr-*.png` |
| 6 | Mobil-AnyPassat | **Built**, with UX gaps | ③ the «El cartró de l'any passat» drawer is a dead end: its text says "escaneja'l, o afegeix-lo pel número" but it has **no button** (`live/t5-legacy-drawer.png`).<br>① the notice's «+ Cartró» and the floating «+ Cartró» show together (D290's "never offered twice" spirit). At rest the floating pill sits over the Historial \| Cartrons switch. | `snapgen/snaps/legacy*.png` |
| 7 | Mobil-Inici-Buit-Historial | **Partly built** | ① is composed. In the real Game, the round's first Spin showed «Encara no ha sonat cap cançó.» (`game/12-first-spin.png`). «Quina sonarà?» shows only in the drum's late `waiting` phase (`Reel.svelte:247`), not "while it turns" as captioned.<br>② built (D290). | `snapgen/snaps/first-spin.png`, `before.png` |
| 8 | Mobil-Inici-Buit-Cartrons | **Built as drawn** (D290) | ② says the camera is "stacked over «Afegir cartró»"; as in row 5, the pad underneath is not visible. | `snapgen/snaps/empty-*.png` |
| 9 | Mobil-Abans | **Partly built** | ① built.<br>② the start line is composed; the code exists but was never seen running.<br>③ **card types and prices not built** (screens.md «Not built yet»).<br>**Dropped from the agreed hand-drawn board:** the countdown ring (25M) with the nino. The redraw note simply says "no 25M countdown ring". I found no decision removing it: **ask the user**. | `boards/pre/Mobil-Abans.png` against `boards/now/Mobil-Abans.png` |
| 10 | Mobil-Abans-Cartro | **Built in the demo, but not in a real Game** | The board says "before any Landing a card has no marks and no count pill". In the real Game before the start, card #12 shows a **«4» count pill** (`game/01-before.png`, `03-before-cartrons.png`).<br>Opened from the card link, the home also loads **scrolled**: the header and the cog are hidden under the garland (`game/01-before.png`). | `snapgen/snaps/before-cards.png` |
| 11 | Mobil-Comenca | **Built** | At rest, the floating «+ Cartró» covers the Historial \| Cartrons switch at the end of the content (frame ②).<br>Dropped from the hand-drawn board: sponsor logos on the prize rows (the app has none on phones; D285 was decided for the projector). | `snapgen/snaps/shuffle.png`, `round-start.png` |
| 12 | Mobil-Comprovacio | **Built** | ② «#123 Línia Cartró correcte!» while the phone's own #123 tile shows **one mark** (fixture bug F1).<br>The real Game's Check ribbon is fine (`game/21-check.png`). | `snapgen/snaps/check*.png`, `notice.png` |
| 13 | Mobil-Celebracio | **Built** | The confetti is a canvas, so snapshots never show it; live it is there, small and sparse (`live/sheet-t4.png`).<br>The screen is half empty between «Tancar» and the ninos. | `snapgen/snaps/cel-other.png`, `cel-bingo-other.png` |
| 14 | Mobil-Celebracio-Teva | **Built**; both frames show impossible cards | «La teva línia!» on a card with no complete row, and «La teva quina!» on #57 with 7 of 12 marked (fixture bug F1). In the real Game both Celebrations show the completed card correctly (`game/23-*.png`, `36-*.png`). | `snapgen/snaps/cel-mine.png`, `cel-bingo-mine.png` |
| 15 | Mobil-Descans | **Built**; the price is **not built** (tagged) | Dropped from the hand-drawn board: the 5M countdown ring with the nino (as in row 9). | `snapgen/snaps/interval*.png` |
| 16 | Mobil-Pausa | **Built as drawn** | — | `snapgen/snaps/pause*.png` |
| 17 | Mobil-Final | **Built**, with a known bug baked into the board | The header reads **«QUINA QUINA! 3»** (the plan's title plus the round; the board's own note calls it "§9 bug 3").<br>«El teu premi d'aquesta nit» (agreed hand-drawn) is replaced by a per-round summary. The note says "Open point 3: the code is drawn", so that's **unconfirmed by the user**.<br>The floating «+ Cartró» still shows after the night. | `snapgen/snaps/after*.png`; `boards/pre/Mobil-Final.png` |
| 18 | Mobil-SenseConnexio | **Built in the demo; fails in a real Game** | With the phone's browser offline for 25 s during the Game, **no strip, no veil, nothing** (`game/29-offline-3s.png`, `30-offline-25s.png`). There is no heartbeat and no `offline` listener (bug B1). | `snapgen/snaps/offline.png`, `reconnect-*.png` |
| 19 | Mobil-Desgraciat | **Built as drawn** | 320 px is checked (`live/t5-320-desg.png`). | `snapgen/snaps/desg*.png` |
| 20 | Mobil-Desgraciat-Potra | **Built as drawn** | — | `snapgen/snaps/desg-mine.png`, `desg-other.png` |
| 21 | Mobil-Desgraciat-Cau | **Built as drawn** | Diffs are timing only. | `snapgen/snaps/dc-*.png` |
| 22 | Mobil-Calaixos-Moviment | **Built as drawn** | — | `snapgen/snaps/mo-*.png` |
| 23 | Mobil-Tambor-Petit | **Built as drawn** | Diffs are timing only. | `snapgen/snaps/tp-*.png` |
| 24 | Mobil-Teva-Final | **Built**; the docs disagree | The particles are card marks plus a comet (ANIMATIONS, D237). D74 and screens.md still say shooting star, corn and hearts (`phone-reqs.md` §3.1). | `snapgen/snaps/tf-*.png` |
| 25 | Mobil-Ajustos-Dialegs | **Built as drawn** | — | `snapgen/snaps/aj-*.png`, `link-added.png` |
| 26 | Mobil-Instal-la | **Built**, but only seen through forced review links (`&install=`) | Not tested: Chrome's real prompt and a real iPhone. The Catalan Safari labels are still U19. | `snapgen/snaps/in-*.png` |
| 27 | Mobil-Inici-Moviment | **Built in Chrome** | On iOS 18 the Drum collapse is a step, not a scrub (see iOS 18 below). | `snapgen/snaps/sw-*.png`, `dc-scroll-*.png`, `ch-*.png` |
| 28 | Mobil-Inici-Vores | **Built in Chrome**; (a) or (b) still open for the user | (b), "fade before the strip", **does not exist on iOS 18**: it falls back to (a). In the real Game, the switch peeks half-cut under the strip (`live/t2-pad-done.png`). | `snapgen/snaps/ee-*.png` |
| 29 | Mobil-Plegats | **Built as drawn** | «LÍNIA!» / «QUINA!» appear only with 2+ playing cards, so a one-card phone never announces (`collapsed.ts:22-24`; nobody decided this). The real Game confirms tiles, big cards, dashes and the scribble (`game/20-*`, `35-*`). | `snapgen/snaps/pl-*.png` |
| 30 | Mobil-Premis-D244 (hand-drawn drawer) | **Built** (structure, selector, locked «Premis sorpresa», «La següent», all-secret, stacked from Horari) | The app's drawers (`snapgen/snaps/premis*.png`, `mo-stack.png`) match the drawn one with demo data. «Guanyat amb el teu cartró» and «Ja té guanyador» exist (`strings.ts:203-205`).<br>The real 2025 hampers and logos are not in any demo. In the local Game they could not show either (bug B5). | `live/sheet-premis.png` |

**The Archive's agreed picks**

| Board | Status |
|---|---|
| Component-Icona-Opcions (D: the B and C mix) | Built: round chips, labels, the faded taken icon. |
| Component-Cantonades-Estils (B) | Built. |
| Component-Regal-Opcions (C) | Built. |
| Mobil-Calaixos-Jerarquia (J2) | Built. |
| Mobil-Premis-Reals and -Secret (D244) | Built (see row 30). |
| Mobil-Teva-Opcions (D74 blend) | Built, with the later particle change (row 24). |
| Mobil-Plegats-A-Graella, -A-Estats, -A-Toc | Built: `pl-*` shots and the real Game. |

## Bugs found

Severity is for the night. "Live" means I saw it in the running app; "code" means it was read from source (by me or the helper).

### High

**B1. A dead connection is never shown** (live).
- What I saw: the phone's browser went offline for 25 s mid-Game, and the app showed no «Sense connexió» strip and no veil. Back online, nothing showed either.
- Why: `cloud-feed.ts:1-3` says it outright: "no hello, no heartbeat, no polling". There is no `offline` listener and no silence timeout on an open socket.
- Effect: a half-open socket on venue wifi or 5G freezes the phone on stale songs with no warning. This breaks screens.md ("offline it keeps its normal screens, visibly marked as offline") and D225's 20 s rule in practice.
- Caveat: my test used browser offline emulation, which leaves an open WebSocket half-alive, much as a flaky network does. A real phone test should confirm it.

**B2. During the next round's Intro (and the Descans), the cards show the round that just ended** (live and code).
- What I saw: at round 2's Intro, both cards still showed round 1's marks (`game/40-round2-intro.png`). They cleared only at round 2's first landing (`41-…`).
- Why: `logic/view.ts:115-128` follows the last started round. Per the helper, in the Desgraciat → Descans → Especial stretch this puts every normal card under «No juguen en aquesta quina», and the special card stays on its Desgraciat side.
- Effect: this is exactly when people turn their paper cards over (U50 "current or coming").

**B3. «Sons» off doesn't survive a reload** (code, from the helper).
- Why: `device/sounds.ts:62` starts enabled, and `model.svelte.ts:492` syncs only on the next save.
- Effect: a muted phone clicks and blips again after reopening, while its switch says off. Admin's default changed mid-night doesn't reach open phones.

**B4. The relay crashes on a failed spawn** (live; Backend's code, `apps/show/relay/server.ts:~301`).
- What I saw: the engine page asked for a stretch render, `spawn(PYTHON …)` hit ENOENT (no `tools/prep/.venv` in the worktree), and `stretchRender` had no `child.on('error')`. The unhandled `error` event killed the whole relay mid-Game: engine, tablet and phone all dropped (`game1/`, which ends at frame 31).
- Compare: `runAnalysis` at line 271 handles `error`.
- Effect on the night: any spawn failure (python missing, a moved venv, EMFILE) takes down the show.

### Medium

**B5. On the relay feed the phone has no Game plan** (live and code). `relay-feed.ts:33-34` uses `new LocalPlanStore()` (this browser's localStorage) instead of the relay's `/cloud/plan.json` or `relay.plan` pushes. With a plan that had round 1's prizes, the phone showed:
- in Premis, «Línia 0 premis · Per anunciar» next to «Guanyat amb el teu cartró» (`game/26-play-premis.png`, `39-interval-premis.png`);
- in Horari, only «Quina 1» and «Fi» (`27-play-horari.png`);
- in the Intro, Shuffle and Descans, «Per anunciar» prize cards.

It is a dev-only path (production phones use the cloud feed, which I couldn't run here; the e2e covers it). Still, any laptop-only rehearsal shows broken prizes, and there is **no LAN fallback for phones** if the venue loses internet: `chooseFeed` allows the relay feed only on the laptop itself (`feed.ts:94`).

**B6. Count pill before the first landing** (live). In a real Game before the start, the card shows «4» (`game/01-before.png`). Mobil-Abans-Cartro says no pill before any Landing; the demo hides this.

**B7. Horari** (code; D192):
- the night's one break shows as «Primer descans» (`strings.ts:227`, with a test asserting it);
- the "~" times are the plan's, never shifted when the night runs late (`timeline.ts:43-57`);
- before the night, Quina 1 already carries «ARA» in Horari and Premis (`game/07-*`, `08-*`).

**B8. The pad's leave question uses the rejected wording** (`strings.ts:78-83`): «Continuar» / «Descartar» instead of D188's «Descarta els canvis» / «Segueix editant». ANIMATIONS `pad-leave` still specifies the old words.

**B9. The end-of-night header reads «QUINA QUINA! 3»** (the plan title plus the round number), as drawn on Mobil-Final.

**B10. The agreed boards show impossible states** (fixtures and snapshotter). This matters because the user reviews these boards as "what's built":
- F1: the `celebration` fixture lacks the winning song 69 (`packages/ui/fixtures/states.ts:809-818` builds from `baseState` with `FIXTURE_LANDED`, not `FIXTURE_LANDED_LINE`). `celebrationBingo` names #57, which is 7/12 marked. `checkValid` says #123 is valid while the phone's #123 has 1 mark.
- The snapshotter's text taps (`tap('1')`, `tap('3')`) hit the wrong buttons: Afegir-Estats ① has no number, and B-J2 ⑤ shows «#6».

**B11. The QR scanner stack hides the pad** (row 5). The three levels aren't legible as agreed.

**B12. The legacy drawer is a dead end** (row 6), and the floating «+ Cartró» sits over the switch at rest (Intro, legacy) and duplicates the notice's button.

**B13. Opening a card link loads the home scrolled**, with the header and cog under the garland (`game/01-before.png`).

### Low

- B14: the first Spin of a round says «Encara no ha sonat cap cançó.», not «Quina sonarà?» as Mobil-Inici-Buit-Historial captions it.
- B15: at 320 px the pad opens with a visible focus ring on ✕ (`live/t5-320-pad.png`).
- B16: «LÍNIA!» / «QUINA!» appear only with 2+ cards (helper, `collapsed.ts:22-24`).
- B17: the Shuffle's cue blip never plays (helper).
- B18: card icons repeat from the 11th card (helper).
- B19: a feed with another `edition` wipes the phone's cards (helper, `storage.ts:188-191`).
- B20 (doc): packages/ui/HANDOFF.md lists `/26/123` as the player page, but the relay returns **404** for it (dist mode; Vite MPA has no rewrite either). Locally the player is at `/player/#/26/123` or `/player/?demo=…`.

### Checked and fine

- The pad: smart keypad, «Ja el tens», D241 «+ Un altre» / «Fet».
- The real Line and Bingo, their Celebrations and the «LÍNIA!» / «QUINA!» tiles.
- The Check ribbon.
- A reload mid-Game repaints the live state at once with no welcome flash (D225, `game/32-reload-250ms.png`).
- The your-song gold look across consecutive songs.
- Suspense and Hold.
- Drawers closing on a Celebration.
- 320 and 430 px layouts hold.
- `npm run test:ui`: 1042 of 1042 pass. All are pure-logic tests, and none mounts a component or a browser. That is why the suite was green while the realistic test went badly.

## iOS 18 (Safari 18.0–18.x), by reasoning

There is no Safari 18 engine here: Playwright's WebKit is newer, as baseline.ts itself says. Findings from `baseline.ts`, the built player CSS and JS (`player-built.css`, `player-built.js` in this folder) and the source.

**Guarded correctly (no content hidden):**
- Every scroll-driven animation in the build is inside `@supports (animation-timeline: …)`, with `@supports not` fallbacks: drum-words-hit, drum-collapse, home-scroll / strip-fade, history-edge.
- Anchor positioning is inside `@supports (anchor-name: --a)`, with a `not` branch.
- `closedBy` is feature-tested (`lightDismiss` fallback).
- `showPopover`, `requestIdleCallback` and `navigator.vibrate` are tested before use.
- `startViewTransition` with types is guarded, per the lint.
- `BarcodeDetector` falls back to jsQR.
- `-webkit-user-select` and `-webkit-touch-callout` are present, and `navigator.audioSession` is set.
- No other post-18 JS API appears in the bundle: Iterator helpers, `Promise.try`, base64 on Uint8Array, `RegExp.escape`, Temporal, `moveBefore`, `scheduler`, `CloseWatcher` and `URL.parse` are all absent.

**What still differs or risks on iOS 18:**
1. **The look is reduced, by design of the fallbacks.**
   - No strip-fade: content runs under the stuck strip and shows in the gap below the garland, which is option (a), still open on Mobil-Inici-Vores.
   - The Drum collapse snaps at once instead of following the scroll.
   - No Historial edge shrink.
   The user's iPhone will never look like the Chrome-snapped boards; no board shows the iOS 18 look.
2. **Popover is dated 18.3 for iOS** (baseline.ts). On iOS 18.0–18.2, `YourSong.svelte:60-61` skips `showPopover`, so the your-song flash and particles stay **under** open drawers. D90 is not met there.
3. **Screen Wake Lock in an installed iOS web app:** WebKit only fixed wake lock for Home Screen apps in iOS 18.4, to my knowledge (worth confirming with the Baseline data). An installed player on iOS 18.0–18.3 may let the screen sleep mid-game, failing the grandmother test's "the screen stays on". In the Safari tab it works from 16.4.
4. **No back-swipe closes a drawer** (helper: drawers add no history entries), so the iOS edge-swipe navigates the page back instead.
5. The lint only checks that a guard exists, not that the fallback looks right. Nobody has seen the fallbacks on a Safari 18 device.

## Biggest gaps first

1. **The real-network path is unproven, and the offline state is never shown (B1).** Phones freeze silently on a bad connection. Add a heartbeat or silence timeout and test on real phones on the venue network.
2. **Wrong round on the cards during Intros and the Descans (B2)**, exactly when players turn their paper cards over.
3. **The relay crashes on a spawn error (B4, Backend).** One failure kills every screen mid-show.
4. **Laptop-only rehearsals show broken prizes and schedule (B5), and phones have no LAN fallback without internet.** Decide whether the relay feed should serve phones (plan B) and give it the plan.
5. **The boards can't be trusted as a check.**
   - 28 are snapshots of the app, so they always "match".
   - Several frames show impossible or wrong states (B10).
   - Agreed hand-drawn designs were quietly replaced in the redraw: the countdown rings (Before, Descans), «El teu premi d'aquesta nit», the readable three-level QR stack.
   - Mobil-B-J2 still shows two Descans against D192.
   Review the «Changed since the old board» notes with the user. Fix the fixtures and the snapshotter's taps.
6. **iOS 18 users get a different, untested home (strip, collapse), possibly no wake lock when installed, and the your-song layer under drawers on 18.0–18.2.** Test on a real iOS 18 iPhone.
7. **«Sons» off doesn't persist (B3).**
8. **Not built:** card types and prices before the Game (Mobil-Abans ③, screens.md), the price in the Descans, the camera switch. Before the Game the home also lacks the rounds and round 1's prizes (only in drawers).
9. **Wording and decision drift:** pad-leave words (B8), «Primer descans» (B7), the «QUINA QUINA! 3» header (B9), the count pill before the start (B6).
10. **Smaller UX:** the legacy dead end, «+ Cartró» over the switch, the link opening scrolled, the one-card phone never announcing «LÍNIA!» (B11–B16).
11. **No component or browser tests.** The 1042 tests can't catch any of the above.
