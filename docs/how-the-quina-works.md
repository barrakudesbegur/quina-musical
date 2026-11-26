# How the Quina works

A one-page map of the Quina Musical and its system, for anyone new to the project: an organizer, or a fresh Claude session. It summarises; the rules themselves are in the requirements files linked at the end. For the event without any software, read [event.md](event.md): every requirement comes from it. Terms follow [GLOSSARY.md](../GLOSSARY.md), and words in quotes are what people see on screen, in Catalan.

## What the Quina is

The Quina Musical is a live music bingo that Barrakudes runs once a year in a pop-up tent in Begur. This year's night is **Sunday 27 December 2026**.

- Players hold printed **Cards** of 12 songs in 3 lines of 4, and cover a song with a corn seed when it lands.
- The first complete line wins the **Line**; the first full card wins the round's **Bingo**, and players shout "Quina!".
- A projector shows a **Drum** of album covers that stops on each song as its **Hook** hits. The music comes from the show laptop through the PA, mixed like a real DJ set.
- Two presenters run the show with a Wii remote and a shared tablet (the **console**). The **tech** sits by the laptop to run it and help them.
- Players can follow their cards on their phones (the **player app**), with no account and nothing to install.

The goal is a great night, not only great mixing. When the presenters do nothing, the show keeps going by itself, and every automatic behaviour can be overridden live. The game is fair because each round's order is shuffled once, in public, and never changes.

## A night in ten steps

1. **Set-up.** In the afternoon, everyone sets up the tent, the PA, the projector, the laptop and the tablet by the [night runbook](night-runbook.md), runs the preflight, and checks the sound.
2. **Doors and card sales** (from 17:00). Interval music plays and the bar opens. The projector shows the night's rounds, the card types, a "scan your card" QR and the sponsors. Players add their cards on their phones.
3. **The welcome.** The presenters explain the game out loud: there's no how-to-play text anywhere.
4. **A round's intro.** The presenters press "Comença la quina". The projector and phones reveal the round's prize bundles, and the presenters read out every prize and its sponsor.
5. **The Shuffle.** "Barreja" decides the round's **Queue** once and in public: every cover flies from a grid into the drum. The organizers note the round's resume code.
6. **The songs land.** The drum spins and stops on each song exactly as its Hook hits. That **Landing** is when the song counts. Transitions are produced DJ moves, light early and bigger as a win gets close. The songs advance by themselves at a **Pace**, and the presenters can talk ("Parlem"), hold a song ("Aguanta"), build a Suspense, go back ("Enrere") or advance by hand.
7. **Claims and the Check.** A player shouts "Línia!" or "Quina!". The presenters type the card number, and the projector checks the card song by song, in public. The Check's result decides.
8. **The Celebration and the Interval.** A passed Check gets a Celebration; the winner is noted by name or a numbered slip and collects the prize later. After a Line the round plays on; after a Bingo comes the Interval, with relaxed music, and sometimes a throw break ("parón") of about 5 minutes.
9. **The special rounds.** Once a night the **Quina del Desgraciat** is played in reverse: everyone stands, a card sits down when one of its songs lands, and the last card standing wins. The **Quina Especial**, usually last, plays only special cards for the biggest prizes.
10. **The close** (about 22:00). The presenters explain how to collect prizes, give a short speech and thank the sponsors. A DJ set follows, then everyone takes down.

**If something fails,** the show goes on: the laptop runs alone without the internet, a spare laptop resumes from the cloud, and if the presenters reject the tablet, the tech drives the show from the laptop.

## Where to read more

| Read | For |
|---|---|
| [event.md](event.md) | The event itself, with no software: the root of every requirement |
| [requirements/game-rules.md](requirements/game-rules.md) | Rounds, cards in play, Claims and the Check, ties, winners, prizes and sponsors |
| [requirements/songs-and-cards.md](requirements/songs-and-cards.md) | The Pool and its size, Hooks, song preparation and quality, card types, printing, prices and the QR |
| [requirements/show-and-music.md](requirements/show-and-music.md) | The Shuffle and the drum, transitions, Phase and Heat, the presenters' actions, the Interval, the night's running order |
| [requirements/screens.md](requirements/screens.md) | The projector, the console, the player app, Admin, the cheat sheet and the Wii remote |
| [requirements/operations.md](requirements/operations.md) | Where things run, the public feed's privacy, Plan B and fallbacks, the free tier, storage, rehearsals |
| [GLOSSARY.md](../GLOSSARY.md) | The words to use |
| [decision-log.md](decision-log.md) | Why each rule is the way it is, and what it replaced |
| [status.md](status.md) | Where each area stands |
| [open-questions.md](open-questions.md) | What waits on the user (U1, U2…), with the default in force |
| [adr/](adr) | The three architectural decisions: [the Queue decides](adr/0001-queue-decides-drum-reveals.md), [audio and drum may split](adr/0002-audio-and-drum-may-run-on-different-devices.md), [the cloud owns the Game](adr/0003-cloud-owns-the-game-laptop-owns-playback.md) |
| [timeline.md](timeline.md), [night-runbook.md](night-runbook.md) | The dates, and the steps on the night |
