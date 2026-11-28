# Operations

Where things run and what must never fail: the cloud, the laptop, the tablet and the phones, the public feed's privacy, Plan B and the fallbacks, the free tier, storage, rehearsals and the day itself.

- Every rule here comes from [event.md](../event.md). Why a rule is the way it is, and what it replaced, is in [decision-log.md](../decision-log.md).
- "(pending U19)" points to [open-questions.md](../open-questions.md); the rule states the default in force meanwhile.
- "**Not built yet.**" marks a rule the handoffs list as still to do.
- The steps for the night are in the [night runbook](../night-runbook.md). Terms follow [GLOSSARY.md](../../GLOSSARY.md).

## The venue

_From event.md › When and where, What must never fail._

- A large pop-up tent on a town square. It's cold, the lights can fail, and the sound can be too quiet at the back.
- **There's no Wi-Fi and no router,** but there's good 5G. Phones can share a hotspot.
- Two big speakers on stage and a simple mixing desk, with no sound team. One projector, far from the audience.

## Where things run

_From event.md › What must never fail; [ADR 0003](../adr/0003-cloud-owns-the-game-laptop-owns-playback.md), [ADR 0002](../adr/0002-audio-and-drum-may-run-on-different-devices.md) (R2-Q26)._

- **The cloud owns the Game:** the rounds, Queues, every landing, the cards in play, claims, winners, prizes, sponsors and the Schedule. It's one Cloudflare Durable Object, exportable as JSON. Songs and media are in a private R2 bucket.
- **The show laptop owns playback.**
  - It plays the music and drives the projector from one clock.
  - It journals everything, reports every landing to the cloud, and carries on alone when the internet drops. **The music never depends on the internet.**
  - It's installed: one setup command pulls the Pool and media from R2, so any prepared laptop can take over. A laptop with nothing installed is not for this year (R2-Q26).
  - It sits in the first row or at the side of the stage, wired to the PA by cable (never Bluetooth or AirPlay), with the projector on HDMI.
  - It's tethered by USB to a phone, with a second phone on another carrier as a backup hotspot.
