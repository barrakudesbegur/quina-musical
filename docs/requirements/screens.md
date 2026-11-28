# Screens

What each screen must show, who uses it, and what it must never show: the projector, the console, the player app, Admin, the cheat sheet and the Wii remote.

- Every rule here comes from [event.md](../event.md). Why a rule is the way it is, and what it replaced, is in [decision-log.md](../decision-log.md).
- "(pending U30)" points to [open-questions.md](../open-questions.md); the rule states the default in force meanwhile.
- "**Not built yet.**" marks a rule the handoffs list as still to do.
- Terms follow [GLOSSARY.md](../../GLOSSARY.md). Every animation is specced in [ANIMATIONS.md](../../packages/ui/ANIMATIONS.md), with its trigger, timing, sound and fallback, before it's built.

## Every screen

_From event.md › The audience, Atmosphere and style, Fairness and trust._

- **Everything is in Catalan,** in informal, natural language.
  - A round is "Quina 1"…, the special round "Quina Especial" and the Desgraciat "Quina del Desgraciat", or simply "Desgraciat" where space is short (D251). Numbering only appears as "Quina 4 de 12".
  - A Line is "Línia", a full card "Quina!" ("premi de quina"). Card numbers are written "#123". Times use am/pm.
- **A show, not a meeting:** a festive Christmas look, styled like a mobile game, "juicy" and full of animation. The projector and the player app get the full look; the console and Admin can be simpler. One design system covers all of them.
- **Animations are part of the show.** Each one is planned in [ANIMATIONS.md](../../packages/ui/ANIMATIONS.md) before it's coded. Motion never tells a secret: nothing shows a song before it lands, even when a phone already holds the Spin's target (D277).
- Barrakudes' figures ("ninos") may appear, only family-friendly ones, and only if they fit the style.
- **Londrina is always in capitals** (D96): titles, buttons, names and numbers. Unit symbols beside a number stay lowercase ("9 s", "10:14 pm"), and Nunito text inside a Londrina button keeps its case (D114).
- **Buttons are fully round only when floating** (D189). Every other button is a rounded rectangle.
- **Every press feels good (D215):** each interactive element travels when pressed, with its sound (except in Admin, D208) and, on Android phones, a short vibration. iPhones and iPads have no vibration, so they get the sound and the motion.
- **"On" is animated (D215):** a temporary active state, such as a Hold mode, shows panning stripes. Nothing is on by default, and a locked state is never striped.
- **Placement (D215):** a control in a corner sits at the same distance from both edges. A ring keeps one even gap all round, its 3D edge included. Headings wrap balanced and body text wraps "pretty".
- Images are JPEG XL, with a PNG or JPEG fallback. Never WebP.
- **Browsers (D219):** only the latest Chrome and Safari, on the phones, the tablet and Admin. No fallbacks for older versions. The game works fully with paper, so a phone that can't update loses only the companion.
- **The ending stays secret.** Nothing public shows the next song, the Queue, who might win, or how close the end is.
- The approved look still has to be applied to the projector, the console and Admin (pending U12; not ready yet). The player app already has it.

## Projector

_From event.md › When and where (Projection), The night, step by step, Claims and checks, Fairness and trust; the decisions doc › Projector._

**Who uses it:** the whole audience. It's a 4:3 projector far from the audience, so only big things are readable and there's no small text. It must also work at 16:10 and 16:9, the most common projector formats (D276). A second projector, if one is found, shows the same image from an HDMI splitter (D276). It's silent: the sound comes from the engine on the PA.

