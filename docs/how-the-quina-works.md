# How the Quina works

A walk through one night of the Quina Musical, as it works now. It is for anyone new to the project: an organizer, or a fresh Claude session. Read it in about ten minutes, then go to the linked docs for detail. For the event itself, without any software, read [event.md](event.md): it's the root the requirements come from.

**This page is the current state.** The decision docs ([mixer-design-decisions.md](mixer-design-decisions.md), [show-ui-and-platform-decisions.md](show-ui-and-platform-decisions.md)) are dated records of the user's interviews, and their older sections are partly superseded. Where they disagree with this page, this page wins; tell the orchestrator, who keeps it current. The terms are the ones in [GLOSSARY.md](../GLOSSARY.md); words in quotes are the Catalan labels people see on screen.

## What the Quina is

The Quina Musical is a live music bingo. Barrakudes runs it once a year in a pop-up tent; this year's night is **Sunday 27 December 2026**.

- Players hold printed **Cards** of 12 songs and cover a song with a corn seed when they hear it.
- Two presenters on stage run the show with a Wii remote and a shared tablet. They improvise and work the crowd. The **tech**, the organizer who prepared the songs, cards and software, sits by the laptop to run it and help them.
- A projector shows a **Drum** of album covers that reveals each song.
- The music comes from the show laptop through the PA, mixed like a real DJ set.
- Players can follow their cards on their phones.

The goal is a great night, not only great mixing. When the presenters do nothing, the system keeps the show going by itself. Every automatic behaviour can be overridden live.

## An edition and its Game

- An **Edition** is one year's Quina, named by its year ("26"). Cards, their QR links and the data on players' phones belong to an edition.
- The **Game** is every round played on the night. It carries the edition's name, set in Admin (this year "Quina Quina 3"). A rehearsal is a separate Game in the same edition, so phones keep their cards.
- The night's plan lives in Admin: the rounds in order, the card type for each round, the prize bundles, the sponsors and the Schedule. Upcoming rounds can be reordered and edited live during the night; rounds already played stay fixed.

On screen everything is in Catalan:
- a round is "Quina 1", "Quina 2"…; the special round is "Quina Especial", with no number. Numbering only appears as "Quina 4 de 12";
- a completed row is "Línia", and a full card is "Quina!" ("premi de quina");
- card numbers are written "#123";
- times use am/pm.

## Cards and card types

- A **Card** has 12 songs in 3 lines of 4, a number and a QR code that opens the player app at `quina.barrakudesbegur.org/26/<number>`.
- Every card is printed from the **Pool**, the full set of songs. This year's playlist is final on 1 December; last year's 77 songs are only test material. Once cards are printed, the songs can't change.
- **Card types** come from the card generation, not from Admin. Each type has a name, a pastel colour, a printed title and a price. There are two: normal, and especial (only for the Quina Especial). Admin only chooses which type plays each round.
- **Cards in play** are the cards sold, entered once in Admin as ranges. Each round only counts the cards of its type. A normal card is kept for every regular round.

## The rounds

**A regular round** runs from its first song until a Quina is confirmed. It has two prizes: the Line comes first (only one Line per round), and once a Line is confirmed the round plays on towards the Quina.

**The Quina Especial** is played with especial cards only. On phones, only those cards show during it.

**The Desgraciat** is played in reverse, once a night:
- everyone stands; a card is out (its player sits) as soon as any of its songs lands, and the last card standing wins;
- the console privately shows the cards still standing among the round's cards in play. Cards in play are entered as ranges, so some may be unsold, and the system can't tell which. That's why it never ends the round itself: auto-advance stops when one card stands, and the presenters call the winner by looking at the room;
- there is no Line: the round's only prize is the last standing card's bundle ("Premi de l'últim dempeus"). If the last players standing all sit on the same song, they share it. The Celebration's title is still to be confirmed ("DEMPEUS!" is the proposal);
- the Shuffle makes sure the last two cards can't fall on the same song;
- its Check shows that none of the card's songs has landed, and stops at the first one that has (the card has **fallen**);
- the Phase and the Heat climb as fewer cards stand;
- phones show "Dempeus" or "Assegut" for each card;
- it can be moved to any point in the night. It's played with normal cards (Admin picks the type).

