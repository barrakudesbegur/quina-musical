# Waiting on the user

The only list of what waits on the user: decisions with the default in force meanwhile, and tasks only the user can do. Requirements, handoffs and the timeline refer to these by ID (U1, U2…).

- **Adding one:** sessions send it to the orchestrator, who adds it here with the next free ID. Sessions never edit this file directly: several share one checkout. Say which default you took, so the user only answers when they disagree.
- **Answering one:** the orchestrator records the answer in [decision-log.md](decision-log.md), updates the requirements, and moves the entry to "Answered" with its decision ID. IDs are never reused.
- Dates are in [timeline.md](timeline.md); the night is Sunday 27 December 2026.

## Decisions

### U231 · The projector before the night: which board (D294)
The 28 Nov redraw replaced agreed boards with as-built ones. Before the night: the pre-redraw `Abans-28nov-Projector-Abans` has a blue-bulb garland across the top; the current `Projector-Abans` (and the live screen) has none. Both otherwise the same; the Desgraciat's sad face has no circle either way (D23).
- (a) The pre-redraw board, with the garland (the orchestrator's recommendation: the agreed in-play look has a garland too).
- (b) The current board, no garland.

### U232 · The projector's Check: which boards (D294)
For `Comprovacio`, `Comprovacio-Fallida` and `Comprovacio-Revisio`. D283's thick centred marks and D117's reveals stopping at the ✗ live only in the current boards.
- (a) The current boards: thick centred ✓s, the playing song with the running dashed ring and ▷ (as on the phones), the falling nino; drawn on the agreed look's starfield and ink-stroked type (the recommendation: they already hold D283 and D117).
- (b) The pre-redraw boards with D283's marks added: a solid glowing ring and an equaliser badge on the playing song, the squashed nino.

### U233 · The projector's Line Celebration: which board (D294)
- (a) The current `Projector-Linia`: «LÍNIA!» over the drum's victory lap, the garland, slow paper rain (the recommendation: screens.md asks for the drum's victory lap).
- (b) The pre-redraw: «LÍNIA!» high on a starry ray field, static confetti, no drum or garland, other ninos.

### U234 · The Desgraciat's finale: which board (D294)
- (a) The current `Projector-Desgraciat-Final`: a costume pose per finalist, the bulb garland, paper rain; drawn after D180–D187 (the recommendation).
- (b) The pre-redraw: three plain tinted figures, an oval-lamp garland, a curved cover row; drawn before D180–D187.

### U235 · The Descans on the projector: which board (D294)
Two boards show it; the redraw left `Projector-MitjaPart` unchanged.
- (a) `Projector-Descans`: no garland, the cyan ring, «Descans» (D149), Londrina capitals marked not built; what's live (the recommendation: the later board, after D149).
- (b) `Projector-MitjaPart`: the blue garland, a lilac «min».

### U236 · «QUINA POTRA!» on the projector: which board (D294)
Either way the prize card gives way to the sponsors' logos (D285).
- (a) `Projector-Desgraciat-Potra`: the gold capitals plate, the drum's victory lap and the garland, slow paper rain; what's live (the recommendation: the same victory lap as the other Celebrations).
- (b) `Projector-Desgraciat-Dempeus` (unchanged by the redraw): an orange mixed-case plate, a prize card with a gift box, no drum.

### U237 · A confirmed win on the phones of those who didn't win
Today every phone shows the full Celebration («QUINA!», confetti, ninos, the prize), as D242, D285 and the boards draw it. screens.md says a confirmed win "only celebrates on a phone that holds the winning card", and D32's reason is "people don't care who won unless it's them". The orchestrator's verify run (28 Nov) flagged that a player may read «QUINA!» on their own phone as "I won".
- (a) Only the winner's phone celebrates; the other phones keep their cards, with a small «Línia!» or «Quina!» notice (the recommendation: the grandmother test).
- (b) Every phone shows the full Celebration, as now.

