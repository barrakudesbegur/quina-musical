# Docs map

What each document is for, and which one is the source of truth. The orchestrator keeps the docs in this folder; sessions keep the handoffs in their own areas.

## Start here

| Read | For | Source of truth for |
|---|---|---|
| [event.md](event.md) | How the event works, with no software: the night, the people, the rules, the money, the venue | The event. Every requirement comes from it |
| [how-the-quina-works.md](how-the-quina-works.md) | A one-page overview of the system, with links into the requirements | Nothing on its own: it summarises |
| [../GLOSSARY.md](../GLOSSARY.md) | The words to use in code, docs and conversation | Terms |

## What the system must do

Requirements say what must be true now. They hold no history: why something was decided, and what it replaced, is in the decision log.

| File | Covers |
|---|---|
| [requirements/game-rules.md](requirements/game-rules.md) | Rounds, cards in play, Claims and the Check, winners, prizes and sponsors |
| [requirements/songs-and-cards.md](requirements/songs-and-cards.md) | The pool, hooks, song preparation and quality, card types, card generation, printing and prices |
| [requirements/show-and-music.md](requirements/show-and-music.md) | The Shuffle and the drum, transitions, Phase and Heat, the presenters' actions, the Interval, the night's running order |
| [requirements/screens.md](requirements/screens.md) | The projector, the console, the player app, Admin, the cheat sheet and the Wii remote |
| [requirements/operations.md](requirements/operations.md) | Where things run, privacy of the public feed, Plan B and fallbacks, the free tier, storage, rehearsals |

## Why it is this way

| File | Holds |
|---|---|
| [ideas.md](ideas.md) | Ideas the user wants kept but hasn't decided on: the presenters' notebook on the tablet, ordering from the tables to the bar |
| [decision-log.md](decision-log.md) | Every decision with an ID (the interviews' Q1–Q38 and P1–P15, then D1, D2…), its date, status, what it supersedes, and where it lives now |
| [adr/](adr) | The three big architectural decisions |
| [mixer-design-decisions.md](mixer-design-decisions.md), [show-ui-and-platform-decisions.md](show-ui-and-platform-decisions.md) | The two interviews as first recorded (23 and 24 November). Frozen and partly superseded: read them for context, not for the current rules |

## Where things stand

| File | Holds | Written by |
|---|---|---|
| [HANDOFF.md](HANDOFF.md) | The orchestrator's in-flight work, to resume after a clear | The orchestrator |
| [status.md](status.md) | One screen: each area's state, what's blocked, what waits on the user | The orchestrator, rolled up from each handoff's "Now" block |
| [open-questions.md](open-questions.md) | The only list of what waits on the user (U1, U2…), with the default in force | The orchestrator, from the sessions' requests |
| [timeline.md](timeline.md) | The dates and milestones up to the night | The orchestrator |
| [team.md](team.md) | The roles, the contracts between them, and the working rules | The orchestrator |
| Handoffs: [Sound engine](../apps/show/docs/HANDOFF.md), [Frontend](../packages/ui/HANDOFF.md), [Backend](../apps/cloud/docs/HANDOFF.md) | Each role's "Now" block, done list, queue and how to run | Each session, for its own area |

## On the night

- [night-runbook.md](night-runbook.md): setting up and running the night, and what to do when something fails.

## Elsewhere

- **Engine and protocol:** [apps/show/docs/protocol.md](../apps/show/docs/protocol.md), [apps/show/docs/dj-techniques.md](../apps/show/docs/dj-techniques.md).
- **Screens' motion:** [packages/ui/ANIMATIONS.md](../packages/ui/ANIMATIONS.md). Every animation is specced there before it's built.
- **Cloud:** [apps/cloud/README.md](../apps/cloud/README.md), and [apps/cloud/docs/deploy-plan.md](../apps/cloud/docs/deploy-plan.md) for every change to the Cloudflare account.
- **Research:** [research/](research), the background reports. Superseded wherever the decisions differ.

## Keeping it true

- A decision the user makes with any session is reported to the orchestrator the same day, logged with an ID, and applied to the requirements.
- When a requirement changes, the decision log says why, and the requirement file says only the new rule.
- event.md changes only with the user.
