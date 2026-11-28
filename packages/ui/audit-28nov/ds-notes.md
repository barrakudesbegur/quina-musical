# DS boards vs the /ds/ gallery: audit notes (audit-admin/ds)

Code: clean checkout of origin/main at `d3634e28` (`.../scratchpad/wt-audit-admin`). Boards: `temp/design-canvas/look/project/DS-*.dc.html` (24 files, mtimes 28 Nov 03:13–14:04).
Method: (1) pulled every board's component headers, h3s and figcaptions (data URIs, scripts and svgs stripped); (2) matched each figcaption against the source of `apps/ds/**` (normalised text). The 158 misses were then checked by hand: about 110 are captions the gallery builds from templates (`${variant} · ${color}`, the ring states, the nino poses, the token groups, the garland's `caption()`), so they are covered. The rest are listed below as board-only. (3) Every `Code:` path the boards cite was checked to exist in the checkout. All of them exist; the four apparent misses were parsing artefacts: `particles.css` lives in `packages/ui/components/`, `hold/` in `packages/ui/components/hold/`, and `.ds-ribbon` is a selector.

Gallery files: `apps/ds/Gallery.svelte` (palette, A1 Button, R1–R10), `apps/ds/sections/Tokens.svelte`, `apps/ds/PanelsSection.svelte` (C1–C4), `apps/ds/sections/Buttons.svelte` (A2–A9), `apps/ds/sections/Icons.svelte` (H1), `apps/ds/sections/CardsSongs.svelte` (D1–D6), `apps/ds/sections/TilesSection.svelte` (D7, D8), `apps/ds/sections/EmptyCardsSection.svelte` (D290), `apps/ds/StatusSections.svelte` (E1, E3–E6, F1, F2, G1–G5) + `sections/HeatGarland.svelte` (E2) + `sections/ConsoleFinale.svelte`, `apps/ds/ControlsGallery.svelte` (B1–B10, D-e), `apps/ds/sections/ConsoleMenu.svelte`, `apps/ds/sections/ConsoleNow.svelte`.
Densities: console light/dark, `?density=phone`, `?density=projector`. There is no admin density. Some sections are gated by density: `CardsSongs` and `ButtonsFamily` are hidden on the projector, `ControlsGallery` too, E5 shows on the console only, G5 on the projector only, and `TilesSection` and `EmptyCards` on the phone only.

Verdict key: **covered** = the gallery draws the same specimens · **partly** = some specimens drawn, some not · **gallery-missing-but-in-code** = the code draws it, the gallery doesn't · **not in code** = nothing in the code draws it.

Overall answer: **for the generic components, yes.** Every generic component on the DS boards has a gallery section with the same variant and state cells, word for word. The boards themselves are snapshots taken from /ds/. The gaps are (a) the projector's scenes and the app-level effects that the boards paste in as screenshots or old images, (b) specimens the boards freeze mid-interaction that the gallery only offers live, and (c) one proposal with no code at all.

---

## Per board

### DS-Tokens-1 · Colour (§1.1 palette slots, §1 colours, card identity, card-type pastels, console themes)
- Board: the palette-slot table; colours by name (20 groups); 31 theme roles; the 10 card identities with CardMark plus the marks' wood; the card-type pastels (normal, especial, unknown); the console's light/dark table.
- Gallery: `Gallery.svelte` › "Palette slots (§ 1.1, D210)"; `sections/Tokens.svelte` › Colours by name, Theme roles, Card identity, Card-type pastels, Console themes (console density only). It reads every value live from the CSSOM (`sections/tokens.ts`).
- Code: `packages/ui/ds/palette.css`, `packages/ui/tokens.css`, `apps/console/theme.css`, `packages/ui/data/card-types.ts`, `apps/player/components/CardMark.svelte`.
- Verdict: **covered**.

### DS-Tokens-2 · Type, space, shadows, motion (§1.2–§1.5)
- Board: font families and weights, the `--text-*` and `--stage-text-*` ramps, title stroke/drop/tracking, `.unit`; space, radius, line and tap scales; shadows and edges (`--shadow-piece*`, `--edge-piece*`, `--shine-panel`, `--shadow-floating`, `--edge-3d*`, the starry sky); durations, easings, layers, z-index, the resources' tokens.
- Gallery: `sections/Tokens.svelte` › Type, Space…, Shadows and edges, Motion, Layers and z-index, Design resources' tokens.
- Code: `packages/ui/tokens.css`, `packages/ui/fonts.css`, `packages/ui/layers.ts`.
- Verdict: **covered**.

