# Game rules

What the game must be, as it stands now: the Game and its rounds, the cards in play, Claims and the Check, winners, and prizes and sponsors.

- Every rule here comes from [event.md](../event.md). Why a rule is the way it is, and what it replaced, is in [decision-log.md](../decision-log.md).
- "(pending U18)" points to [open-questions.md](../open-questions.md); the rule states the default in force meanwhile.
- "**Not built yet.**" marks a rule the handoffs list as still to do.
- Terms follow [GLOSSARY.md](../../GLOSSARY.md). Words in quotes are what people see or say, in Catalan.

## The Game and its edition

_From event.md › The cards, Players' phones; GLOSSARY › Game, Edition._

- An **Edition** is one year's Quina, named by its year ("26"). Cards, their QR links and the data on players' phones belong to an edition.
- The **Game** is every round played on the night. It carries the edition's name, set in Admin (this year "Quina Quina 3").
- A rehearsal is a separate Game in the same edition, so phones keep their cards.
- Each edition starts clean. Last year's cards don't count, and an old card shows that it's from last year.

## The night's rounds

_From event.md › The night, step by step, One round, The special rounds._

- Each edition decides how many rounds it plays and in what order. The night's plan in Admin holds them (pending U18). 2025 played 10 regular rounds, then the Desgraciat, then the Especial: 12 rounds. 2024's 12 rounds felt long.
- Each round plays one card type, chosen in Admin. Only cards of that type are valid in it.
- **The order can change during the night.** Upcoming rounds can be reordered and edited live, for example to move the Desgraciat. Rounds already played stay fixed.
- A round never starts by itself. The presenters start it when they've announced its prizes.
- On screen a round is "Quina 1", "Quina 2"…. The special round is "Quina Especial", with no number, and the Desgraciat is "Quina Desgraciada". Numbering only appears as "Quina 4 de 12".

## A regular round

_From event.md › One round._

- A regular round runs from its first song until a Bingo is confirmed. It plays normal cards.
- Every round plays a shuffle of the whole Pool. It ends long before the Pool runs out.
- **Only landings count.** A song counts for the cards from its Landing. A Tease or a Decoy never counts.
- **The Line:** the first card with a complete row of 4 songs wins the Line prize. There's only one Line per round. The round goes on.
- **The Bingo:** the first full card, with all 12 songs landed, wins the round's main prize. Players shout "Quina!". The round ends.

## The Quina Especial

_From event.md › The special rounds, The cards._

- Only special cards play. Phones show only those cards during it.
- It has a Line and a Bingo, like a regular round.
- Its prizes are the biggest of the night (2025: a TV).
- It's usually the last round. Each edition decides how many it plays (2024 had two).

## The Quina del Desgraciat

_From event.md › The special rounds; the decisions doc › Changes, the Desgraciat round._

- It's played once a night, in reverse. Everyone with a card stands up.
- A card is **fallen** as soon as any of its songs lands, and its player sits down. **The last card standing wins.**
- **A shared win:** if the last players standing all sit on the same song, they share the win. A card that fell with the latest landing passes its Check, so the presenters may accept several such cards for one shared Celebration; a card that fell earlier never passes.
- There's no Line. The round's only prize is its bundle.
- The standing cards are the round's cards in play, so unsold cards inside an entered range count too. The system can't tell which. So it never ends the round itself:
  - auto-advance stops when one card stands;
  - the presenters call the winner by looking at the room.
- The Shuffle makes sure the last two cards in play can't fall on the same song. A shared win can still happen when the real last players hold cards that fall together.
- Its Check shows that none of the card's songs has landed. It stops at the first song that has: the card has fallen.
- It plays special cards by default, as in 2025 (D70); Admin picks the type like any round's.
- It can be moved to any point in the night.
- It's short, lively and full of interaction with the crowd (2025: 21 songs, about 8 minutes).
- Its Celebration has no title, unlike a Line's or a Quina's. The console keeps a label for the presenters only ("Últim cartró dempeus").

## Cards in play

_From event.md › The cards (Knowing which cards are sold); the mixer decisions › Cards in play._

- The **cards in play** are the cards sold, entered in Admin as ranges, normal and special together.
- Sellers take cards in order from stacks of 50, so the sold numbers form ranges.
- The tech updates the ranges during the night. It's reliable but not exact: a range can contain unsold cards.
- Each round counts only the cards in play of its card type.
- One normal card serves every regular round. The corn seeds come off easily between rounds.
- One special card plays both the Desgraciat and the Quina Especial, as in 2025 (D81).

## Claims

_From event.md › Claims and checks._

- **Players must claim.** They shout "Línia!" or "Quina!". Nobody ever tells a player they've won, and no phone does.
- On a claim:
  - the presenters stop new songs ("Parlem"), and the music keeps going quietly underneath;
  - a presenter goes to the player with the microphone, or the player comes forward;
  - they take the card number and open the Check ("Comprovar cartró").