- **The tablet** joins the laptop's phone hotspot and talks to the laptop directly. Away from the hotspot, a console goes through the cloud.
- **The tech's phone** opens the console the same way.
- **Players' phones** use only the cloud, on their own mobile data.
- The laptop plays both the audio and the drum. The audio on a separate device near the mixer, kept in sync by landing times announced in advance, would be nice but isn't required: the mixer can be placed almost anywhere (D274). No stick at the projector; a wireless HDMI kit if the laptop must be far from it (D274). A second projector, if one is found, goes inside the tent about 12–14 m from the stage, on the long wall away from the open area, angled to the back tables, fed the same image by a 1-in, 2-out HDMI splitter (D276).
- **Test runs (D292):** a relay started with `--test` adds a «Proves» section to the local consoles (a new Game, round N's intro, round N after K songs); never on the cloud console, and never on the night.
- **The presenters' remote:** the genuine Wii remote, paired with the Mac by MacWiiPair, as built (D275). The user buys a backup, a presenter remote or a mini gamepad, and the Console supports whichever (D281).
- **The laptop and the mixer sit at the tech's table,** next to the projector, 6–7 m from the stage (D281). **A Mac app starts the night:** one command behind a control page with buttons and status lights (D282). The projector screen can also open from the cloud's address, for a second projector on another computer (D300).
- **A 5G drop isn't a design concern** (D273): new designs may rely on the internet. What's built for a drop stays, because congestion (the whole tent on one cell) is unlikely but possible, and a design that relies on the internet must say what congestion does to it.
- **The engine enforces the rules, never the cloud.** The cloud accepts what the engine journals and only flags oddities for an admin (for example an accepted card whose Check didn't pass). Refusing would freeze phones over a judgement the engine already made.
- **One deploy serves both addresses:** the test address and the QR address are the same Worker, so every deploy changes what the printed QR codes open. After the code freeze, deploys are only fixes. From this year's cards on, every deploy names its pool, and the preflight checks that the cloud's cards match it: a deploy that fell back to the default pool would put last year's test cards on the QR address.
- **The deployed cloud learns a new value before any laptop journals it.** A journal entry the cloud refuses stops the laptop's uploads, and with them every phone update for the rest of the night. So a new round kind, win kind or similar reaches the deployed cloud first: the protocol change, then the cloud's acceptance and a redeploy, then the engine journaling it.

## The public feed's privacy

_From event.md › Fairness and trust (The ending stays secret), Prizes and sponsors (The reveal)._

The feed to phones must never carry:
- the Queue or the songs after the current Spin: a phone shows a song only at its landing. The current Spin's target may reach it from the Spin's start, so its drum runs the projector's exact trajectory (D277);
- the possible winners, Futur, or the standing cards and their count;
- a locked prize: only revealed rounds' bundles reach it;
- a Check's outcome, a winner's name, or a winner's slip number;
- the round's exact end time (only the Game's end, rounded to 5 minutes).

It never sends client heartbeats or polling. Phones reconnect with backoff and jitter, and catch up from a snapshot.

## Plan B and resume codes

_From event.md › What must never fail (Equipment can fail); the decisions doc › Changes._

- **If 5G drops,** the show goes on: driven from the tablet on the hotspot, the laptop's keys or the Wii remote. Phones show they're offline and catch up when it's back.
- **If the laptop restarts,** the show page resumes the same Game at the last song.
- **If the laptop dies,** a spare laptop resumes the night from the cloud, at the same round and song.
- **If a laptop is restarted offline** and lost its Game, it's resumed from Admin with the round's **resume code** and the song.
- At each Shuffle, the organizers note the round's resume code ("Codi de recuperació de la quina") from the console. It never goes on a screen or in a photo.
- **Panic** silences everything and keeps the Game.

## Fallbacks

_From event.md › The presenters (Their equipment), What must never fail (People may not adopt the new tools)._

Fallbacks are requirements: new tools are hard to introduce, so every new way of working falls back to the old one.

- **If the presenters reject the tablet,** the tech drives the whole show from the laptop, and the presenters advance by hand.
  - The console runs on the laptop's own screen, with the show page on the projector as a separate display (never mirrored). A USB presenter clicker (→ or PageDown) runs the console's default action. The night runbook's "Without the tablet" has the setup, and `npm run preflight -- --laptop-only` checks it.
  - The show page's own keys work too: → "Següent", ← "Enrere", Space Hold, S Suspense, M Hold music, Esc Panic.
- **The Wii remote comes first;** the tablet is its plan B and can do everything the remote does.
- **The Wii remote's Bluetooth range** from the stage to the laptop was at the limit in 2025. The runbook has a walk test from both ends of the stage at setup and every rehearsal, the console counts the remote's drops, and the venue check is pending U19.
- **iPad and Android tablets** must both work (pending U19). The tablet's auto-lock is set to never, since the console on the hotspot can't keep the screen awake.
- **A tablet that can't reach the laptop** on the hotspot uses the cloud console on its own data, or the other phone's hotspot.

## The spare laptop

_From event.md › What must never fail; the night runbook._

- A spare laptop is prepared at home before the night, with good internet: about 7 GB to download.
- Its setup is one command, safe to rerun, and never connects as the show laptop, so it's safe while the main laptop plays.
- After any change to the prepared Pool (new songs, approved hooks), the main laptop pushes the media again, so the spare pulls the same files.
- On the night, its link takes over from the main laptop's when it connects.

## The free tier

_From [ADR 0003](../adr/0003-cloud-owns-the-game-laptop-owns-playback.md); the decisions doc › Hosting._

- The free Cloudflare plan comes first.
- A load test with 400 simulated phones runs before the night, and usage is checked at each rehearsal and in the preflight. A pessimistic night uses about half the daily quota.
- If a limit is hit on the night, upgrading takes minutes. Meanwhile only the phones and remote consoles pause, never the show.

## Storage

_From the Sound engine and Backend handoffs; timeline.md › Risks._

- R2's free storage is 10 GB; a little beyond it costs cents a month and is fine (D113).
- **2026:** 135 songs (D269), about 47 MB each, plus the shared Hold, break, voice and effect sounds: 2,772 blobs, 8.04 GB, under the free tier (28 Nov, after D269's renumber). Last year's files and the old folder layout are deleted (D246–D248), and nothing expires by date.
- **Each file is stored once, by its content (D248):** R2 keys a file by its SHA-256, and each repertoire's private manifest maps its readable paths to those fingerprints. A push uploads only what's missing, a pull rebuilds the laptop's readable folders and checks every hash, and prune deletes only fingerprints no manifest names, after a dry run.

## Rehearsals

_From event.md › Timing (Rehearsals)._

- Full-show rehearsals happen on days before the night, never on the day itself: they share the cloud's free daily quota. In 2026 the user runs a tech rehearsal when everything feels ready, and maybe a presenters' rehearsal a day or two before or on the day itself (D82). A rehearsal with no phones costs under 1% of the daily quota; phones are the only big cost.
- **A presenters' rehearsal on the day itself runs laptop-only:** the cloud link stays off and the tablet joins the laptop's hotspot, so it uses none of the cloud's quota and phones never see its songs or prizes.
- **The night's Game starts fresh** (`&fresh=1`, as always), so a rehearsal's Game is never continued. Players' cards are kept, since they're saved per edition.
- A tech rehearsal on an earlier day keeps the full setup: the cloud link and real phones.
- They use this year's Pool, the real plan, the tablet, the Wii remote, real phones, and the spare laptop.
- A rehearsal is its own Game in the same edition, so phones keep their cards.

## Privacy

_From event.md › What must never fail (Privacy), The songs._

- **Winners' names** are never shown on screen or published. They stay in the cloud's Game data, never in git.
- **Audio is never published:** no songs or generated song data in git or on a public address.
- Every card's songs are public, because phones need them. Anything may be public unless there's a reason to hide it, to keep the code simple (D78).
- **Hiding prizes is for the show's hype (D98):** the projector and phones show a round's prizes only once it's revealed.
- **One JSON per edition, in git (D116):** the plan, prizes and sponsors (businesses' names included), the songs and the cards. Local seeding uses it; the user or an agent uploads it to the cloud by hand, on the day or for a rehearsal, and an upload always saves the old settings first. Git isn't read at runtime: the cloud is the source of truth while running (D111). Logos stay in the bucket; money amounts only in the organizers' spreadsheet (D112).
- Phones have no account. Admin only sees which card numbers were opened, never who opened them.
- Admin, the console and the organizers' routes are behind the organizers' Google login. The laptop has its own key, kept only on the show laptops and never sent by chat or email.
- The console's pairing token and the hotspot password are treated like the resume code: no photos. The hotspot password is the first line of defence, because anyone on the hotspot can reach the laptop's relay; the token then guards the commands.
- The repo is public: no people's names, no emails, secrets or personal data. Businesses' names are fine anywhere (D116, D307); sponsor logos stay out of git (D307).

## The day itself

_From event.md › Before the night (On the day), The night, step by step._

- Everyone comes to set up in the afternoon, and the whole day is kept free.
- The laptop, phones, PA, projector and tablet are set up by the [night runbook](../night-runbook.md).
- The preflight runs before the doors open, and every failure is fixed first.
- The sound check: an effect at low volume, then a few seconds of Hold music. Since D157–D158 the laptop plays about 6 dB quieter inside, to leave room for the chaotic moments, so the sound system is turned up about 6 dB compared with 2025. The cheat sheet and the laptop's setup notes say so. The console's sound test (D229) plays each kind of sound in turn for adjusting every level. With the tablet's interface sounds on (D208), tap a few tablet buttons near the presenters' microphones and check that the PA doesn't carry the clicks; if it does, switch them off in the tablet's settings.
- The night is started from the console only: the doors' big button «Començar la nit», by a tap (D299, D304). Nothing on the projector starts it.
- The QR address points at the new app since 25 Nov (D76).