The Desgraciat's rules are approved; the engine and screens are being built (see [timeline.md](timeline.md)).

## Before the Game

The organizers set up the laptop, phones, PA and projector by following the [night runbook](night-runbook.md), then start the night from the console menu ("Començar la nit").

While people arrive:
- **The projector** shows the edition's name, a preview of the night's rounds (regular, Desgraciat, Especial), each card type with its colour and price (making clear which one is only for the Especial), a large "scan your card" QR, the sponsors and a rough countdown. Interval music plays.
- **Phones** add cards by scanning their QR, or with the big "Afegir cartró" number pad. Round 1's prizes are already visible; later rounds are locked.
- There is **no how-to-play text** anywhere. The presenters explain the game.

## A round's intro and its prize reveal

Rounds never start by themselves, because announcing the prizes takes as long as it takes.

1. During the Interval, the console shows the next round, its prizes to announce and a countdown that is only a guide ("Compte enrere orientatiu").
2. The presenters press "Comença la quina". This is the round's **intro**: the projector shows "Quina N" (or "Quina Especial") with its prize bundles and sponsors, and the same bundles unlock on phones at that moment.
3. The presenters announce the prizes.

## The Shuffle and the Queue

When the prizes are announced, the presenters press "Barreja".

- The **Shuffle** decides the round's **Queue**, the order its songs will play, once and in public. Nobody can change it afterwards, not even an admin, and nobody picks songs by hand ([ADR 0001](adr/0001-queue-decides-drum-reveals.md)).
- On the projector every cover appears in a grid, gets shaken, and flies into the drum, with the item-box sound. The covers fly in a random order that has nothing to do with the Queue, so filming it reveals nothing.
- **No ties:** the Shuffle reshuffles, deterministically from the same seed, until neither the first Line nor the first Quina would be shared by two cards in play. The rule is public.
- No fairness code is shown. Trust comes from an animation people find familiar and easy to follow. The seeds are kept privately, for debugging.
- At each Shuffle the organizers note the round's **resume code** ("Codi de recuperació de la quina") from the console. It lets a restarted laptop rebuild the round exactly. It never goes on a screen or in a photo.

Then "Següent" plays the first song.

## The drum, and how a song lands

- **The drum** is a big reel of covers across the whole projector. It holds only the songs still pending: a song leaves it when it lands, and Back puts it back.
- When the next song is requested, the drum **Spins** while the current song keeps playing and the **Transition** builds.
- The **Landing** is the instant the drum stops on a song and that song's **Hook** hits, both at once. A song counts for the cards from its landing.
- Anything of the incoming song heard before its landing is a **Tease**, and never counts.
- The drum isn't a random draw: it is staged to stop on the next song in the Queue, which is what lets the mixer prepare a real transition.
- After each landing the projector shows the current song big, and only the last 3 songs in a row under the drum.
- **Hooks** are a song's most recognizable moments, such as a chorus, starting on a downbeat. This year's are detected automatically, and the user approves, rejects or nudges each one on the audition page.

## The music

Every transition is a produced DJ move from the very first song. A bare volume fade is never acceptable. The detail is in [mixer-design-decisions.md](mixer-design-decisions.md).

