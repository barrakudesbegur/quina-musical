# Show and music

What the show must do, as it stands now: the Shuffle and the drum, the music, Phase and Heat, the presenters' actions, the Interval, and the night's running order.

- Every rule here comes from [event.md](../event.md). Why a rule is the way it is, and what it replaced, is in [decision-log.md](../decision-log.md).
- "(pending U13)" points to [open-questions.md](../open-questions.md); the rule states the default in force meanwhile.
- "**Not built yet.**" marks a rule the handoffs list as still to do.
- Terms follow [GLOSSARY.md](../../GLOSSARY.md). What each screen shows is in [screens.md](screens.md), and every animation in [ANIMATIONS.md](../../packages/ui/ANIMATIONS.md).

## The Shuffle and the Queue

_From event.md › One round, Fairness and trust; [ADR 0001](../adr/0001-queue-decides-drum-reveals.md)._

- After a round's intro, the presenters press "Barreja". The **Shuffle** decides the round's **Queue**, the order its songs will play, once and in public.
- **Nobody can change the Queue afterwards**, not even an admin, and nobody picks songs by hand.
- On the projector every cover appears in a grid, gets shaken and flies into the drum, with a game-style item-box sound. The covers fly in a random order that has nothing to do with the Queue, so filming it reveals nothing.
- The Shuffle applies the public no-tie rule ([game-rules.md › Ties](game-rules.md#ties-late-claims-and-going-back)), and in the Desgraciat the last-two rule.
- **No fairness code is shown.** Trust comes from an animation people find familiar. The seeds are kept privately, for debugging.
- At each Shuffle the organizers note the round's resume code ([operations.md › Plan B](operations.md#plan-b-and-resume-codes)).

## The drum and the Landing

_From event.md › One round, Fairness and trust; [ADR 0001](../adr/0001-queue-decides-drum-reveals.md), [ADR 0002](../adr/0002-audio-and-drum-may-run-on-different-devices.md)._

- **The drum** is a big reel of album covers, edge to edge across the projector. It holds only the songs still pending: a song leaves it when it lands, and Back puts it back.
- When the next song is requested, the drum **Spins** while the current song keeps playing and the Transition builds. A Spin takes about half the Pace, between 3 and 11 s.
- **The Landing** is the instant the drum stops on a song and its Hook hits, both at once. The song counts from then.
- The drum isn't a random draw. It's staged to stop on the next song in the Queue, which lets the mixer prepare a real transition.
- The drum and the audio share one clock. Landing times are always exchanged as shared timestamps, so the audio can also run on another device.
- The presenters say each song's name right on its landing. The console shows them the next song privately, with a countdown to its landing.

## Teases, Signatures and Decoys

_From event.md › Fairness and trust (Only landings count); the decisions doc › Changes._

- **A Tease** is any part of the incoming song heard before its landing. It never counts, must never feel as if it counted, and always resolves clearly.
- **A Signature** is a short instrumental piece of the incoming song, such as its intro riff, the build into its chorus or a chorus motif, teased just before it lands.
  - Signatures are picked automatically. The user can veto any, or pick more by hand, on the audition page.
  - A vocal line is never replayed after the landing.
  - They play in about 5% of transitions (pending U13). Default: keep that, and pick more by hand while reviewing this year's songs.
- **A Decoy** is a tease of a pending song that isn't the next one. Decoys play only during a Suspense.

## Transitions

_From event.md › Atmosphere and style, One round; the mixer decisions › Changes after the first listen, Transitions._

- **Every transition is a produced DJ move from the very first song.** Never a plain volume fade, never robotic or repetitive.
- **Real DJ layering:**
  - overlapping layers, stems (drums, vocals, bass) and mashups;
  - tempos matched with pitch-preserving stretch up to about ±8%; beyond that, half or double time, stems-only overlaps or effect-led cuts;
  - key checks whenever melodies overlap;
  - outside sounds: risers, impacts, drum loops.
- Since the Queue is known, everything is prepared offline.
- **On the phrase:** the playing song leaves at the end of a 4- or 8-bar phrase, and the next song lands on its downbeat. A presenter's "Següent" starts the Spin at once, and the landing waits up to about 11 s for a phrase boundary. Over 90% of landings must fall on a phrase.
- **Intensity follows the Phase.** Early transitions are light, quick and well made. They grow bigger and more suspenseful as a win gets closer, and drop back after a Line.
- **The orchestra hit is rare.** Impacts are rare early and absent from many landings. The big orchestra hit comes only late or in the final Phase, with a cooldown.
- **Vocals:**
  - a song whose vocals come in suddenly gets a quick, clean move straight into the voice;
  - when both songs have vocals, they can trade lines: the outgoing song's line, answered by the incoming one's on the downbeat.
- Variety is measured over whole simulated nights, so the same move doesn't keep coming back.
- The user hasn't heard the latest sound yet (pending U13).

## Phase, Heat and the Final Lap

_From event.md › One round, Atmosphere and style, Fairness and trust; the mixer decisions › Phase and Heat._

- **Phase** (early, mid, late, final) is how likely a win is within the next few songs. It decides how big the transitions are.
  - It comes from the cards in play and the known Queue, blurred on purpose. Its thresholds scale with the number of cards in play.
  - Late starts a random 3–8 songs before the expected win, and sometimes as a false alarm. Final covers about the last 1–3 songs.
  - It climbs towards the Line, resets once a Line is confirmed, and climbs again towards the Bingo. In the Desgraciat it climbs as fewer cards stand.
  - The presenters can override it.
- **Heat** is how hot the round looks on the projector.
  - It follows the Phase on its own smoothed clock, with some randomness.
  - It never jumps at a landing, it cools visibly after a Line, and it never reveals how many songs are left.
- **The "Final Lap!" fanfare** plays when the Phase first reaches late, once per climb. A console switch turns the automatic fanfare off (R2-Q18). The switch: **Not built yet** (the protocol has it).

## The presenters' actions

_From event.md › The presenters; the decisions doc › Changes (Wii remote mapping, R2-Q38)._

The presenters can do any of these at any time, from the console or the Wii remote. Every automatic behaviour can be overridden live (R1-Q27); when the presenters do nothing, the show keeps going by itself.

| On the console | What it does | Wii remote |
|---|---|---|
| "Següent" | The next song now. Ignored while a transition is running, so a double press does nothing | A |
| "Parlem" | **Hold:** nothing lands by itself, even with the auto-advance on, and the music ducks under the presenters' voices: for something important, not every remark (D142). A long Hold switches to Hold music. "Següent" ends it | − or + (tap) |
| "Pausa" (hold "Parlem") | **Pause:** available at any time. No song lands, the Pausa music plays, and the projector and phones show "Tornem de seguida". The playback in progress is saved; when Pausa ends it resumes, with Parlem still on (D128). While it's on, A turns it off, and the tablet's "Següent" plays the transition into the next song. During a Check, this hold sends the Check to review instead | − or + (hold) |
| "Aguanta" | **Stay:** no song lands, and the current song keeps playing at full volume, looping a phrase, for dancing and crowd moments. "Següent" is disabled while it's on (D133) | B (hold) |
| "Suspens" (hold "Aguanta") | **Suspense:** the current song keeps playing while the build grows, and the drum hovers over about 3 pending songs while their Decoys tease. Letting go lands the real next song on the phrase. It releases by itself after about 30 s, and never starts by itself. "Següent" is disabled while it's on (D133) | B held plus A held (A first works too: B while A is still held turns the starting transition into a Suspens, D176), or (if the shake gesture is on) 3 strong shakes; 3 vibrations, and letting go of A before the third cancels it back to Aguanta; after it, letting go of B lands it (D144, D147). The shake is on by default, and the window is about 1.5 s (D148). With manual advance, holding B starts it at once: 3 vibrations, and letting go before the third cancels it, after it lands it (D145) |
| "Enrere" (long press) | **Back:** during a Check, a single press steps back one revealed song, down to none, and never closes the Check. The projector removes that mark, the previous song's snippet replays, and that Check's automatic reveal turns off. Only while revealing: not in a review or after the cue (D127, D134). Otherwise it undoes the last landing. That song stops counting, phones unmark it, and it becomes the next song again; the Queue is untouched. The drum turns back one card and the show goes into Hold. It can be pressed several times, and during a Spin it cancels the Spin | 1 or 2 (hold 1.5 s) |
| "Comprovar cartró" | A Claim: a number pad for the card, then the Check | Console only |
| "Efectes" | Sound effects and fanfares, such as a horn, shown as icons | D-pad (4 effects) |
| "Ritme" | The Pace: presets, −/+ and a lock | none |
| Auto-advance | On, or off ("Avanç manual", D143) | HOME (a different rumble for each) |

- **Two levels per button:** "Parlem" → "Pausa", and "Aguanta" → "Suspens". The console shows each pair visually.
- **Every Hold mode shows that it's on** (D133): the pressed button and the ring's badge.
- **Pausa (D128, D135):** "Tornem de seguida" only during a round, a Check or a Celebration; it resumes exactly where it was, fading in; during a review the −/+ hold is Pausa and A does nothing.
- **The Suspense release** lands on the outgoing song's phrase boundary, up to about 9 s after letting go (pending U13). Default: the phrase.
- **The moment to keep:** the presenters control the exact moment a song changes, to get the crowd chanting before it. Suspense is the first tool for that.
- **Safe by design:**
  - "Parlem" and "Aguanta" cancel a transition under way, so an accidental "Següent" is easily undone;
  - risky buttons, like "Enrere", need a long press with a filling ring; a short tap only shows "Mantén premut per confirmar";
  - Wii A always means "go ahead with the console's default action", for example approving or rejecting a Check by its result.
- **Panic** silences everything at once, and the Game is kept.

## Auto-advance, Pace and Drift

_From event.md › One round, Timing; the mixer decisions › Pace, auto-advance and schedule._

- **By default the songs advance by themselves** at a **Pace**, the target time from one landing to the next:
  - about 22 s for a song's first play of the night, whatever the round, always from its main hook (D174);
  - about 14 s for every later play of it.
- Each gap snaps to the playing song's phrases, so the Pace holds on average, not for every song.
- The presenters can take over at any time: change the Pace, lock it, or switch auto-advance off.
- **Drift:** the console shows when the round and the Game should end, and how far ahead or behind they are. To recover Drift, the system nudges the Pace by up to ±20%, only in the early and mid Phases. The lock stops it. It never catches up during a round's tense final moments.
- **The final Phase:** auto-advance is off by default, and the presenters advance by hand, with a switch to keep it on. If it stays on, a landing that probably completes a card gets a slot about 50% longer. Late, fancy transitions may stretch a song's slot by up to about 50% too.
- **In the Desgraciat,** auto-advance stops when one card stands.
- **The Schedule** is the planned timetable: the start time, each round's and each Interval's length. The estimates include the Intervals and the Checks (2025: a Line Check took 1–2 minutes, a Bingo Check plus the round's end 1.5–3.5 minutes).
  - It also includes the throw breaks, and follows each remaining round's kind (a Desgraciat round is about 24 songs, with no Line).

## Hold music and the Check's sound

_From event.md › Claims and checks, Atmosphere and style; the decisions doc › Rules (Check, Celebration)._

- **The music never stops,** unless the silence is intended: during claims, pauses and Intervals too.
- **Hold music** is looping background tracks, such as a video-game waiting tune. It takes over during a long Hold.
- **The Check's sound:**
  - the card's songs play in the card's order as 2–3 s hook snippets, each when a presenter reveals it (D107);
  - a song that has landed gets ✓; one that hasn't plays briefly "broken" (a short warble or bitcrush, never annoying) and gets ✗;
  - in the Desgraciat each ✓ is a short tick, and the first landed song plays its snippet as proof. If that song is the latest landing, the card fell with the last players: it passes, and shares the win;
  - the Hold music stays ducked far down throughout.
- **A failed Check:** the Failure fanfare on the presenters' cue, or at the end of an automatic reveal (D109, D117), then the error Hold music until the presenters press "Reprèn".
- **A Check under review:** no fanfare or effect; whatever was playing keeps playing (its level pending U78). Pausa only if a presenter turns it on (D118). After a discard, the music from before the Check comes back in Parlem, with the auto-advance suspended until "Següent" (D122; how, pending U84).
- More Hold loops and victory tracks would repeat less (pending U20). Today there are 3 Hold loops and 1 victory track.

## The Celebration's music

_From event.md › Claims and checks; the mixer decisions › Claims, Check and Celebration._

- A confirmed win gets an impact and the Clear fanfare.
- The music is a suggested default the presenters can change without being blocked:
  - after a Line, the Winning song, looping its chorus; then the round plays on;
  - after a Bingo or the Desgraciat's win, a victory track flowing into the Interval.

## Music for each moment

_From event.md › The night, step by step; D129._

- **The doors, the breaks and the end** each have their own set. For now the breaks and the end use the pop playlist 0fvoRGCC8zXqDyj5uLhJVg. The end plays in a fixed order.
- **Pausa** plays the lofi and silly-core playlist 0XTlZPUpt7xPoPxk4AUU3O, low, as if in Parlem.
- **Each round's intro** has music chosen for it in the plan. For now it's "5-12. Parasail Minigame" (Zelda: Breath of the Wild), looping cleanly, played low.
- **Each throw** has an energetic song chosen for it. This year: "Flying Free" by Pont Aeri and Marian Dacal (last year's id 24), from a hook of its own a bit before the drop. "Llançament" starts it at full volume; a tap stops it, and the next tap resumes where it was; a long press restarts it from the hook; the break music fades back after (D138).
- **After the close,** the end music plays until the tech disconnects the laptop for a Spotify Jam (D137).
- **The corn-seed storm (D151):** if the crowd starts throwing corn seeds at the end, the tech turns on a song by hand, from a hook of its own right at the drop: "Flying Free" for now (D153). The button shows on the tablet during the last round, inside its Check, and on the end screen (D155). The throws and the storm play louder than the songs (D154; how, pending U133).
- Still pending: U97 (the doors and the end's playlists) and U99 (the intro music's span).

## Volumes

_D130._

- On the tablet's settings, saved in the cloud and the edition file (D139). A master volume, plus one each for songs, songs in Parlem, the DJ moves' effects, the presenters' effects, the drum's ticks, the Check's sounds, Hold music, the win, the fail, the final-lap stinger, intros, breaks, Pausa, throws, the doors and the end. Every slider runs from 0% to about 150%, with its default at 100%, today's tuned level. The engine plays the whole show lower inside, so going above 100% stays clean, and the sound system is turned up to match at the sound check (D157). The throws and the corn-seed storm sound noticeably louder, set by ear: they start at about 141% (+6 dB) with a −6 dB trim, both tunable (D158).

## The Interval and the throw breaks

_From event.md › One round, The night, step by step._

- **The Interval** is the time between rounds: relaxed music while the organizers note the winners and reset.
  - Its music is a local playlist, played by the same engine with simple transitions and no drum, so a round flows into it with no silence. Since 26 Nov its source is the Spotify playlist 0XTlZPUpt7xPoPxk4AUU3O (D104). Pausa plays it too. A track we can't download is left out (D106).
  - The next round starts only when the presenters press "Comença la quina" (its intro). The Interval's countdown is only a guide.
- **The throw breaks ("parón"):** between some rounds, a break of about 5 minutes.
  - Organizers throw things to the crowd, such as fuets, sweets or chocolates, so people get up off their chairs and the night doesn't drag.
  - The presenters put on a bit of a show or go round the tables talking to people.
  - A throw break is a longer Interval.
  - The Schedule plans them, and the Interval's countdown before a break adds its minutes. Admin's editor for them: **Not built yet.**

## The night's running order

_From event.md › The night, step by step, Prizes and sponsors; 2025's running-order notes._

A template. Each edition sets its own rounds and times, and the order can change during the night. The Schedule models the rounds, Intervals and throw breaks. The cheat sheet carries the presenters' checklist for each step below.

1. **Doors and card sales** (from 17:30). Music plays and the bar opens. The projector shows the night's rounds, the card types, the scan-your-card QR and the sponsors.
2. **The welcome** (before round 1, which starts at 18:00). The presenters explain the game, since there are no written instructions anywhere:
   - how many rounds there are;
   - the Desgraciat, and how it's played;
   - which round is the Especial, and that it needs a special card;
   - the throws, and roughly when they come;
   - how winners are identified (their name, or a numbered slip handed to them at the win) and how they collect their prizes;
   - a reminder about the bar and what it offers.
3. **Each round:**
   - the intro: the presenters present the round and read out every prize and its sponsor, money donors included;
   - the Shuffle, then the songs, with the presenters keeping the prizes alive;
   - Claims, Checks and the Celebration;
   - the Interval.
4. **The throw breaks,** between some rounds through the middle of the night (2025's plans had two or three).
5. **The Quina Especial,** usually last. Members sell special cards between the tables before it.
6. **The close** (the rounds end at about 22:00):
   - the presenters explain how to collect prizes;
   - a short closing speech;
   - the sponsors are thanked;
   - a DJ set follows.
