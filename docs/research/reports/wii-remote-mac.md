# The Wii remote on the Mac

Research for the user's idea (28 Nov): a Mac app that pairs the Wii remote, holds its connection, and hands its buttons to Chrome "as standard Gamepad API (or some other kind of data transmission)", so that another remote could later pair straight to Chrome and nobody has to open the Console to pair. Also: "wii remote must also have rust implementation or the js could be easily ported". Read-only research. Nothing here was tried with a real remote (none was connected to this laptop).

## The answer

The runbook's step 7 is wrong. On current macOS a Wii remote does not pair from System Settings: the remote wants a binary PIN that the settings dialog can't type. You need a pairing app once per laptop. WiimotePair, the app used in 2025, fails on macOS 26 and 27. MacWiiPair (6 Nov 2026) is built and tested for macOS 27.0.1, the version this laptop runs. Once paired with the red SYNC button, the pairing survives reboots, and a button press reconnects the remote. So pairing is a one-time job at home, never a Console job.

The user's idea mixes two problems. The hard part is the **pairing**, and it needs private Apple APIs that break with macOS updates; our own app would inherit that upkeep. The **reading** part is easy and needs no hacks: macOS exposes a paired remote as a normal HID device, which Chrome's WebHID, Node's `node-hid` and Rust's `hidapi` all open with the same system call. A virtual gamepad for Chrome is the worst way to pass the buttons on. It needs a restricted Apple entitlement, and it loses rumble, the accelerometer (so the three strong shakes), the LEDs and the battery. Chrome also only reads gamepads in a focused window. Sending the buttons over the relay's WebSocket keeps everything and needs no entitlement.

For this year: fix the runbook (MacWiiPair, SYNC, at home, on both laptops), give the laptop's Console a Chrome profile that survives a reboot, and run four short tests (below). All cheap, no code. Maybe buy a DolphinBar and try it at a rehearsal for the range; it's the one hardware option that could fix both pairing and range, but nobody has confirmed it on a Mac. Later: move the remote's HID out of Chrome into a small Node host on the laptop, and add standard controllers through the Gamepad API in the Console. Don't build a virtual gamepad.

## 1. Pairing on current macOS

### What 2025 did

`legacy/2025/client/src/WiiMoteSection.tsx` says, step 1: "Connecta el Wii Remote via Bluetooth des de la configuració del sistema o amb el botó. A MacOS, cal instal·lar WiimotePair" (link to `dolphin-emu/WiimotePair`). Step 2 was "Connectar via HID" (WebHID). The user's own PR on `natel97/wiimote-chrome` (#2, opened 19 Dec 2025) adds the same line: "In MacOS, you need to install WiimotePair". So the app the user deleted was **WiimotePair**. The 2025 page also had a "Connectar via Bluetooth" button (Web Bluetooth, GATT); a Wii remote is Classic Bluetooth HID, not GATT, so that step could never do anything.

### Why System Settings alone doesn't work

- The remote uses legacy PIN pairing with a **binary** PIN: the Mac's Bluetooth address, bytes reversed, for SYNC; the remote's own address, reversed, for 1+2 (WiiBrew). The bytes aren't printable, so you can't type them into a PIN box. Very old guides say to pair from Bluetooth settings; users on later macOS got "Passkey entered did not match".
- On macOS 26 and 27 it got worse. IOBluetooth now answers the remote's PIN request itself with "Just Works" and no PIN, so the pairing app is never asked, and pairing times out after about 7.7 s with HCI 0x1F. Apps show this as "(os/kern) default set". Root cause found on macOS 27.0.1 build 26A434 (MaxfieldKassel/WiimotePair PR #1). **This laptop runs macOS 27.0.1, build 26A434** (`sw_vers`), the exact build.
- I found no reliable report of a pairing from System Settings alone on macOS 15, 26 or 27. Only one auto-generated article claims it. **Unverified either way.** A two-minute test settles it (test A below), but don't plan on it.

### The tools