- **Real DJ layering:** overlapping layers, stems (drums, vocals, bass), tempos matched with pitch-preserving stretch up to about ±8%, key checks when melodies overlap, outside sounds (risers, impacts, drum loops) and mashups. Since the Queue is known, everything is prepared offline.
- **On the phrase:** the playing song leaves at the end of a 4- or 8-bar phrase, and the next song lands on its downbeat. Transitions never start or end at a random moment.
- **Signatures:** a short instrumental piece of the incoming song, such as its intro riff or the build into its chorus, teased just before it lands. They're picked automatically and the user can veto any of them. A vocal line is never replayed after the landing.
- **Vocals:** a song whose vocals come in suddenly gets a quick, clean move straight into the voice. When both songs have vocals, they can trade lines (call and response).
- **Intensity follows the Phase.** Early transitions are lighter, quick and well made. They grow as a win gets closer. Impacts are rare early, and the big orchestra hit is kept for late and final.
- **Phase** (early, mid, late, final) is how likely a win is within the next few songs. It comes from the cards in play and the known Queue, and is blurred on purpose. Its thresholds scale with the number of cards in play. Late starts a random 3–8 songs before the expected win, and sometimes as a false alarm; final covers about the last 1–3 songs. The Phase climbs towards the Line, resets once a Line is confirmed, and climbs again towards the Quina. Presenters can override it.
- **Heat** is how hot the round looks on the projector. It follows the Phase on its own smoothed clock, with some randomness. It never jumps at a landing, it cools visibly after a Line, and it never reveals how many songs are left.
- **The "Final Lap!" fanfare** plays when the Phase first reaches late, once per climb.

## The presenters' actions

| On the console | What it does | Wii remote |
|---|---|---|
| "Següent" | The next song now. Ignored while a transition is running, so a double press does nothing | A |
| "Parlem" (microphone) | **Hold:** no song lands, and the music ducks under the presenters' voices. A long Hold switches to Hold music | − or + (tap) |
| "Pausa" (hold Parlem) | **Pause**, for a long break mid-round: no song lands, the Interval music plays, and the projector and phones show "Tornem de seguida" | − or + (hold) |
| "Aguanta" | **Stay:** no song lands, and the current song keeps playing at full volume, looping a phrase, for dancing and crowd moments | B (hold) |
| "Suspens" (hold Aguanta) | **Suspense:** the current song keeps playing while the build grows, and the drum hovers over about 3 pending songs while their **Decoys** tease. Letting go lands the real next song on the phrase. It releases by itself after about 30 s, and never starts automatically | B held, plus 3 strong shakes; let go of B to land |
| "Enrere" (long press) | **Back:** undoes the last landing. That song stops counting, phones unmark it, and it becomes the next song again; the Queue is untouched. The drum turns back one card and the show goes into Hold. It can be pressed several times, and during a Spin it cancels the Spin. Typical use: a Quina claim noticed after the next song landed | 1 or 2 (hold 1.5 s) |
| "Comprovar cartró" | A Claim: opens a number pad for the card, then the Check | Console only |
| "Efectes" | The sound pad: effects and fanfares, shown as icons | D-pad (4 effects) |
| "Ritme" | The **Pace**: presets, −/+, and a lock | — |
| Auto-advance | On or off | HOME (a different rumble for on and off) |

**Auto-advance and Pace.** By default the songs advance by themselves at a Pace, the target time from one landing to the next: about 22 s in the first round, when every song is new, and about 14 s after that. Each gap snaps to the playing song's phrases, so the Pace holds on average. The console shows when the round and the Game should end, and the **Drift** (how far ahead or behind they are). To recover Drift the system nudges the Pace by up to ±20%, only in the early and mid phases; the lock stops that. In the final phase auto-advance is off by default and the presenters advance by hand, with a switch to keep it on. If it stays on, a landing that probably completes a card gets a slot about 50% longer.

**Safe by design:**
- Parlem and Aguanta cancel a transition that's under way, so an accidental Següent is easily undone.
- Risky buttons, like Enrere, need a long press with a filling animation. A short tap only shows "Mantén premut per confirmar".
- Wii A always means "go ahead with the console's default action", for example approving or rejecting a Check by its outcome. Console controls show a small badge with the Wii button that triggers them, and every Wii action rumbles.

## Claims, the Check, winners and the Celebration

