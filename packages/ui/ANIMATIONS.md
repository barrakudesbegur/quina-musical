# Animation spec

Animations are features of the show, so each one is designed here before it's coded. Every entry lists what triggers it, what moves, its duration and easing, any sound, the reduced-motion fallback, and the cost budget. The code refers to each animation by its **hook name**: `data-anim="…"` on the element, a `--dur-*` token for its length, and on the projector a `quina:anim` event with `detail.name`. A theme can then restyle the motion without touching logic.

Status: a draft for the user's review (2026-11-24). Numbers are starting points, to be tuned at the rehearsal.

## Principles

1. **One dominant motion at a time.** The projector is seen from far away, so only one big thing moves at once. The drum owns the Spin, the title owns the Landing, and the card owns the Check. Everything else stays still or idles very gently.
2. **Motion never tells a secret.** Nothing moves *before* a song lands:
   - no anticipation of the title;
   - no near-win pulse timed to songs;
   - Heat never changes at a landing (`packages/rules/heat.ts` delays and eases it).
   A phone's reel is generic until the landing.
3. **Timed by the show's clock, not by when a message arrives.** Moments with a timestamp (`landAtMs`, `steps[i].atMs`, `shuffle.startAtMs`/`endAtMs`, `spin.startAtMs`) start at that time on the sender's clock, corrected with `ClockOffset`. So the projector, the console and the phones agree, and a late message starts mid-animation instead of late.
4. **Sound belongs to whoever owns the speaker:**
   - the engine plays everything on the PA;
   - the projector is silent;
   - the console is silent;
   - phones play only short interface sounds (see "Sound map").
5. **Reduced motion** (`prefers-reduced-motion: reduce`, and on phones also Data Saver): every animation has a still fallback that keeps the information. The tokens drop to 0 ms (`packages/ui/tokens.css`) and the fallbacks below take over.
6. **Budgets:**
   - Animate only `transform` and `opacity` (and `filter` on the projector only).
   - Never animate layout properties.
   - Animations stop while the page is hidden.
   - **Phones** (the target is a 4-year-old mid-range Android): at most 24 elements animating at once; no blur or backdrop filters; under 4 ms of JS per frame.
   - **Projector** (the show laptop at 60 fps, sharing the CPU with the audio engine): at most 150 animated elements; keep the main thread free around `landAtMs`, with no layout work in the 300 ms before a landing.

## Projector (`apps/stage/`)

