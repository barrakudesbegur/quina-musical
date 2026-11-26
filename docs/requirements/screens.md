# Screens

What each screen must show, who uses it, and what it must never show: the projector, the console, the player app, Admin, the cheat sheet and the Wii remote.

- Every rule here comes from [event.md](../event.md). Why a rule is the way it is, and what it replaced, is in [decision-log.md](../decision-log.md).
- "(pending U30)" points to [open-questions.md](../open-questions.md); the rule states the default in force meanwhile.
- "**Not built yet.**" marks a rule the handoffs list as still to do.
- Terms follow [GLOSSARY.md](../../GLOSSARY.md). Every animation is specced in [ANIMATIONS.md](../../packages/ui/ANIMATIONS.md), with its trigger, timing, sound and fallback, before it's built.

## Every screen

_From event.md › The audience, Atmosphere and style, Fairness and trust._

- **Everything is in Catalan,** in informal, natural language.
  - A round is "Quina 1"…, the special round "Quina Especial" and the Desgraciat "Quina Desgraciada". Numbering only appears as "Quina 4 de 12".
  - A Line is "Línia", a full card "Quina!" ("premi de quina"). Card numbers are written "#123". Times use am/pm.
- **A show, not a meeting:** a festive Christmas look, styled like a mobile game, "juicy" and full of animation. The projector and the player app get the full look; the console and Admin can be simpler. One design system covers all of them.
- **Animations are part of the show.** Each one is planned in [ANIMATIONS.md](../../packages/ui/ANIMATIONS.md) before it's coded. Motion never tells a secret: nothing moves before a song lands.
- Barrakudes' figures ("ninos") may appear, only family-friendly ones, and only if they fit the style.
- **Londrina is always in capitals** (D96): titles, buttons, names and numbers. Unit symbols beside a number stay lowercase ("9 s", "10:14 pm"), and Nunito text inside a Londrina button keeps its case (D114).
- Images are JPEG XL, with a PNG or JPEG fallback. Never WebP.
- **The ending stays secret.** Nothing public shows the next song, the Queue, who might win, or how close the end is.
- The approved look still has to be applied to the projector, the console and Admin (pending U12; not ready yet). The player app already has it.

## Projector

_From event.md › When and where (Projection), The night, step by step, Claims and checks, Fairness and trust; the decisions doc › Projector._

**Who uses it:** the whole audience. It's a 4:3 projector far from the audience, so only big things are readable and there's no small text. It must also work at 16:9. It's silent: the sound comes from the engine on the PA.

