# An Android app for the show

Research for the user's question (28 Nov), asked during the [laptop app](laptop-app.md) research: "also explore if making a android app would be a good option". The user said it's a separate piece of research. It is also separate from [android-twa-and-install.md](android-twa-and-install.md), which covers the player app on Google Play.

## The answer

No, not this year. An Android device can't stand in for the show laptop. The Wii remote can't pair with stock Android at all. The relay's Node server and its Python Blend renders would have to be rebuilt inside an app. Chrome on Android pauses a page that isn't in front. Video and audio out to a projector and the PA depend on the model. It would take weeks, it reopens R2-Q26, and nobody could rehearse it before the code freeze. An Android app just for the console (a wrapper on the tablet) is possible, but it only fixes keeping the screen awake, and a one-time setting already does that.

## Two ways to read the question

1. **An Android phone or tablet runs the show instead of the laptop** (the relay, the link, the show page and its audio, the projector, the Wii remote).
2. **An Android app for the console on the shared tablet**, instead of opening it in the browser.

## 1. Android instead of the show laptop

| What the show laptop does today | On Android |
|---|---|
| **The relay** (Node 23.6 or newer, running the repo's `.ts` files directly) | Only inside an app that embeds Node. nodejs-mobile now has Node 24, whose full build keeps TypeScript stripping. The lite build drops it. Only one Node runtime per app. Or Termux, which is a developer tool, not a non-developer's app |
| **The Blend renders** (the relay starts Python with numpy, soundfile and Rubber Band during the show) | No Python, no Homebrew. Rubber Band would need building for Android and Python embedding (for example Chaquopy), or a rewrite. Not tried by anyone here |
| **The show page and its Web Audio** (Chrome with anti-throttling flags, in kiosk mode) | Chrome on Android can't take those flags, and it throttles or freezes a page that leaves the foreground. A WebView in our own app avoids that, but it's a different engine setup to test. Web Audio latency varies by model: about 40 ms on phones with Android's low-latency path, hundreds of ms on others |
| **The Wii remote** (paired in the Mac's Bluetooth, then WebHID in Chrome) | **Blocked.** The Wii remote only does legacy PIN pairing, with a raw binary PIN, and stock Android's Bluetooth stack can't do that (since about Android 6). WebHID did reach Chrome for Android in Chrome 158 (17 Nov 2026), but only on Android 17 or newer, and never in a WebView. That doesn't help if the remote won't pair. The only route is a USB adapter (a DolphinBar-like device), untested here |
| **The projector on HDMI and the PA on a cable** | Needs USB-C video out (many phones have none; Samsung DeX and some tablets do) plus a hub for audio, power and HDMI on one port. Depends on the model |
| **The preflight's checks** (audio output, displays, sleep, power, clock) | All written for macOS (`system_profiler`, `pmset`). They would need rewriting |
| **The 8 GB of media** | Fits on many devices, but `npm run media -- pull` would have to run inside the app |
| **Installing it** | A sideloaded APK, no Play Store. Spain is not yet under Google's developer verification (in force since 30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand; global from 2027), so "install unknown apps" still works. Publishing on Play would need the 14-day closed test from the TWA report |

**Effort:** weeks. It would be a new app, a port of the relay and the Blend renders, and a new device for the presenters, with no Wii remote. Owners would be all three sessions: Sound engine (the engine and the relay), Backend (the link, the media and the setup) and Frontend (every screen).

**Against the decisions:**
- **R2-Q26 (Active):** the show runs on an installed laptop, and "nothing installed" waits until after this year.
- **ADR-0002:** the audio may run on a second device near the mixer, synced by landing times announced in advance. That's the one place an Android device could fit later, as an audio player only. Today it's a supported mode, not a built device.
- **The code freeze** after the tech rehearsal.

**Flag:** don't start this unless the user reopens R2-Q26.

## 2. An Android app for the console

The console is already a web page, and both iPad and Android tablets must work (D54; checking them on real devices is U19).

**What a wrapper app would fix:**
- **Keeping the screen on.** Over the hotspot's plain `http`, the console can't hold a Screen Wake Lock, so the runbook turns the tablet's Auto-Lock off by hand. A native app can keep the screen on by itself.

**What it wouldn't fix, or would add:**
- **A TWA can't host the LAN console.** A TWA needs an `https` origin with Digital Asset Links, and the LAN console is `http://<laptop IP>:5174`. Only a plain WebView app would load it, and a WebView has no WebHID. That doesn't matter, though: the Wii remote pairs with the laptop, not the tablet.
- **The iPad gets nothing.** A second way to open the console next to the web page is close to the fallback versions D84 rules out (flag, not a ruling).
- **A sideloaded APK to install and keep updated** on the tablet, signed by the developer.
- **Effort:** a day or two for a WebView wrapper, plus a device test. The owner would be Frontend (the console), with Backend for the build.

**Verdict:** not worth it. Setting the tablet's screen timeout to the longest is a one-time setting, and it's already in the runbook.

## Not verified

- Which Android tablets and phones have USB-C video out good enough for the projector.
- Whether a DolphinBar-like USB adapter would talk to WebHID on Android 17.
- Whether nodejs-mobile's Node 24 runs the relay unchanged: `ws`, `node:child_process` (no Python to start anyway), and its file paths.
- Measured Web Audio latency on any specific Android device.

## Sources

- Chrome 158: "brings the existing WebHID API to Chrome on Android", "relying on new OS support in Android 17 / API level 37 and later"; WebView not supported. [Chrome Platform Status: release notes 158](https://chromestatus.com/release-notes/158), [GIGAZINE](https://gigazine.net/gsc_news/en/20261118-google-chrome-158/)
- Wii remote pairing: legacy PIN pairing only, a binary PIN, no Secure Simple Pairing; not possible on stock Android's Bluetooth stack. [WiiBrew: Wiimote](https://wiibrew.org/wiki/Wiimote), [GBAtemp: Wii Remote pair code on Android](https://gbatemp.net/threads/wii-remote-pair-code-on-android.522035/), [RetroArch issue 9732 (DolphinBar)](https://github.com/libretro/RetroArch/issues/9732)
- Node on Android: nodejs-mobile with Node 24, full vs lite builds, one runtime per app, Android 7 and NDK r24 or newer. [digidem/nodejs-mobile](https://github.com/digidem/nodejs-mobile), [nodejs-mobile: getting started on Android](https://nodejs-mobile.github.io/docs/guide/guide-android/getting-started/)
- Web Audio latency on Android: device-dependent, about 40 ms with the low-latency path, up to hundreds of ms without. [Chromium issue 40103372](https://issues.chromium.org/issues/40103372), [Android CDD: audio latency](https://android.googlesource.com/platform/compatibility/cdd/+/refs/heads/master/5_multimedia/5_6_audio-latency.md), [audiolab.tools](https://audiolab.tools/insights/realtime-audio-in-the-browser)
- Android developer verification: in force since 30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand; global in 2027; the advanced flow and ADB for unverified apps. [Android Authority: timeline](https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/), [Android Authority: bypassing it](https://www.androidauthority.com/how-to-bypass-android-developer-verification-sideloading-rules-3718002/)
- TWA needs an `https` origin with Digital Asset Links. [Chrome for Developers: Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/)