| Hook | Trigger | What moves | Time · easing | Sound (engine) | Reduced motion |
|---|---|---|---|---|---|
| `scene-enter` | `scene` changes | The old scene fades out while the new one rises 24 px and fades in | `--dur-slow` 480 ms · ease-out | none | Instant swap |
| `spin` | `transition.scheduled`, from `spinStartAtMs` | **The drum** (engine) spins edge to edge. The stage's current-song title slides down 40 px and fades to 30 %, and the last-3 row stays still | Title out over 400 ms · ease-in | The transition itself | Title dims to 30 % with no slide |
| `landing` | `transition.landed`, at `landAtMs` | The title **slams** in: scale 1.35 → 1, overshooting with `--ease-bounce`. The artist line follows 120 ms later. In the last-3 row the new tile slides in from the left and the oldest leaves to the right (220 ms) | `--dur-landing` 700 ms | The landing impact | The title appears, and the row swaps with no slide |
| `suspense` | `suspense.started`, until released | A vignette slowly darkens the edges, and the title area shows a big "?" breathing (scale 1 → 1.06, period 1.6 s, speeding up to 0.8 s near `autoReleaseAtMs`) | Loop · ease-in-out | The build loop | Static vignette, static "?" |
| `heat` | A new Heat sample's `fromMs` | The garland's colour, glow and twinkle speed ease towards the new value. Cool: slow white-blue twinkle. Warm: gold and orange. Hot: red, orange and gold with a faster chase | 20 s ease (`HEAT.easeMs`), starting 4–15 s after the change | none | Colour changes in one 2 s fade; no twinkle |
| `shuffle` | `shuffle.scheduled`, between `startAtMs` and `endAtMs` (about 9 s) | ① Every cover appears in a grid (1 s). ② The grid jiggles as if shaken (2 s). ③ Covers fly into the drum one by one in a **random visual order that has nothing to do with the Queue**, staggered, each along an arc with a spin (5 s). ④ The drum appears and turns half a lap (1 s) | 9 s total · per cover 600 ms ease-in | Item-box sound at ① and a "whoosh" bed | The grid fades out and the drum fades in; a caption reads "Barrejant…" |
| `check-enter` | `check.scheduled` | The ribbon drops from the top (bounce): Barrakudes orange, with notched tails and a darker bottom edge, reading "Comprovant el cartró N…" next to a gold pill naming the claim ("LÍNIA · FILA 3", or "QUINA"). Under it the card deals in row by row, each tile flipping 90° → 0° with a 60 ms stagger. The covers (about 208 px on the 1440 px box) float on the night background with their titles below, with no box or card behind them. For a Line, the other rows dim to 22 %. No progress dots: the marks show the progress | Ribbon 400 ms `--ease-bounce`; deal 600 ms | none | Ribbon and card appear; the other rows dim at once |
| `check-step` | Each `steps[i].atMs` | The playing cover gets a pulsing orange ring and glow (1.2 s period) and an orange equaliser badge (still bars) at its corner, for `durationMs`. At its end the mark stamps on at the same corner. **✓**: a green badge scales 2 → 1 with a −12° rotation, the cover gets a green ring, and the tile gives one small bounce. **✗**: the tile shakes (3 × 6 px, 300 ms), its cover turns grey and gets a red ring and a red badge | Ring per step; stamp 300 ms `--ease-bounce` | Snippet on ✓; "broken record" on ✗ (engine) | The ring becomes a static outline, and the marks appear without stamp or shake |
| `check-result` | Now ≥ `check.endAtMs` (at once for a card that is not valid) | The result plaque, tilted −2°, lands where it hides nothing that was checked: over a Line's other rows (only the bottom one, in a compact plaque, when the middle row was checked), or over the middle of the card for a Bingo. **Valid:** a gold plaque "Cartró correcte!" slides up; the ribbon stays as it is. **Failed** (the card is incomplete or not valid): ① the ribbon turns slate and now reads "Cartró N" (the pill stays), with one shake (3 × 6 px); never red, as it isn't an error. ② A slate plaque with a chunky ink edge drops in with a bounce: "Aquest cartró no té premi" ("Cartró no vàlid" for an unknown or wrong-type card) and below it "Falta «title». El joc continua!", naming the first song that didn't sound (just "El joc continua!" when its title isn't known). For a Bingo a dark scrim fades in over the card, under the ribbon and the plaque. ③ The nino-espatxarrat sticker tumbles onto the plaque's left edge: it falls turning once and lands at −12° with a bounce. The checked covers keep their ✓ and ✗ | Plaque 400 ms (`--ease-bounce` failed, ease-out valid); ribbon shake 300 ms; scrim 400 ms fade; sticker 600 ms `--ease-bounce`, 200 ms after the plaque | Failure fanfare on reject (engine, at the presenter's decision) | The ribbon turns slate without the shake; the plaque, scrim and sticker appear at once |
| `celebrate` | `celebration.started` | ① A white screen flash (120 ms). ② "LÍNIA!" or "QUINA!" slams in from scale 3 with a −5° tilt (600 ms, elastic). ③ Rays behind start rotating, one turn per 20 s. ④ Confetti bursts: 120 pieces for a Line, 200 in two bursts for a Bingo, falling for 2.4 s. ⑤ The card number plate drops in (300 ms later), then the prize panel rises (300 ms later). ⑥ The ninos bounce in from the sides. Bingo is bigger: gold flash, double confetti, a fireworks sticker | Entrance 1.2 s (`--dur-celebrate`); idle loop afterwards | Impact plus the Clear fanfare, then the Celebration music (engine); the drum's victory lap (engine) | Title, number and prize appear together; static rays; no confetti |
| `interval-rotate` | Every 8 s during the Interval | The prize cards crossfade (400 ms). The countdown chip ticks each minute with a small scale 1.08 → 1 | 400 ms ease-in-out | Interval music (engine) | Crossfade with no scale |
| `idle` | Before the Game, the Interval, after the Game | The title floats ±6 px with an 8 s period. The ninos sway ±3° with periods offset so they never sync | Loop · ease-in-out | none | Still |
| `credits` | After the Game | The sponsors and every round's winning card numbers scroll slowly upward | About 40 px/s, linear | none | Static pages that fade every 8 s |
| `pause` | `pause` set or cleared | A full-screen overlay fades in. The meditating nino breathes (scale 1 → 1.04, 4 s period) | 300 ms in, 300 ms out | Hold music (engine) | The overlay appears; the nino is still |
| `link-lost` | The relay drops for over 3 s | A small dot in the corner fades to red. The scene stays as it was, since the show may still be running | 200 ms | none | Same |

