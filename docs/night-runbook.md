# Quina Musical: night runbook

One page for the organizers, next to the cheat sheet. The show runs on the **laptop**; the cloud only feeds the phones and remote consoles. If the internet fails, the show goes on.

## Setting up (in this order)

1. **Phone A** (main): plug it into the laptop by USB and turn on **USB tethering** and its **personal hotspot**. The hotspot must have a **password**. **Phone B** (another carrier): charged, hotspot ready as the backup.
2. **Laptop**: plug in the power. Plug the **PA in with a cable** (headphone jack, USB or HDMI), never Bluetooth or AirPlay. Connect the **projector** by HDMI.
3. **Keep the laptop awake**: in a terminal, run `caffeinate -dis` and leave it open. If the projector runs from a second computer, keep that one awake with its own system setting too. Over the hotspot's plain `http`, pages can't keep a screen awake by themselves.
4. **Start the show** (each in its own terminal, and leave them open):
   - the relay: `cd apps/show && npm start -- --lan --repertoire 2026`. It builds the show first, then serves it, and refuses to start an out-of-date build (since 27 Nov, f89d972; that day's test ran a build two days old, with no Pausa). Without `--lan` it only listens on the laptop and the tablet can't reach it. At start it prints the tablet's pairing address with its **token** (`?t=…`);
   - the cloud link: `cd apps/cloud && npm run link`. It should say `cloud: connected`.
5. **Open the show page on the projector**:
   `open -na "Google Chrome" --args --user-data-dir="$HOME/Library/Application Support/Quina/chrome-show" --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --kiosk "http://localhost:5174/show/?autostart=1"`
   Never minimise or cover the show window. The flags above stop Chrome slowing down a hidden show page (the music would keep playing, but transitions could stall). For the night's Game, add `&fresh=1` the first time, so the rehearsal's Game isn't continued. Its profile folder keeps the show page's own copy of the Game, its display offset and the music's place across a restart: never use a folder in /tmp, which macOS empties at every restart.
6. **Tablet**: join phone A's hotspot and open the console with the token: `http://<laptop IP>:5174/console/?t=<token>` (the address and token the relay printed, or the console's QR). The tablet remembers the pairing, even across relay restarts, so a tablet paired at the rehearsal stays paired. Treat the token like the hotspot password: no photos. Away from the hotspot, the tablet uses the cloud console instead (the cloud's address + `/console/`). **Turn the tablet's Auto-Lock off for the night** (iPad: Settings → Display & Brightness → Auto-Lock → Never; Android: Display → Screen timeout, the longest). Over the hotspot's plain `http` the console can't keep the screen on by itself.
7. **Wii remote** (optional; it pairs with the **laptop**, not the tablet):
   - **Pair it once, at home, on each laptop, with a pairing app.** System Settings can't pair a Wii remote: it needs a binary PIN the dialog can't type. 2025's app, WiimotePair, fails on macOS 26 and 27. MacWiiPair is reported to work on macOS 27.0.1 (to be tried, U220). Pair with the red **SYNC** button under the battery cover, not 1+2. The pairing survives reboots, and any button press reconnects the remote. Don't update macOS after pairing without trying it again.
   - Open the console on the laptop with its own profile: `open -na "Google Chrome" --args --user-data-dir="$HOME/Library/Application Support/Quina/chrome-console" --no-first-run --no-default-browser-check --app=http://localhost:5174/console/` (on the laptop itself it needs no token), then menu → **Comandament** → **Connectar**, and pick it from the list. Keep that console window open on the laptop's own screen. If the console doesn't reconnect the remote by itself after a drop or a restart (U220), press a button on the remote, then **Comandament** → **Connectar** again.
   - **Range test**, at the setup and at every rehearsal. In 2025 the range from the stage to the laptop was at the limit. Stand where the presenters will stand, at both ends of the stage, and press a **D-pad arrow** every few seconds for a minute: each press plays an effect through the PA. Every press should play at once, and the console must not say «S'ha desconnectat».
   - If presses get lost or it disconnects:
     - move the laptop nearer the stage, in sight of it (no metal or crowd in between, lid open);
     - or put a USB Bluetooth adapter on a USB extension cable near the stage. On a Mac this only helps if macOS actually uses the adapter instead of its own Bluetooth, and many adapters and Apple-silicon Macs don't. Try it at a rehearsal, never for the first time on the night;
     - otherwise the presenters use the tablet: it does everything the remote does.
   - The preflight shows whether the remote is connected, its battery, and how often it dropped in the last 10 minutes. It warns from 2 drops, like the console. A remote at the edge of its range drops, but only this walk test shows the range before it does.
8. **Run the checks**: `cd apps/cloud && npm run preflight`. **Fix every FAIL** before the doors open; read the WARNs.
9. **Sound check**: play an effect from the console at low volume, then a few seconds of Hold music. Tap a few tablet buttons near the microphones: if the PA carries the clicks, switch the tablet's sounds off in its settings (D208).

At each Shuffle, note the round's **resume code** (console → **Codi de recuperació de la quina** → **Mostra el codi**). Keep it like the box of cards: never on a screen, never in a photo.

## Without the tablet

If the presenters don't want the tablet, or it fails, the **tech drives the whole show from the laptop** and the presenters advance by hand or with the Wii remote. Set up as above (the tablet's step 6 can be skipped), with these changes:

1. **The projector as a separate display, never mirrored.** System Settings → Displays → select the projector → **Use as: Main display**. The console will be on the laptop's own screen: mirrored, the next song and the possible winners would be on the projector for everyone.
2. **The show page** (step 5): with the projector as the main display, the kiosk window opens on it.
3. **The console on the laptop's screen:** `open -na "Google Chrome" --args --user-data-dir="$HOME/Library/Application Support/Quina/chrome-console" --no-first-run --no-default-browser-check --app=http://localhost:5174/console/`, then move its window to the laptop's screen (drag it there, or Window → Move to the built-in display). On the laptop itself it needs no token. This is also the console that hosts the Wii remote (step 7).
4. **Run the checks** with `npm run preflight -- --laptop-only`. It fails if the console isn't open or the projector mirrors the laptop's screen, and it doesn't need the tablet's LAN address.
5. **Drive from the console.** The show page's keys (→, Space…) only work while its window has focus, and that window is on the projector, so stay on the console.
6. **The presenters can advance by hand** with a **USB presenter clicker** plugged into the laptop: with the console window focused, its → (or PageDown) does the console's default action, the same as the Wii remote's A. It does nothing while typing, with a dialog open, or on a held key. Back, Parlem and the rest stay on the console's screen. The Wii remote works here too (step 7).

## Prepare a spare laptop

Do this at home, the day before or earlier, with good internet: it downloads about 7 GB.

1. Install Homebrew (brew.sh), then run `brew install node uv rubberband git`. Also install Google Chrome.
2. `git clone https://github.com/barrakudesbegur/quina-musical && cd quina-musical`
3. Get `apps/cloud/.env.link`, the show laptop's key, from the organizers' password manager (the secure note "quina .env.link"), or AirDrop it from the main show laptop. **Never send it by chat or email**: anyone who has it can act as the show laptop.
4. Run `npm run setup:laptop`.
   - It says exactly what's missing and how to install it, then installs everything.
   - It pulls the repertoire's media from the cloud, fetches the Game plan and its logos, and finishes with the preflight.
   - If anything stops it, fix that and run it again: finished steps are skipped, and an interrupted download resumes where it stopped.
   - It never connects as the show laptop, so it's safe to run while the main laptop is playing.
5. If the night may use the Wii remote, pair it with this laptop too (step 7 of "Setting up": MacWiiPair, SYNC), then open the console with its command and do **Comandament** → **Connectar** once.
6. It's ready when it says **This laptop is set up** and the preflight says **READY**. Warnings about the speakers and Chrome are expected until the night's setup.

After any change to the prepared repertoire (new songs, approved hooks, overrides), the main laptop runs `npm run media -- push --repertoire <name>` in `apps/cloud`, so spares pull the same files.

**To swap laptops on the night,** follow steps 3–8 of "Setting up" on the spare (the Wii remote must already be paired with the spare, at home: step 7). Its link takes over from the main laptop's when it connects.

## When something goes wrong

| What you see | What to do |
|---|---|
| **5G drops.** Phones say "Connexió perduda". The link says `cloud: closed … retrying`. | Nothing: the show goes on. Switch the laptop to **phone B** if phone A has no signal. When the connection is back, the link catches up by itself; check that `npm run preflight` shows "journal in sync". |
| **The tablet's console won't connect** (or the hotspot drops it). | Drive the show from the **laptop keys**: → Next, ← Back, Space Hold/resume, S Suspense, M Hold music, Esc Panic (silence). Or use the **Wii remote**. Check that the relay was started with `--lan` and that the tablet opened the address with the token. Then try the console's other address (the LAN one or the cloud one). |
| **The tablet is on the hotspot but the LAN console never opens.** The hotspot isolates its clients. | Use the cloud console with the tablet's own data, or put the tablet on phone B's hotspot with the laptop. Until then, use the laptop keys or the Wii remote. |
| **The laptop crashes, or its browser closes.** | Start everything again (steps 3–5, without `fresh=1`, and the laptop's console: step 7). The show page resumes the same Game by itself, at the last song. Press **Next** to carry on. |
| **We swap to the spare laptop** (with internet). | On the spare (prepared beforehand with `npm run media -- pull`), do steps 3–5 without `fresh=1`. The link copies the Game from the cloud, and the show page says "Represa des del núvol". If it doesn't, an admin uses Admin → **Recuperar el show (pla B)** → **Recuperar al portàtil**. |
| **The laptop was restarted offline and lost its Game.** | Open Admin on the laptop. Under **Recuperar el show (pla B)**, type the noted **Codi de recuperació** and the song, then **Recuperar al portàtil**. Then press Next. |
| **Phones stop updating, and the link or Admin shows errors 429 or 1027.** The free daily quota ran out. | The show itself is fine. To bring phones back at once: Cloudflare dashboard → **Workers & Pages → Plans → Workers Paid** (5 USD a month). It works within a minute. Otherwise phones come back at 01:00. |
| **The music stops, or something sounds wrong.** | **Esc** (Panic) silences everything; the Game is kept. Press Space or Next to go on. |
| **The projector goes dark.** | Check the HDMI cable and that `caffeinate -dis` is still running. The show page is still on the laptop. |

## After the show

Stop the link and the relay with Ctrl+C. Everything is already in the cloud: an admin can download it from Admin → **Importar i exportar** → **Exportació completa**.