**A Claim** is a player shouting "Línia!" or "Quina!". The presenters go into Parlem, press "Comprovar cartró" and type the card number. Several claims queue up, and every claimed card is checked before the round moves on.

**The Check** is public, on the projector:
1. "CARTRÓ #123" and the card type come first; a card of the wrong type for the round fails here.
2. The card's grid appears.
3. Its songs play in order as 2–3 s hook snippets. Each is marked ✓ if it landed, or ✗ if it didn't; a ✗ plays briefly "broken". A Line check plays the completed row (or the row with the most landed songs). A Quina check plays all 12. Hold music stays ducked far down throughout.
4. The result.

**Validity:**
- a number outside the generated cards is invalid;
- a card of the wrong type for the round is invalid, shown as its own reason;
- "not registered as sold" is only a private warning on the console;
- **the Check's result decides.** In a strange case the presenters can still reject a card that passed, but they can never accept a card that failed. Both outcomes are recorded.

**A failed Check** shows a huge red ✗ with red light beams, and no text. The Failure fanfare plays, then the error Hold music until the presenters press "Reprèn". The round goes on.

**Who wins:**
- the first to claim wins;
- claims on the same landing share the prize, and the winners agree the split;
- a late claimer wins if nobody else claimed. Other late-claim disputes are decided on the spot, so the console shows when each card became complete ("complete since song 34");
- an unclaimed win is lost.

**Winners** are noted by their name or by a numbered slip handed to them, and the presenters can add notes. They collect their prizes later by showing their card or slip, so there's no prize ceremony. Names stay in the cloud's data only: never on the projector, never in git.

**The Celebration** follows a confirmed win:
- an impact, the Clear fanfare, "LÍNIA!" or "QUINA!" huge, the prize bundle and sponsors, confetti, ninos, and a victory lap of the drum. No winning card number is shown;
- the music is a suggested default the presenters can change without being blocked: the Winning song for a Line, and a victory track flowing into the Interval for a Quina;
- after a Line the round plays on and the Phase starts again; after a Quina comes the Interval.

On phones, a confirmed win only celebrates when the winning card is one of that phone's own cards ("La teva línia!").

## The Interval

The **Interval** is the time between rounds. Its music is a local playlist played by the same engine, with simple transitions and no drum, so a round flows into it with no silence. Between some rounds the Interval is a longer break of about 5 minutes ("parón"), when organizers throw fuets, sweets or chocolates to the crowd; the Schedule allows for it.

- **The projector** shows the next round's name, a rough countdown, "Quina 4 de 12" and sponsor thanks. It shows no prizes (they wait for the intro), no winners and no QR.
- **The console** shows the next round and its prizes to announce, the guide countdown, the music's skip and volume, and "Comença la quina".

## Prizes, bundles and secrecy

- Each Line and each Quina has a **bundle** of prizes, usually with one or two headline prizes. Screens show the whole bundle, headline prizes first, never a single prize.
- Each prize has a **Sponsor**: Barrakudes itself or a local business. Logos come from a private logo library in the cloud, cleaned in bulk, and Admin picks from it.
- Prizes and sponsors are entered in Admin, which has bulk JSON import and export so an AI agent can load the organizers' spreadsheet.
- **Secrecy:** a round's bundle is revealed at its intro, on the projector and phones at once. Until then it's locked everywhere, future rounds show as locked (game-style), and only round 1's bundle is visible before the night. An "everything secret" option exists. The cloud enforces it, so a locked prize never reaches the public feed.
- The console's "Premis" tab has the round's prize lines and sponsors, ready to read out. A basic printed cheat sheet has them too.

## The screens, and who uses them

### Projector

The audience screen. It's a 4:3 projector far from the audience, so only big elements and no small text; it also works at 16:9. The style is juicy, game-like and Christmassy. During play it shows the drum, the current song, the last 3 songs, "Quina N" and the Heat, with no QR or URL. Talking (Parlem) changes nothing on it. Every state is in the [projector table](show-ui-and-platform-decisions.md#projector), and every animation in [ANIMATIONS.md](../packages/ui/ANIMATIONS.md).