### DS-Tokens-3 · Each app's own tokens
- Board: the durations and the rest from `apps/console/theme.css`, `apps/console/console.css` and `apps/player/player.css`.
- Gallery: `sections/Tokens.svelte` › App tokens (template `${app.file}: its durations (n)`).
- Verdict: **covered**.

### DS-Botons-1 · A1 Button
- Board: 9 colours; 4 variants × 3 colours; sizes xs–l; slots and icon placement, including «Destapa» with children; states (toggle off/on, dots, locked, busy, disabled); floating; long text; on the white and black cards; the same set again on the phone. Surfaces are tagged Console, Phone and **Admin**.
- Gallery: `Gallery.svelte` › "A1 · Button" plus R9/R10. Every caption matches.
- Code: `packages/ui/components/Button.svelte`, `button.css`, `types.ts`.
- Verdict: **covered** on console and phone. The **Admin** surface is not: the gallery has no admin density, and the admin loads its own `apps/admin/manage.css`, which also defines its own `.notice*` classes. Admin uses Button, Notice, Switch and TextField (`apps/admin/**`).

### DS-Botons-2 · A2 LongPressButton, A3 TwoLevelButton
- Board: LongPressButton layouts (button, solid row, plain row, long label with tag, disabled) and **3 frozen states** ("hint: a short tap shows what to do", "pressing: the fill sweeps… about half-way", "pressing, the row"). TwoLevelButton off, level 1, level 2, locked, strip keys, disabled; **"Rising: pressing: the strip fills… frozen about half-way"**; the Throw's two buttons; held on another console (D234 lock mirror).
- Gallery: `sections/Buttons.svelte` › A2, A3, "The Throw's two buttons"; the lock mirror is in `sections/ConsoleMenu.svelte` › "D234 · A two-level button held on another console".
- Code: `LongPressButton.svelte`, `TwoLevelButton.svelte`, `hold/`, `apps/console/actions.ts`.
- Verdict: **partly**. Every static specimen is in the gallery. The 4 frozen hold states exist there only as live interaction (press and hold). No static specimen draws them, so a snapshot of /ds/ can't reproduce them.

### DS-Botons-3 · A4 MiniButton, A5 CornerButton, A6 Button floating
- Board: MiniButton colours at rest, pressed gold and green with HOME, pace presets, icon-only, ring, disabled, sizes xs–l. CornerButton both corners, **pressed (held) frozen**, and **"In place: the player's home (/player/?demo=play)"**, an app screenshot. Floating: the navy preset, orange, the three card-hint pills. The empty home (D290) at 390 and 320 px.
- Gallery: `sections/Buttons.svelte` › A4, A5, A6; `sections/EmptyCardsSection.svelte` (phone).
- Code: `MiniButton.svelte`, `CornerButton.svelte`, `IconButton.svelte` (hint), `apps/player/components/EmptyCards.svelte`.
- Verdict: **partly**. Missing from the gallery: CornerButton's pressed state as a static specimen (live only), and the in-place home, which is an app screen and not a gallery cell.

### DS-Botons-4 · A7 IconButton, A8 TextLink, A9 SoundPad
- Board: IconButton framed × 6 colours, the sheet's ‹ ✕, size s and pressed, bare, floating, disabled, the phone. TextLink red, gold, long href. SoundPad gold 1-column, snow 4-column, disabled.
- Gallery: `sections/Buttons.svelte` › A7, A8, A9.
- Verdict: **covered**. Caveat: the gallery's SoundPad cells draw **line icons** (`Icon`) as their art, not the console's real multicolour `SoundIcon`. See DS-Icones.

### DS-Controls-1 · B1 Switch, B2 SegmentedControl, B3 Tabs
- Board: Switch row off/on, inline, disabled, embedded off/on, long label, and the phone. SegmentedControl radio m, tabs m, s with a disabled option, weights, l, disabled, long labels, progress 0.40, the phone. **"The Celebration's music pick with a cover (pending U157/U158)": "board · the proposal, size l with covers (not built)"**. Tabs: five wide, narrow, extras, three.
- Gallery: `ControlsGallery.svelte` › B1, B2, B3.
- Code: `Switch.svelte`, `SegmentedControl.svelte`, `Tabs.svelte`. The Celebration picker is `apps/console/components/CelebrationMusic.svelte`, which shows words only.
- Verdict: **covered**, except the music pick with covers, which is **not in code at all**. `SegmentedControl.svelte` and `control-types.ts` have no cover option. It is pending with the user.

