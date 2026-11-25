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
- By default the laptop plays both the audio and the drum. The audio can also run on a separate device near the mixer, kept in sync by landing times announced in advance.
- **The engine enforces the rules, never the cloud.** The cloud accepts what the engine journals and only flags oddities for an admin (for example an accepted card whose Check didn't pass). Refusing would freeze phones over a judgement the engine already made.
- **The deployed cloud learns a new value before any laptop journals it.** A journal entry the cloud refuses stops the laptop's uploads, and with them every phone update for the rest of the night. So a new round kind, win kind or similar reaches the deployed cloud first: the protocol change, then the cloud's acceptance and a redeploy, then the engine journaling it.

## The public feed's privacy

_From event.md › Fairness and trust (The ending stays secret), Prizes and sponsors (The reveal)._

The feed to phones must never carry:
- the Queue or the next song: a phone learns a song only at its landing;
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

- R2's free storage is 10 GB.
- A song is about 68 MB in today's format, with two approved hooks (up to about 92 MB with more). The draft's 86 songs take 5.9–7.9 GB, which fits once last year's pool is pruned.
- About 100 songs fit. A lighter format, about 20 MB a song, is measured and ready if the playlist grows past that.
- Storage beyond 10 GB would cost money, so it needs the user's OK.

## Rehearsals

_From event.md › Timing (Rehearsals)._

- Full-show rehearsals happen on days before the night, never on the day itself: they share the cloud's free daily quota. In 2026: **13 and 19 December**.
- They use this year's Pool, the real plan, the tablet, the Wii remote, real phones, and the spare laptop.
- A rehearsal is its own Game in the same edition, so phones keep their cards.

## Privacy

_From event.md › What must never fail (Privacy), The songs._

- **Winners' names** are never shown on screen or published. They stay in the cloud's Game data, never in git.
- **Audio is never published:** no songs or generated song data in git or on a public address.
- Every card's songs are public, because phones need them (pending U22).
- Phones have no account. Admin only sees which card numbers were opened, never who opened them.
- Admin, the console and the organizers' routes are behind the organizers' Google login. The laptop has its own key, kept only on the show laptops and never sent by chat or email.
- The console's pairing token and the hotspot password are treated like the resume code: no photos. The hotspot password is the first line of defence, because anyone on the hotspot can reach the laptop's relay; the token then guards the commands.
- The repo is public: no people's or businesses' names, no emails, secrets or personal data.

## The day itself

_From event.md › Before the night (On the day), The night, step by step._

- Everyone comes to set up in the afternoon, and the whole day is kept free.
- The laptop, phones, PA, projector and tablet are set up by the [night runbook](../night-runbook.md).
- The preflight runs before the doors open, and every failure is fixed first.
- The sound check: an effect at low volume, then a few seconds of Hold music.
- The night is started from the console's menu ("Començar la nit").
- The QR address points at the new app before the cards are handed out (pending U15).