### Console

The presenters' control page, on one shared tablet in landscape. The same page opens in portrait on the tech's phone, and every open console stays in sync. It has a simpler, light theme.
- **Always visible:** the round, the Phase and the real Heat, the clock, the expected end of the round, the Drift and the connections.
- **"Ara sona"** is the playing song, with a ring that counts down to the next auto-advance and shows the state (manual, Parlem, Aguanta…). **"Següent"** is the next song, private, with a countdown to its landing so the presenters can name it on the hit.
- **The buttons** from the table above. Enrere takes a quarter to a third of the bottom row, and "Comprovar cartró" the rest.
- **Tabs:** "Futur", "Premis" and "Efectes". "Futur" is the crystal ball, hidden until someone taps "Mirar el futur": a chart of how many cards have each number of marked songs, the songs left to the first possible Line and Quina, and the possible winners. It never reaches the projector or phones.
- **The menu:** start and end the night, the Schedule, Panic (silence), the resume code, and "Comandament", a drawing of the Wii remote's buttons that opens by itself when a remote connects.

### Player app

Players open it from the QR on their card, straight in the browser, with no account and nothing to install. It has to pass the "grandmother test": big tap targets, high contrast, large text, one thumb, anything at most 2 taps away, plain Catalan.
- **Tabs:**
  - "Ara": the drum on top, then a switch between "Historial" (the current round's songs only, including the one playing now) and "Cartrons" (the player's cards as grids);
  - "Premis": the current round's bundle and sponsors, with future rounds locked;
  - "Horari": the schedule, with real times for what has happened and "~" predictions for what's next.
