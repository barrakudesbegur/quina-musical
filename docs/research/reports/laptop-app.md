# A laptop app for the night

Research for the user's question (28 Nov): "would it be easy to do and a good idea to make a simple macos (and also a windows and linux version) of the software i need to run in the laptop? if i need to use another laptop, using the commandline may not be ideal on a non-developer computer."

## The answer

A double-click launcher for macOS is easy and worth doing: about a day's work, with nothing to sign. A full desktop app (Electron or Tauri), or Windows and Linux versions, are not easy and are not a good idea for this year. The show depends on things a package doesn't remove: Google Chrome with special flags, a Python helper with the Rubber Band library that the relay runs during the show, and macOS-only setup and preflight checks. Windows and Linux would be a port, not a package, and nobody could test it on real hardware before the code freeze. The decided plan (R2-Q26) already says the spare laptop is an **installed** Mac, prepared in advance by `npm run setup:laptop`, and that "nothing installed" waits until after this year. So the smallest useful step is: the tech prepares the spare at home, and a "Start the Quina" double-click file on it replaces the terminals on the night.

If the user has an Apple Developer account (reported during this research, not yet confirmed to the orchestrator), that removes the cost of signing and notarizing a macOS app, but a launcher made inside the cloned repo doesn't need signing at all (below).

## What the laptop runs today

From [night-runbook.md](../../night-runbook.md), [operations.md](../../requirements/operations.md), `apps/show/package.json`, `apps/show/relay/server.ts`, `tools/laptop/setup.ts`, `apps/cloud/laptop/preflight/gather.ts` and the two handoffs.

**Processes on the night**, each in its own Terminal window today:

| What | Command | What it does |
|---|---|---|
| Keep awake | `caffeinate -dis` | Stops the Mac and its display sleeping |
| The relay | `cd apps/show && npm start -- --lan --repertoire 2026` | `vite build`, then a Node HTTP and WebSocket server on port 5174. It serves the pages and the repertoire's media from `data/`, forwards commands between the consoles and the show page, and refuses a stale build. It **spawns Python** (`tools/prep/.venv`) for the Blend renders (`/api/stretch`, `stretch.py` with numpy, soundfile and Homebrew's `librubberband.dylib` through ctypes). Without that venv the relay crashes at the first Check (Backend handoff) |
| The cloud link | `cd apps/cloud && npm run link` | Node: relay ↔ the Worker, with the laptop's Access service token from `apps/cloud/.env.link` |
| The preflight | `cd apps/cloud && npm run preflight` | Node: checks the repertoire's media hashes, the build, the cloud, and macOS settings through `system_profiler`, `pmset`, `defaults`, `sntp` and `ps` |
| The show page | `open -na "Google Chrome" --args --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --kiosk "http://localhost:5174/show/?autostart=1"` | **The audio engine runs here, in Chrome, with Web Audio** (`apps/show/engine/src`). The show page owns the show state and plays through the system's default output |
| The console on the laptop | Chrome at `http://localhost:5174/console/` (an `--app` window in "Without the tablet") | Needed whenever the Wii remote is used: the remote talks **WebHID** to this Chrome window |

**How the devices connect:**
- **The tablet** joins phone A's hotspot and opens `http://<laptop IP>:5174/console/?t=<token>` over the LAN, plain http. Away from the hotspot it uses the cloud console.
- **The Wii remote** pairs with the laptop's Bluetooth, then the console on the laptop opens it through WebHID (`apps/console/wii/driver.ts`). WebHID exists only in Chrome and Edge on desktop.
- **The projector** is an HDMI display; the PA is a cable from the laptop.