| State | What it shows |
|---|---|
| Before the Game | The edition's name; a preview of the night's rounds (regular, the Desgraciat with a sad face, the Especial with a star); each card type with its colour and the rounds it plays (the normal card: Quines 1–10; the special card: the Desgraciat and the Especial, D243); the price of a card for round 1 (D69: 15 €); a large "scan your card" QR on a pure white panel with generous padding (D216); the sponsors; a rough countdown |
| A round's intro | "Quina N" (or "Quina Especial", "Quina del Desgraciat") with its prize bundles and sponsors, revealed now as the presenters announce them |
| The Shuffle | Every cover in a grid, shaken, flying into the drum |
| In play | A big edge-to-edge drum of pending songs; the current song big after each landing; only the last 3 songs in a row under the drum; the round's name; the Heat |
| Hold ("Parlem") | No visible change |
| Pause | "Tornem de seguida" |
| Claim and Check | "CARTRÓ #123" and one label for the card's type and side, "Normal 1–5", "Normal 6–10", "Desgraciat" or "Especial" (D163, D193, D266), first (a wrong type fails here); the card's grid; each song ✓ or ✗ in turn, at the presenters' pace; the result. A Check under review stays on the Check screen with "Revisió manual", no pass or fail (D118, D119, D123) |
| A failed Check | A huge red ✗ with red light beams, and no text. The Desgraciat has no public Check: its finale on stage replaces it (D166) |
| Celebration | "LÍNIA!", "QUINA!" or, in the Desgraciat, "QUINA POTRA!" huge (D186), the prize bundle and sponsors, confetti, ninos and a victory lap of the drum. A Line's Celebration shows no prize panel for now, on the projector or the phones; how a Celebration shows its prize is pending Frontend's proposals (D242) |
| Interval | The next round's name, a rough countdown, "Quina 4 de 12", the price of a card for the coming round, and sponsor thanks |
| After the Game | Thanks and sponsor credits |

- **Card prices:** only the coming round's card price, on that round's Interval screen. The before-the-Game screen counts as round 1's Interval. Before the Quina Especial it's the special card's price. The prices themselves are in [songs-and-cards.md › Prices](songs-and-cards.md#prices). The Interval shows the coming round's card in its colour with its price ("Cartró: 10,50 €"), and nothing until a price is set.
- **The Desgraciat's Celebration** reads "QUINA POTRA!" (D186).
- **It never shows:**
  - the next song, the Queue, the possible winners or the standing cards;
  - a winning card number or a winner's name;
  - a prize before its round's intro, or any prize in the Interval;
  - a QR or URL during play or the Interval;
  - fairness code, how-to-play text or a resume code.
- How many cards still stand in the Desgraciat: the console shows it, the projector doesn't, since the count includes unsold cards (D72).

## Console

_From event.md › The presenters (What they can do, What they see privately, Their equipment); the decisions doc › Changes._

**Who uses it:** the two presenters, on one shared tablet in landscape. The tech opens the same page in portrait on their phone, or on the laptop, to help. Every open console stays in sync, live (D234). While one console holds a two-level button (Parlem → Pausa, Aguanta → Suspens), the others show it locked until it's let go (D234); their Wii remote's press of that button is refused with a short "no" rumble. It has a light theme, simpler and with icons, and keeps its dark theme as the alternative (D2). The layout must be very well thought out: "Següent", Hold and the claim stay in the same places in landscape and portrait (R2-Q21): one cluster in the same order, the right column in landscape and fixed at the bottom in portrait. To be checked against R2-Q21 at the theme pass.