- Several claims at once queue up. Every claimed card is checked before the round moves on.
- In the Desgraciat, a claim takes only the card number: there's no Line or Quina to choose.

## The Check

_From event.md › Claims and checks; the decisions doc › Changes._

- **The Check is public.** The card appears on the projector, and its songs are checked one by one as landed or not. The steps are in [screens.md › Projector](screens.md#projector), and their sound in [show-and-music.md](show-and-music.md#hold-music-and-the-checks-sound).
- A Line Check shows the completed row, or the row with the most landed songs (the top one on a tie). A Bingo Check shows all 12 songs.
- **Validity:**
  - a card number outside the printed cards is invalid;
  - a card of the wrong type for the round is invalid, shown as its own reason;
  - a card not registered as sold only raises a private warning on the console. The presenters ask to see the card.
- **Forged cards:** we assume nobody forges cards. If two cards claim the same win, the fake one is easy to tell apart.
- **The Check's result decides.**
  - In a strange case, the presenters can still reject a card that passed.
  - They can never accept a card that failed.
  - Both outcomes are recorded.
- **A failed Check** gets a funny "fail" moment, then the round goes on.
- **A passed Check** gets a Celebration, and the winner is noted.

## Ties, late claims and going back

_From event.md › Claims and checks (R2-Q12)._

- **The first to claim wins.**
- **Claims on the same landing share the prize.** The winners agree how to split it.
- **No ties among the cards in play:** the Shuffle reshuffles, deterministically from the same seed, until neither the first Line nor the first Bingo would be shared by two cards in play. That's a public rule. A tie can still happen through a card that isn't registered as sold.
- **Late claims (R2-Q12):** a player who completed earlier but claims late still wins if nobody else has claimed. Any other late case is decided by the team on the spot. The console shows when each claimed card became complete ("complete since song 34") to help.
- **An unclaimed win is lost.** Nobody goes looking for winners.
- **Going back:** if a claim comes after more songs have played, the presenters undo those songs ("Enrere") so they don't count. Players lift the corn seeds off. The Queue's order is untouched.

## Winners

_From event.md › Claims and checks, Prizes and sponsors, What must never fail; the 2025 running order._

- A winner is noted by their name, or by a numbered slip handed to them at the win. The presenters can add notes.
  - The console's winner form takes the name or the slip number, and notes.
- Winners collect their prizes later, when they leave or at the end, by showing their card or slip. There's no prize ceremony on stage.
- **Privacy:** winners' names stay in the cloud's Game data. They're never shown on a screen, never published and never in git.
- No winning card number is shown on the projector or phones. Only the winner's own phone celebrates a confirmed win.

## Prizes and bundles

_From event.md › Prizes and sponsors; the 2025 hamper lists._

- Each Line and each Bingo has a **bundle** of prizes. The Desgraciat has a single bundle.
- **A Bingo's bundle** is a hamper ("panera"), one per round (2025: 12 hampers for 12 rounds). A hamper holds about 17–19 items:
  - one headline item: a ham, or an appliance such as a coffee maker, an air fryer, earbuds, a toaster or a griddle, and a TV for the Especial;
  - Christmas staples: chocolate, panettone, turrón, neules, wine, cava, fruit, rice, tomatoes, fuet and a Barrakudes T-shirt;
  - vouchers and products from several sponsors.
- **A Line's bundle** is small (2024: a bottle of white wine, a fuet, neules and a small sponsor prize).
- Screens always show the whole bundle, headline items first, never a single prize.
- Prizes are assigned to rounds about 3–4 days before the night. A sponsor may still bring a prize on the day, so upcoming rounds' bundles can change during the night.

## Sponsors

_From event.md › Prizes and sponsors, Money._

- Each prize has a **Sponsor**: Barrakudes itself or a local business (2024: 34 sponsors; 2025: about 55).
- Sponsors give products, vouchers or money.
- **A money donor** has no prize of its own: the money buys hamper items. It's still thanked by name like every other sponsor.
- **Mention everyone.**
  - Before each round, the presenters read out every prize and its sponsor, money donors included. The cheat sheet lists them.
  - They keep the prizes alive during the round ("a veure qui s'emportarà…").
  - Every sponsor appears somewhere on the projector during the night ([screens.md](screens.md#every-sponsor-appears)).
- Prizes, bundles and sponsors come from the organizers' own spreadsheet, which the orchestrator parses into the night's settings file (D89). Admin's UI is for last-minute edits. Logos come from a private logo library (pending U16).

## Prize secrecy

_From event.md › Prizes and sponsors (The reveal)._

- A round's bundle is revealed at its **intro**, on the projector and phones at once.
- Until then it's locked everywhere. Future rounds show as locked, game-style, and the Interval shows no prizes.
- Before the night, only round 1's bundle is visible.
- The organizers can choose to keep everything secret.
- The cloud enforces it: a locked prize never reaches the public feed.