### DS-Controls-2 · B4 Chip, B5 WiiKey
- Board: Chip colours, solid/subtle, glow, dots, value, s, customColor, and the phone's DEMPEUS/ASSEGUT. WiiKey md, sm, the D-pad, held, shake.
- Gallery: `ControlsGallery.svelte` › B4, B5.
- Code: `Chip.svelte`, `WiiKey.svelte`, `apps/console/components/WiiBadge.svelte`.
- Verdict: **covered**.

### DS-Controls-3 · B7 NumberField + NumberPad, B8 IconPicker
- Board: pad, empty with ↵, invalid, system, row, on console and phone. IconPicker with disabled tags. **"In place: the add-card pad (/player/?demo=play&open=pad): the card's mark, the ten marks"**, an app screenshot.
- Gallery: `ControlsGallery.svelte` › B7, B8. The gallery's IconPicker uses line icons, not the card marks the phone draws through its `mark` snippet.
- Verdict: **partly**. IconPicker drawing the card marks (the phone's real use) is not a gallery specimen.

### DS-Controls-4 · B9 TextField, B10 Slider
- Board: TextField m, invalid, l search, rows=2, disabled, the phone; surfaces include **Admin**. Slider under, past and at the default, disabled.
- Gallery: `ControlsGallery.svelte` › B9 (with D-e Match highlight), B10.
- Verdict: **covered** on console and phone; no admin specimen (see Botons-1).

### DS-Plafons-1 · C1 Panel, C2 PaperCard (Ticket, PrizeCard recipes)
- Board: Panel surface + kicker, snow + dashed, panel, line normal / padding s, kicker + title + actions. Tickets line, bingo, standing, empty; PrizeCard line, bingo, standing; PaperCard row and hero with a gold ring; PrizeCard on the projector.
- Gallery: `PanelsSection.svelte` › C1, C2 (the projector page shows PrizeCard only).
- Code: `Panel.svelte`, `PaperCard.svelte`, `packages/ui/recipes/Ticket.svelte`, `PrizeCard.svelte`.
- Verdict: **covered**.

### DS-Plafons-2 · C3 Sheet, C4 Dialog
- Board: **opened** sheets on the phone (bottom, left, right, sticky footer, stiff form, **stacked**: "the one under scales to .94 and dims"). **"In place: the player's drawers (/player/?demo=play&open=…)"**: Premis out of the left corner, Horari out of the right, «Afegir cartró» stiff form. The console's side-right menu. **Opened** dialogs: phone s paper «Descartar el #123?», console m with a warning, console l «Comandament».
- Gallery: `PanelsSection.svelte` › C3, C4. Every sheet and dialog sits behind an «Obre…» button and opens live; the stacked sheet comes from «Apila'n un altre».
- Code: `Sheet.svelte`, `sheet-drag.ts`, `Dialog.svelte`.
- Verdict: **partly**. Every board specimen can be reached live, but no static open specimen exists, and the 3 in-place drawers are app screens.

### DS-Cartrons-1 · D1 PlayerCard, D2 CardGrid · CardCell
- Board: PlayerCard (playing, glow, standing, sunk, white, black, orange halo, 4 long names, 4 compact); the console's Check grid in the user's order; the phone's grid with mark-bob; CardMark's ten marks; **"On the projector: the stage's Check grid: 208 px cells, the equaliser, the lifted mark": "board · the projector's Check grid, kept as agreed"** (an old-board image).
- Gallery: `sections/CardsSongs.svelte` › D1 (phone), D2 (console Check grid, phone grid with mark-bob, long titles). The ten marks are in `sections/Tokens.svelte` › Card identity.
- Code: `PlayerCard.svelte`, `CardCell.svelte`, `card-looks.ts`, `apps/player/components/CardGrid.svelte` (the gallery doesn't use it: it builds the grid from `CardCell` + `card-grid`/`check-grid` classes), and the projector's grid in `apps/stage/render/check.ts`.
- Verdict: **partly**. The projector's Check grid is **gallery-missing-but-in-code**: `CardsSongs` is hidden on `?density=projector`, and the gallery only says in a note that "the projector's Check uses the same parts at its scale".

### DS-Cartrons-2 · D3 MiniCard + TypeSideLabel, D4 Cover
- Board: MiniCard label (normal, especial), chip, band; TypeSideLabel pending, ok, wrong type, «Desgraciat». Cover ladder xs–xl, no song, missing file, blurred. **"The error music's cover open: dropped or still to build?": "board · the error music: #A82028 with the white note (no code draws it)"**.
- Gallery: `sections/CardsSongs.svelte` › D3, D4.
- Code: `MiniCard.svelte`, `TypeSideLabel.svelte`, `Cover.svelte`, `cover.ts` (`COVER_SIZES` = 28/52/72/108/132, matching the board).
- Verdict: **covered**, apart from the error-music cover, which is **gallery-missing-but-in-code**. The board's "no code draws it" is **wrong** at origin/main: `apps/console/console.css` › `.now-playing .now-playing__tile[data-music='error'] .song-tile__cover` (and `.now-line .cover--missing[data-music='error']`) draws it in `--color-red-edge` = `#a31d27` with a white note (in since `eb2e89e3`, 27 Nov). The board's colour (`#A82028`) is not a token. `ConsoleNow.svelte` has no checkFailed specimen, so the gallery never shows it.

### DS-Cartrons-3 · D7 CardTile, D8 Scribble
- Board: 11 CardTile states; Scribble in its 3 places × gold/ink.
- Gallery: `sections/TilesSection.svelte` (phone).
- Code: `CardTile.svelte`, `Scribble.svelte`, `apps/player/components/CardTiles.svelte`.
- Verdict: **covered**.

### DS-Cancons · D5 SongTile, D6 Drum
- Board: SongTile row, tile, feature, compact, result, mini, headline (long titles). The console compositions NowPlaying (4), NowLine, NextSong (3). The phone's drum (10 stills). **"The projector's drum": "board · the projector's drum, kept as agreed"** (an old-board image).
- Gallery: `sections/CardsSongs.svelte` › D5, D6 (phone Reel); `sections/ConsoleNow.svelte`.
- Code: `SongTile.svelte`, `apps/player/components/Reel.svelte`, `apps/player/logic/drum.ts`. The projector's drum is `apps/show/engine/src/wheel/drum.ts` + `apps/show/engine/css/drum.css`.
- Verdict: **partly**. The projector's drum is **gallery-missing-but-in-code**: there is no projector drum specimen anywhere in `apps/ds`. SongTile's surfaces include Projector, but the gallery's SongTile is hidden on the projector page; its "tile (the projector's last three)" is drawn at console density.

### DS-Estat-1 · E1 Ring, E2 Garland + HeatMeter, E3 Toast
- Board: the 14 ring states (the `RING_STATES` list in `apps/console/logic/now-ring.ts`, all of them), framed 170/390 px, "Before the start" (5, labelled not built), garland patterns × moods on the projector and the phone, HeatMeter zones, Toast (6) and the phone.
- Gallery: `StatusSections.svelte` › E1 (including "Before the start (not built yet)"), E3; `sections/HeatGarland.svelte` › E2.
- Code: `Ring.svelte`, `ring-looks.ts`, `packages/ui/motion/garland.ts`, `apps/player/components/Heat.svelte`, `apps/stage/render/garland.ts`, `apps/console/components/HeatMeter.svelte`, `Toast.svelte`.
- Verdict: **covered**. Note: the "Before the start" ring exists as a Ring specimen only. The projector's Before (`apps/stage/render/before.ts`) uses a `CountdownChip`, not this ring, so that screen use is **not in code** (the board and the gallery both say so).

### DS-Estat-2 · E4 Notice, E5 Verdict, E6 PriceTag
- Board: Notice (7, plus the phone). Verdict on the console: pass, fail. **Verdict on the projector, "kept from the agreed board": fail (huge ✗, red rays, squashed nino), review («REVISIÓ MANUAL» plate −2°, magnifier), discarded (the card fades)**, all old-board images. PriceTag tag, line, unknown, and at the projector's scale.
- Gallery: `StatusSections.svelte` › E4, E5 (console only), E6 (all densities).
- Code: `Notice.svelte`, `apps/console/actions.ts` › `VERDICT_LOOKS`, `apps/console/components/CheckPanel.svelte`, `PriceTag.svelte`. The projector's verdict is `apps/stage/render/check.ts` (the review plaque, the layered ✗, the fallen nino, `data-discarded`).
- Verdict: **partly**. The projector's verdict (3 looks) is **gallery-missing-but-in-code**.

### DS-Final · F1 Nino, F2 the finale's stage and row
- Board: the 27 poses (`NINO_POSES` in `packages/ui/ninos.ts`, 27), the looks, NINO_FOR, the projector's scale. **"The projector: the stage's demos, at 55 %": the finalists in cones of light, three fall at «Love Story», «Salvats!», the last one standing wins** (stage screenshots). The console's Dempeus row (4) and the row's head (3).
- Gallery: `StatusSections.svelte` › F1, F2 head; `sections/ConsoleFinale.svelte` › the Dempeus row (console).
- Code: `Nino.svelte`; `apps/stage/render/finale.ts`, `apps/console/components/FinaleStage.svelte`.
- Verdict: **partly**. The projector's finale stage is **gallery-missing-but-in-code** (no projector finale in `apps/ds`).

### DS-Icones · H1 Icon
- Board: the throw songs' two icons in every look; the registry beside a 17 px text; on the night (phone). **"The sticker icons: StickerIcon, the gift with the tall lid, the alarm clock, on the corner buttons"**. **"The multicolour Efectes icons, D35: the console's SoundIcon, in place on the Efectes tab (/console/?demo=play)"**, an app screenshot.
- Gallery: `sections/Icons.svelte` › the throw songs' icons, the registry.
- Code: `packages/ui/icons/line.ts`, `Icon.svelte`, `StickerIcon.svelte`; `apps/console/components/SoundIcon.svelte` + `apps/console/sound-icons.ts`.
- Verdict: **partly**. StickerIcon appears only inside CornerButton (A5); it has no section of its own and `apps/ds` never imports it. SoundIcon is **gallery-missing-but-in-code**: `apps/ds` never imports it, and A9's SoundPad uses line icons instead.

### DS-Adhesius-1 · G1 StickerTitle, G2 Plate
- Board: the StickerTitle ramp (projector, console and phone); Plate colours × use (projector, console).
- Gallery: `StatusSections.svelte` › "G1 · StickerTitle, G2 · Plate" (all densities).
- Verdict: **covered**.

### DS-Adhesius-2 · G3 Rays, Confetti, the your-song effect; G4 SponsorStrip/List, LogoTile, StickerCollage; G5 QrBlock
- Board: rays gold, red, live; confetti. **"The your-song effect: the player's demo (/player/?demo=yourSong)", 2 screenshots** (the gold, the beams and the marks; the marks falling). SponsorStrip 1 row, 2 rows, short list, reduced motion; SponsorList; LogoTile; StickerCollage (gallery demo) + **"board · one row / rows: 2, the real logos"** (old-board images, private logos). QrBlock alone + **"In place: the projector's Before (/stage/?demo=before)"**, a stage screenshot.
- Gallery: `StatusSections.svelte` › E6/G3 (rays and confetti), G4 (strip on the projector, list on the phone, LogoTile, collage), G5 (projector only).
- Code: `packages/ui/ds/resources.css` › `.ds-rays`, `Confetti.svelte`, `apps/player/components/YourSong.svelte` + `apps/player/logic/your-song.ts`, `SponsorList.svelte`, `LogoTile.svelte`, `StickerCollage.svelte`, `apps/stage/render/parts.ts` › `SponsorStrip`, `apps/stage/render/qr.ts`.
- Verdict: **partly**. The your-song effect is **gallery-missing-but-in-code**: `apps/ds` has only its gold ground behind the drum and the scribble, and the garland's party mood. The real-logo strip is board-only by design (the logos are never committed). The QR in place is a stage screen.

### DS-Recursos · R1–R11, D-e, G3
- Board: rings and marks (5), edges (4), R3 off/on/dots/locked on Button and TwoLevelButton, press and focus, **"Pressed: held down here, frozen"**, text-wrap, corners (Wii keys, 4), R8 (heading only), long text, white and black cards, Match highlight, rays.
- Gallery: `Gallery.svelte` › "Design resources (R1–R11)" + the A1 states; `sections/Buttons.svelte` › A3; `ControlsGallery.svelte` › Match highlight; `StatusSections.svelte` › rays.
- Verdict: **covered**, except the frozen "held down" press, which is live only.

---

## Components drawn on the DS boards that don't exist in code

Only these:
1. **The Celebration's music pick with covers** (DS-Controls-1, U157/U158): a SegmentedControl with a cover per option. Neither `SegmentedControl.svelte` nor `control-types.ts` has a cover option, and `apps/console/components/CelebrationMusic.svelte` shows words only. Pending with the user.
2. **The projector's "Before the start" countdown ring** (DS-Estat-1): Ring can draw it, and the gallery does, but no screen uses it. `apps/stage/render/before.ts` shows a `CountdownChip`. Both the board and the gallery label it "not built yet".
3. (Not a gap; a wrong label on the board.) The error-music cover, which DS-Cartrons-2 says "no code draws", **is** in code (`apps/console/console.css`), in `#a31d27`, not the board's `#A82028`.

Every other named component has the source file the board cites, and every cited path exists.

## Biggest gaps first (top 10)

1. **The projector's Verdict** (fail ✗ + rays + nino, review plate, discarded fade): in code in `apps/stage/render/check.ts`, never in the gallery. E5 is console only, and DS-Estat-2 shows old-board images.
2. **The projector's Check grid** (208 px cells, the equaliser, the lifted mark): in code in `apps/stage/render/check.ts`; `CardsSongs` is hidden on `?density=projector`; DS-Cartrons-1 shows an old-board image.
3. **The projector's drum**: in code in `apps/show/engine/src/wheel/drum.ts` + `css/drum.css`; no gallery specimen; DS-Cancons shows an old-board image.
4. **The projector's finale stage** (cones of light, the fallen, «Salvats!», the winner): in code in `apps/stage/render/finale.ts`; no gallery specimen; DS-Final pastes stage screenshots.
5. **The your-song effect** (gold, beams, falling marks): in code in `apps/player/components/YourSong.svelte` + `logic/your-song.ts`; no gallery specimen; DS-Adhesius-2 pastes 2 player screenshots.
6. **The Celebration's music pick with covers** (U157/U158): **not in code at all**.
7. **SoundIcon, the console's multicolour Efectes art**: `apps/console/components/SoundIcon.svelte` + `sound-icons.ts`, never in the gallery. Worse, the gallery's A9 SoundPad uses line icons, so the SoundPad it shows isn't the one the console draws.
8. **The error-music cover**: in `apps/console/console.css` (`#a31d27` + white note); no gallery specimen (`ConsoleNow.svelte` has no checkFailed case); the board says wrongly that no code draws it, and gives a colour that isn't a token.
9. **Frozen interaction states the gallery offers live only**: LongPressButton hint and pressing (button, row), TwoLevelButton's rising fill, CornerButton pressed, R4 held down, the open sheets (5 phone + the console menu, stacked, stiff), the 3 open dialogs. A snapshot of /ds/ can't produce these board specimens, and no prop or fixture forces them.
10. **The Admin surface**: DS-Botons-1 and DS-Controls-4 tag Button and TextField "Admin", but /ds/ has no admin density. The admin loads `apps/admin/manage.css` (which defines its own `.notice`, `.notice--warn`, `--error`, `--ok`, `--pending`, `--private`) and uses Button, Notice, Switch and TextField. No board or gallery specimen shows them in the admin's look.

Smaller, also true: StickerIcon has no section of its own (only inside CornerButton). IconPicker with the phone's card marks is shown only as an app screenshot (DS-Controls-3). `apps/player/components/CardGrid.svelte` exists, but the gallery rebuilds the grid by hand from `CardCell`. The in-place app screens (the player home, the add-card pad, the drawers, the QR on the Before, the Efectes tab) are screenshots, not gallery cells.

## In the gallery, on no DS board

- `apps/ds/sections/ConsoleMenu.svelte`: **D228** the Descans music picker, **D237** «Sons automàtics» (`AutoSounds.svelte`), **D229** «Prova de so» (`SoundTest.svelte`), **D234** «Cartrons venuts» (`CardsAdd.svelte`, 6 states). They appear only on the Consola-* boards (`Consola-Menu-Sons`, `Consola-Menu`, `Consola-Portes`, `Consola-Veus-Redoble`), not on a DS board. Only this section's lock-mirror part is on DS-Botons-2.
- The **console dark theme** page (`/ds/?theme=dark`): no DS board draws dark specimens. DS-Tokens-1 has only the light/dark token table.
- `sections/Tokens.svelte` › "Other tokens" (tokens.css names no group takes), when not empty.
- The live-only controls (the mark-bob tempo and bar sliders, the collage's count, seed and replay buttons, the SegmentedControl progress slider) are on the boards only as one frozen value.
