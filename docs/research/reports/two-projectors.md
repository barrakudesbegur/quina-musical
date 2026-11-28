# Two projectors: how to feed them and where to put them

Research for the user's message (28 Nov): "I would also like to have a plan in case i manage to get 2 projectors. to know how to put them in different locations".

Hardware facts come from makers' pages and sellers, cited at the end. **(unverified)** marks what nobody here has tested. Prices are rough, in EUR, and are guesses unless a source is given.

## The answer

The simplest robust plan is **the same image on both projectors, from a cheap HDMI splitter** (1 in, 2 out) on the laptop's HDMI port. It needs no new code. macOS sees only one display, so the runbook and the preflight barely change. The far projector gets a long cable: active fibre HDMI, HDMI over Cat6 (HDBaseT), or a wireless HDMI kit, which D274 already accepts. If one projector is 4:3 and the other 16:9, send a 4:3 signal: the 16:9 one shows black bands at the sides, but the text stays as tall as it can be. A second page that draws the show on its own display, with its own delay, is worth building only if a rehearsal shows that the drum's landing visibly misses on one screen. The fix is a drum on the standalone `/stage/` page, which is real work for Frontend and Sound engine and must be finished before the tech rehearsal. A different scene on the second screen is a design question for the user. Nothing in the rules asks for it, and it hides the drum from the people who watch that screen.

**In this venue** (a tent of about 10 × 25 m, the stage on one short side, the bar on the other, and an open, uncovered area of about 10 × 25 m along one long side), the case for a second screen is **readability in the back half, not the sound**:
- From a screen at the stage end, the back tables are 20–25 m away. There, even a 2 m-tall image shows the song's title only at the limit, and the artist and the last 3 can't be read from about 11 m back.
- The sound reaches the bar end 58–73 ms late. Calibrating the one delay from the middle of the tent keeps every seat within EBU R37's limits, so no per-screen delay is needed.
- **The best place for a second screen is inside, halfway down the long wall away from the open area, angled to the back tables.** A screen for the open area would go outside at its stage end, facing along it, with the risks of an outdoor setup. One second projector can't serve both: which one comes first is the user's question.

**Be careful not to solve the wrong problem.** "Far from the audience, so only big things are readable" (event.md) might be fixed by one brighter 16:9 projector with a bigger image hung higher. In this tent, though, no image that fits can make the small text readable from the back, so a second screen is the real fix for the back half (see Placement).

## What exists today

