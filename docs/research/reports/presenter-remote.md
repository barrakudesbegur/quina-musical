# A reliable remote for the presenters

Research for the user's question (28 Nov): "the main issue to figure out is a reliable way for the presenter to control the game." A screen needs the presenter's eyes. The Wii remote is fun, familiar and has many buttons, but "it has a outdated and unreliable connection method". Options to look at: Wii remote look-alikes on plain Bluetooth, Joy-Con, presenter remotes ("less cool"), and a Bluetooth repeater. The user's preference: "keep the laptop on the table, near the projector, with the mixer with me as well. but i can adapt." Read-only research. Nothing here was tried with real hardware. It builds on [wii-remote-mac.md](wii-remote-mac.md) and doesn't repeat it.

## The answer

**Move the radio, not the remote.** Any device that must reach the table 5–10 m away through a full tent is a gamble: Bluetooth's usual 10 m is a free-air figure, and bodies absorb 2.4 GHz. The fix is to put the receiving end within 1–3 m of the presenter: either the tablet on stage, or a USB receiver on an **active USB extension** laid along the audio cables to the stage edge. A 2.4 GHz presenter's receiver is just a USB keyboard to the Mac: no pairing, no Bluetooth stack, no Chrome grant.

For this year, the safest pick is a **2.4 GHz presenter remote with a USB receiver** (a Logitech R400 or similar) on a 10 m active extension. It works today with no code (PageDown is already the default action, `apps/console/logic/keys.ts`), and the same receiver also works in a tablet's USB-C port. With a small Console change, its four keys can carry Parlem/Pausa, Aguanta/Suspens, Enrere and auto-advance by tap and hold, like the Console's own two-level buttons. To keep the fun Wii remote, test the **8BitDo USB Wireless Adapter 2** (about 20 €) on the same extension. It pairs a genuine Wii remote with SYNC, no MacWiiPair, and shows it to the Mac as a gamepad. But it drops rumble and the shake, and the Console needs a Gamepad API reader. If the presenters take the tablet, an **8BitDo Micro in keyboard mode** paired to the tablet is the best many-button option. Dead ends: Wii remote clones, Joy-Con 2, Bluetooth "repeaters", and air-mouse TV remotes (risky keys).

The user's preference holds: the laptop can stay at the table. What has to move is a USB cable.

## Why the range problem is about the geometry