| Tool | What it does | State |
|---|---|---|
| **WiimotePair** (Dolphin project, Objective-C, macOS 12+) | Scans for `Nintendo RVL-CNT-01*` with IOBluetooth, starts the pairing, and answers the PIN with the reversed Mac address through a private API (`IOBluetoothCoreBluetoothCoordinator pairPeer…`). SYNC only. | Only release: 1.0, 5 Feb 2024; last commit 22 May 2025. Fails on macOS 26 and 27 ("(os/kern) default set", issues #5, #17). A fix (PR #20) was closed unmerged on 24 Oct 2026. A SwiftUI rewrite (PR #21) has been open since 21 Nov 2026. **Don't use it this year.** |
| **MacWiiPair** (aureliothuerch, Swift, GPL-3.0) | Same idea, plus a hook that answers the PIN request before macOS does (pairing type 6, PIN as a little-endian number). Tries both PINs (SYNC and 1+2). | v0.2.3, 6 Nov 2026. README: "Tested: Wii Remote (RVL-CNT-01) on macOS 27.0.1, Mac16,5"; RVL-CNT-01-TR "untested, should work"; Apple silicon on macOS 27 only. Says it's signed and notarized (I didn't check the signature). Brand new, 0 stars, one maintainer, private APIs: "A macOS update can break it." **The one to use**, tested on this laptop before relying on it. |
| WiiMacMote (gdemontalivet, Swift) | Pairs, reads the remote through IOHIDManager and creates a virtual gamepad. | Users on 26.5.2 report macOS flagging it as malware and moving it to the Bin (Aug–Sep 2026). Avoid. |
| blueutil script | Command-line pairing. | "Fails on Apple silicon." |

### Persistence and the night

