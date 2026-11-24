# Quina Musical: night runbook

One page for the organizers, next to the cheat sheet. The show runs on the **laptop**; the cloud only feeds the phones and remote consoles. If the internet fails, the show goes on.

## Setting up (in this order)

1. **Phone A** (main): plug it into the laptop by USB and turn on **USB tethering** and its **personal hotspot**. The hotspot must have a **password**. **Phone B** (another carrier): charged, hotspot ready as the backup.
2. **Laptop**: plug in the power. Plug the **PA in with a cable** (headphone jack, USB or HDMI), never Bluetooth or AirPlay. Connect the **projector** by HDMI.
3. **Keep the laptop awake**: in a terminal, run `caffeinate -dis` and leave it open.
4. **Start the show** (each in its own terminal, and leave them open):
   - the relay: `cd experiments/mixer-poc && npm start -- --lan`. Without `--lan` it only listens on the laptop and the tablet can't reach it. At start it prints the tablet's pairing address with its **token** (`?t=…`);
   - the cloud link: `cd experiments/mixer-poc/cloud && npm run link`. It should say `cloud: connected`.
5. **Open the show page on the projector**:
   `open -na "Google Chrome" --args --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required --kiosk "http://localhost:5174/show/?autostart=1"`
   For the night's Game, add `&fresh=1` the first time, so the rehearsal's Game isn't continued.
6. **Tablet**: join phone A's hotspot and open the console with the token: `http://<laptop IP>:5174/console/?t=<token>` (the address and token the relay printed, or the console's QR). The tablet remembers the pairing, even across relay restarts, so a tablet paired at the rehearsal stays paired. Treat the token like the hotspot password: no photos. Away from the hotspot, the tablet uses the cloud console instead (the cloud's address + `/console/`).
7. **Run the checks**: `cd experiments/mixer-poc/cloud && npm run preflight`. **Fix every FAIL** before the doors open; read the WARNs.
8. **Sound check**: play an effect from the console at low volume, then a few seconds of Hold music.

At each Shuffle, note the round's **resume code** (console → **Codi de recuperació de la quina** → **Mostra el codi**). Keep it like the box of cards: never on a screen, never in a photo.

## When something goes wrong

| What you see | What to do |
|---|---|
| **5G drops.** Phones say "Connexió perduda". The link says `cloud: closed … retrying`. | Nothing: the show goes on. Switch the laptop to **phone B** if phone A has no signal. When the connection is back, the link catches up by itself; check that `npm run preflight` shows "journal in sync". |
| **The tablet's console won't connect** (or the hotspot drops it). | Drive the show from the **laptop keys**: → Next, ← Back, Space Hold/resume, S Suspense, M Hold music, Esc Panic (silence). Or use the **Wii remote**. Check that the relay was started with `--lan` and that the tablet opened the address with the token. Then try the console's other address (the LAN one or the cloud one). |
| **The tablet is on the hotspot but the LAN console never opens.** The hotspot isolates its clients. | Use the cloud console with the tablet's own data, or put the tablet on phone B's hotspot with the laptop. Until then, use the laptop keys or the Wii remote. |
| **The laptop crashes, or its browser closes.** | Start everything again (steps 3–5, without `fresh=1`). The show page resumes the same Game by itself, at the last song. Press **Next** to carry on. |
| **We swap to the spare laptop** (with internet). | On the spare (prepared beforehand with `npm run media -- pull`), do steps 3–5 without `fresh=1`. The link copies the Game from the cloud, and the show page says "Represa des del núvol". If it doesn't, an admin uses Admin → **Recuperar el show (pla B)** → **Recuperar al portàtil**. |
| **The laptop was restarted offline and lost its Game.** | Open Admin on the laptop. Under **Recuperar el show (pla B)**, type the noted **Codi de recuperació** and the song, then **Recuperar al portàtil**. Then press Next. |
| **Phones stop updating, and the link or Admin shows errors 429 or 1027.** The free daily quota ran out. | The show itself is fine. To bring phones back at once: Cloudflare dashboard → **Workers & Pages → Plans → Workers Paid** (5 USD a month). It works within a minute. Otherwise phones come back at 01:00. |
| **The music stops, or something sounds wrong.** | **Esc** (Panic) silences everything; the Game is kept. Press Space or Next to go on. |
| **The projector goes dark.** | Check the HDMI cable and that `caffeinate -dis` is still running. The show page is still on the laptop. |

## After the show

Stop the link and the relay with Ctrl+C. Everything is already in the cloud: an admin can download it from Admin → **Importar i exportar** → **Exportació completa**.