**System dependencies on the show laptop** (what `setup.ts` checks): macOS (it stops on anything else), Node 23.6 or newer (Node's own TypeScript stripping runs the `.ts` files directly), `uv` (for the Python venv), Homebrew's `rubberband`, Google Chrome in `/Applications`, at least 10 GB free. **ffmpeg and the full prep Python (torch, librosa…) are only for preparing a repertoire, never on the night laptop**; the night laptop's venv has only `requirements-show.txt` (numpy, soundfile).

**The media:** repertoire 2026 is 8.04 GB in R2 (2,772 blobs). `npm run media -- pull` rebuilds it into the repo's `data/cache` and `data/out` folders and checks every hash; it resumes after a cut. The relay reads it from those repo paths.

## What a second laptop needs from scratch

The runbook's "Prepare a spare laptop", done at home with good internet:
1. Homebrew, then `brew install node uv rubberband git`, and Google Chrome.
2. `git clone` the public repo.
3. `apps/cloud/.env.link` (the laptop's Access service token) from the organizers' password manager or AirDrop. Never by chat or email.
4. `npm run setup:laptop`: `npm ci`, the Python venv, the media pull (about 7 GB), the Game plan and its logos, then the preflight. Safe to rerun.

Steps 1, 2 and 4 are terminal work. Installing Homebrew also asks for an admin password and installs Apple's command-line tools. That part is the real hurdle for a non-developer, and **no launcher removes it**; only a fully bundled app would (option c), and even that still needs Chrome and the 8 GB pull.

## The options

| | (a) Double-click launcher | (b) Single bundled binary | (c) Desktop app (Electron) | (c′) Desktop app (Tauri) |
|---|---|---|---|---|
| **What it is** | A `Start the Quina.command` in the repo (macOS), calling one new script that starts caffeinate, the relay, the link, opens Chrome with the flags and runs the preflight. Optionally a `.app` wrapper (AppleScript applet or Platypus) | Node SEA, `bun build --compile` or `deno compile` of the relay and link, with the built pages inside; it opens Chrome | One window: pick the repertoire, sync the media, start, preflight, status, the tablet's address and QR. Ships its own Chromium and Node | The same window, using the system's web view |
| **Still needs installed** | Everything `setup:laptop` installs (Node, uv, Rubber Band, Chrome, the repo, the media) | Chrome, Python with numpy, soundfile and Rubber Band (a binary can't embed them), the media, `.env.link` | The media and `.env.link`. Python and Rubber Band must be bundled per platform | Same as Electron, plus a Node or Rust rewrite of the relay |
| **Changes in the repo** | One script (for example `npm run night`) and one `.command`; the runbook's steps 3–5 and 8 collapse into one | Bundle the TS relay and link (esbuild or Bun), move `data/` out of the repo, a build per platform | A new `apps/laptop` package; data paths moved; the Wii picker rewritten with Electron's `select-hid-device`; window placement on the projector; CI builds and signing | All of Electron's, plus WebHID is missing on macOS and Linux (WebKit), so the Wii remote needs a native HID path |
| **Owner** | Backend (owns `tools/laptop` and the laptop setup), with Sound engine for the relay's flags | Sound engine (the relay) and Backend (the link, packaging) | All three: Sound engine, Backend, Frontend (the window is a screen) | All three |
| **Work** | About a day, including a test and the runbook | Several days, and Python stays outside | One to three weeks, then re-rehearsal | More than Electron |
| **macOS signing** | None: files from `git clone` carry no quarantine flag, so Gatekeeper doesn't check them (checked on this repo: only `com.apple.provenance`). A `.command` sent by AirDrop or download would be quarantined | Needed if downloaded: Developer ID + notarization (the user's account, if confirmed) | Same; hardened runtime plus entitlements for the spawned Python and its unsigned dylib (unverified) | Same |
| **Windows and Linux** | Possible as `.bat`/`.ps1` and `.desktop`, but the stack under them is macOS-only today (below) | Bun cross-compiles to all three; the stack under it still doesn't run there | Electron builds all three; each needs Rubber Band, Python and testing on real hardware | Same, with a different web engine on each OS |
| **Auto-update** | `git pull` + `setup:laptop`, as today | Download a new build | electron-updater; needs signed builds | Tauri's updater; needs signed builds |
| **Changes what the rehearsals tested** | No: the same commands and the same Chrome | A little: a different Node runtime (or Bun) | Yes: a different Chromium build, no Chrome profile, new device and window code | A lot: WebKit instead of Chrome on macOS |

**Other options worth naming:**
- **One `npm run night` command** with no launcher at all. It removes four terminals and the long Chrome line, and it's the core of option (a) anyway.
- **A `Prepare this laptop.command`** that runs `setup:laptop`. It helps only after Homebrew and the clone exist, so it saves little.
- **A status page instead of a status app.** The preflight's result, the tablet's address and its QR could be a page the relay serves on the laptop, which keeps it in the browser everyone has tested. A menu-bar app adds a native process for no clear gain.

## Why Windows and Linux are a port, not a package

Today's code assumes a Mac in several places:
- `tools/laptop/setup.ts` stops on anything but macOS;
- `tools/prep/steps/rubberband.py` loads Homebrew's `librubberband.dylib` (pylibrb is only a constant-ratio fallback, which lacks the key-frame map the Blends need);
- the preflight's Laptop group (audio output, displays, sleep, power, clock, reduce motion) runs only on macOS and otherwise only warns "check by hand";
- the runbook's `caffeinate` and `open -na "Google Chrome"`.

Neither Windows nor Linux has ever run the show. A Windows or Linux spare would need the Blend renders, the Chrome flags, the Wii remote over WebHID and the preflight checks ported and tried at a rehearsal. That's new work for Sound engine and Backend, and it lands right before the code freeze ("After the tech rehearsal: only fixes", [timeline.md](../../timeline.md)).

## Risks on the night

| Risk | Today, with the command line | A launcher (a) | A packaged app (c) |
|---|---|---|---|
| **Audio output and latency** | Web Audio in Chrome, to the system's default output; the preflight checks the output device. Latency is Chrome's, already rehearsed | Same | Electron: same engine, new build; could add an output picker (`setSinkId`), which is new code. Tauri on macOS: WebKit's Web Audio, never tested |
| **Sleep and screen lock** | `caffeinate -dis` by hand; the preflight checks `pmset` | Fixed: the launcher starts caffeinate itself | Fixed: Electron's `powerSaveBlocker` |
| **Firewall for the LAN relay** | macOS: the firewall is off by default (off on this laptop); if on, it asks once for Node. Not a new risk | Same | A new signed app asks again once. **Windows** asks on the first listen, and a hotspot is a "Public" network by default, so the tablet can be blocked unless Public is ticked |
| **Browser and autoplay** | Chrome with the autoplay and anti-throttling flags; the preflight FAILs a throttled Chrome | Same flags, typed by the script instead of by hand: fewer typing mistakes | Electron: the same switches in code. Tauri: no such flags on WebKit |
| **The show window on the projector** | Kiosk opens on the main display; "Without the tablet" needs the projector set as main display by hand | Same | Electron could place it on the projector itself (new code to test) |
| **Wii remote pairing** | macOS Bluetooth, then Chrome's WebHID picker in the console | Same | Electron has no picker: its `select-hid-device` handler must be written and tested. Tauri: no WebHID on macOS |
| **Closing a window stops the show** | Closing a terminal stops the relay or the link | Same, but one window instead of four | Quitting the app stops everything at once |
| **Behaviour the rehearsals tested** | It is what they test | Unchanged | Changed: the rehearsals would have to be done again on the app |

## Recommendation

Not a full app, and not Windows or Linux, this year. In order:
1. **The spare laptop stays a Mac, prepared by the tech at home** with `npm run setup:laptop` (R2-Q26, the runbook). The prep needs Homebrew and a terminal, so it's the developer's job, and it's done once.
2. **Build the smallest launcher before the tech rehearsal:** one `npm run night -- --repertoire 2026` (caffeinate, relay with `--lan`, link, the show page in Chrome with the flags, then the preflight; `--laptop-only` and `--fresh` as options) and a `Start the Quina.command` in the repo that runs it. Owner: Backend (`tools/laptop`), checked by Sound engine for the relay. Use it at the tech rehearsal and on the spare, so the night runs exactly what was rehearsed.
3. **Optionally,** a `.app` wrapper signed with the user's Developer ID, only if the user wants an icon in the Dock. It adds nothing the `.command` lacks.
4. **After the night,** if the user still wants a non-developer laptop: an Electron app is the only option that keeps Chrome's engine and WebHID. It fits the deferred "nothing installed" item (R2-Q26).

## Decisions this touches

- **R2-Q26 (Active):** the show laptop is installed (the repo, Node, the relay, the link) and any laptop becomes show-ready with one setup command; "nothing installed" is deferred until after this year's event. A full desktop app or a Windows spare would reopen it. **Flag:** don't start (b) or (c) without the user reopening R2-Q26.
- **ADR-0003 and R2-Q1e:** the cloud owns the Game, the laptop owns playback, and a prepared laptop resumes from the cloud. A launcher changes nothing here.
- **R2-Q1f:** a simple Plan B when 5G drops; the user asked to keep it simple. A launcher fits it.
- **D84:** no fallback versions in the code. A desktop app next to the command-line path would be two ways to run the night; a launcher that calls the same commands isn't.
- **The code freeze** after the tech rehearsal ([timeline.md](../../timeline.md)): anything here must be built and rehearsed before it.
- The runbook already assumes a Mac spare and a cabled PA, never Bluetooth or AirPlay ([operations.md](../../requirements/operations.md) › Where things run).

## Not verified

- Whether an Electron app that spawns the venv's Python and loads an unsigned `librubberband.dylib` notarizes without extra entitlements (likely needs `disable-library-validation`; not tried).
- Rubber Band on Windows and Linux with the key-frame map: not tried. It's GPL-2.0-or-later (the repo is MIT), which matters only if a bundle is ever handed out.
- Exact Chromium and Node versions inside a current Electron, and whether its Node runs the repo's `.ts` files directly (it would likely need a bundling step).
- macOS's Local Network privacy prompt for a packaged app: not checked.
- App sizes are from comparison blogs, not measured.

## Sources

- Node SEA: still "Stability 1.1, Active development"; one embedded script (CJS or ESM), assets via `node:sea`; `--build-sea` since v25.5.0; macOS output must be codesigned. [nodejs.org: Single executable applications](https://nodejs.org/api/single-executable-applications.html), [killerwolf/node-sea](https://github.com/killerwolf/node-sea)
- Bun `--compile` cross-compiles to macOS, Windows and Linux; binaries about 50–120 MB. [bun.com: Single-file executable](https://bun.com/docs/compiler/executables), [Bun v1.1.5](https://bun.sh/blog/bun-v1.1.5), [zenn.dev: Deno to Bun](https://zenn.dev/dyoshikawa/articles/deno-to-bun-single-binary?locale=en)
- Electron vs Tauri sizes (Electron about 85–250 MB, Tauri about 3–15 MB; Tauri uses WKWebView on macOS and WebKitGTK on Linux). [Better Stack](https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/), [PkgPulse](https://www.pkgpulse.com/blog/best-desktop-app-frameworks-2026), [Tauri: Webview versions](https://v1.tauri.app/v1/references/webview-versions/)
- WebHID: Chrome and Edge desktop only, never Safari or WebKit. [TestMu: WebHID browser support](https://www.testmuai.com/learning-hub/webhid-browser-support/). Electron's HID handlers: [Electron: Device Access](https://www.electronjs.org/docs/latest/tutorial/devices), [Electron: session](https://www.electronjs.org/docs/latest/api/session)
- Gatekeeper since macOS Sequoia: no right-click → Open; System Settings → Privacy & Security → Open Anyway, once per app; only quarantined files are checked. [Michael Tsai](https://mjtsai.com/blog/2024/07/05/sequoia-removes-gatekeeper-contextual-menu-override/), [Hacks Guide wiki](https://wiki.hacks.guide/wiki/Open_unsigned_applications_on_macOS_Sequoia_and_newer), [AppleInsider forums](https://forums.appleinsider.com/discussion/238106)
- Apple Developer Program: 99 USD a year, includes Developer ID and notarization. [flaviocopes.com](https://flaviocopes.com/apple-developer-free-vs-paid/), [asogauge.com](https://asogauge.com/blog/apple-developer-account/)
- Windows signing and SmartScreen: unsigned apps get "More info → Run anyway"; EV no longer skips SmartScreen; Azure Artifact Signing (formerly Trusted Signing) from 9.99 USD a month, limited regions. [Microsoft: SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [Microsoft: Code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [gdgsoft FAQ](https://www.gdgsoft.com/faq/azure-trusted-signing-cost-effective-exe-code-signing)
- Windows Firewall's prompt on a Node server's first listen, and Public vs Private networks. [vitejs/vite #23766](https://github.com/vitejs/vite/issues/23766), [How-To Geek](https://www.howtogeek.com/435610/why-does-windows-defender-firewall-block-some-app-features/)