- **Always visible:** the round, the Phase and the real Heat, the clock, the expected end of the round, the Drift and the connections (cloud or hotspot, phones' feed, Wii remote).
- **"Ara sona"** is the playing song, with a ring that counts down to the next auto-advance and shows the state (manual, "Parlem", "Aguanta"…).
- **"Següent"** is the next song, private, with a countdown to its landing so the presenters can name it on the hit.
- **The buttons:** every action in [show-and-music.md › The presenters' actions](show-and-music.md#the-presenters-actions). "Enrere" takes a quarter to a third of the bottom row, and "Comprovar cartró" the rest. Each control a Wii button triggers shows a small badge with that button.
- **Tabs:**
  - Their order (D187): "Estat", "Cerca", "Futur", "Premis", "Efectes";
  - **"Cerca", the lookup (D162, D170, D187):** one tab with a "Cançons / Cartró" switch; a private quick check at any time in a round: a fuzzy song search (title or artist, typos accepted, matches highlighted), and a card check whose "show future" also tells whether the card can still win;
  - **"Estat", the game's state (D170, D173):** always visible. On the left, how many cards have each number of songs missing; on the right, the round's song history, scrolling;
  - "Futur" (D170): hidden until someone taps "Mirar el futur". The possible winners and the songs to the first possible Line and Quina on the left; the upcoming songs on the right, each with how far ahead it is and how many more songs until any card can win;
  - "Premis": the round's prize lines and sponsors, ready to read out;
  - "Efectes": the sound pad, as icons;
  - in the Desgraciat, "Dempeus" comes first: the count of standing cards, each standing card's number from 60 down, and "Comprovar #57" as the default action when one card stands. Once "Començar final" starts the finale, the finalists' view lives in this tab (D187): the ninos, with "Al revés"; "+ Finalista"; and "Editar", whose label stays while on, with "+ Afegir" in the panel's header and an × only on standing finalists (D183). The remote's A stays "Següent", so the finale opens from the tablet only. "Enrere" grows at most from 84 to 100 px (D184).
- **During a Check (D107–D110, D117):** the card as its 3×4 grid, already marked privately, with any warnings ("not registered as sold"); the next song's title large, to read out; one big button that reveals the next song (the remote's A; held, or with the tablet's toggle, they come in a row); the presenters' cue for the fanfare; a smaller "Revisió manual" button that sends the Check to review with no pass or fail (the claim shows "En revisió"); then the review's four choices: continue, win by hand, lose by hand, discard (D121), with a warning when a choice goes against the card; "+ Candidat" (D179). The list of claimed cards only shows when there are 2 or more. There's no "Confirmar".
  - Then a Celebration music override, the winner's name and notes.
  - A numbered slip's number on the winner form, optional, next to the name.
- **During the Interval:** the next round and its prizes to announce, the guide countdown ("Compte enrere orientatiu"), the music's skip and volume, and "Comença la quina". In the Descans the presenters pick its music: the break set or the Pausa set (D228).
- **In-game admin (D234):** what the night needs from Admin is also on the console, starting with adding sold cards to the cards in play (the rest pending U202).
- **The sound test (D229):** a mode for setting up the PA on the day, before the night starts. It plays each kind of sound in turn at its slider's level, so every volume can be adjusted. A step whose automatic sound is off still plays in the test and says «apagat a Sons automàtics»; «Victòria» and «Fallada» include their fanfares.
- **Automatic sounds, one by one (D237):** a section to switch each automatic sound (the drum's click and the others) on or off.
- **At the doors and in a break (D195):** "Comença la quina" is the main action, in the right column's big slot. "Llançament", when available, is a slimmer button. "Enrere" and "Comprovar" aren't shown, since they can't act there, and neither are they on the end screen (D199). The end screen has "Tempesta" and no "Llançament" (D194). Whether the doors' big button starts the night is pending U173.
- **The layout (D196):** the playback ("Ara sona") is always at the top of the left column, on every console screen. The right column holds only action buttons. Where a pad or tab covers the left column (the claim pad, the finalists' pad, Cerca), and on the Check screens, a compact "Ara sona" line stays at its top (D199).
- **The menu:** start and end the night, the Schedule, Panic, the resume code, and "Comandament", a drawing of the Wii remote's buttons that opens by itself when a remote connects.
- **On the laptop:** the tech must be able to drive the whole show from the laptop alone: the console on the laptop's own screen, the show page on the projector as a separate display (never mirrored, since the console shows the next song), and a USB presenter clicker (→ or PageDown) running the console's default action. Set up as in the night runbook's "Without the tablet".
- **It never reaches** the projector or phones: the next song, Futur, the song lookup, the standing cards (except the Desgraciat's finalists on stage, D161) and the resume code stay on the console.
- **The claim pad** closes with "Torna a la quina", its larger button (D164).
- **Interface sounds (D208):** on by default, with a switch in the settings. The sound check confirms the presenters' microphones don't pick them up. The show laptop stays silent.
- Both iPad and Android tablets must work (pending U19, the check on real devices).

## Player app

_From event.md › Players' phones; the decisions doc › Changes._

**Who uses it:** players who want to, on their own phones. The game works fully with paper and corn; phones are a companion.

- **On a desktop or a tablet** it looks decent: the phone layout with a maximum width, so the screen doesn't stretch. It isn't a separate responsive design (D212).
- **It's an installable web app (PWA, D221).** The service worker always goes to the network first and updates itself aggressively, so nobody keeps an old version (D222). Its icons are a maskable app icon and a monochrome badge for Android's status bar, from the afro nino's head and hand: simple and funny (D223).
  - **Install:** where the cards list shows its add-card button when a player has none, an install button can take that place once they have cards, only when the browser can install the app (placement pending U193). Ajustos also offers the install, or says it's already installed. On iPhones there's no install button on the home, only in Ajustos, with a drawer explaining how to add it to the home screen, unless iOS offers a one-tap install (research, 27 Nov).
  - **The QR opens the right flow for each platform directly,** grandma-proof (D224; research, 27 Nov).
- **A reload never flashes the welcome (D225):** the tab keeps its last public state for up to 5 minutes and reopens on it. With none, it shows an empty sky. The first paint has no fades, and a phone with no feed at all says «Sense connexió» after 20 s.
- **A card without a name** shows only its number, never a made-up name. A card that doesn't play this round is tilted without covering its label or leaving its place (D225).
- **It feels like an app (D220):** no tap highlight, no pull-to-refresh (on every app, so the console can't reload from a stray swipe mid-show), no text selection outside text fields, and full-screen layers sized to the large viewport so no strip shows while the URL bar hides.
- **The home (D220):** Historial and Cartrons switch by a tap or a horizontal swipe, one axis at a time, with the coloured indicator following the finger, each tab keeping its scroll, and always animated. Scrolling down collapses the drum into its compact look, stuck to the top on both tabs. Historial's rows shrink and fade slightly at the bottom edge, behind the corner buttons. While idle, the drum can be tugged sideways: very stiff, springing back on release, and never while it spins.
- **Drawers (D220):** one can be dragged closed from any point once its content is scrolled to the top. The QR scanner opens as its own stacked drawer. Editing a card is titled «Editar», with the number as the usual field and its QR button, and a green «Desar».

- **Getting in:** players scan the QR on their card, straight in the browser. There's nothing to install and no account.
  - They add more cards by scanning, or by typing the number on the big add-card pad, opened from the "+ Cartró" button (D188). Leaving the pad with a number typed asks first, and each of that question's buttons says what happens ("Descarta els canvis", "Segueix editant").
  - **"Add another?" (D241, replacing D200's banner):** after «Desar», the drawer shows the new card's mark with a ✓, «Cartró #N afegit!», the phone's cards, and «Vols afegir un altre cartró?» with «+ Un altre» (a fresh form) and «Fet» (closes, and rings the new card on the home). Most people play several cards and follow their relatives', and many don't know a phone can hold more than one.
  - The pad's QR button scans the card inside the app, in the drawer, keeping the name and icon already picked (D141).
  - The pad has one save button: full width, square corners, with a tick icon, and always visible on a small screen (D188); no "Desar i afegir-ne un altre" (D95). **Not built yet:** the board's name field, QR button and smart keypad. The icon picker mixes B and C: B's labels and its faded background for a taken icon; C's circular shape, frame and border (D131).
  - They can name each card ("Àvia"). Each card gets its own icon and colour, always corn first, then nine more (among them a heart, grapes, a top hat and the Tió). Removing a card asks first.
  - Cards are kept on the phone for the whole edition. Last year's links show "Aquest cartró és de l'any passat".
- **Layout (D73):** one home screen, two corner buttons and stacked drawers. The tabs are gone, with no fallback layout kept in the code (built in 71caa9c).
  - the home screen: the drum on top, then the current round's songs ("Historial", including the one playing now) and the player's cards as grids;
  - the Premis corner button opens the current round's bundle and sponsors, with future rounds locked. The drawer (D244): the round selector from board P1 and the content from P2; a locked round shows «Premis sorpresa» with its sponsors under it; bigger sponsor cards; it scrolls;
  - the sponsors show as big logos in a scrolling list, and a tap opens a logo larger in a dialog (D216);
  - the Horari corner button opens the schedule, with real times for what has happened and "~" predictions for what's next: "Venda de cartrons" first (D152), then the rounds with the night's one "Descans" among them, then "Fi" (D150, D192; a "Comencem" row and "+ llançament", pending U168). Breaks are "Descans" on every screen (D149);
  - more drawers: adding a card, the menu (the player's cards, sounds, last year's card, "Esborrar dades") and last year's card.
  - The corner buttons use style B, with matching icons, and the drawers use hierarchy J2; the menu drawer is titled with a settings word, not "Menu" (D87). The prizes drawer (D244, answering U30): the round selector ‹ round › at its top, each round's bundles under it, and a locked round's «Premis sorpresa» with the night's sponsors as big tiles.
  - **Being built to match the boards (D132)**; the prizes drawer to `Mobil-Premis-D244`.
- **The card's side (D102):** a normal card has two sides with the same number. Pending U50, the phone shows the side of the current or coming round by itself.
- **Before the Game:** the night's rounds and the card types, round 1's prizes, and adding cards. No how-to-play text. The card types' preview: **Not built yet** (the phone shows the rounds and prizes).
- **Marking:** every landed song is marked on the cards, the latest included. The song that's playing has the design system's running ring, its cover undimmed. There's no near-win marking (D237; its sounds pending U208), and no banner.
- **The drum matches the projector's** (D237): the same covers in the same order, the same spin and blur, and the same landing (3a0d00bf). How it lands before the song is public is U206.
- **The Desgraciat:** each card shows "Dempeus" or "Assegut", and a card sits down at the landing that sinks it.
- **Only the current round** shows in "Historial", and only the cards of the round's type count in it (only special cards in the Quina Especial).
- **A confirmed win** only celebrates on a phone that holds the winning card ("La teva línia!"). The Desgraciat's winner phone says "Quina potra!", like the projector, with the glowing card, the nino and the confetti (D190).
- **Behaviour:** interface sounds only, on by default (Admin sets the default for everyone, and a player's own choice wins). One «Sons» switch covers the touch sounds and the game sounds. Touch sounds are recorded clicks, wobbly and bouncy, and a tap on something that can't be used gives a dull thud with a small "no" motion (D206–D208); the screen stays awake while a game is live (from the round's start to the end, the Interval included; never before or after the night, never in the background); vibration is only a bonus, because iPhones have none; it reconnects by itself, and offline it keeps its normal screens, visibly marked as offline.
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

**Who uses it:** the organizers, behind their Google login. A simpler design is fine. It has no interface sounds (D208).

- **Setup** (pending U18, the night's plan):
  - the edition's name and the cards in play, as ranges;
  - the rounds in order, each with its kind (regular, Desgraciat, Especial) and card type. Only one Desgraciat a night, with a single bundle;
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
- **The two-level lock covers the remote too (D234):** while another console holds Parlem → Pausa or Aguanta → Suspens, the remote's press of that button (− or +, B, and A while a refused B is down) sends nothing and rumbles "no": three quick buzzes, 220 ms in all (4e9dfa9d). The other two-level button works as usual. The engine enforces it (f8492f38): the first hold wins, and the other console's Parlem, Pausa, Aguanta or Suspens is refused with no toast. On the remote it's the same "no" rumble, and the rest of that press is dropped. Through the cloud, each console is its own sender (ed631847) once Backend deploys.
- Its plan B is the tablet: the console can do everything the remote does. Its range is in [operations.md › Fallbacks](operations.md#fallbacks).
- The console counts the remote's drops over the last 10 minutes and shows them in the "Comandament" dialog. From 2 drops it warns: come closer to the laptop, or keep the tablet at hand.
- It still has to be tried on real hardware (pending U19).

## Every sponsor appears

_From event.md › Prizes and sponsors (Mention everyone)._

- Every sponsor in the plan appears somewhere on the projector during the night: before the start, in a round's intro, in the Interval's thanks or in the closing credits. Money donors are thanked too, without a prize. Before the start and in the Interval, a strip of much bigger logos pans slowly so all of them show, starting at a random point so it isn't always the same ones first (D216). The closing credits roll the whole list.