- **The laptop** (MacBook Pro 16" 2021, M1 Pro) drives **up to two external displays** as well as its own screen. Its HDMI port drives one of them, up to 4K at 60 Hz. A second one needs a Thunderbolt port with a USB-C to HDMI adapter ([Apple, SP858](https://support.apple.com/kb/SP858)).
- **macOS can mix mirroring and extending.** With three displays, two can mirror each other while the third extends the desktop: in System Settings → Displays, hold Option and drag one display onto another ([Apple: extend or mirror](https://support.apple.com/guide/mac-help/extend-mirror-mac-desktop-multiple-displays-mchlb5f905a1/mac)). So the two projectors can mirror each other while the laptop's own screen keeps the Console. What a mirrored pair does when one display is 4:3 and the other 16:9 (one resolution for both, with bands or a stretch) is **unverified**.
- **The show page** (`apps/show/engine`) holds the engine, the audio and the drum. The drum is a 3D DOM reel (`wheel/drum.ts`) replayed on the audible audio clock. Its display lag is corrected by one signed `displayOffsetMs` (`clock.ts`). It is set with the `[` and `]` keys in 5 ms steps, after filming the flash-and-click test, and kept in the show page's Chrome profile. There is **one value per show page**, so in practice one per laptop.
- **The standalone `/stage/` page** (`apps/stage`, served by the relay at `http://localhost:5174/stage/`) already draws every projector scene: Before the Game, the intro, the Shuffle grid, play (the title, the last 3, the round, the Heat garland), the Check, the Celebration, the Break, the Pause, the finale and After the Game. It follows the relay as the `drum` role. On the laptop itself it needs no token (the relay pairs any local connection).
  - **It has no drum.** The drum's band shows the placeholder «Tambor · a la pàgina del show» (`strings.ts`), which must never reach the public as it stands.
  - **Its feed strips `drum.targetId`** and `to` (`source.ts`), on purpose. The relay itself still sends the full `transition.scheduled` to the `drum` role: the target, `minLaps`, `spinSeed`, `spinStartAtMs` and `landAtMs`. With `drumOrder` and the shared solver (`packages/rules/drum-solver.ts`), a page on the laptop could work out the show page's very trajectory.
  - **It has no display offset.** It fires its moments on the laptop's epoch clock (`ClockOffset`, about 0 ms on the same machine), with no per-display correction.
- **The phone's drum** (`apps/player/logic/drum.ts`, D237) uses the same solver but doesn't know the target. It creeps on until the landing is public, then glides onto the song in 0.5–1.4 s. That is fine on a phone, but wrong for a projector, where the drum must stop as the hook hits.
- **The preflight** (`apps/cloud/laptop/preflight/checks.ts › displaysCheck`) reads `system_profiler SPDisplaysDataType`. It warns, or with `--laptop-only` fails, when **any** display is mirrored. It doesn't check which display is mirrored.
- **Text sizes on the projector** (`packages/ui/tokens.css`, in the 1440×1080 box): the current song's title is 80 px (`--stage-text-lg`), the artist, the round and the last 3 are 30 px (`-sm`), and the big words are 120 px (`-xl`) and 272 px (`-hero`). On a 4:3 image, or a 16:9 image fitted by height, the title is about 7 % of the image height and the small text about 2.8 %.

## 1. The ways to feed two projectors

### (a) The same image on both

**(a1) An HDMI splitter on the laptop's HDMI port.** The laptop sees one display, so nothing changes in the software.
- **EDID:** a splitter tells the laptop which resolutions the displays accept. Most have a switch: COPY (output 1's display decides) or AUTO (the best mode both accept). Some also scale one output ([OREI](https://www.orei.com/products/uhds102a-1-in-2-hdmi-splitter-audio-extractor), [WolfPack scaler](https://www.hdtvsupply.com/1x2-hdmi-splitter-scaler.html), [BZBGEAR](https://bzbgear.com/product/bg-da-1x2as-1x2-hdmi-splitter-with-4k-and-hdr-down-scaler-1080p/)). Put the projector that matters most on output 1, use COPY, and switch both projectors on before plugging in the laptop. **(unverified)**: what a cheap splitter reports when output 1's projector is off.
- **4:3 and 16:9 together:** the stage lays out a 4:3 box and fits it to the screen.
  - **A 4:3 signal** (1024×768, 1400×1050 or 1600×1200) on the 16:9 projector gives black bands at the sides. The image keeps its full height, so the text keeps its size. Only the drum's band loses the extra width it gets on a 16:9 screen.
  - **A 16:9 signal** on the 4:3 projector gives bands at the top and bottom. The image is 75 % as tall, so all text there is 25 % smaller.
  - So send 4:3, unless the 4:3 projector is the minor one. Set each projector's aspect to "auto" or "normal", never "full" or "stretch" **(unverified per model)**.
- **One delay for both screens.** `displayOffsetMs` is calibrated on one of them. If the two projectors' own input lag differs (it does between models, usually by tens of ms, **unverified**), or one runs over wireless HDMI, the other screen is off by that difference.

**(a2) macOS mirroring of two external displays.** Projector A goes on HDMI and projector B on a USB-C to HDMI adapter. In Displays, Option-drag B onto A, and leave the laptop's own screen separate.
- There's no box in between, and each projector reports itself.
- The preflight then fails a correct setup (see section 3), and macOS must keep the arrangement. How it handles mixed aspect ratios is **unverified**. It still gives one delay for both.
- A splitter is simpler; (a2) is the fallback if no splitter is at hand.

**Long runs to the far projector** (they apply to (a1), (a2) and (b) alike):
- **Passive HDMI:** reliable up to about 10–15 m at 1080p (rule of thumb, **unverified** per cable).
- **Active fibre HDMI (AOC):** up to about 100 m with no delay. It works one way only, from the laptop end, and some need USB power. The earlier report found 50 m for about 150–210 USD ([browser-only-show.md](browser-only-show.md)).
- **HDMI over Cat6 (HDBaseT):** uncompressed, delay well under 1 ms, 70 m at 1080p on one Cat6 cable ([SC&T](https://www.sct.com.tw/solutions/hdbaset-extension-solution), [Xantech](https://xantech.com/node/2102.html)). There are 1×2 kits with two receivers ([OREI UHD12-EXB400-K](https://www.orei.com/products/4k-ultrahd-1x2-hdmi-extender-splitter-over-cat6-7-up-to-400-ft-with-hdbaset-edid-bi-directional-ir-uhd12-exb400-k), [WolfPack](https://www.hdtvsupply.com/1x2-hdmi-hdbaset-splitter.html)). Cat6 is thin, cheap and easy to tape down. The receivers need power.
- **Wireless HDMI, one transmitter and two receivers:**
  - The Hollyland Mars 4K takes up to two receivers, at 0.06 s and 150 m line of sight on 5 GHz ([Hollyland](https://www.hollyland.com/product/mars-4k)).
  - Cheaper consumer 1-to-2 kits claim 50–60 ms and 200 m, such as [VCOLink](https://www.amazon.com/Wireless-Transmitter-Receiver-VCOLink-Streaming/dp/B0F664TV9C) and [Lemorele](https://us.lemorele.com/products/lemorele-ultra-long-transmission-wireless-hdmi-kit-1tx-to-4rx). These are sellers' claims, with compressed video. Some kits are 100–300 ms ([J-Tech](https://www.jtechdigital.com/products/jtech-wex200v3-jtd-611-wireless-hdmi-extender-1080p-wireless-hdmi-extender-kit-200ft)).
  - The risks are 5 GHz crowding from 300 phones and a crowd blocking the line of sight, so mount the receivers high.
  - **Wireless to only the far projector** makes that screen about 60 ms later than the cabled one. Section 2 shows that this happens to match the sound's delay for people about 20 m from the speakers.

### (b) A second display-only page on the laptop's second display

Both projectors are separate displays: the laptop's own screen plus two extended displays, which the M1 Pro supports. The show page runs in kiosk on projector A. A second Chrome kiosk, with its own profile, opens `/stage/` on projector B. Each page fits its own screen, so 4:3 and 16:9 each get a native image, and each page has its own delay.

What's missing:
1. **A drum on `/stage/`** that lands exactly like the show page's drum. The phone's creep-and-glide drum isn't good enough here. The page needs a privileged laptop-only mode that keeps `drum.targetId` (the relay already sends it). It then draws the same trajectory from the solver: Spin, Suspense coast, Back and a cancelled Spin's glide, the Shuffle into the drum, the finale's smaller band and the Celebration's victory lap. Either it reuses the engine's drum renderer without its audio ticks, or it is a port. Two drums must never drift apart: this is the costly, risky part.
2. **A per-page display offset** on `/stage/` (stored in its profile, set with `[` `]` like the show page) and the flash-and-click test on that page.
3. **The privacy guard:** `source.ts` and `view.test.ts` must keep stripping the target for every other use. The privileged mode is accepted only from the laptop itself.
4. **Launch:** a second kiosk command with `--user-data-dir=…/chrome-stage` and `--window-position` on the second display **(unverified with `--kiosk` on macOS)**, plus the same anti-throttling flags as the show page.

A variant (**unverified**, a spike only): the show page opens a second window on the other screen itself (the Window Management API) and draws a second drum and a second stage overlay into it, from the same clock. That gives perfect sync and no protocol change, and the "one show page" rule still holds. But it doubles the DOM work on the audio page's main thread, and how kiosk mode, fullscreen on a second screen and its permission prompt behave is unknown.

Effort: medium to large, for Frontend and Sound engine together, plus Backend's runbook and preflight changes. It needs its own rehearsal on two real projectors. If it isn't solid before the tech rehearsal, it waits for next year.

### (c) A different scene on the second projector

For example, the prizes, the night's rounds and times, the sponsors, or a bigger card during a Check.
- **Is there a real reason?** Event.md and screens.md don't ask for one. The rules point against it:
  - "the drum is what people trust" (event.md), and a screen without the drum hides it from the people watching that screen;
  - the Check is public, so everyone should see the same card;
  - prize secrecy and "never a QR in play or the Break" apply to any second scene too.
  - The one plausible reason is a separate area, such as the bar or the entrance, where the sponsors or the night's rounds loop. It would also help "every sponsor appears".
- **Cost:** a design pass with the user first: boards, the ANIMATIONS.md spec, and content checked against the model. Then Frontend code. A drum-less scene can run on today's `/stage/` (it needs no drum), so the code is smaller than (b)'s. The design work is not.
- **This is the user's question (Q3 below), not a default.**

### Comparison

| Option | Cost (EUR, rough) | Added delay | 4:3 + 16:9 together | New code | Owner sessions |
|---|---|---|---|---|---|
| (a1) HDMI splitter, both projectors near (≤ 10–15 m passive) | 20–80 (guess) | about 0 (a scaling output may add a frame, **unverified**) | Yes, with bands on one; send 4:3 | None | The user (hardware); Backend (runbook lines, via the Orchestrator) |
| (a1) + fibre HDMI to the far projector | + 50–200 (the earlier report: 150–210 USD for 50 m) | 0 | As above | None | As above |
| (a1) + HDBaseT 1×2 kit over Cat6 | 150–600 for a 1×2 kit (guess) | < 1 ms | As above | None | As above |
| (a1) + wireless HDMI, 1 transmitter, 2 receivers (or 1 receiver for the far one only) | 150–300 consumer (guess); 600–900 for a Mars 4K with 2 receivers (guess) | 50–60 ms claimed (Mars 4K: 60 ms) | As above | None | As above |
| (a2) macOS mirrors the two projectors | 15–30 (adapter) | 0 | Unverified | Preflight fix (it fails a correct setup) | Backend |
| (b) `/stage/` with a real drum and its own delay, on the second display | 15–30 (adapter) + cables | Each screen calibrated on its own | Yes, native on both | Medium to large: drum on `/stage/`, privileged target, per-page offset, launch, preflight | Frontend, Sound engine, Backend |
| (c) A different scene on the second display | As (b) | Its own | Yes | Design + a new scene; no drum needed | The user (design), Frontend, Backend |

## 2. Placement in the tent

**The venue (the user, 28 Nov):**
- A tent of about 10 × 25 m on one of the town's squares, with the stage on one short side and the bar on the other.
- Along one long side, touching the tent, an open area of about 10 × 25 m with no roof. People may stand there. The organizers put no tables there, but people may carry spare tables out.
- **Today's projector** stands at its normal throw from screen A, under about 5 m (maybe a bit more). The stage is a little further, no more than about 6–7 m from the projector. The tech's table (laptop, mixer) is next to the projector. So the projector, screen A, the stage and the tech's table are all at the stage end of the tent, and the bar end is about 20–25 m from the stage (the user, 28 Nov; this replaces event.md's "5–10 m").
- The speakers are on stage. In 2024 the sound was too quiet at the back.
- **Assumed:** screen A faces the tables, from the stage end. Whether it hangs beside or in front of the stage isn't recorded.

### The plan (a sketch, not to scale)

```
  distance from
  the stage         TENT (10 m wide)                OPEN AREA (10 m, no roof)
                 +-------------------+   +-------------------+
    0 m          |spk  [STAGE]  spk  |   | [C] -> faces down |  C: a screen for the open area,
                 |    [screen A]     |   |  the open area    |     outside at its stage end
  ~5-7 m         |   proj A + tech   |   |                   |
                 |  tables   tables  |   |     standing      |
   ~12 m       [B] tables    tables  |   |      people       |  B: inside, on the long wall
                 |  tables   tables  |   |                   |     away from the open area,
                 |  tables   tables  |   |                   |     angled to the back tables
  20-25 m        |  tables   tables  |   |                   |
   25 m          |       [BAR]       |   |                   |
                 +-------------------+   +-------------------+
                                     ^ the long side the tent shares with the open area
```

### What each spot sees from screen A

Readable distances (see "Size, distance and height" below) for a 2 m-tall image: the title to about 20–30 m, the artist and the last 3 to about 8–11 m.

| Where | Distance from the stage | From screen A | The sound arrives |
|---|---|---|---|
| The front tables | 3–10 m | Everything readable | 9–29 ms late |
| The middle | 10–15 m | The title yes; the artist and the last 3 at the limit or no | 29–44 ms late |
| The back tables, at the bar | 20–25 m | The title at the limit, only with an image 2 m or taller; the artist and the last 3 no | 58–73 ms late |
| The open area, middle | about 14 m in a straight line | At a steep side angle (about 40° or more), maybe hidden by the tent's edge | about 40 ms late |
| The open area, far corner | about 27 m | The title barely, at an angle | about 80 ms late |

For the back tables to read the small text on screen A, the image would need to be 4.5–6 m tall, which doesn't fit under a tent roof. So a second screen is the real fix for the back half. A bigger single image alone would fix only the title.

### Where to put the second screen

**For the back tables (B, the recommended default):**
- Put it inside, about 12–14 m from the stage, on the long wall **away from** the open area, angled about 30–45° towards the bar end.
- The back tables are then 7–13 m from it, so with a 2 m image they read everything, the artist and the last 3 included. They still face roughly the same way as the stage, so the presenters stay in their view.
- On that wall it blocks no one's view of screen A, and the shared long side stays free for the open area.
- Hanging it in the middle of the tent, facing the back, would block screen A for the back tables, unless the tent is tall enough to hang it above that line of sight (ask its height).
- The cable to it is short: B is about 6–8 m from the tech's table in a straight line, about 10 m along the tent's edge. A passive HDMI cable is enough at up to about 10–15 m, or use Cat6 or wireless.

**For the open area (C):**
- Put it outside, at the open area's stage end, facing along it. The people standing there then look the same way as in the tent, towards the stage end.
- Its far end is still about 25 m away, so there they read the title and the big words only.
- **Outdoors in December** brings new risks:
  - dew and cold on the projector: keep it under a roof (the tent's eave, or a small gazebo);
  - rain;
  - wind on the screen: anchor it;
  - street lamps on the image;
  - power leads outdoors, which need outdoor-rated leads;
  - and probably little sound there, since the speakers face down the tent (a sound question).
- The tech's table is about 6–7 m from the stage, so the cable runs about 10–15 m across the shared side. Wireless avoids a trip hazard at the tent's open edge.

**Both at once** needs three screens (A, B and C). A splitter with 1 in and 4 out does the same job as the 1×2 (option (a)). Each extra screen needs its own projector, cable and power. With only one second projector, the user must choose: the back tables (B) or the open area (C). B serves seated players who read their cards. C serves people standing, who may or may not be playing (question 1).

**Facing the bar end** (a screen at the bar, facing the bar) only helps people queuing at the bar, and they'd turn their backs to the stage. It isn't worth a projector unless it shows a different scene for that area (option (c), the user's call).

### Size, distance and height

- **Readable distance:** AVIXA's rule (DISCAS, basic decisions) says the farthest viewer may sit at about 200 × the height of the smallest element they must read. That is the "4/6/8 × image height" rule for elements of 2/3/4 % ([risertools DISCAS](https://risertools.com/av/discas-display-sizing/), [AMOverview 4-6-8](https://www.amoverview.com/the-projector-4-6-8-rule-explained-how-far-should-viewers-sit-from-the-screen/)). Applied to the projector's text, taking the font size as the element height (optimistic: capital letters are about 0.7 of it):

  | What | Font size, share of the image height | Readable up to | With a 1.5 m image | With a 2 m image |
  |---|---|---|---|---|
  | The current song's title | 7.4 % | about 10–15 × image height | 15–22 m | 20–30 m |
  | The artist, the round, the last 3 | 2.8 % | about 4–5.5 × image height | 6–8 m | 8–11 m |
  | The big words (Celebration, Pause) | 11–25 % | 20 × or more | 30 m + | 40 m + |

  So the drum and the title carry far. The artist and the last 3 are lost beyond about 10 m. A 16:9 signal on a 4:3 projector cuts all of these by 25 %.
- **Closest viewer:** at least about 2 × the image height from the screen ([AMOverview](https://www.amoverview.com/the-projector-4-6-8-rule-explained-how-far-should-viewers-sit-from-the-screen/)).
- **Height:** the image's bottom edge must clear standing heads, so about 2 m or more. People stand up in the Desgraciat round, and the finale is on stage. With a 1.5–2 m image, the top is at 3.5–4 m: ask how tall the tent is at its walls and at its ridge.
- **Brightness:** lumens ≈ lux on the screen × the image area in m². Event guides suggest about 650 lm per m² of screen when the room lights are dimmed, and about 860–970 with the lights on ([Centric](https://centric.events/blog/what-size-projector-screen-do-i-need/), [Valerion](https://www.valerion.com/blog/understanding-projector-brightness-lumens-ansi-lumens-iso-lumens-lux-foot-lamberts-and-nits)). The tent's lights stay on, because people read their cards.
  - A 2.7 × 2 m image (5.4 m²) needs about 3,500–5,000 ANSI lumens.
  - A 2 × 1.5 m image needs about 2,000–2,900.
  - Keep the tent's lamps off the screen. Outdoors (C), street lamps add light to the screen too.
- **Beams and shadows:** a projector on a stand among the tables gets heads and walkers in its beam. Hang it high, use a short-throw lens, or project from behind onto a rear-projection screen if there's room behind it. Behind B's wall is the tent's edge, so a short-throw projector from in front is the likely choice.
- **Cables and power:**
  - Run the cable along the tent's edge or overhead along its frame, never across the aisle to the bar, the toilets, the exit or the open side. Tape it down, with cable ramps where people walk. The thin Cat6 cable is the easiest to hide.
  - The second projector needs its own socket. Keep the show's circuit (the laptop, projector A, the mixer, projector B) apart from the heaters. A heater that trips a breaker must not take a projector with it **(ask the council how the power is split)**.

### The sound's delay at a far screen

- **The numbers:** sound travels at 343 m/s, about 2.9 ms per metre. Light is instant. So far from the stage, the drum's landing shows before its hook is heard. At the bar end (20–25 m) the sound is **58–73 ms late**. At the open area's far corner (about 27 m) it is about **80 ms** late.
- **The tolerance is wider than 45 ms.** In ITU-R BT.1359, 45 ms is the detectability threshold for sound that comes **early**. For sound that comes **late**, which is the case here, the threshold is about 125 ms, and acceptability goes to 185 ms. EBU R37, stricter, allows 40 ms early and 60 ms late end to end ([Wikipedia](https://en.wikipedia.org/wiki/Audio-to-video_synchronization), [NAB](https://nab.org/xert/scitech/2009/TVTechCheck/TV100509.asp)). These figures were measured on speech. A sharp event like the drum's stop on the hook may be noticed sooner **(unverified)**.
  - So the bar end is just over EBU's strict 60 ms, and well inside ITU's 125 ms.
- **It depends on where the viewer sits, not on the screen.** Someone at the bar hears the hook about 70 ms late whether they watch screen A or B. They already live with this with one screen.
- **A cheap fix that needs no code, for (a) too:** film the flash-and-click calibration of `displayOffsetMs` from **the middle of the tent** (about 12 m from the stage), not from next to the speakers.
  - The picture is then held back about 35 ms, the sound's travel to the middle.
  - At the front, the sound comes about 35 ms early, inside EBU's 40 ms. At the bar, it comes about 38 ms late, inside EBU's 60 ms. At the open area's far corner, it comes about 45 ms late.
  - So every seat is within the strict limit, with one delay. Film it from the middle at the rehearsal; the tech's table, at about 6–7 m from the stage (about 20 ms), is a fair second choice: the bar end then hears the sound about 50 ms late, still inside EBU's 60 ms.
- **With (a), screen B can't get its own delay:** both screens get the same signal. If B runs over wireless (about 50–60 ms more), its back-table viewers get the sound about 15–35 ms early. That is still inside the limits.
- **With (b), it can be fixed per screen,** but in this tent it isn't needed. The sound's delay is not a reason to build (b).
- **Speakers at the back** (2024's sound was too quiet there) would bring the sound earlier for the far tables. They need their own audio delay (about 60–70 ms for speakers at the bar end), which is a sound question. A delay speaker for the open area would be the same.

## 3. What the presenters and the tech need to know

The presenters: nothing changes. They look at the public, and the screens follow the show.

The tech (runbook lines for Backend to draft and the Orchestrator to apply in docs/night-runbook.md):

- **Step 2, with (a1):** the laptop's HDMI goes to the splitter's input. Output 1 goes to the main projector (it decides the resolution), output 2 to the second one, through its long cable or wireless transmitter. Plug in the splitter's power. Switch both projectors on before connecting the laptop. Set each projector's aspect to auto or normal. Look at both screens.
- **Step 2, with (a2) or (b):** projector A on HDMI, projector B on a USB-C to HDMI adapter in a Thunderbolt port. With (a2): Displays → Option-drag B onto A, and leave the laptop's screen separate.
- **Step 5:** (a) is unchanged: the kiosk opens on the main display. Calibrate `displayOffsetMs` on screen A. With (b), add a second kiosk command for `/stage/` with its own profile on projector B, and calibrate each page with its own flash-and-click test.
- **"Without the tablet", step 1:** "never mirrored" becomes "**the projectors may mirror each other, never the laptop's screen**". The rule's reason stays: the Console (the next song, the possible winners) must never reach a projector. With (a1), nothing changes: macOS sees one projector.
- **"When something goes wrong":** add a row: "One projector goes dark: check its cable, the splitter's or receiver's power and its input. The other screen and the show carry on."
- **docs/setup.svg** ("its own display, never mirrored") gets the same change as step 1.

The preflight (`apps/cloud/laptop/preflight/checks.ts › displaysCheck`), Backend:
- **(a1):** no change is needed. It sees one display (the splitter passes output 1's name). It can't tell whether projector B is lit: that is a look at the screen.
- **(a2):** today it warns, or with `--laptop-only` fails, on a correct setup, because it flags any mirrored display. It must fail only when the laptop's own screen is in a mirror set. **(unverified)**: what `system_profiler` reports for two mirrored external displays. Test it on the laptop with two displays.
- **(b):** check two external displays, both separate. Check that a `drum` client is on the relay (the relay's client list already shows it). Check the second Chrome profile isn't in /tmp (`chrome-profiles.ts`).

## 4. Questions for the user

The tent's size and layout are now known (the user, 28 Nov). Still open:

1. **What the second screen is for:** (a) the back tables at the bar end (B, proposed: they're seated players, and from about 11 m back they can't read the artist or the last 3 on screen A); (b) the people standing in the open area (C, outdoors). Do people play in the open area, with cards (and tables they carry out), or do they mostly stand and watch?
2. **The same image on both, or a different scene on the second?** (a) the same image on both (proposed: no new code); (b) a different scene, such as the sponsors and the night's rounds, which needs a design pass with you first.
3. **The second projector:** its model, or its brightness (ANSI lumens), aspect ratio (4:3 or 16:9) and native resolution, and what it projects on (size).
4. **Screen A today:** is it at the stage end, facing the tables (the report assumes so), and how big is its image? And what was the trouble last year: (a) too small or too dim for the back, or (b) parts of the tent couldn't see it at all?
5. **The tent's height** at its walls and at its ridge, and whether the long side towards the open area has a wall or is open. These decide how high B can hang and whether people outside can see screen A at all.
6. **Power at the second spot:** is there a socket there on its own circuit, away from the heaters? For C, outdoors, is there a covered spot for the projector?

## Sources

- Apple: [MacBook Pro 16" 2021 specs (SP858)](https://support.apple.com/kb/SP858); [Extend or mirror your Mac desktop across multiple displays](https://support.apple.com/guide/mac-help/extend-mirror-mac-desktop-multiple-displays-mchlb5f905a1/mac); [Use one or more external displays (macOS 12)](https://support.apple.com/guide/mac-help/use-external-displays-mchl7c7ebe08/12.0/mac/12.0).
- Splitters and EDID: [OREI UHDS-102A](https://www.orei.com/products/uhds102a-1-in-2-hdmi-splitter-audio-extractor); [BZBGEAR BG-DA-1X2AS](https://bzbgear.com/product/bg-da-1x2as-1x2-hdmi-splitter-with-4k-and-hdr-down-scaler-1080p/); [WolfPack 1x2 splitter scaler](https://www.hdtvsupply.com/1x2-hdmi-splitter-scaler.html); [CS-1X2HDMSPL5](https://we-supply.com/products/cs-1x2hdmspl5).
- HDBaseT: [SC&T](https://www.sct.com.tw/solutions/hdbaset-extension-solution); [Xantech 70 m kit](https://xantech.com/node/2102.html); [OREI 1x2 HDBaseT](https://www.orei.com/products/4k-ultrahd-1x2-hdmi-extender-splitter-over-cat6-7-up-to-400-ft-with-hdbaset-edid-bi-directional-ir-uhd12-exb400-k); [WolfPack 1x2 HDBaseT](https://www.hdtvsupply.com/1x2-hdmi-hdbaset-splitter.html).
- Wireless HDMI: [Hollyland Mars 4K](https://www.hollyland.com/product/mars-4k); [VCOLink 1-to-2](https://www.amazon.com/Wireless-Transmitter-Receiver-VCOLink-Streaming/dp/B0F664TV9C); [Lemorele 1TX to 4RX](https://us.lemorele.com/products/lemorele-ultra-long-transmission-wireless-hdmi-kit-1tx-to-4rx); [J-Tech WEX200V3](https://www.jtechdigital.com/products/jtech-wex200v3-jtd-611-wireless-hdmi-extender-1080p-wireless-hdmi-extender-kit-200ft); [AV Access HDW100](https://www.avaccess.com/products/hdw100/).
- Fibre HDMI: see [browser-only-show.md](browser-only-show.md) › Sources.
- Screen size and brightness: [risertools: DISCAS](https://risertools.com/av/discas-display-sizing/); [AMOverview: the 4-6-8 rule](https://www.amoverview.com/the-projector-4-6-8-rule-explained-how-far-should-viewers-sit-from-the-screen/); [av-info.eu: projection rules](https://av-info.eu/video/projectionrules.html); [Centric: screen sizing](https://centric.events/blog/what-size-projector-screen-do-i-need/); [Valerion: lumens and lux](https://www.valerion.com/blog/understanding-projector-brightness-lumens-ansi-lumens-iso-lumens-lux-foot-lamberts-and-nits).
- Sound and picture sync: [Wikipedia: audio-to-video synchronization](https://en.wikipedia.org/wiki/Audio-to-video_synchronization) (ITU-R BT.1359, EBU R37); [NAB TV TechCheck 2009](https://nab.org/xert/scitech/2009/TVTechCheck/TV100509.asp).
- The repo: docs/event.md › When and where; docs/requirements/screens.md › Projector; docs/night-runbook.md; docs/decision-log.md (D237, D274); docs/research/reports/browser-only-show.md; apps/stage/{README.md, main.ts, source.ts, config.ts, strings.ts, stage.css}; apps/show/engine/src/{clock.ts, main.ts, wheel/drum.ts}; apps/show/relay/server.ts; packages/protocol/events.ts (`TransitionScheduled`, `SuspenseStarted`); packages/rules/{drum-solver.ts, time.ts}; apps/player/logic/drum.ts; packages/ui/tokens.css; apps/cloud/laptop/{chrome-profiles.ts, preflight/checks.ts, preflight/gather.ts}.