- **Bluetooth Classic on a Wii remote is about 10 m in free air** (Wikipedia: "up to 30 feet (10 meters)"; class 2 is 2.5 mW). In 2025 the stage-to-laptop distance was 5–10 m, through people. "At the limit" is the expected result, not bad luck.
- **2.4 GHz presenters claim more:** Logitech R400 15 m, R500s 20 m, Norwii 100 m (Norwii sells 1 mW and 5 mW versions). These are line-of-sight marketing figures. User reports on the R400 range from "all corners of my two-story house" to "3-6 feet" (B&H review). **No crowded-room test found. Unverified.**
- **Bodies, not phones, are the main problem.** Phones on 5G don't use 2.4 GHz much, but every phone's Bluetooth is on, and the show's hotspot may be on 2.4 GHz. Put the hotspot on 5 GHz if the phone allows it (to check, Backend).
- **A Bluetooth "repeater" for HID doesn't exist as a product.** What's sold as a "Bluetooth extender" is a long-range USB adapter or an audio box. An RV forum answer: "no Bluetooth repeaters exist that would work for this … they are for audio applications." A long-range USB Bluetooth adapter doesn't help either: macOS on Apple silicon won't reliably switch to an external Bluetooth controller (wii-remote-mac.md).
- **The USB cable is the repeater.** Passive USB 2.0 is limited to 5 m. Active (repeater) cables chain: StarTech's 5 m active cable chains to 20 m, others to 15–25 m; the USB spec's limit is 5 hubs, about 30 m. Two 5 m active cables (or one active plus one passive) give 10 m. The audio cables already run from the mixer at the table to the stage, so the USB cable follows them (and gets taped down: event.md's tripping worry).
- **What can go at the end of the cable:** a 2.4 GHz presenter receiver (a USB keyboard), an 8BitDo USB Wireless Adapter 2 (a USB gamepad), or a DolphinBar (USB HID). All three are USB devices to the Mac, so macOS doesn't have to adopt a Bluetooth radio.

## The two paths

**(a) The remote paired with the tablet on stage.** The radio link is 1–3 m, so range stops being a problem. The long hop (stage to table) becomes the tablet's Wi-Fi to the laptop's relay, which must work anyway for the tablet to be useful. But:
- It only works when the presenters use the tablet, and the tablet is the thing they may reject (event.md).
- An iPad can't pair a Wii remote at all. Safari has no WebHID. So the tablet path means a keyboard-type device (keyboard events) or a standard pad (Gamepad API).
- With a Bluetooth keyboard connected, **iPadOS hides the on-screen keyboard** (Apple Community threads; the user can bring it back from the shortcut bar's keyboard icon). The Console's card numbers use its own pad, but `WinnerForm.svelte` (the slip) and `ResumePanel.svelte` use real text fields. Android has the same default, with a setting to keep the on-screen keyboard. A gamepad-mode device doesn't do this.
- A pad's HOME (Guide) button on iPadOS 26 **opens Apple's Games app**, and users found no setting to turn that off (Apple Community, 2025–2026; a double-click still reaches the app). So on an iPad, HOME can't be auto-advance.
- iPadOS Safari has no gamepad rumble (WebKit bug 288839: "macOS supports … vibrationActuator while iOS, iPadOS, and visionOS do not").

**(b) The remote reaching the laptop at the table.** This is the path for "without the tablet" (night-runbook.md). With a receiver on a USB extension at the stage edge, the link is short again. But:
- Keyboard events and the Gamepad API both reach only the **focused** window. If the tech clicks the show window or another app, the remote goes dead, silently. Worse, the show page (`apps/show/engine/src/main.ts`, line 1197) sends `next` on → and Enter when it has focus, bypassing the Console's default-action logic. A remote that sends PageDown is safer than one that sends →.
- Chrome's WebHID can't open keyboards (Chrome protects keyboard and mouse collections), so there's no focus-free way to read a presenter remote from Chrome. The Wii remote through WebHID is focus-free; a gamepad through WebHID could be too (unverified, see the adapter below).
- A keyboard-type remote tells the Console nothing about itself: no connected or disconnected, no battery, no drops. The receiver is always "there". So `remote.status` and the preflight's remote warning wouldn't cover it.

**Devices that do both:** a 2.4 GHz presenter whose receiver has a USB-C plug (or a USB-A receiver with a 2 € USB-C adapter) works on the laptop, an iPad with USB-C and an Android tablet with OTG, as a plain USB keyboard. Some Norwii models have Bluetooth and a USB-C receiver, but Norwii says that on Android "only the laser and page up/down work" over Bluetooth, and the receiver takes priority over Bluetooth when plugged in. The 8BitDo Micro does both in principle (keyboard mode to the tablet, and the 8BitDo adapter on the laptop), but as two different kinds of input (keyboard and gamepad), so twice the Console code.

## What a device with fewer buttons can still do

Today's Wii mapping (show-ui-and-platform-decisions.md, `apps/console/wii/mapping.ts`):

| Wii | Action | Without the Wii |
|---|---|---|
| A | The default action (Següent; approve or reject in a Check) | Any key. Already works for → and PageDown |
| B hold | Aguanta while held | Needs a key that reports press **and** release (keydown/keyup, or a gamepad button). Otherwise Aguanta becomes a toggle, as on the Console |
| B hold + 3 strong shakes | Suspens | **Lost** with no motion sensor. Stand-in: hold the Aguanta key past a threshold, the same as the Console's two-level Aguanta → Suspens |
| − / + tap, hold | Parlem, Pausa | One key: tap = Parlem, hold = Pausa (the Console's two-level rule) |
| 1 / 2 hold 1.5 s | Enrere | A hold on any key, or a double-press |
| HOME | Auto-advance on/off | A spare key. Not HOME on an iPad pad (the Games app) |
| D-pad | 4 effects | Needs 4 spare keys. Lost on presenter remotes |
| Rumble on every action | Confirms the press | **Lost** on every keyboard device and on the 8BitDo adapter. Only pads with `vibrationActuator` in Chrome on macOS keep it (unverified per pad) |

Holds need care. A held keyboard key gives keydown, then OS auto-repeats (`repeat: true`, after about 250–500 ms), then keyup. So hold time = keyup − keydown, which works if the device sends real press and release. **Presenters differ**:
- The **R400** repeats while held (an owner: borrowers "press and hold the next slide button and end up on the very last page"). So it sends press and release, and holds can be timed. Good.
- The **R500/R500s** changes slides "only … when the change slide buttons are pressed and then released", and its long-press functions come from Logitech's software. So without the software it may send nothing until release, and a hold can't be timed. **Unverified; test.**
- **Norwii** firmware does its own long press (on the N23/N27, "long press to enter black screen") and has a Windows setting "Keep sending Key when long press". So a hold may arrive as a different key, once, with no release.

Also: `keys.ts` ignores every key while a dialog is open. That's right for a keyboard, but would block the remote at moments the Wii remote still works. Something for Frontend to decide.

## Comparison

Prices are for Spain, new, late 2026. "Guess" means I didn't find a Spanish listing.

| Device | Connection | iPad / Android / Mac | In our web Console | Buttons → our actions | Rumble / shake | One hand | Range evidence | Price | Fun |
|---|---|---|---|---|---|---|---|---|---|
| **Genuine Wii remote, today** (MacWiiPair + WebHID) | BT Classic, PIN pairing | No / not practical / MacWiiPair once (wii-remote-mac.md) | WebHID, focus-free | All | Yes / yes | Yes, made for it | ~10 m free air; "at the limit" in 2025 | Have it | High |
| **Wii remote + 8BitDo USB Wireless Adapter 2** on a USB extension | BT Classic to the adapter; USB gamepad to the host | Android 9+ with OTG; macOS ("Mac mode", set by hand); iPad not listed | Gamepad API (focused window). WebHID on the adapter: unverified | All buttons; holds yes; HOME may be taken by macOS (unverified) | **No** ("Rumble, motion control, IR control … not supported") | Yes | Adapter at the stage edge: 1–3 m | 16–24 € (PcComponentes, Fnac, Phone House) | High |
| **Wii remote + DolphinBar, mode 4,** on a USB extension | BT Classic to the bar; 4 HID devices to the host | Mac: **unverified**; iPad no | Our WebHID driver, plus picking the slot that answers | All | Likely yes (Dolphin uses it), on a Mac unverified | Yes | Bar at the stage edge | About 25–35 € (guess) | High |
| **Wii remote clones** | BT Classic, copied protocol | Worse than genuine: macOS doesn't find them, they drop during SDP, no input reports (Dolphin PR #14963) | — | — | — | Yes | — | 10–15 € (guess) | High |
| **Logitech R400** | 2.4 GHz, USB-A receiver | iPad and Android with a USB-C adapter (a USB keyboard; unverified on our tablets) / Mac yes | Keyboard events. PageDown works today | 4 keys: PageUp, PageDown, F5/Esc (alternating), "." → see the mapping below | No / no | Yes, presenter shape | 15 m spec; mixed user reports | About 30–40 € (guess) | Low |
| **Logitech R500s** | BT LE + USB receiver | iPad: sources disagree; Android 5+; Mac yes | Keyboard events (arrows, per a Logitech rep) | 2 keys + a laser. Holds may not be timeable | No / no | Yes | 20 m spec | 33–40 € (Amazon.es) | Low |
| **Logitech Spotlight** | BT LE + USB receiver | "Limited functionality" on iPadOS 13.4+ and Android | Keyboard events; the rest needs Logitech's app | 3 buttons | Vibrates for timers only, through its app / gyro for its own pointer | Yes | 30 m spec | About 100–130 € (guess) | Medium |
| **Norwii N95 BLE / N76 BLE** | BT LE + USB-C receiver | Over BT on Android "only … page up/down"; receiver on USB-C likely all keys (unverified) / Mac yes | Keyboard events | 4–6 keys; firmware long press sends other keys | No / no | Yes | 100 m spec (5 mW) | About 25–40 € (guess) | Low |
| **8BitDo Micro** (keyboard mode) | BT (keyboard), or USB cable | Yes / yes / yes (8BitDo lists Android, iOS, iPadOS, macOS, Windows) | Keyboard events, works in Safari; remap keys with 8BitDo's iOS/Android app | 16 buttons: enough for every action, including the 4 effects | No / no | Tiny (72 × 41 mm, 25 g): one thumb, maybe fiddly | BT class 2; fine at 1–3 m; to the laptop, the same problem as the Wii | 20–25 € (Amazon.es, ReyRetro) | Medium |
| **8BitDo Zero 2** (keyboard mode) | BT | Yes (keyboard mode; "make sure the input language … is in English") / yes / yes (or macOS gamepad mode) | Keyboard events; no remapping app | D-pad + 4 face + L/R + Select/Start | No / no | Tiny, keychain size | BT class 2 | About 20 € (guess) | Medium |
| **Joy-Con (Switch 1), one** | BT Classic HID | iPadOS 16+ / Android (pairs) / macOS 13+ from System Settings | Chrome on Mac: single Joy-Con maybe not exposed to the Gamepad API (conflicting sources); **joy-con-webhid** gives buttons, IMU and rumble on desktop Chrome only; iPad Safari: Gamepad API, no rumble, no motion | Enough buttons | Rumble + IMU on Mac Chrome via WebHID / none on tablets | The user finds it uncomfortable | BT class 2 | About 40 € one, 70–80 € a pair (guess) | Medium |
| **Joy-Con 2 (Switch 2)** | Proprietary BLE protocol | No native support on macOS (InputConfig); iPad/Android unconfirmed | Only through hacks (a Web Bluetooth extension) | — | — | Same | — | About 90 € a pair (guess) | Medium |
| **Air-mouse TV remote (G20S-style)** | 2.4 GHz dongle and/or BT, with a gyro | Bluetooth mouse and keyboard on tablets; dongle on the Mac | Keyboard events for arrows and OK; Back = BrowserBack or right-click, Home = BrowserHome (no Mac keycode), volume and power taken by the OS | About 5 usable keys | No / the gyro only moves the pointer: a "shake" would be pointer jumps, fragile | Yes, remote shape | Dongle can go on the extension | About 12–18 € (guess) | Medium |
| **ESP32 bridge** (Bluepad32 or ESP32Wiimote) | Wii remote → original ESP32 by BT Classic → Wi-Fi or USB serial | Any (it talks to the relay) | A new relay client: protocol and code | All | Bluepad32 supports Wii rumble and accelerometer | Yes | ESP32Wiimote's own advice: "keep ESP32 within 5 meters" | 10–15 € of parts; days of work | High |

### A mapping for a four-key presenter (a proposal, not decided)

The Console already has two-level buttons: tap for the first level, hold for the second (`hold-modes.ts`: Parlem → Pausa, Aguanta → Suspens). Reusing that rule, an R400's four keys could do:

| Key (R400 code) | Tap | Hold |
|---|---|---|
| Next (PageDown) | The default action (Següent), as today | — (so a tap is never delayed) |
| Back (PageUp) | Aguanta on/off | Suspens |
| Black screen (".") | Parlem on/off | Pausa |
| Start (F5, then Esc on the next press) | Auto-advance on/off | Enrere |

What's lost: Aguanta-while-held (it becomes a toggle, as on the Console), the shake, the 4 effects and every rumble. **F5 and Esc need testing first:** F5 can reload a page in some browsers, and Esc can mean "back" on Android. The Console must catch both before the browser does, or the key stays unused. This is for the user to pick (Frontend owns it); it changes the remote's feel.

## Test plan, at home, before the tech rehearsal

Buy three cheap things: a 2.4 GHz presenter (an R400, or a Norwii with a USB-C receiver), an 8BitDo USB Wireless Adapter 2, and two 5 m active USB 2.0 extension cables. Optional: an 8BitDo Micro for the tablet path. About 90–120 € in all.

A key-logger page helps every test: a blank page that prints each `keydown` and `keyup` (key, code, repeat, time) and each gamepad's buttons. Frontend could add it as a hidden Console page, or the user can use an online key tester.

1. **What each device sends.** On the laptop (Chrome), the iPad (Safari) and an Android tablet (Chrome): press each button, then hold each one for 3 s. Note the key names, whether a hold gives repeats and a keyup at release, and whether any key does something on its own (reload, back, home, volume, the Games app). For the 8BitDo adapter with the Wii remote: in Mac mode, check `navigator.getGamepads()` shows `mapping: "standard"`, and check what HOME does.
2. **Range through people.** Receiver at the end of the 10 m extension, at about stage height. Walk 5 m, 10 m, 15 m from it, with 4–6 people standing between, then turned round, then the remote in a pocket-sized grip (hand over it). Press 50 times at each spot; count misses. Do the same with the Wii remote paired straight to the laptop at 5–10 m, as the baseline. Then a phone hotspot on 2.4 GHz next to the receiver, and repeat.
3. **Holds under load.** Hold each key 1 s, 1.5 s and 3 s, ten times each, and check the Console sees the right length. A missed keyup is the worst case: it would leave Aguanta on.
4. **Sleep and reconnect.** Leave each device untouched for 20 min, 45 min and 90 min (a round or a break). Then press once: does that first press arrive, or only wake it? For the Gamepad API, does the first press after a page load count? (The W3C spec hides gamepads until a "gamepad user gesture".) For the 8BitDo Micro, try its "Disable Sleep" setting.
5. **Focus.** On the laptop, click the show window, then Finder, then press the remote. Note what happens (nothing, or the show page's own `next`).
6. **Unplug and replug** the extension cable during play. Does the receiver come back by itself? Does macOS show "Allow accessory to connect?" again (Privacy & Security → Accessories)?
7. **Batteries.** A fresh AAA versus a half-used one, at the far spot.

Report back: misses per spot, hold accuracy, which keys are unsafe, and comfort in one hand.

## What each option needs in software

UI work needs a board before code (the badges, the Comandament dialog, the legend on the cheat sheet). The code freeze comes after the tech rehearsal, with no fixed date, so anything here must be built and rehearsed before then.

| Option | Change | Owner |
|---|---|---|
| A presenter on → / PageDown only | None. Runbook line: receiver on the extension at the stage edge | Orchestrator (docs/night-runbook.md); Backend (laptop setup) |
| A presenter with the four-key mapping | `keys.ts` grows from one key to tap/hold per key, a profile per device; the badges and the Comandament dialog show the presenter's keys. Board first | Frontend |
| Keyboard devices on the tablet | Same as above, plus a rule for dialogs, and a check that the slip and resume fields still get a keyboard on iPad | Frontend |
| 8BitDo adapter + Wii remote, or any pad | A Gamepad API module that feeds `mapping.ts` the same button names (about 100–150 lines plus tests, wii-remote-mac.md §4); `remote.status` from `gamepadconnected`/`gamepaddisconnected` (connected and drops, no battery); badges for "no rumble, no shake". Board first. Reading the adapter through WebHID (focus-free) is a possible later step, unverified | Frontend; Sound engine only if `remote.status` needs a new field (a protocol change) |
| DolphinBar mode 4 | `knownWiiRemote()` in `driver.ts` picks the slot that answers a status request | Frontend |
| Preflight | Check the receiver or adapter is plugged in (USB device list) and the Console window is open and frontmost | Backend |
| ESP32 bridge | Firmware, a new relay client type and message, a host for the mapping, power at the stage | Sound engine, Backend, Frontend. **Not this year** |

## Critique and open points

- **The Wii remote's fun has a real cost.** The rumble and the shake are part of why it's fun ("shaking it can start a Suspense", event.md). Every option that fixes its range cheaply (8BitDo adapter) loses both. Only the DolphinBar (unverified on a Mac) or an ESP32 bridge (too much work) keeps them. The user may prefer the Wii remote as it was in 2025, with the laptop closer to the stage (U221 (a)).
- **A presenter remote is boring but solves three things at once:** range (receiver on the cable), pairing (none) and the Chrome grant (none). It loses the D-pad effects and the rumble, and the presenters may find it less funny. It already works for Següent.
- **The laptop path's focus rule is the hidden risk** for every keyboard or gamepad option. WebHID (today's Wii driver) doesn't have it. If the tech will use the laptop for other things during the night, a focus-free path matters more than the device.
- **Two presenters, one remote?** Every option above is one remote. Two receivers on the laptop work as two keyboards; two Wii remotes through WebHID would need driver changes. Not researched.
- **Our tablets aren't chosen yet (D54).** A USB-C receiver needs a tablet with USB-C, and an iPad's Games-app HOME rule only matters on an iPad.

## Not verified

- Any device's range in a crowd. No source tested this.
- The R400 receiver (or any 2.4 GHz receiver) as a keyboard on our iPad and Android tablet through USB-C.
- Whether the R500s or the Norwii send press and release, so a hold can be timed.
- What F5 and Esc do in Safari on iPad and Chrome on Android, and whether the Console can catch them.
- The 8BitDo USB Wireless Adapter 2 with a Wii remote on macOS 27 (8BitDo's page says macOS 10.10+; a newer support page leaves macOS out), its Chrome mapping, and what HOME does on macOS.
- Whether WebHID can read the 8BitDo adapter (focus-free).
- The DolphinBar on a Mac, in any mode.
- A single Joy-Con in Chrome's Gamepad API on the Mac (sources conflict), and in iPad Safari.
- Joy-Con 2 on iPadOS 26 and Android.
- What an air-mouse remote's Back and Home do in Chrome on the Mac.
- 8BitDo Micro sleep timing and how its first press after sleep behaves.
- Prices marked as guesses.

## Sources

Repo: docs/event.md, docs/night-runbook.md, docs/show-ui-and-platform-decisions.md, docs/open-questions.md (U221), `apps/console/logic/keys.ts`, `apps/console/logic/hold-modes.ts`, `apps/console/wii/mapping.ts`, `apps/console/App.svelte`, `apps/console/components/WinnerForm.svelte`, `apps/show/engine/src/main.ts`, `packages/protocol/events.ts` (`remote.status`), [wii-remote-mac.md](wii-remote-mac.md).

Wii remote, clones and adapters:
- [Wikipedia: Wii Remote](https://en.wikipedia.org/wiki/Wii_Remote) (10 m)
- [Dolphin PR #14963](https://github.com/dolphin-emu/dolphin/pull/14963) (clones on macOS)
- [8BitDo USB Adapter 2: Wii Remote and Wii U Pro manual](https://support.8bitdo.com/Manual/USB-Adapter-2/wii-wiiupro-others.html), [product page](https://www.8bitdo.com/wireless-usb-adapter-2/), [FAQ](https://api.8bitdo.com/faq/usb-wireless-adapter.html)
- Prices: [PcComponentes](https://www.pccomponentes.com/8bitdo-usb-wireless-adapter-2-adaptador-usb-inalambrico-para-mandos-bluetooth-y-arcade-sticks-8bitdo), [Fnac](https://www.fnac.es/mp9726617/Adaptador-USB-Inalambrico-Usb-Wireless-Adapter-2-Negro-8BitDo), [Phone House](https://www.phonehouse.es/tarjetas-de-puertos/8bitdo/8bitdo-usb-wireless-adapter-2-tarjeta-y-adaptador-1745464.html)
- [Batocera wiki: DolphinBar](https://wiki.batocera.org/hardware:dolphinbar), [ManualsLib: DolphinBar manual](https://www.manualslib.com/manual/2200306/Mayflash-Dolphinbar.html), [LaunchBox forums](https://forums.launchbox-app.com/topic/30137-retroarch-mayflash-and-dolphinbar/)
- [Bluepad32: supported gamepads](https://github.com/ricardoquesada/bluepad32/blob/main/docs/supported_gamepads.md), [release notes](https://bluepad32.readthedocs.io/en/latest/release_notes/)
- [ESP32Wiimote](https://github.com/andremmfaria/ESP32Wiimote)

Presenter remotes:
- [ivoidwarranties: R400 vs R500](https://www.ivoidwarranties.com/2019/03/) (R400 repeat, R500 on release)
- [SpinetiX wiki: USB wireless presenters](https://support.spinetix.com/wiki/USB_wireless_presenters) (R400 keys)
- [Mac OS X Hints: Logitech presenter and Keynote](http://hints.macworld.com/article.php?story=20070127120815819), [Derick Rethans: R400 on Linux](https://derickrethans.nl/logitech-r400.html)
- [B&H: R400](https://www.bhphotovideo.com/c/product/644449-REG/Logitech_910_001354_Wireless_Presenter_R400.html) (15 m, user reports)
- [Best Buy Q&A: R500s](https://www.bestbuy.com/site/questions/logitech-r500s-presenter-bluetooth-and-usb-remote-control-graphite/6477412), [Micro Center: R500s](https://www.microcenter.com/product/645987/logitech-r500s-laser-presentation-remote-clicker-black), [ManualsLib: R500 FAQ](https://www.manualslib.com/manual/2110663/Logitech-R500.html), [Amazon.es: R500s](https://www.amazon.es/Logitech-Presentaci%C3%B3n-presentaciones-Compatibilidad-personalizable/dp/B07W4DG827)
- [Logitech: Spotlight sheet](https://www.logitech.com/content/dam/logitech/en/education/pdf/logitech-spotlight-presentation-remote.pdf), [Logitech Spotlight support](https://hub.sync.logitech.com/spotlight)
- Norwii: [N95 BLE](https://www.norwii.com/producten/235-en.html), [N95 BLE manual](https://norwii.com/manualen/shownews.php?id=834&lang=en), [N76 BLE](https://www.norwii.com/producten/247-en.html), [N23/N27 manual](https://www.norwii.com/manualen/374-en.html), [macOS software manual](https://www.norwii.com/manualen/397-en.html)
- [rellen/expresso #644](https://github.com/rellen/expresso/issues/644) (clicker key repeat), [Kindle page turner gist](https://gist.github.com/liquidguru/1e9c77f9389cdf23f94d2a94b220c90a) (repeat or no repeat)

Pads and keyboards:
- [8BitDo Micro](https://www.8bitdo.com/micro/), [Micro keyboard mode manual](https://manual.8bitdo.com/micro/micro-keyboard-bluetooth.html), [note.com: Micro on iPad](https://note.com/yakimeshi_pty/n/nee3a84c1050d?hl=en), [MacStories](https://www.macstories.net/stories/my-latest-mac-automation-tool-is-a-tiny-game-controller/), [Amazon.es: Micro](https://www.amazon.es/8Bitdo-Bluetooth-Pocket-sized-Controller-Raspberry/dp/B0CDG2HKBF), [ReyRetro](https://reyretro.es/consola-retro/8bitdo-micro/)
- [8BitDo Zero 2 keyboard mode](https://manual.8bitdo.com/zero2/zero2_keyboard_mode.html)
- Joy-Con: [tomayac/joy-con-webhid](https://github.com/tomayac/joy-con-webhid), [hchiam/gamepad](https://github.com/hchiam/gamepad), [Apple developer forums](https://developer.apple.com/forums/thread/763679), [MacRumors](https://www.macrumors.com/how-to/pair-nintendo-joy-con-iphone-ipad-apple-tv/), [InputConfig: Joy-Con 2 on a Mac](https://inputconfig.com/questions/joy-con-2-on-mac), [Joy2Cloud](https://github.com/Matheusnugas/Joy2Cloud)
- [WebKit: Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/), [WebKit bug 288839](https://bugs.webkit.org/show_bug.cgi?format=multiple&id=288839) (no pad rumble on iPadOS)
- [W3C Gamepad](https://w3c.github.io/gamepad/) (gamepad user gesture)
- [WICG WebHID: blocklist](https://wicg.github.io/webhid/#blocklist) (keyboards and mice are protected; from memory of the spec, not re-checked today)
- Apple Community: [iPadOS 26 Xbox controller](https://discussions.apple.com/thread/256141365), [controller shortcut](https://discussions.apple.com/thread/256205650), [Switch Pro controllers](https://discussions.apple.com/thread/256136615) (HOME opens Games); [on-screen keyboard with a Bluetooth device](https://discussions.apple.com/thread/256195268)

Air mice, range and cables:
- [xbmc #21566](https://github.com/xbmc/xbmc/issues/21566) (G20S codes), [MDN: key values](https://developer.mozilla.org/en-US/docs/web/api/ui_events/keyboard_event_key_values), [mybyways: air mouse keys](https://mybyways.com/blog/of-mice-and-keyboards)
- [iRV2 forum: Bluetooth range extender](https://www.irv2.com/threads/bluetooth-range-extender.2073554/)
- [StarTech USB2AAEXT5M](https://docs.rs-online.com/3e56/0900766b816f5b19.pdf), [yourcablestore: USB length limits](https://www.yourcablestore.com/pages/usb-cable-length-limitations-and-how-to-break-them)