- **The menu:** the player's cards, sounds, last year's card and "Esborrar dades".
- **Cards:** each followed card gets its own icon and colour, always corn first, then nine more (among them a heart, grapes, a top hat and the Tió). Cards are kept on the phone for the whole edition. Adding one by number asks before leaving if a number was typed. Last year's links show "Aquest cartró és de l'any passat".
- **Marking:** every landed song is marked on the cards, the latest included. When a card is one song from a Line or the Quina, that song's cell gets a gentle highlight on the grid. There's no banner, and the phone never says anyone won.
- **Behaviour:**
  - interface sounds only, on by default (Admin sets the default for everyone, and a player's own choice wins);
  - the screen stays awake;
  - vibration is only a bonus, because iPhones have none;
  - it reconnects by itself. When it's offline, it keeps showing its normal screens, visibly marked as offline.

A layout with a home screen, two corner buttons and stacked drawers is proposed and waits for the user's confirmation (see [packages/ui/HANDOFF.md](../packages/ui/HANDOFF.md)).

### Admin

The organizers' setup and fixes page, behind the organizers' Google login. A simpler design is fine.
- **Setup:** the edition's name, cards in play, the rounds plan with a card type per round, prize bundles, sponsors and logos, and the Schedule.
- **On the night:** live edits to upcoming rounds, the plan B resume, the winners list, and which card numbers have been opened on phones.
- **Player app:** the default for sounds, and a message banner to every phone.
- **Tools:** the hook audition page, a full JSON export, and the Shuffle seeds.

### Cheat sheet and Wii remote

- **The cheat sheet** exists on screen and as a basic printed PDF: the prize lines, the claim rules, the Wii mapping and the laptop's keys.
- **The Wii remote** is optional and fun: the presenters enjoy it, and shaking it to open a Suspense is a show moment of its own. It pairs with the show laptop (desktop Chrome only), and the console can do everything it does.

## Where things run

The model is in [ADR 0003](adr/0003-cloud-owns-the-game-laptop-owns-playback.md); the setup steps are in the [night runbook](night-runbook.md).

- **The cloud owns the Game:** rounds, Queues, every landing, cards in play, claims, winners, prizes, sponsors and the Schedule, in one Cloudflare Durable Object, exportable as JSON. Songs and media are in a private R2 bucket. Organizers log in with Google through Cloudflare Access. The free plan comes first; if a limit is hit on the night, upgrading takes minutes, and meanwhile only the phones and remote consoles pause, never the show.
- **The show laptop owns playback.** It plays the music and drives the projector from one clock. It journals everything, reports every landing to the cloud, and carries on alone when the internet drops. It's installed with one command (`npm run setup:laptop`) that pulls the pool and media from R2, so any prepared laptop can take over. It sits in the first row or at the side of the stage, wired to the PA, tethered by USB to a phone, with a second phone on another carrier as a backup hotspot.
- **The tablet** joins the laptop's phone hotspot and talks to the laptop directly. Away from the hotspot, a console goes through the cloud. Both iPad and Android tablets must work.
- **Fallbacks are requirements.** The tablet is new, and the presenters may reject it: then the **tech** drives the whole show from the laptop and the presenters advance by hand. The Wii remote is the presenters' intended controller, with the tablet as its plan B; in 2025 its range from the stage to the laptop was at the limit.
- **Phones** use only the cloud, on their own mobile data. The public feed never carries the Queue, the next song, the possible winners, the standing cards or locked prizes. A phone learns a song only at its landing, and its reel stays generic until then.
- **Plan B:**
  - if 5G drops, the show goes on, driven from the tablet on the hotspot, the laptop's keys or the Wii remote;
  - if the laptop restarts, the show page resumes the same Game at the last song;
  - a spare laptop resumes from the cloud;
  - a laptop restarted offline is resumed from Admin with the round's resume code and the song.
- **Rehearsals** share the cloud's free daily quota, so they're never held on the day of the show.
- The audio can also run on a separate device from the drum ([ADR 0002](adr/0002-audio-and-drum-may-run-on-different-devices.md)), but by default the laptop does both.

## What we deliberately don't do

- **Phones never announce a win.** No "you won", no banner, and no win celebrated unless it's the phone's own confirmed card. Players must notice and shout.
- **No winning card numbers** on the projector or phones, and no winners' names on the projector. People only care when it's them.
- **No next song, Queue or possible winners** anywhere public.
- **No prizes before a round's intro**, and none in the Interval.
- **No changing the Queue** after the Shuffle, and no picking songs by hand.
- **No fairness code** on screen.
- **No how-to-play text.** The presenters explain.
- **No QR or URL** on the projector during play or the Interval.
- **No automatic round start**, and no prize ceremony.
- **No plain volume fades,** and the music never stops unless silence is intended.
- **No past rounds' history** on phones.
- **No WebP images** (JPEG XL with a PNG or JPEG fallback), and no React.
- **Not this year:** a show laptop with nothing installed (deferred until after the event).

## Still open

These wait on the user, with defaults in place:
- the player drawers layout, and two more design choices on the canvas (listed in [packages/ui/HANDOFF.md](../packages/ui/HANDOFF.md));
- the Suspense release time and how rare Signatures are ([open-questions.md](open-questions.md));
- the Desgraciat's Celebration title ("DEMPEUS!" is the proposal);
- card prices: a normal card's price drops with each regular round played (2025: 1.50 € per round still to play), so the projector either shows the current price or none;
- this year's card title, colour, types and amounts, and when cards are handed out ([timeline.md](timeline.md)).

## Read more

- Terms: [GLOSSARY.md](../GLOSSARY.md)
- Screens, player app and hosting: [show-ui-and-platform-decisions.md](show-ui-and-platform-decisions.md) (its "Changes" section first)
- Music and show engine: [mixer-design-decisions.md](mixer-design-decisions.md)
- Lasting decisions: [docs/adr](adr)
- The night itself: [night-runbook.md](night-runbook.md)
- Dates: [timeline.md](timeline.md); roles: [team.md](team.md)