## Player app (`apps/player/`)

| Hook | Trigger | What moves | Time · easing | Sound (phone) | Reduced motion |
|---|---|---|---|---|---|
| `tab-switch` | Tapping a tab | The content crossfades | `--dur-fast` 120 ms | Tap blip | Instant |
| `reel-spin` | `spin.startAtMs` | The Ara reel scrolls generic card backs (no songs), speeding up, then slowing so it stops at `landAtMs`. With `landAtMs: null` (a Suspense), it coasts slowly until the landing | Tied to `landAtMs`, eased so it stops exactly then | Soft ticks as cards pass (rate-limited to 10/s) | A spinner reading "Sona la ruleta…" |
| `shuffle` | `shuffle` set (round start) | A small fan of tilted card backs jiggles, like a shaken deck. It never shows songs, so it can't hint at the order | Loop while the Shuffle runs, 400 ms per jiggle | Tap blip once | A static fan with "Barrejant…" |
| `landing` | A new landing becomes public | The cover flips in from the back (rotateY 90° → 0°, 400 ms) and the title rises. In Historial the new row slides down from the top | 400 ms `--ease-bounce` | A soft "pop" | The cover and title appear |
| `mark-in` | A song lands that is on one of the player's cards | A corn kernel drops onto the cell: translateY −24 px → 0, squash 1.2/0.8 → 1, and a random −15…15° tilt that stays. With several cards, they stagger by 80 ms. Every landed song gets one, the latest included (there is no grace rule any more) | 220 ms ease-out | A tiny "tock" (once, not per card) | The kernel appears |
| `near-win` | A card becomes 1 song from a Line (until a Line is confirmed) or from the Quina: `nearSongs` names a song | No banner (the user's decision). The missing song's cell on that card's grid gets a soft tint of the card's colour and a dashed outline, and breathes slowly (tint 22 % → 42 % → 22 %). Nothing else moves and no text appears: it never says a win happened, and a completed line just shows its marks. **Not tied to songs:** the breath is continuous, never synced to a landing | One breath 2.4 s ease-in-out, looping | A soft two-note chime, only when the player's cards go from no highlighted song to one. Bonus vibration of 30-40-30 ms (Android only; nothing depends on it) | The tint and outline stay, without breathing |
| `check` | `check` changes | "Comprovant el cartró 123…" with three dots stepping (not spinning). When the result comes: a green ribbon (valid) or a grey one | Dots 1.2 s loop; ribbon 300 ms | none | Static text |
| `celebrate` | Scene `celebration` | A light confetti burst (40 pieces, 1.8 s). The winning card numbers pop in one by one (120 ms stagger). If one is the player's own card, its number shows in that card's colour, with **no "you won" text or effect** | 1.8 s | A short fanfare blip (0.8 s) | Numbers appear; no confetti |
| `countdown` | The Interval and before the Game | The ring or text ticks each second, with the last 10 s scaling slightly | 1 s steps | none | Text only |
| `reconnect` | The feed drops | After 3 s, a pill slides down: "Reconnectant…". When the feed is back, it turns green ("Connectat") for 1 s, then slides away | 200 ms in and out | none | The pill appears and disappears |
| `offline` | The laptop link is down for 20 s (`OFFLINE_NOTICE_AFTER_MS`), or the feed for 20 s | A full-screen calm notice fades in ("Connexió perduda, tornem de seguida") with the meditating nino. The cards stay reachable beneath it | 300 ms | none | It appears |
| `pause` | The presenters' technical pause | Same as `offline`, with "Tornem de seguida" | 300 ms | none | It appears |

## Console (`apps/console/`)

The console is a tool. Its motion is feedback, never decoration, and it never delays an action.

| Hook | Trigger | What moves | Time · easing | Reduced motion |
|---|---|---|---|---|
| `press` | Any button press | The button sinks 2 px, and its 3D edge shrinks | 80 ms | Colour change only |
| `long-press-confirm` | Pressing Back, End, Panic | A fill sweeps left to right across the **whole button**. Released early, it drains back over 200 ms. When complete, a flash, then the action fires | `--dur-hold-confirm` 900 ms linear | A numeric "0…100 %" in the button |
| `hold-hint` | A short tap on a long-press button | The popover "Mantén premut per confirmar" pops above the button and fades after 1.5 s | 150 ms in, 300 ms out | It appears and disappears |
| `suspense-hold` | Suspense held down | The button's fill builds, and a glow pulses faster the longer it's held. The ring counts down to `autoReleaseAtMs` | Pulse 1.2 s → 0.5 s | A static fill plus the countdown number |
| `countdown-ring` | `autoAtMs`, a transition's `landAtMs` | A ring (stroke-dashoffset) empties linearly to the moment | Linear | Seconds as text |
| `check-step` | Each `steps[i].atMs` | The row for the playing song is highlighted; its ✓ or ✗ fades in at the step's end | 150 ms | It appears |
| `reveal` | "Mirar el futur" on the Futur tab | The chart, the songs-to-Line and Quina counts and the possible winners unblur and fade in; the bars grow from 0 with a 40 ms stagger | 200 ms fade; bars 300 ms ease-out | It all appears at once |
| `tab-switch` | A tab of the Tabs component is chosen | The chosen tab rises 6 px into the panel (covering its top line) as the old one sinks; the panel's content cross-fades | 120 ms ease-out | The tabs and content swap at once |
| `next-to-now` | The next song lands (`transition.landed`, at `landAtMs` on the show's clock; after a Suspense, at its release) | The "Següent" panel's cover, title and artist fly up into the "Ara sona" panel (FLIP with transforms: they move and grow to Ara sona's sizes) while Ara sona's old content fades out and drops 8 px. The Següent panel is left empty with its dashed frame, and the following song fades into it once the console knows it. The countdown ring refills from empty. Not on Back, and not when the next song is changed before it lands: those swap at once | Fly 450 ms `--ease-out`; old content out 120 ms; new next song in 200 ms | The panels swap at once, with no motion |
| `toast-in` | `command.rejected`, saved and other notices | A toast slides up from the bottom and auto-hides after 4 s | 200 ms in and out | It appears |
| `conn-change` | A connection chip changes state | The colour fades and the chip blinks once | 200 ms | Colour only |

## Sound map

| Who | What |
|---|---|
| Engine, on the PA | Transitions, landings and impacts, effects, Signatures, the Shuffle's item box, Final Lap, Check snippets and the "broken record", the Failure and Clear fanfares, Celebration and Interval music, Hold music |
| Projector | Silent (on the laptop the audio comes from the engine) |
| Console | Silent |
| Phones | Interface sounds only, ON by default and switchable off: tap blip, landing pop, mark "tock", near-win chime, celebration blip, and the reel's ticks (limited to 10 a second). They're synthesised in WebAudio, under 200 ms (the celebration blip 0.8 s), quiet (−24 dBFS peak), never more than one at a time, and never while the page is hidden. 400 phones play them at different moments, so they stay short and soft so they never compete with the presenters |

## Open points for the review

- The confetti amounts (projector 120 or 200, phones 40), and whether the phone's Celebration should show at all for rounds the player has no card in.
- How hard the landing title should slam: the bounce overshoot (`--ease-bounce`), tuned at the rehearsal from the back of the tent.
- Whether the Shuffle should be shorter (6 s) in later rounds, once people know it.