- **SYNC pairs for good, 1+2 doesn't.** SYNC bonds: the remote stores the host and turns on "single press reconnection", so any button press makes it look for that host again. 1+2 is a guest pairing and has to be redone every time (WiiBrew). Use **SYNC**, under the battery cover. MacWiiPair: "From then on … you only need MacWiiPair again if you remove the remote in the Bluetooth settings." The SwiftUI PR on WiimotePair even says its PIN scheme "doesn't work with ① + ②", and a user hit "(os/kern) protection failure" with 1+2 and fixed it with SYNC.
- **Across reboots:** yes for a SYNC bond. The Mac keeps the link key and the remote keeps the host. After a reboot, press a button on the remote. Clone remotes are different: they reconnect on a button press, but macOS fails to set them up as HID (Dolphin PR #14963). **Use a genuine Nintendo remote.**
- **Two laptops:** the remote stores several hosts ("at least three confirmed") and tries them in reverse bonding order (WiiBrew). So it can be bonded to the main laptop and to the spare. **Not verified on a Mac.**
- **Right after pairing,** macOS's first HID connection often drops about 200 ms later (WiimotePair PR #21). Press a button on the remote to reconnect. The LEDs keep blinking until a program opens the remote and sets them; our driver lights LED 1, so that's normal.
- **macOS updates:** an update can break *new* pairings (the private APIs). I found no report of an update dropping an existing bond. Pair after the last update you plan before the night, and test again after any update.

### RVL-CNT-01 or RVL-CNT-01-TR?

The battery-cover label tells you; "Wii MotionPlus INSIDE" models are -TR (product ID 0x0330, the original is 0x0306). The -TR turns itself off when output reports arrive on the HID control channel (SET_REPORT). The original accepts them (WiiBrew; Julian Löhr's HID Wiimote notes on Windows). I couldn't find out which channel macOS uses for `IOHIDDeviceSetReport` on a Bluetooth HID device. Dolphin on macOS writes through hidapi, which uses that same call, and Dolphin works with remotes paired this way, so it likely uses the right channel. But MacWiiPair hasn't tested a -TR, and WiimotePair issue #6 says the built-in MotionPlus model wouldn't pair. **Which model the user has, and whether it pairs and rumbles, is test B.**

## 2. Reading the remote outside Chrome

**Yes, this works, and it's well trodden.** Once paired, macOS exposes the remote in the IORegistry as a Bluetooth HID device, `057e:0306` (or `0330`) (WiimotePair PR #20). Dolphin no longer has its own macOS Bluetooth code: the folder `Source/Core/Core/HW/WiimoteReal/` has only `IOhidapi`, `IOWin`, `IOLinux` and `IOAndroid`. On the Mac, Dolphin reads the remote **and writes its LEDs, rumble and reporting modes through hidapi**. hidapi's Mac backend is IOHIDManager: `hid_write` calls `IOHIDDeviceSetReport(…, kIOHIDReportTypeOutput, …)`. Chrome's WebHID on the Mac calls exactly the same function (`hid_connection_mac.cc`). WiiMacMote does it from Swift too (`IOHIDDeviceSetReport` for 0x11, 0x12, 0x15). If WebHID works on our laptop, `node-hid` and Rust's `hidapi` do as well: it's the same system call.

| | Chrome WebHID (today) | `node-hid` in Node | Rust `hidapi` |
|---|---|---|---|
| Opens the paired remote | Yes, after the chooser | Yes, by vendor and product ID, no chooser | Yes, same |
| Output reports (LEDs, rumble, mode 0x31/0x37, status 0x15) | Yes | Yes (`device.write([0x11, …])`, report ID first) | Yes |
| Reconnects by itself after a drop | Only if Chrome kept the permission (below) | Yes: poll `HID.devices()` and reopen | Yes |
| Needs a window | A Console window on the laptop | No | No |
| Packaging | None | Native module; prebuilt binaries (v3.4.0, 18 Jul 2026) | A binary to build and sign |

**Blockers and permissions to check:**
- **Exclusive open.** hidapi on the Mac opens devices **seized** (exclusive) by default (`hid_init` calls `hid_darwin_set_open_exclusive(1)`). `node-hid` has `nonExclusive: true` for macOS. Only one program should own the remote: don't run a Node host and the Console's WebHID at the same time.
- **Input Monitoring.** `node-hid`'s Mac notes say a device opened non-exclusively may make macOS ask for permission to read it. That rule is about keyboards; I don't know whether macOS treats a Wii remote as one (WiimotePair issue #12 says it showed up as a "trackpad"). WiiMacMote asks for Input Monitoring. For a Node process started from Terminal, the prompt goes to Terminal. **Unverified; test D.**
- **The Bluetooth privacy prompt** is for apps that use CoreBluetooth or IOBluetooth: the pairing app, not the reader. Opening an already-paired HID device doesn't need it, as far as I found.

**A finding about today's setup.** Chrome keeps a WebHID permission across reconnects and restarts **only if the device reports a serial number** (`HidChooserContext::CanStorePersistentEntry`: serial number and product name not empty). Without a serial, the permission is "ephemeral … and must be granted again each time the device is connected". I couldn't confirm whether macOS gives a Bluetooth Wii remote a serial number (often it's the Bluetooth address). If it doesn't, **every drop at the range limit means the tech clicks Comandament → Connectar on the laptop again**. `knownWiiRemote()` in `driver.ts` can't bring it back on its own. Also, the runbook's laptop Console uses `--user-data-dir=/tmp/quina-console`, and macOS clears `/tmp` on restart. So even with a serial number, the grant is lost on every reboot. Test C checks both. This is the strongest argument *for* the user's idea: a Node reader has no chooser and no grant to lose.

**Rust.** The `hidapi` crate (2.6.7, Aug 2026, about 11 M downloads) wraps the same C hidapi. The Wii crates: `wiimote-rs` (cesmec) says "macOS: not supported at the moment". `wiimote` 0.2.0 (metamuffin, Codeberg) works through hidapi; its page names no platforms, and status reports are "not yet implemented". MaxfieldKassel's WiimotePair PR #1 is a Rust *pairing* app (objc2 bindings to IOBluetooth and CoreBluetooth, with the macOS 27 hook). No crate does more than our protocol needs.

**How big a port is.** `apps/console/wii/` is 1,002 lines in 7 files (the brief lists 6; `shake.ts` is the seventh):

| File | Lines | Tied to |
|---|---|---|
| `driver.ts` | 125 | WebHID: the only transport code |
| `report.ts` | 72 | Pure protocol parsing: runs in Node unchanged |
| `mapping.ts` | 384 | Pure: the user's mapping (R2-Q38, D36) |
| `shake.ts` | 53 | Pure: the three strong shakes |
| `drops.ts` | 15 | Pure |
| `guide.ts` | 19 | The Console's legend and config |
| `controller.svelte.ts` | 334 | Svelte, and the Console's rules: `default-action.ts`, `check.ts`, `scene.ts`, `two-level-lock.ts` (D234) |

The remote's protocol part is small: the output reports 0x11, 0x12 and 0x15, and the input reports 0x20, 0x30 and 0x31, about 200 lines in `driver.ts` + `report.ts`. Swapping `driver.ts` for `node-hid` is about 100 lines of Node, and the pure files come along as they are. Porting to Rust is easy for the transport, about 150 lines. But the mapping and the controller would have to copy the Console's rules: A resolves to the Console's default action at the moment of the press, and the two-level lock comes from the Console's logic. A Rust copy would be a second version of those rules, against D84 and "the UI follows the model". **Keep the mapping in TypeScript, and port only the transport, if anything.**

## 3. Exposing it to Chrome as a standard gamepad

**What it would take:**
- A user-space virtual HID device (`IOHIDUserDeviceCreate`, or CoreHID's virtual device) that Chrome's Gamepad code finds as a Generic Desktop gamepad. This needs the restricted entitlement **`com.apple.developer.hid.virtual.device`**. You request it per App ID in the developer portal (Identifiers → Capability Requests → "HID Virtual Device"), it's granted only through a provisioning profile, and a Developer ID build must embed that profile. Without it, the create call returns NULL. Running as root doesn't help, and AMFI kills an ad-hoc-signed process that claims it. Sunshine (May 2026) and OpenLogi needed exactly this. How fast Apple grants it is unknown: one developer filed a request on 11 Oct 2026 and the outcome isn't public. Dolphin PR #14963 found the same: "Virtual HID is not an option" without the entitlement.
- Karabiner's approach (a DriverKit system extension, VirtualHIDDevice) needs its own DriverKit entitlements from Apple, plus the user approving a system extension in System Settings. More work, not less.
- The user has a developer account (reported in [laptop-app.md](laptop-app.md), not confirmed to the Orchestrator). Even so, the entitlement request is a wait with an unknown end. It can't be on this year's path.

**What a gamepad can't carry, compared with what our driver uses today:**

| Our driver uses | Through a virtual gamepad in Chrome |
|---|---|
| Rumble patterns (a buzz per press, the «no» for D234's lock, one per shake) | No. Chrome's `vibrationActuator` is per controller (Xbox, DualShock 4, DualSense); a generic gamepad gets `null`. Sunshine's author: macOS only sends rumble to a controller it recognises as real, so you'd have to impersonate a DualSense |
| The accelerometer (the three strong shakes, report 0x31) | No motion in the Gamepad API. You could hide the magnitude in an axis, which is a hack |
| LED 1 | No |
| The battery (report 0x20), which the preflight and the Comandament dialog show | No |
| Works in a window without focus | No. Chromium gives gamepads only to a focused page and needs a button press first. The laptop's Console window would lose input whenever the tech clicks elsewhere. WebHID has no such rule |

The user's goal of "no Console page" isn't met either: *something* in Chrome still has to read the gamepad and send the commands, and that something is a Console.

**Compared with the relay's WebSocket:** a Node process that owns the remote and talks to the relay keeps rumble, accelerometer, LEDs and battery, needs no entitlement and no focus, and works with any Console. The relay already forwards `remote.status`. The catch is design, not plumbing. The relay is "a dumb WebSocket hub, no game logic" (`server.ts`, line 1), and the mapping needs the Console's rules. So the Node side has to be one of two things:
- **(a) A transport only:** raw reports to a hosting Console, rumble and LEDs back. Small, but some Console must still host it. If that's the tablet, the remote depends on the tablet's link, and the remote is meant to be the tablet's alternative.
- **(b) A headless Console:** a Node process that imports the pure files and the Console's logic and joins the relay as a console. No window at all. Bigger, and the Console's logic has to stay free of Svelte and DOM.

**"If in future I want to use another remote, I can pair it directly to Chrome":** that already works, with no Mac app. Standard controllers (8BitDo, Xbox, PlayStation) pair from System Settings like any Bluetooth device, and Chrome sees them through the Gamepad API without a chooser. What's missing is only the Console's code to read them (section 4). A Mac app doesn't help that path.

## 4. Hardware alternatives

**Mayflash W010 DolphinBar.** A USB sensor bar with its own Bluetooth chip; the remote pairs with the bar (its own sync), not with macOS. Mode 4 (LED 4) emulates Wii remotes: up to four, with speaker, IR and motion. In mode 4 it shows up as **four HID devices, one per slot, connected or not** (Dolphin's `IOhidapi.cpp`: "The DolphinBar uses EPIPE to signal the absence of a Wii Remote connected to this HID"). Modes 1–3 are keyboard and mouse or gamepad emulation, no use to us.
- On a Mac: I found **no first-hand report** of mode 4 on Apple silicon. A 2015 Dolphin-forum post says mode 4 didn't connect on a Mac; a 2026 article says it's "OS-agnostic" but reads as SEO content. Dolphin reads it through the same hidapi path it uses on every platform, so it's plausible. **Unverified.**
- Chrome's WebHID and `node-hid` would see four `057e:0306` devices. Our `knownWiiRemote()` takes the first one `getDevices()` returns, which may be an empty slot. That's a small driver change: send a status request to each and keep the one that answers. That's code before the freeze, so only if a rehearsal shows the bar works.
- Plugging it in on an Apple-silicon laptop asks "Allow accessory to connect?" (Privacy & Security → Accessories, default "Ask for new accessories"). Click Allow.
- Range: the bar's radio sits wherever the cable ends. A passive USB 2.0 extension is good to about 5 m; longer needs an active (repeater) cable. Put the bar at the stage's edge. Dolphin's wiki says it doesn't expose its Bluetooth adapter, so it can't do Dolphin's passthrough, which we don't need.
- Bonus: it removes the macOS pairing problem entirely. This is the one option that fixes pairing and range together. Price: cheap. **Risk: unknown on a Mac.** Buy one and try it at a rehearsal, never for the first time on the night.

**A USB Bluetooth adapter on an extension cable.**
- *For macOS to use:* the old `bluetoothHostControllerSwitchBehavior=always` trick switches macOS to an external controller. I found no source confirming it works on Apple silicon (the runbook already warns "many adapters and Apple-silicon Macs don't"). **Unverified.**
- *For our own software to use:* Dolphin PR #14963 (open, 30 Oct 2026) drives a CSR8510 dongle **directly through libusb on macOS 27, Apple silicon**, with its own small HCI/L2CAP host. It does SYNC pairing with stored link keys, reconnects on a button press, and handles buttons, rumble and status reports, with macOS's Bluetooth never involved. With `bluetoothHostControllerSwitchBehavior=never`, macOS leaves the dongle alone (Google Bumble's macOS docs). That's the cleanest long-term answer to *both* pairing and range: no private APIs, the radio at the stage. But it means writing a Bluetooth host stack. Research-grade, **not this year**.

**Standard controllers through the Gamepad API.** The future "another remote" path in our Console:
- Pairing: System Settings, normal Secure Simple Pairing. No app.
- Reading: a small Console module that polls `navigator.getGamepads()` every frame and turns the "standard" mapping's buttons into the same names `mapping.ts` already takes (A, B, D-pad, − / + from Select/Start, Home from Guide). The mapping, the badges, the lock and the drops counter stay as they are. About 100–150 lines plus tests; the badges would need the controller's own button names.
- Rumble: `vibrationActuator.playEffect('dual-rumble', …)` works in Chrome for DualShock 4 on macOS (2020 test); for Xbox and DualSense on macOS I found nothing specific. **Unverified per controller.**
- Lost: the shakes (the Gamepad API has no motion), unless we write a WebHID driver per controller; the battery; input while the window isn't focused.
- 8BitDo pads also have a "Switch" mode and other modes; whichever mode Chrome maps as "standard" is the one to use. Untested.
- The USB presenter clicker (→ / PageDown) already works, and has the same focus rule.

## 5. Recommendation

### This year (the code freeze comes after the tech rehearsal; the night is 27 Dec)

Cheap, no code, do before the tech rehearsal:
1. **Fix the runbook's step 7** (the Orchestrator's file; lines for whoever owns it): "At home, before the night, pair the remote once with **MacWiiPair** and the red **SYNC** button under the battery cover, never 1+2. Do it on the main laptop and on the spare. Then press any button on the remote and it reconnects, after reboots too. Don't update macOS after this test; if it updates, test again." Keep the Console → Comandament → Connectar step.
2. **A persistent Chrome profile for the laptop's Console:** not `/tmp/quina-console`, but somewhere that survives a restart (for example under `~/Library/Application Support/`). It belongs in the launcher that [laptop-app.md](laptop-app.md) proposes, which can also open that window by itself.
3. **Four tests with the real remote**, at home, before the tech rehearsal:
   - **A.** System Settings alone, SYNC and 1+2: does it pair? (Expect no. If yes, the runbook gets simpler.)
   - **B.** MacWiiPair with SYNC. Note the model (RVL-CNT-01 or -TR). Then the Console: buttons, rumble, LED 1, battery, the three shakes.
   - **C.** With the remote connected: `ioreg -r -c IOHIDDevice -l | grep -i -A3 nintendo` (look for a `SerialNumber`), then chrome://settings/content/hidDevices. Turn the remote off and on: does the Console reconnect by itself? Restart the laptop and repeat. If it doesn't reconnect, add to the runbook: "after a drop, press a button on the remote, then Comandament → Connectar".
   - **D.** (Only if we go further later.) A 20-line `node-hid` script that lists the remote, sets LED 1 and prints buttons: proves the Node path and shows whether macOS asks for Input Monitoring.
4. **The range:** the walk test stays. Optionally buy a DolphinBar plus a 3–5 m USB extension now and try it at a rehearsal. If it works on the Mac, the small driver change (pick the slot that answers) is a fix-sized change. If it doesn't, nothing changed.
5. Genuine Nintendo remotes only, and spare AA batteries (continuous reporting for the shakes uses them faster).

Risky, don't do this year: our own pairing app (private APIs that macOS 26 and 27 already broke once), moving the remote out of Chrome (a protocol change and a new process, right before the freeze, after the rehearsals tested WebHID), a virtual gamepad (Apple's entitlement, and it loses rumble and the shakes), a USB Bluetooth host stack.

### Later (after the night, with R2-Q26's "nothing installed" item)

1. **The remote's HID moves out of Chrome, into Node on the laptop.** Swap `driver.ts` for `node-hid`, reconnect by vendor and product ID with no chooser, and drop WebHID entirely (D84: one way, not two). Best done as a headless Console (option b above), so no window is needed. That means keeping the Console's logic files free of Svelte and DOM. If a Mac app is built later (Electron or a launcher), it runs this same Node code.
2. **Pairing:** keep using MacWiiPair (or WiimotePair once it ships a fix) rather than writing our own. If the user wants one app, the pairing part is Swift or Rust objc2 with the private hook, and someone owns fixing it after every macOS release.
3. **Standard controllers:** the Gamepad API module in the Console (section 4), for an 8BitDo or a console pad as the future remote, without shakes.
4. **Range, for good:** a DolphinBar if it proved itself; or, as a bigger project, a libusb Bluetooth host on a USB dongle at the stage (Dolphin's wmhci approach). That one would remove both macOS pairing and the range limit.

## Sources

Repo: `legacy/2025/client/src/WiiMoteSection.tsx`, `legacy/2025/client/src/utils/WiimoteLib/WiiMote/WiiMoteConnectionHelper.ts`, `apps/console/wii/*.ts`, `apps/console/config.ts`, `apps/show/relay/server.ts`, `docs/night-runbook.md`, `docs/research/reports/laptop-app.md`. This laptop: `sw_vers` (macOS 27.0.1, 26A434), `system_profiler SPBluetoothDataType` (Apple BCM_4387, HID supported).

Pairing:
- [dolphin-emu/WiimotePair](https://github.com/dolphin-emu/WiimotePair) (README, `ViewController.m`, releases, issues [#5](https://github.com/dolphin-emu/WiimotePair/issues/5), [#6](https://github.com/dolphin-emu/WiimotePair/issues/6), [#12](https://github.com/dolphin-emu/WiimotePair/issues/12), [#16](https://github.com/dolphin-emu/WiimotePair/issues/16), [#17](https://github.com/dolphin-emu/WiimotePair/issues/17), [#19](https://github.com/dolphin-emu/WiimotePair/issues/19), PRs [#20](https://github.com/dolphin-emu/WiimotePair/pull/20), [#21](https://github.com/dolphin-emu/WiimotePair/pull/21))
- [natel97/wiimote-chrome PR #2](https://github.com/natel97/wiimote-chrome/pull/2)
- [aureliothuerch/MacWiiPair](https://github.com/aureliothuerch/MacWiiPair)
- [MaxfieldKassel/WiimotePair PR #1](https://github.com/MaxfieldKassel/WiimotePair/pull/1) (the macOS 27 root cause)
- [gdemontalivet/wiimacmote](https://github.com/gdemontalivet/wiimacmote)
- [blueutil gist](https://gist.github.com/gingerbeardman/05030c73714b3aa3202aeee7f21c3b1e)
- [Dolphin docs PR #14937](https://github.com/dolphin-emu/dolphin/pull/14937)
- [Dolphin: Wii Remote Plus (-TR) guide](https://www.dev.dolphin-emu.org/docs/guides/wii-remote-plus-rvl-cnt-01-tr-connection-guide/)
- [Dolphin forums: RVL-CNT-01-TR not working (mac)](https://forums.dolphin-emu.org/Thread-rvl-cnt-01-tr-not-working-mac)
- [Apple Community: High Sierra passkey](https://discussions.apple.com/thread/8421905)
- [Hawkdive](https://www.hawkdive.com/wii-remote-mac-bluetooth-pairing-fix/) (low reliability)

Protocol:
- [WiiBrew: Wiimote](https://wiibrew.org/wiki/Wiimote) (PINs, bonding, reconnection, stored hosts, -TR and SET_REPORT, report modes, status report)
- [Julian Löhr's HID Wiimote notes](https://www.julianloehr.de/)

Reading outside Chrome:
- [Dolphin `WiimoteReal` sources](https://github.com/dolphin-emu/dolphin/tree/master/Source/Core/Core/HW/WiimoteReal) (`IOhidapi.cpp`, `WiimoteReal.cpp`)
- [hidapi `mac/hid.c`](https://github.com/libusb/hidapi/blob/master/mac/hid.c)
- [Chromium `hid_connection_mac.cc`](https://chromium.googlesource.com/chromium/src/+/main/services/device/hid/hid_connection_mac.cc)
- [Chromium `hid_chooser_context.cc`](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/hid/hid_chooser_context.cc) (persistent permission needs a serial number)
- [node-hid](https://github.com/node-hid/node-hid) and [npm](https://www.npmjs.com/package/node-hid)
- crates.io: [hidapi](https://crates.io/crates/hidapi), [wiimote-rs](https://github.com/cesmec/wiimote-rs), [wiimote (metamuffin)](https://codeberg.org/metamuffin/wiimote-rs)

Virtual gamepad and the Gamepad API:
- [Sunshine PR #5171](https://github.com/LizardByte/Sunshine/pull/5171)
- [OpenLogi #1917](https://github.com/AprilNEA/OpenLogi/issues/1917)
- [macgip #3](https://github.com/leetrout/macgip/issues/3)
- [Apple forums: HIDDriverKit](https://developer.apple.com/forums/tags/hiddriverkit)
- [docs.rs: IOHIDUserDevice](https://docs.rs/objc2-io-kit/latest/objc2_io_kit/struct.IOHIDUserDevice.html)
- [MDN: vibrationActuator](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/vibrationActuator)
- [web.dev: Gamepad](https://web.dev/articles/gamepad)
- [Medium: GamePad API quick view](https://medium.com/@Yodairish/quick-view-gamepad-api-29d9752f0134) (DualShock 4 rumble on macOS Chrome)
- [OBS #11694](https://github.com/obsproject/obs-studio/issues/11694) and [FarmXP #264](https://github.com/Gabriel-Andraade/FarmXP_Browser/issues/264) (focus)

Hardware:
- [Dolphin wiki: Bluetooth Passthrough](https://wiki.dolphin-emu.org/index.php?title=Bluetooth_Passthrough)
- [Dolphin PR #14963 (wmhci)](https://github.com/dolphin-emu/dolphin/pull/14963)
- [Batocera: DolphinBar](https://wiki.batocera.org/hardware:dolphinbar?do=export_pdf)
- [LaunchBox forums](https://forums.launchbox-app.com/topic/30137-retroarch-mayflash-and-dolphinbar/)
- [Steam community: DolphinBar](https://steamcommunity.com/discussions/forum/1/3368153565086723331)
- [Alibaba guide](https://electronics.alibaba.com/buyingguides/wii-remote-setup-for-dolphin-pc-guide) (low reliability)
- [Google Bumble: macOS](https://google.github.io/bumble/platforms/macos.html)
- [Apple: Allow accessories to connect](https://support.apple.com/en-us/102282)

## Not verified

- Pairing from System Settings alone on macOS 27 (test A).
- MacWiiPair with a -TR remote, and whether macOS sends output reports on the channel a -TR accepts (test B).
- Whether a Bluetooth Wii remote has a serial number on macOS, which decides whether Chrome keeps the WebHID permission (test C).
- Whether macOS asks for Input Monitoring for a Node process (test D).
- The remote keeping bonds to two Macs.
- The DolphinBar's mode 4 on Apple silicon.
- An external Bluetooth adapter used by macOS on Apple silicon.
- Rumble through the Gamepad API for Xbox and DualSense pads on macOS.
- How fast Apple grants the virtual HID entitlement.
- MacWiiPair's signature (taken from its README).