| State | What it shows |
|---|---|
| Before the Game | The edition's name; a preview of the night's rounds (regular, the Desgraciat with a sad face, the Especial with a star); each card type with its colour and the rounds it plays (the special card: the Desgraciat and the Especial); the price of a card for round 1; a large "scan your card" QR; the sponsors; a rough countdown |
| A round's intro | "Quina N" (or "Quina Especial", "Quina Desgraciada") with its prize bundles and sponsors, revealed now as the presenters announce them |
| The Shuffle | Every cover in a grid, shaken, flying into the drum |
| In play | A big edge-to-edge drum of pending songs; the current song big after each landing; only the last 3 songs in a row under the drum; the round's name; the Heat |
| Hold ("Parlem") | No visible change |
| Pause | "Tornem de seguida" |
| Claim and Check | "CARTRÓ #123" and one label for the card's type and side, "Normal 1-5", "Normal 6-10" or "Especial" (D163), first (a wrong type fails here); the card's grid; each song ✓ or ✗ in turn, at the presenters' pace; the result. A Check under review stays on the Check screen with "Revisió manual", no pass or fail (D118, D119, D123) |
| A failed Check | A huge red ✗ with red light beams, and no text. In the Desgraciat, the song that sank the card is lifted out so the whole tent sees it |
| Celebration | "LÍNIA!" or "QUINA!" huge (the Desgraciat's has no title), the prize bundle and sponsors, confetti, ninos and a victory lap of the drum |
| Interval | The next round's name, a rough countdown, "Quina 4 de 12", the price of a card for the coming round, and sponsor thanks |
| After the Game | Thanks and sponsor credits |

- **Card prices:** only the coming round's card price, on that round's Interval screen. The before-the-Game screen counts as round 1's Interval. Before the Quina Especial it's the special card's price. The prices themselves are in [songs-and-cards.md › Prices](songs-and-cards.md#prices). The Interval shows the coming round's card in its colour with its price ("Cartró: 10,50 €"), and nothing until a price is set.
- **The Desgraciat's Celebration** has no title.
- **It never shows:**
  - the next song, the Queue, the possible winners or the standing cards;
  - a winning card number or a winner's name;
  - a prize before its round's intro, or any prize in the Interval;
  - a QR or URL during play or the Interval;
  - fairness code, how-to-play text or a resume code.
- How many cards still stand in the Desgraciat: the console shows it, the projector doesn't, since the count includes unsold cards (D72).

## Console

_From event.md › The presenters (What they can do, What they see privately, Their equipment); the decisions doc › Changes._

**Who uses it:** the two presenters, on one shared tablet in landscape. The tech opens the same page in portrait on their phone to help. Every open console stays in sync. It has a light theme, simpler and with icons, and keeps its dark theme as the alternative (D2). The layout must be very well thought out: "Següent", Hold and the claim stay in the same places in landscape and portrait (R2-Q21): one cluster in the same order, the right column in landscape and fixed at the bottom in portrait. To be checked against R2-Q21 at the theme pass.

- **Always visible:** the round, the Phase and the real Heat, the clock, the expected end of the round, the Drift and the connections (cloud or hotspot, phones' feed, Wii remote).
- **"Ara sona"** is the playing song, with a ring that counts down to the next auto-advance and shows the state (manual, "Parlem", "Aguanta"…).
- **"Següent"** is the next song, private, with a countdown to its landing so the presenters can name it on the hit.
- **The buttons:** every action in [show-and-music.md › The presenters' actions](show-and-music.md#the-presenters-actions). "Enrere" takes a quarter to a third of the bottom row, and "Comprovar cartró" the rest. Each control a Wii button triggers shows a small badge with that button.
- **Tabs:**
  - **The lookup (D162, D170):** a private quick check at any time in a round: a fuzzy song search (title or artist, typos accepted, matches highlighted), and a card check whose "show future" also tells whether the card can still win;
  - **The game's state (D170; its name pending U152):** always visible. On the left, how many cards have each number of songs missing; on the right, the round's song history, scrolling;
  - "Futur" (D170): hidden until someone taps "Mirar el futur". The possible winners and the songs to the first possible Line and Quina on the left; the upcoming songs on the right, each with how far ahead it is and how many more songs until any card can win;
  - "Premis": the round's prize lines and sponsors, ready to read out;
  - "Efectes": the sound pad, as icons;
  - in the Desgraciat, "Dempeus" comes first: the count of standing cards, each standing card's number from 60 down, and "Comprovar #57" as the default action when one card stands.
- **During a Check (D107–D110, D117):** the card as its 3×4 grid, already marked privately, with any warnings ("not registered as sold"); the next song's title large, to read out; one big button that reveals the next song (the remote's A; held, or with the tablet's toggle, they come in a row); the presenters' cue for the fanfare; a smaller "Revisió manual" button that sends the Check to review with no pass or fail (the claim shows "En revisió"); then the review's four choices: continue, win by hand, lose by hand, discard (D121), with a warning when a choice goes against the card; "+ Un altre". The list of claimed cards only shows when there are 2 or more. There's no "Confirmar".
  - Then a Celebration music override, the winner's name and notes.
  - A numbered slip's number on the winner form, optional, next to the name.
- **During the Interval:** the next round and its prizes to announce, the guide countdown ("Compte enrere orientatiu"), the music's skip and volume, and "Comença la quina".
- **The menu:** start and end the night, the Schedule, Panic, the resume code, and "Comandament", a drawing of the Wii remote's buttons that opens by itself when a remote connects.
- **On the laptop:** the tech must be able to drive the whole show from the laptop alone: the console on the laptop's own screen, the show page on the projector as a separate display (never mirrored, since the console shows the next song), and a USB presenter clicker (→ or PageDown) running the console's default action. Set up as in the night runbook's "Without the tablet".
- **It never reaches** the projector or phones: the next song, Futur, the song lookup, the standing cards (except the Desgraciat's finalists on stage, D161) and the resume code stay on the console.
- **The claim pad** closes with "Torna a la quina", its larger button (D164).
- Both iPad and Android tablets must work (pending U19, the check on real devices).

## Player app

_From event.md › Players' phones; the decisions doc › Changes._

**Who uses it:** players who want to, on their own phones. The game works fully with paper and corn; phones are a companion.

- **Getting in:** players scan the QR on their card, straight in the browser. There's nothing to install and no account.
  - They add more cards by scanning, or by typing the number on the big "Afegir cartró" pad. Leaving the pad with a number typed asks first.
  - The pad's QR button scans the card inside the app, in the drawer, keeping the name and icon already picked (D141).
  - The pad has one save button: full width, square corners, with a tick icon; no "Desar i afegir-ne un altre" (D95). **Not built yet:** the board's name field, QR button and smart keypad. The icon picker mixes B and C: B's labels and its faded background for a taken icon; C's circular shape, frame and border (D131).
  - They can name each card ("Àvia"). Each card gets its own icon and colour, always corn first, then nine more (among them a heart, grapes, a top hat and the Tió). Removing a card asks first.
  - Cards are kept on the phone for the whole edition. Last year's links show "Aquest cartró és de l'any passat".
- **Layout (D73):** one home screen, two corner buttons and stacked drawers. The tabs are gone, with no fallback layout kept in the code (built in 71caa9c).
  - the home screen: the drum on top, then the current round's songs ("Historial", including the one playing now) and the player's cards as grids;
  - the Premis corner button opens the current round's bundle and sponsors, with future rounds locked;
  - the Horari corner button opens the schedule, with real times for what has happened and "~" predictions for what's next: "Venda de cartrons" first (D152), then the rounds with "Primer descans" and "Segon descans", then "Fi" (D150). Breaks are "Descans" on every screen (D149);
  - more drawers: adding a card, the menu (the player's cards, sounds, last year's card, "Esborrar dades") and last year's card.
  - The corner buttons use style B, with matching icons, and the drawers use hierarchy J2; the menu drawer is titled with a settings word, not "Menu" (D87). The prizes drawer's design is still to pick (pending U30).
  - **Being built to match the boards (D132)**, the prizes drawer excepted.
- **The card's side (D102):** a normal card has two sides with the same number. Pending U50, the phone shows the side of the current or coming round by itself.
- **Before the Game:** the night's rounds and the card types, round 1's prizes, and adding cards. No how-to-play text. The card types' preview: **Not built yet** (the phone shows the rounds and prizes).
- **Marking:** every landed song is marked on the cards, the latest included. When a card is one song from a Line or the Quina, that song's cell gets a gentle highlight. There's no banner.
- **The Desgraciat:** each card shows "Dempeus" or "Assegut", and a card sits down at the landing that sinks it.
- **Only the current round** shows in "Historial", and only the cards of the round's type count in it (only special cards in the Quina Especial).
- **A confirmed win** only celebrates on a phone that holds the winning card ("La teva línia!"). The Desgraciat's winner phone shows no title: the glowing card, the nino and the confetti say it.
- **Behaviour:** interface sounds only, on by default (Admin sets the default for everyone, and a player's own choice wins); the screen stays awake; vibration is only a bonus, because iPhones have none; it reconnects by itself, and offline it keeps its normal screens, visibly marked as offline.
- **It never shows:** "you won" or any win announcement; the next song or the Queue, before a landing (its drum shows only songs still to come, blurred while it turns, in an order unrelated to the Queue; the agreed boards, canvas v61 onwards); earlier rounds' songs; a prize before its round's intro; other players' cards or the standing count.
- **When the landed song is on your card (D74):** a flash turns the background from dark blue to gold, stage spotlights loop on the gold with option A's particles (a shooting-star streak, rising corn and hearts), and no lightning-bolt drawing. Two in a row play it again. It fades out smoothly when the drum starts spinning, and never plays in the Desgraciat (the card falls instead). Its flashes and particles play on top of everything, open drawers included (D90).
- **A Celebration closes the open drawers** (Premis, Horari, Ajustos), but not the add-card pad while a number is being typed (D90).
- **A fallen card** in the Desgraciat shows the sitting nino (D72).
- **The cards** keep the printed 3×4 grid in the current design's style (D77). No card-stacking scroll (D75).

## The grandmother test

_From event.md › The audience, Players' phones._

Many people distrust computers and barely use their phones. The player app must pass this test:
- large, clear and simple, in plain Catalan;
- big tap targets, high contrast, large text, usable with one thumb;
- anything at most 2 taps away;
- sounds that can be muted;
- the screen stays on;
- it reconnects by itself.

## Admin

_From event.md › Prizes and sponsors, The cards; the decisions doc › Admin._

**Who uses it:** the organizers, behind their Google login. A simpler design is fine.

- **Setup** (pending U18, the night's plan):
  - the edition's name and the cards in play, as ranges;
  - the rounds in order, each with its kind (regular, Desgraciada, Especial) and card type. Only one Desgraciat a night, with a single bundle;
  - prize bundles, sponsors (money donors too) and their logos, picked from the private logo library (pending U16);
  - bulk JSON import and export, so an AI agent can load the organizers' spreadsheet. Its private columns are never read;
  - the Schedule, with the throw breaks (after any round but the last, 5 minutes by default; the planned end counts them).
- **On the night:** live edits to upcoming rounds (played rounds stay fixed), the Plan B resume, the winners list, and which card numbers have been opened on phones (anonymous).
- **Player app:** the default for sounds, and a message banner to every phone.
- **Tools:** the hook audition page, a full JSON export, and the Shuffle seeds.
- The card types show read-only: they come from the card generation, with their prices and price rules (`card-types.json`).

## Cheat sheet

_From event.md › Prizes and sponsors (the presenters' cheat sheet); the decisions doc › Console._

**Who uses it:** the presenters, printed and on the tablet (the console's "Premis" tab).

- It lists every prize with its sponsor, round by round, three rounds to an A4 page and never splitting a round. A last section, "Altres patrocinadors: agraïu-los també", lists the sponsors that no prize names, such as money donors.
- The claim rules and the special rounds' rules.
- The presenters' checklist for the night's running order ([show-and-music.md › The night's running order](show-and-music.md#the-nights-running-order)).
- The Wii mapping and the laptop's keys, for Plan B.

## Wii remote

_From event.md › The presenters (Their equipment); the decisions doc › Changes (R2-Q38)._

**Who uses it:** the presenters. It's the intended experience: it's fun, they joke about it, and shaking it to start a Suspense is a show moment of its own.

- It pairs with the show laptop (desktop Chrome only). Its buttons are in [show-and-music.md › The presenters' actions](show-and-music.md#the-presenters-actions).
- Every action rumbles. A deliberate shake pattern starts a Suspense, so dancing doesn't.
- Its plan B is the tablet: the console can do everything the remote does. Its range is in [operations.md › Fallbacks](operations.md#fallbacks).
- The console counts the remote's drops over the last 10 minutes and shows them in the "Comandament" dialog. From 2 drops it warns: come closer to the laptop, or keep the tablet at hand.
- It still has to be tried on real hardware (pending U19).

## Every sponsor appears

_From event.md › Prizes and sponsors (Mention everyone)._

- Every sponsor in the plan appears somewhere on the projector during the night: before the start, in a round's intro, in the Interval's thanks or in the closing credits. Money donors are thanked too, without a prize. The before-the-start and Interval strip shows them a page of 8 at a time, cycling through every plan sponsor; the closing credits roll the whole list.