### U238 · Four songs flagged for quality, before the cards
No decision is recorded for #90 and #117 (low bitrate: 117 and 114 kbps) or #18 and #83 (remix titles; data/out/repertoires/2026/quality.json). #73 and #133 were kept. A swap needs a download, prep, an R2 push and new cards before 4 Dec.
- (a) Keep all four (the recommendation, unless one sounds bad to the user; D270 already says #117 is the right song).
- (b) The user listens and names the ones to swap.

### U239 · The A3 test sheets' card numbers (D295)
One or two A3 sheets hold 6–12 cards. If their numbers are also sold on A4, two players hold the same card and can claim at the same moment.
- (a) The A3 sheets repeat numbers from the end of each run, and those A4 sheets are kept off sale (the recommendation: no new cards in the system, and D264's first-digit rule holds).
- (b) The A3 sheets get new numbers past #699 (new cards in cards.json; breaks the first-digit rule).

### U230 · Where the install button goes on the phone (replaces U193)
U193's reading put the install button in the spot the empty list's big add-card button left once a phone had cards. D290 removed that spot: a phone with no cards shows a centred heading and two floating buttons, gone at the first card. And the user's condition, "only if +card button is not showing", now holds exactly when there are no cards. Only where the browser can install the app and it isn't installed; never on iPhones (Ajustos there).
- (a) Once the phone has cards: a quiet row «Instal·lar l'app» at the end of the Cartrons list, under the last card. Frontend's recommendation: the empty state stays about cards, and it reaches people once they're settled in.
- (b) While the phone has no cards: a small third link under «Escanejar el QR» and «Escriure el número».
- (c) Only in Ajustos, never on the home.

### U97, U99 · Music for each moment (D129)
- **U97 · The doors and the end:** (a) for now the pop playlist for the doors, the breaks and the end, until each gets its own (the end in that playlist's order); (b) give the playlists now.
- **U99 · The intro music's span:** (a) from the round's intro until its first song lands, over the Shuffle; (b) only the intro. Rounds without a choice use (a) Parasail Minigame, or (b) the Pausa music.

### U136 · The corn-seed storm during the last round's play
D155 allows the storm button during the last round, not only after it. If it's pressed while songs are still landing:
- (a) the round goes into Parlem first, so no song lands unheard under the storm, and "Següent" resumes (what Sound engine built);
- (b) the round carries on underneath, and songs keep landing.

### U137 · The corn-seed storm's name on the tablet
Frontend's board (canvas v83) calls it "Tempesta de blat de moro", marked provisional.
- (a) Keep "Tempesta de blat de moro".
- (b) Another name.

### U138 · The storm button in the last round's Celebration
D155 lists the last round's normal screen, its Check and the end screen. The corn may fly during the Celebration itself.
- (a) Show it in the last round's Celebration too.
- (b) Only where D155 says.

### U139 · The break music while a throw is stopped
A tap stops the throw song, and the next tap resumes it (D138).
- (a) While it's stopped, the break music comes back up.
- (b) It stays down until the throw ends.

### U157 · The Celebration's music pick
The user's own decisions: R1-Q36 (23 Nov) set the default, the Winning song looping its chorus after a Line, and a victory track into the break after a Quina or the Desgraciat's win. R2-Q20 (24 Nov) made it "only a suggested default" the presenters can change. Today they pick during the Check, or change it in the Celebration: the Winning song, the victory track, or Hold music. On the canvas the user wants it on the left, styled as a tab whose background slides to the pick, with the song's cover and title instead of "Cançó guanyadora", and icons for the others.
- (a) Keep the pick: the default plays unless a presenter changes it.
- (b) Drop it: always the default.

### U158 · The Celebration's music options (if U157 keeps the pick)
- (a) Two: the Winning song and the victory track. Parlem already lowers either for talking.
- (b) Three, with Hold music too.

### U163 · The round total in "Quina 4 de N"
The model numbers only normal rounds ("Quina 1"…; the specials are "Quina Especial" and "Quina del Desgraciat", with no number). Today every screen shows the plan's position instead, specials included, so with a special earlier in the night a normal round's number is one too high. Frontend is fixing that. Left open: what the total "de N" counts. In 2026 that's 10 normal rounds plus 2 specials.
- (a) Normal rounds only: "Quina 4 de 10".
- (b) Every round: "Quina 4 de 12", though only 10 rounds carry a number.

### U160 · The last real players falling together before the finale
Before the finale the engine only sees the cards in play, unsold ones included (D180 is built: 6eb9624, 21254e1). Say the last two real players in the room fall on one song while an unsold card still stands. The landing counts for them, because it didn't take out every card in play, so they're out and nobody in the room is standing. Today they can't be entered as finalists, since entry needs standing cards (D168).
- (a) "Enrere", then enter them as finalists, and the same song lands again, now not counting for them (Sound engine's reading; it replays the song).
- (b) Entry also accepts a card that fell on the latest landing, and the finale applies D180 among the finalists: the landing that took them all doesn't count, and they're back in, with no "Enrere".
- (c) Nothing: the presenters start the finale earlier (with about 5–10 standing, as the growing button suggests), so it doesn't happen.
Built as (b) (Sound engine, 593fef2), as a reading of D180 applied among the finalists being entered. It's easy to change if the user picks otherwise.

### U159 · The numbered slip for winners
The user on the canvas: "What is this field? we dont papereta concept. please read glosary. If it is the card, it should be readonly or no field directly". The field was labelled "Papereta", which isn't the glossary's word. The model does have a **numbered slip**: the glossary's Winner is "noted by name or by a numbered slip handed to them", event.md says "their name, or a numbered slip we hand them", and the organizers' 2025 notes say "s'entrega un paper amb un número per a identificar posteriorment a la persona". The card's number is already known from the claim.
- (a) Keep the slip: the winner form has an optional slip number next to the name, with a clearer label.
- (b) Drop slips: the card's number identifies the winner, who shows the card to collect the prize. The glossary and event.md change.

### U150 · The finalists on the phones
- (a) The phones show the finalists' figures too.
- (b) Only the projector and the tablet show them.

### U128 · The throw song's hook
Sound engine set the throw hook (D138) at 193.2 s into "Flying Free": the build's phrase start, 16 s before the drop at 208.8 s, after the breakdown at 175–181 s.
- (a) Keep it.
- (b) Another point, after listening.

### U129 · The effects' default volume
D130 said songs in Parlem and the effects "may start lower". Sound engine set every slider's 100% to today's tuned level. "Songs in Parlem" starts at 45% (today's −14 dB duck), and the effects at 100%.
- (a) Keep the effects at 100%.
- (b) Start them lower; give a number.

### U103 · The throw song is on the cards
"Pont aeri" is pool 1's #29, "Flying Free – Original Mix" (Pont Aeri, Marian Dacal): Sound engine confirmed it's the same Spotify track as last year's id 24, so the throw song is printed on pool 1's cards. A throw happens between rounds, when no card is in play, so it can't be marked by mistake.
- (a) Keep it as the throw song.
- (b) Pick a throw song that isn't on the cards.
- (c) Take it out of pool 1 and keep it for the throws.

### U104 · Undoing a landing while a claim is open
Inside a Check, "Enrere" on the tablet, or a single press of 1 or 2 on the remote, steps back one revealed song (D127). As built (Frontend, ad27fa7), holding 1 or 2 on the remote still undoes the last landing, as today.
- (a) Keep that: the remote's hold undoes a landing even during a Check.
- (b) No landing undo during a Check: review, discard, then "Enrere".

### U105–U114 · Pausa in each situation (D128; Sound engine's check of 26 Nov)
- **U105 · A Suspense when Pausa starts:** (a) it's cancelled, and the song resumes without it; (b) it's kept and resumes where it was.
- **U106 · Aguanta when Pausa ends:** (a) Aguanta comes back, the song looping at full volume; (b) Parlem, as D128 says.
- **U107 · Pausa during a Check:** (a) not available: the remote's hold and the tablet's button both mean "Revisió manual"; (b) the tablet's button still pauses the Check.
- **U108 · A Celebration after Pausa:** "Parlem still on" means (a) the victory music ducked, as Parlem in a Celebration (D117); (b) something else.
- **U109 · Where Parlem doesn't exist today** (the Interval, the intro, the doors, the end): when Pausa ends there, (a) the music resumes at its own level; (b) Parlem becomes possible there too, and resumes on.
- **U110 · The Interval's countdown during Pausa:** (a) it freezes; (b) it keeps running.
- **U111 · A restart during Pausa:** (a) Pausa is recorded in the night's log, so a restart comes back paused, with the saved playback; (b) not recorded: a restart comes back unpaused, in the Hold.
- **U113 · Short sounds when Pausa starts** (fanfares, effects, snippets, a transition's tail): (a) they ring out under the Pausa music; (b) they're cut at once.
- **U114 · Paused time and the night's end:** (a) the round's target end moves by the paused time, so the show doesn't rush afterwards; (b) it counts as time lost, and the Pace speeds up to catch up, as today.

### U85 · The music under a Check, between reveals
Today the song or Hold music drops very low (−32 dB) for the whole Check, under the snippets. With the presenters pacing it, they'll talk between presses.
- (a) Very low for the whole Check, as now.
- (b) At the claim's level, under the presenters' voices, dipping further only while a snippet plays.

### U89 · When the card appears on the projector
- (a) As soon as the number is sent: "CARTRÓ #57" and the type check show while the presenter talks, and the first song waits for a press.
- (b) Only on the presenters' first press.

### U197 · A Play Store app (TWA) for Android players
The research (docs/research/reports/android-twa-and-install.md, 27 Nov) recommends passing.
- **Timing:** the user's Play account is old, so it needs no 14-day closed test or production-access step (the user, 27 Nov). Only the new app's review remains, up to about 7 days, with room for one rejection before the night. Bare web wrappers are often rejected.
- **No gain:** it adds nothing an installed PWA lacks, and "Play Store, sign in, install" is harder than scanning.
- **Removing it:** possible but imperfect. Unpublishing stops new installs, and an app on fewer than 1,000 devices can now be deleted, which burns its package name. Installed copies stay on phones.
- (a) Pass.
- (b) Try it: about 2–3 days of work, then the review.

### U196 · An App Clip for iPhone players
The research (docs/research/reports/ios-install-and-app-clip.md, 27 Nov) recommends passing.
- **Review:** it needs a full parent app with the same features, and a parent that is just the site in a web view fails App Review's guideline 4.2. A new app's first approval takes about 2–7 days, often after a rejection, and Apple warns of slow reviews around 19–26 Dec.
- **Little gain:** its only real gain is 8 hours of notifications, which would also need Apple push from our backend.
- **Hard to remove:** it's hard to switch off (a deactivated experience kept loading 48+ hours later), and the App Store listing outlives the night with the seller's name and, in the EU, contact details.
- **The plain link is already the simplest path:** camera, the yellow chip, Safari opens the card. An App Clip adds a card, a tap and a download.
- (a) Pass.
- (b) Try it, submitting within about a week.

### U194 · Push notifications for 2026
The research (docs/research/reports/push-notifications.md, 27 Nov) recommended skipping them. Then the user (27 Nov): "i think it would be nice to have push notifications, so if someone is using the phone on another app, he still gets the song. and if we make an android app, we maybe can make a nice live update notification". The research ruled out a push for each song because about 500 a night would annoy. That goes away with one notification replaced at each landing, silently (the same tag), showing the song that just landed. Android Chrome can do that with web push, with no app. iPhones get push only from a Home Screen install, which starts without the cards (the iOS research). Android's "Live Updates" style needs a native app, and the Play Store app was set aside (U197).
- (a) Skip push for 2026.
- (b) One silent notification per phone, updated in place at each landing, opt-in, Android first. About 3–5 days across Backend and Frontend, after the night's core is stable.
- (c) Only the two-message version (the Descans ending, a thank-you).

### U195 · Do winners ever leave without collecting their prize?
If they do, a reminder to an uncollected winner is the one push message with real value (U194), and Admin's winners list would need a "collected" mark.
- (a) No, or very rarely.
- (b) Yes, it happens.

### U207 · ✕ in a stack of the app's own drawers
In a stack such as Ajustos → the add-card pad, ✕ closes every drawer at once today. The QR camera's ✕ closes only the camera.
- (a) Keep it: ✕ closes the whole stack, and ‹ goes back one level.
- (b) ✕ closes only the top drawer.

### U205 · Parlem's switch to Hold music after 40 s
The user: "When the presenter lets a song play it should always loop and not switch to pause music." D239 does that for Aguanta and for manual advance. Under Parlem, today's engine lets the ducked song give way to Hold music after 40 s («Música d'espera»), and at its end. Hold music exists for long waits, so a long Hold doesn't loop the same few bars for minutes. But there are no real Hold tracks yet: data/media/hold has only error tracks, the win, the intro and the throw (U20), so today it would be a synthesized placeholder.
- (a) Parlem keeps the ducked song looping too, and the 40 s takeover and its switch go.
- (b) Keep the 40 s takeover, with real Hold tracks added (U20).

### U214 · The grill format outside the card design session
On 26 Nov the user told the orchestrator not to use the grill format. On 27 Nov, in the card design session, they asked for it ("the skill to check is grill with docs": numbered ❓ rounds, each with a ➡️ recommendation, worded so "yes" accepts it). On 28 Nov they restarted the orchestrator with "plain questions (one numbered question, one set of options, a recommendation)".
- (a) The grill format only in a card design session; plain questions in every other session. The default meanwhile.
- (b) Plain questions everywhere, the card design session too.

### U202 · What admin the console does during the night (D234)
Admin isn't at hand on stage. The proposal for the console:
1. Add sold cards to the cards in play: a range or single numbers.
2. Exchange a spoilt card (D232): take the old number out and add the new one, between rounds only.
3. Send a message to the phones (the banner).
4. Reorder or edit the upcoming rounds, for example moving the Desgraciat ("the order can change during the night").
- (a) These four.
- (b) Change the list (say how).

### U203 · What "the entire state" means for a second console (D234)
Today every console already shares the show's state live: songs, Holds, claims, Checks, winners. A second console could also mirror the screen itself, so it shows the same tab, an open claim pad and the number being typed.
- (a) The show's state only, as today, plus the hold locks. Each console keeps its own tabs and pads, so the tech can look something up without moving the presenters' screen.
- (b) Mirror the screen too.

### U188 · A tap outside the console's Wii dialog
The menu now closes on a tap outside (D279: the user reported it as a bug). Left open: the Wii dialog.
- (a) It doesn't close on a tap outside, because it may be mid-pairing. The default.
- (b) It closes too.

### U181 · What the «Veus automàtiques» switch turns off (D204)
Frontend's board (v104) has the switch on by default: «Apagat: cap veu més en tota la nit». Voices that fall due while it's off are dropped, not saved for later, since a late "15 minuts" would be wrong (D204's 60 s).
- (a) Every voice, the round's name on «Comença la quina» included. The round fanfare's music still plays, so the presenters keep their cue before talking (D198).
- (b) Only the timed voices: the doors and the Descans. The round's name and the goodbye still play.
- (c) Every voice and the round fanfare too.

### U179 · A volume slider on the break's music panel
screens.md lists "the music's skip and volume" for the break. Frontend's redraw of that panel (D196) has no slider, as on the agreed board. The menu's sliders (D139) still set the break music's level.
- (a) Only the menu's sliders.
- (b) A quick slider on the break's panel too, since the level is set by ear on the night.

### U176 · "repeat we're selling tickets at 3min"
The user's words in U171's first point. The reading: one more doors line, 3 minutes before the start, saying cards are still on sale ("Últims minuts per comprar cartrons!"). Every 3 minutes would mean about 20 announcements in an hour.
- (a) Yes, one more line at 3 minutes before the start.
- (b) Something else (say what).

### U177 · How the remote marks the drum roll's threshold (D203)
- (a) The 3 vibrations, like the other holds: letting go before the third stops the roll smoothly, and after it, the roll lands.
- (b) One vibration when the threshold passes.

### U178 · The D-pad's other three effects
Today they're taps: up «tada», right an orchestra hit, down a sad trombone, left Among Us. The same depth as the drum roll for each (held, on the beat, shake for more, a landing past the threshold). Yes or no for each:
1. **Up: the drum roll**, whose landing is today's «tada». A quick tap still plays a plain «Tatxan!», so nothing is lost; holding starts the roll. The sound starts on the press: a snare flick that a quick release turns into the «Tatxan!», so the tap never feels late. The tap/hold split is a new one of its own (not the two-level buttons' 800 ms), starting at about 300 ms and tuned on the remote at the listening pass (U13).
2. **Right: orchestra hits on the beat.** A tap is one hit on the next beat; held, a hit on every beat; shaking doubles the speed; past the threshold, letting go ends on a big hit with a long tail. For hype and punchlines ("Quina… TRES!").
3. **Down: the sad trombone.** A tap is the "wah-wah-wah"; held, its last note holds, and shaking wobbles it; letting go, the note falls off. The music sags a little under it and comes back. For jokes and near misses.
4. **Left: the crowd.** Held, applause swells; shaking adds cheers and whistles; letting go fades it, and past the threshold it ends in an ovation. It cues the tent to clap: the presenters' entrance, the sponsors, a winner. Among Us moves to the tablet's pad.

Left out on purpose: anything that changes the song's speed or pitch, like a tape stop or a scratch, because the landings follow the song's timing.

### U173 · Starting the night from the big button at the doors
D195 puts "Comença la quina" in the big slot in a break. At the doors, what comes next is starting the night, which today is only in the menu ("Començar la nit"). That's on purpose: "an A pressed while testing the remote mustn't start the show". With D198, starting it also plays the kick-off and the voice-over story in front of everyone.
- (a) The doors' big slot shows "Començar la nit", but only a tap on the tablet starts it; the remote's A does nothing before the night. The menu item goes.
- (b) The big slot is the A button there too: A starts the night.
- (c) It stays in the menu only.

### U168 · Horari's rows from the organizers' schedule
The organizers' list (D192) has two rows that D150's Horari doesn't: "Començem (6pm)" and "Descans + llançament".
- (a) Horari follows the list: a "Comencem" row at 6 pm (spelled the Catalan way) after "Venda de cartrons", and the break as "Descans + llançament".
- (b) Keep D150's rows: no start row, and the break as "Descans".

### U169 · "Tempesta" in the last round's Check
The user on the canvas: "in this screen we can swap +candidat for tempesta". But a second card can claim during any Check: claims on the same landing share the prize, and late claims count (game-rules › Ties). "+ Candidat" (D179) is the only way to add one during a Check. The last round is now the Especial, a normal round with a Line and a Bingo.
- (a) Keep "+ Candidat" in that Check, and give "Tempesta" a slimmer slot of its own.
- (b) Swap them as written. During the last round's Check, a second claim can't be added.

### U166 · A review before anything was revealed
D191 keeps the music far down under review, "as during the Check". But a Check only ducks the music from its first reveal. Before that, the music from before the Check plays at the claim's level. So in three cases a review has the music at the claim's level (Sound engine, 26 Nov):
- the presenters send the Check to review before revealing any song;
- they "Enrere" back to no reveals, then send it to review;
- another card's Check comes on screen meanwhile, and the duck goes with it.
- (a) Far down for the whole review: the duck goes on as the review starts, whatever was revealed, and stays through another card's Check until the review ends. After "continue" with nothing revealed, the music comes back to the claim's level, like any Check before its first press.
- (b) As the Check had it: far down only once something was revealed; otherwise at the claim's level.

### U79 · Phones while under review (D118, D119)
A Check under review gets its own screen on the projector and the tablet; the music keeps playing, far down (D191), and Pausa is only by hand. During a Check, phones show "Comprovant el cartró 123…". On a review:
- (a) that line just closes, with no mark (what Backend built for now, a one-line change);
- (b) it stays, still pending, until the card is checked again or dropped;
- (c) it changes to a neutral line, like the projector's.
No default: the user decides.

### U68–U75 · The edition file (D116): Backend's and Sound engine's joint proposal, 26 Nov
The proposal: `npm run edition -- build 2026` assembles `data/editions/2026.json` (the plan with rounds, prizes, sponsors' names, schedule and cheat sheet; the songs per pool; card types and cards; the pool it came from), checking that it all fits. It never holds audio, covers, hooks, Games, winners' names, resume codes, seeds or money. `npm run edition -- upload <file> [--reset]` validates, saves the cloud's current state, then replaces it. Local seeding is the same upload against the local Worker, plus the plan for the relay. Facts: logos and prize pictures are in the cloud's own database today, not in the bucket; cards and card types are static files deployed with the Worker.
- **U68 · Cards:** (a) uploaded data, so one upload configures everything; (b) static files deployed with the Worker, as today. Proposed: (a).
- **U69 · Where the old settings are saved:** (a) the cloud keeps every replaced version, restorable by number; (b) a timestamped local backup, gitignored since Games hold winners' names; (c) both. Proposed: (c).
- **U70 · What a rehearsal reset clears:** (a) the plan and settings, plus a fresh Game, with old Games kept; (b) also deletes the rehearsal Games, after backing them up. Phones keep their saved cards either way. Proposed: (a).
- **U71 · Logos:** (a) move to the R2 bucket; (b) stay in the cloud's database. The file only names them. Proposed: (a).
- **U72 · The path:** (a) `data/editions/2026.json`, like the pools; (b) `data/editions/26.json`. Proposed: (a).
- **U73 · Tests and development:** (a) a test edition file built from the default pool replaces the hand-written test plans; (b) keep both. Proposed: (a).
- **U74 · After an upload, if Admin edits the plan:** (a) `npm run edition -- pull` writes the cloud's plan back into the file before each commit; (b) Admin can't edit what the file holds; (c) the file is only a starting point, and Admin wins afterwards. Proposed: (a).
- **U75 · One file or split:** (a) one assembled file, as the user said; its cards (about 1 MB two-sided) change with every song swap; (b) the plan by hand in one file, with songs and cards referenced from the pool. Two files can drift. Proposed: (a).
- Their Q9 (one edition = one night bundle) became U54, answered by D178: each set of 70 is a pool.
**Default:** nothing built until the user answers.

### U12 · The theme pass
Pending your go on the visual theme pass across the screens. Not ready yet (25 Nov).

### U13 · Listening pass on the new sound
Not heard yet: phrase landings, the lighter early palette and rare impacts, Signatures before the landing, the new Suspense, Aguanta's loop, vocal entries, Count-in. Things to confirm while listening, including the chaotic moments' loudness (D158); and when trying the remote, the cancel window (D148) and how long A is held before "Seguides" starts (600 ms for now):
- **Suspense release:** it lands on the outgoing song's phrase boundary, up to about 9 s after the release. The alternative is a 2-bar boundary, about twice as fast. **Default:** the phrase.
- **Signatures are rarer:** about 5% of transitions (38 of last year's 77 songs get one). Options: keep it; lower the automatic pick's score (0.6); pick more by hand. **Default:** keep, and pick by hand while reviewing this year's songs.

### U55 · Old song data on the laptop's disk
Both final pools are prepared (27 Nov). Two old sets are kept and wait for the user's OK to delete (D80): last year's 77 test songs (about 6 GB), and 2026's data from before the final playlists, set aside in `data/out|cache/repertoires/2026-before-final` (about 2.5 GB). The laptop has about 70 GiB free, so there's no hurry.
- (a) Keep both for now.
- (b) Delete the 2026-before-final set only.
- (c) Delete both.

### U56 · Cutting the hook approval from 7 hours
About 2 minutes a song is about 4.7 hours for 140 songs. Sound engine's options: (a) a quick-review mode on the audition page, playing the top automatic hook (Enter accepts, the arrows step through candidates, the next song loads by itself), so 30–40 s a song and about 1.4 hours, at half a day of work; (b) one approved hook per song instead of two, which also cuts stems, disk and storage (each song plays in 5 rounds now, not 10); (c) other organizers review one set each, on the same page over the local network.
**Default:** (a) and (b); (c) if the user wants it.

### U63 · A credential so agents can edit the cloud's plan
D116 has the user or an agent upload the edition's JSON to the cloud by hand, saving the old settings first. The upload tool is being proposed by Backend and Sound engine. To push without a Google login it needs its own Cloudflare Access service token, `quina-agent`, allowed only to read and save the plan, kept on the dev Mac only and revocable on its own. The user creates it in Zero Trust (a few clicks). About half a day of Backend's work.
**Default:** nothing built until the user says yes.

### U50 · How the screens point to the right side
The presenters explain the sides in rounds 1 and 6 (D102, D193).
**Default:** the phone shows the side of the current or coming round by itself; the console reminds the presenters at the intros of rounds 1 and 6; the projector shows the side's mark at each regular round's intro and Interval, matching the printed one. Designs only, with Frontend.

### U36–U39 · How prizes really work
Asked in chat on 2026-11-25 after checking event.md against the 2025 hamper sheet and the 2026 sponsors sheet:
- U36: the Line's prize in 2025 and 2026;
- U37: a hamper's three tiers (the big item, sponsor gifts with logos, the basics uncredited), with a sponsor's units split across rounds;
- U38: a gift known only by its sponsor;
- U39: money donors are thanked, never tied to a prize;
- U40: answered (D89).

**Default:** the prizes drawer stays on hold until these are answered.

## Tasks only the user can do

### U220 · Try the Wii remote on this laptop · before the tech rehearsal
The runbook's old step (pair in System Settings) can't work, and 2025's WiimotePair fails on macOS 26 and 27 (docs/research/reports/wii-remote-mac.md). With the real remote:
1. Pair it with MacWiiPair and the red SYNC button; note the model printed on the back (RVL-CNT-01, or -TR "Wii MotionPlus Inside").
2. In the Console on the laptop: the buttons, rumble, the LED, the battery and the three strong shakes.
3. Turn the remote off and on, then restart the Mac: does the Console reconnect by itself, or does it need Comandament → Connectar again?
4. Quit Chrome hard (`kill -9`) and restart the Mac: does a "Restore pages?" or "profile in use" dialog appear in the show or console window (Backend's check)?
Then the spare laptop, the same way. A Mayflash DolphinBar on a USB extension may fix both pairing and range, but nobody has confirmed it on a Mac: optional, to try at a rehearsal.

### U191 · Ask the presenters about a notebook on the tablet
The idea is in [ideas.md](ideas.md): their own colour-coded notes, imported and shown as a draggable notebook over half the console. First, do they want it at all, or do they prefer paper?

### U126 · Check for lost Admin edits on quina-dev
Backend found a bug (fixed in 5fdc2c9): the cloud didn't save a plan edit that phones don't see, like a later round's prizes or the cheat sheet, and the edit was lost when the cloud restarted. If you edited those in Admin on quina-dev, check that the edits are still there.

### U65 · Rotate the relay's pairing token · optional, before the tech rehearsal
The relay's pairing secret (`data/cache/relay-token`) sat in the private R2 bucket from 24 to 26 Nov, readable only with the laptop's service token. Backend removed it and excluded it from the sync (6397550). To rotate it: delete `data/cache/relay-token` on the show laptop; the relay makes a new one, and the tablet pairs again.
**Default:** rotate it when the tablet next gets paired anyway.

### U64 · Check R2's payment method
D113 lets R2 go past the free 10 GB. Backend can't see billing. In Cloudflare: Manage Account → Billing → Payment info, check a payment method is there.

### U14 · Approve this year's hooks · before the first rehearsal
On the audition page: about 2 minutes a song, so about 3 hours for 90 songs, and about 4.7 hours for 140 unless U56 cuts it. A song can't play until its hook is approved. It starts once the playlist is handed over and prepared (D80).

### U16 · Upload the logo library in Admin
It needs your Google login: Admin → "Pujar logos a la biblioteca" with the cleaned logos in `temp/logos-clean/`, then "Triar de la biblioteca" per sponsor. Two logos are small sources; ask those sponsors for bigger ones.
Two sponsors have no logo file at all in the organizers' list: s-and-s and peixos-arnau (Backend, 28 Nov); ask the organizers for them. Verdures Andreu's was doubled; Backend cropped it and put it in the plan (49352964).

### U18 · The night's plan in Admin · before the first rehearsal
Rounds in order, a card type and side per round, prize bundles, sponsors, the doors' time and the throws. Since D116 it goes in through the edition file (U68–U75).

### U19 · Checks on real devices · before the rehearsals
1. An iPhone with Safari (iOS 26 or 27, set to Catalan, for the labels and screenshots) and an Android phone with Chrome: scan a test QR, add a second card by number, lock and unlock (it reconnects, and the screen stays awake), sounds after the first tap. The touch sounds (D208): the iPhone's silent switch mutes them (Safari's "ambient" audio), and a tap on a faded key thuds or stays silent, either of which is fine.
2. An older phone: smooth scrolling with 3–4 cards, usable at the end of a round.
3. Last year's offline cache (can be checked now): open the QR address on a phone that used last year's app; it must load this year's player, not the cached old one.
4. On the iPad console, the Llançament icon's crossed swords: the front sword's outline must cut a clean gap in the back one (Safari, e4c0a3ca).
5. The projector at 4:3, 16:10 and 16:9 (D276): the drum, the last-3 row and the Check readable from the back.
6. The console on the actual tablet (iPad and Android) over the hotspot, then pair a phone as the tech's console. It needs iPadOS 18 / Safari 18 or Chrome 131 or newer (D293).
7. Scanning a card on Android (a Samsung and an older phone) before the cards are printed on 4–5 Dec: the camera, the Quick Settings scanner and Google Lens. Each must open the card itself, with or without the installed app (D224).
8. The real Wii remote: every button, the shake for Suspens, and its range from the stage to the laptop.

### U20 · More Hold music and victory tracks
Only 3 Hold loops and 1 victory track exist, so they repeat a lot (`data/media/hold`, `data/media/celebration`). You'll add more.

## Answered

- **U212 · Which card** (2026-11-28) → D295: the organizers chose «Apaïsat sense portades», the 21 × 9.9 cm card without covers, three to an A4 page.
- **U193 · Where the install button goes** (2026-11-28): replaced by U230, since D290 removed the spot it relied on.
- **U204 · The realistic run's times** (2026-11-28) → D288: today's test starts 30 minutes after the deploy and the laptop setup are live; 27 Dec's times go back afterwards.
- **U225 · The ✗ in the Check's cells** (2026-11-28) → D283: thick on the projector's Check; the console's stay.
- **U221 · Where the laptop sits; U229 · the backup remote** (2026-11-28) → D281: at the tech's table with the mixer; the user's pick of backup.
- **U215 · The night's start; U218 · the browser-only setup** (2026-11-28) → D282: a Mac app with a control page; U218 moot.
- **U206 · The phone's drum landing** (2026-11-28) → D277: the Spin's target travels from the Spin's start, shown only at the landing.
- **U208 · The near-win sound** (2026-11-28) → D278: (b), the sound and buzz stay without the marking.
- **U216, U217, U222, U224** (2026-11-28) → D279: (a), (b), (b), and Frontend's pick on "decide yourself".
- **U223 · The edition's name** (2026-11-28) → D280: «Quina Quina! 3».
- **U226 · What to buy to test the remote** (2026-11-28) → D275: the Wii remote with MacWiiPair, no adapter; a backup remote (U229).
- **U227, U228 · A second projector** (2026-11-28) → D276: inside for the back tables; the same image from a splitter.
- **U219 · If 5G drops** (2026-11-28) → D273: a drop isn't a design concern; what's built for it stays.
- **U57 · Pool 2's song numbers** (2026-11-28) → D238, D269: pool 2 continues after pool 1 (71–135), and a shared song keeps pool 1's number.
- **U61 · A pool's song we can't download** (2026-11-28): moot. All 135 songs downloaded (D269).
- **U213 · #117's cover** (2026-11-28) → D270: keep the real 1996 white label; title «Els Segadors Remix», artist «Pont Aeri-Chasis».
- **U198 · The special card's labels on the screens** (2026-11-27) → D266: «Desgraciat» and «Especial».
- **U199 · The 4 songs in both playlists** (2026-11-27) → D268: a model change. One repertoire with every song once; a song may be in both pools; pool 2 keeps its 70.
- **U201 · The sticker circle's sides** (2026-11-27) → D265: both sides.
- **U211 · How many normal cards** (2026-11-27) → D264: still 399, with the sheet's spare places as «MOSTRA» samples.
- **U52 · Duplex printing and the paper** (2026-11-27) → D267: last year's coloured paper, in colour, a proof sheet first.
- **U210 · Cards per printed page** (2026-11-27) → D256: six on an A3 sheet, portrait.
- **U209 · The normal card's heading** (2026-11-27) → D254: «QUINES 1–5» / «QUINES 6–10» as the title; «QUINA QUINA!» with «BARRAKUDES · 2026» in the branding.
- **U200 · The word in the sticker circle** (2026-11-27) → D253: «GOMET».
- **U161 · A spare laptop's music** (2026-11-27): moot. Repertoire 2026 is in R2 with the Hold, Interval and voice music, so a spare can pull it (ca3c0a3d).
- **U30 · The prizes drawer** (2026-11-27) → D244: P1's round selector with P2's content; «Premis sorpresa» for locked rounds.
- **U170 · The Llançament and Tempesta icons** (2026-11-27) → D245: A and A, redrawn in the outline style.
- **U174 · When "Vols afegir un altre cartró?" shows** (2026-11-27): moot. D241 replaces the banner with a step inside the add-card drawer.
- **U58 · The alphabetical convention** (2026-11-27) → D238: letter by letter, as the user's sorting tool does and the playlists are.
- **U192 · A two-sided special card** (2026-11-27) → D226: yes, agreed with the team; the Desgraciat on side 1 (pool 1), the Especial on side 2 (pool 2).
- **U59 · The special card's back** (2026-11-27) → D226: it's side 2, for the Especial.
- **U187 · The oldest iOS** (2026-11-27) → D219: the latest browsers only; amended by D293 (a floor of Safari 18 and Chrome 131, after the user's iPhone on iOS 18 failed in the live test).
- **U180 · The phone's home as drawn** (2026-11-27) → D218: build it now, from the design system's components.
- **U167 · The special rounds' pool** (2026-11-27) → D217: for now, one side from pool 1, as the team agreed; the two-sided card is the user's task U192.
- **U189 · Balanced line breaks on titles** (2026-11-27) → D215: yes, as a project-wide rule (headings balance, body text pretty).
- **U175 · The design system's open choices** (2026-11-27) → D211: answered on the canvas. The user commented on the Design system page and then called it "correct"; Frontend applies the comments and reports any item they changed.
- **U190 · The design system's props rework** (2026-11-27) → D210: all as recommended.
- **U182–U186 · The interface sounds** (2026-11-27) → D208: the tablet on by default with a switch; none in Admin; one switch on phones; a thud on a refused tap; the sounds picked for the user, wobbly and bouncy.
- **U171 · More moments for automatic sounds and voices** (2026-11-26) → D202: 1–4 yes (the 4th may be dropped), 5 no; a drum roll instead (D203).
- **U172 · The voices' rules** (2026-11-26) → D204: as proposed, played only when the presenters are unlikely to be talking.
- **U78 · The music's level while under review** (2026-11-26) → D191: still far down, as during the Check.
- **U165 · "QUINA POTRA!" on the winner's phone** (2026-11-26) → D190: the phone says "Quina potra!" too.
- **U164 · A title for the Desgraciat's winner** (2026-11-26) → D186: "QUINA POTRA!".
- **U155 · The finale and the new tabs, what's left to review** (2026-11-26) → D187: all fine, Frontend's v95 details included.
- **U162 · "Tots dempeus!"** (2026-11-26) → D181: "Salvats!", the light from the text, spotlights and the phones' particles.
- **U54 · What to call each set of 70 songs** (2026-11-26) → D178: each is a pool (Pool 1, Pool 2).
- **U153 · "+ Candidat"** (2026-11-26) → D179: yes.
- **U77 · The review screen**, **U130 · the Check boards (v67)** (2026-11-26): reviewed by the user through the canvas (their own edits and 15 comments, v84; D165).
- **U88 · The remote during a review** (2026-11-26): answered by D128 and D135 (the −/+ hold sends a Check to review; A does nothing in a review).
- **U112 · "Següent" during Pausa** (2026-11-26): it ends Pausa, and Parlem with it (D142).
- **U156 · A slightly before B** (2026-11-26) → D176: no delay; B while A is held turns the starting transition into a Suspens.
- **U154 · First plays and the night's length** (2026-11-26) → D175: keep 22 s.
- **U51 · The slower pace** (2026-11-26) → D174: not the first round but a song's first play of the night, longer and from its main hook.
- **U151 · The finale decided by the song** (2026-11-26) → D172, then superseded by D180: no grouping and no shared win; the songs go on until one is left.
- **U152 · The game's-state tab** (2026-11-26) → D173: "Estat".
- **U142–U149** (2026-11-26) → D166–D170: the finale replaces the Desgraciat's Check; it starts from the claim button's slot, which grows; a finalist's card shows privately and a fallen one isn't added; finalists can be removed or brought back; the song decides (U151 to confirm); the lookup is its own tab, today's Futur becomes the game's state with the song history, and a new Futur holds the possible winners and the upcoming songs.
- **U140 · The canvas edits** (2026-11-26) → D165: the user's own, with the canvas's assistant.
- **U127 · The plan-save fix's deploy** (2026-11-26): the user approved it; deployed as 94b395be. Step 1 of the new Check is deployed too (fddfdc1d).
- **U135 · One slider or two for the chaotic moments** (2026-11-26) → D159: one shared slider.
- **U134 · The loudness details** (2026-11-26) → D158: noticeably louder, set by ear; the starting point is +6 dB with a −6 dB trim, both tunable.
- **U133 · How the chaotic moments get louder** (2026-11-26) → D157: their slider above 100% with hidden room; every slider 0–150%, default 100%.
- **U132 · The corn-seed storm** (2026-11-26) → D153, D155: "Flying Free" from its drop for now; the button on the last round's normal screen, inside its Check and on the end screen.
- **U131 · Horari's first row** (2026-11-26) → D152: "Venda de cartrons".
- **U120–U122 · Suspens on the remote** (2026-11-26) → D147, D148: letting go of B lands; B + A has the same vibrations and cancel window as the manual one; the shake stays on; 1.5 s, to tune on the remote.
- **U123 · The screens' word for a break** (2026-11-26) → D149: "Descans".
- **U124 · The console's labels** (2026-11-26): the user tells Frontend directly ("He took the code freeze too seriously").
- **U125 · Horari's rows** (2026-11-26) → D150: the card-selling time, the rounds with "Primer descans" and "Segon descans", "Fi".
- **U116–U119** (2026-11-26) → D142: "Següent" ends Parlem after all, so U116 and U118 need no answer; U117 (a), no expirable Aguanta; U119 → D145 (b): with manual advance, holding B starts a cancellable Suspens.
- **U115 · What the add-card QR button does** (2026-11-26) → D141: it scans inside the app.
- **U84 · Does "Següent" end Parlem?** (2026-11-26) → D133: no; Aguanta and Suspens disable "Següent"; an expirable Parlem or Aguanta shows a badge. Follow-ups U116–U119.
- **U90–U92 · "Enrere" inside a Check** (2026-11-26) → D134: the projector removes the mark; the previous snippet replays and that Check's automatic reveal turns off; only while revealing.
- **U93–U95 · Pausa** (2026-11-26) → D135: "Tornem de seguida" only in a round, a Check or a Celebration; it resumes exactly where it was; during a review the hold is Pausa and A does nothing.
- **U96 · "Break"** (2026-11-26) → D136: every Interval; the user prefers "break"; a throw is just a "Throw".
- **U98 · The end and the DJ** (2026-11-26) → D137: no DJ; a Spotify Jam from a phone during the take-down.
- **U100 · The throw song** (2026-11-26) → D138: last year's "Flying Free" (Pont Aeri), its own hook before the drop; "Llançament" taps stop and resume, and a long press restarts it.
- **U101–U102 · Volumes** (2026-11-26) → D139: every slider listed, on the tablet, saved in the cloud and the edition file.
- **U66 · Publishing the Check boards** and **U67 · The console's two labels** (2026-11-26) → D140: the user's go to design and build the new things.
- **U86 · A card number that doesn't exist** (2026-11-26) → D126: refused privately on the pad.
- **U87 · "Enrere" during a claim and a Check** (2026-11-26) → D127: the normal Back before a Check; inside a Check, one press steps back one song, and it never closes the Check.
- **U82 · Where Discard leads** (2026-11-26) → D122: back to the music from before the Check, in Parlem with the auto-advance off, until "Següent".
- **U76 · The projector during a review** (2026-11-26) → D123: the Check screen, showing "Revisió manual".
- **U83 · `dropped` or `discarded`** (2026-11-26) → D124: `discarded`.
- **U81 · The internal status name for "under review"** (2026-11-26) → D120: `reviewing`.
- **U80 · A temporary-sounding name for the stopped Check** (2026-11-26) → D119: "under review", "En revisió" on the tablet, button "Revisió manual".
- **U62 · The Check's remaining details** (2026-11-26) → D117: a stop goes into Pausa; automatic reveal runs through the fanfare and stops there; the rest stands.
- **U46 · Londrina's two lowercase exceptions** (2026-11-26) → D114: both, as drawn.
- **U47 · The card icon picker's style** (2026-11-26) → D115: A; the QR icon is too sharp next to the others.
- **U43 · Which copy wins on the night** (2026-11-26) → D111: the cloud, always; no git-tracked settings file; development runs on a test plan.
- **U48 · Sponsors' names and money in the settings file** (2026-11-26) → D112: no sponsors, prizes or money in git.
- **U53 · Storage past the free 10 GB** (2026-11-26) → D113: fine to go past it; upload as soon as the files are ready, prune after the night.
- **U60 · Two Interval tracks by hand** (2026-11-26) → D106: left out; the Interval plays its 37.
- **U49 · The special rounds' pool** (2026-11-26) → D105: their own playlist (79G8VcNrkih9GGjIzb47Gt), using pool 1's songs until it's final. The special card's back moved to U59.
- **U34 · How many songs in the pool** (2026-11-25) → D100: 70, final, for each pool.
- **U42 · Where the night's settings file lives** (2026-11-25) → D97 and D98: in this public repo, every prize included; hiding prizes is only for the hype on the players' screens.
- **U45 · The shake icon** (2026-11-25) → D94: option C with a smaller, medium "×3" (size option 2 for now), no frame.
- **U44 · The menu's rare, risky holds** (2026-11-25) → D92: they keep "Mantén premut", as a tag beside the label.
- **U41 · A Celebration while a drawer is open** (2026-11-25) → D90: a Celebration closes Premis, Horari and Ajustos, not the pad; the your-song flashes and particles play on top of everything.
- **U35 · What the print shop needs** (2026-11-25) → D88: the same as last year, just the PDF.
- **U40 · How contributions get into hampers** (2026-11-25) → D89: the organizers use their own spreadsheet; the orchestrator parses it into the plan; the night's settings live in a git-tracked JSON file that agents edit.
- **U17 · The PDF install script** (2026-11-25): approved by the user; `canvas` is built and loads.
- **U26 · One special card for both special rounds** (2026-11-25) → D81: yes, one card plays both.
- **U27 · The rehearsal dates** (2026-11-25) → D82: no fixed dates; a tech rehearsal when ready, maybe a presenters' one a day or two before or on the day.
- **U28 · When the cards are printed** (2026-11-25) → D83: the user makes them on 4–5 December, if the playlist is ready.
- **U29 · How far "no fallbacks" goes** (2026-11-25) → D84: no fallback versions in the code; the operational plan Bs stay.
- **U31 · A new colour each edition?** (2026-11-25) → D85: a new title each edition; the colour may stay.
- **U24 · Stray local files** (2026-11-25): `legacy/2025/last-year-data/` is git-ignored; the rest of `legacy/2025/` stays; the old `ci-head` worktree is removed (all of it was already on main). Useful aggregates from the export go into a doc.
- **U32 · Storage past 100 songs** (2026-11-25) → D80: moot; the final playlist will almost surely be under 100 songs. No work on the draft until the user hands over the playlist.
- **U33 · Disk space** (2026-11-25): withdrawn by D80; nothing is deleted.
- **U23 · Frontend's session can't reach GitHub** (2026-11-25): resolved; the user ran `ssh -T git@github.com` there and it authenticates.
- **U1 · How to download the songs** (2026-11-25) → D66: the method is Sound engine's call, as long as the quality is right and the user does little work; the user downloads only the few leftovers by hand.
- **U2 · The printed card's title and colours** (2026-11-25) → D67: "QUINA QUINA! 3" with last year's colours, provisionally; may change at print time.
- **U3 · Card types and amounts** (2026-11-25) → D68: as in 2025, provisionally.
- **U25 · This year's card prices** (2026-11-25) → D69: as in 2025, 1.50 € a round and 5 € for a special card.
- **U4 · When cards are handed out** (2026-11-25) → D71: only on the night, at the start and during it; printing takes a few hours.
- **U7 · Two Desgraciat board points** (2026-11-25) → D72: no standing count on the projector; the sitting nino.
- **U8 · The prizes corner icon** and **U10 · The player app's layout** (2026-11-25) → D73: drawers and two corner buttons, no fallback; proposals to pick from (U30).
- **U9 · The effect when the landed song is yours** (2026-11-25) → D74: spotlights and flashes, no bolt drawing, smooth in and out.
- **U11 · The card-stacking scroll** (2026-11-25) → D75: discarded for now.
- **U15 · The QR domain switch** (2026-11-25) → D76: now.
- **U21 · Card text size on phones** (2026-11-25) → D77: the current design is fine.
- **U22 · The printed cards are public** (2026-11-25) → D78: public, and anything may be public unless there's a reason.
- **U5 · Card prices on the projector** (2026-11-25): show only the price for the coming round, on that round's Interval screen (the before-the-start screen is round 1's). A normal card costs the per-round price × the regular rounds still to play, the coming one included, not counting the Desgraciat (2025: 1.50 €, so 15 € before round 1); before the Quina Especial, the special card's fixed price. The prices come from setup data, never hard-coded.
- **U6 · The Desgraciat's celebration title** (2026-11-25): none. "DEMPEUS!" is dropped; the rest of its Celebration stays. The phones' per-card "Dempeus" / "Assegut" labels stay.
- **Rehearsal dates:** withdrawn. The 13 and 19 December written in event.md were the orchestrator's defaults, not the user's; reopened as U27.
- **Late claims (R2-Q12):** a late claimer wins if nobody else claimed; any other case is decided on the spot (event.md).
- **The Desgraciat when the last players fall together:** they share the win (event.md).
- **The Efectes pads:** icons, with the word version kept as a board (canvas, 24 Nov).
- **Wii remote mapping (R2-Q38):** decided and built.
- **Where the show runs (R2-Q26):** A+, an installed laptop with media from R2.
