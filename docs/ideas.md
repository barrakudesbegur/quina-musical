# Ideas for later

Ideas the user wants kept but hasn't decided on. None is planned or built. Each needs the user's go, and often the organizers' or the presenters', before it becomes a requirement.

## The presenters' notebook on the tablet

_The user, 27 Nov 2026. First the user asks the presenters whether they want it at all (U191). "It is very likely they still preffer paper."_

**Where it starts:** the presenters prepare their own notes, a document (a .docx or similar) that marks who says what, one colour per presenter.

**The idea:**
- **Import:** they send us that file, and we parse it into Markdown shown with our own components.
- **Tabs, like a notebook:** their document's pages become tabs, for example the intro, the prizes, the notes for the rounds (one document with a title per Quina and its notes under it) and the closing.
- **On the tablet:**
  - it opens as a dialog over one half of the console screen, styled as a notebook with a spiral and bookmarks for the tabs;
  - it reads like a teleprompter;
  - it can be dragged, with inertia and physics, between the left half and the right half. It always snaps to one of the two halves and never stops in between;
  - the controls under the other half stay usable, and the notebook moves out of the way easily.
- **Its button:** an open/close notebook button where the status badges are today. The user thinks the badges aren't important.

**Things to check when it's developed** (the orchestrator's notes):
- **The status badges hold the connections** (cloud or hotspot, the phones' feed, the Wii remote), and the console warns after the remote's drops. Those need to stay visible somewhere.
- **Each half has a job (D196):** the playback is at the top of the left column, and the right column holds the action buttons. Covering the left half hides "Ara sona" and "Següent"'s countdown, which the presenters need to name songs on the hit. Covering the right half hides the actions, which the remote mostly covers.
- **The cheat sheet's "Premis" tab** already shows the prizes and sponsors to read out. The notebook's prizes tab could be that same content.
- **Colours:** the "who says what" colours must stay readable against the notebook's paper look.

## Ordering from the tables to the bar

_The organizers' request, through the user, 27 Nov 2026. The user thinks it's worth it, but it's not for now: "i wont implement yet, just keep it written down". The plan: discuss the details, make the design, discuss the implementation, then write an implementation doc and plan to hand to a session. It needs extensive research on this kind of software first, "to make a solution that is well done and adapted to our needs, and not bloated". The user is open to more ideas._

**The idea:**
- **Remote orders:** players order drinks, snacks and cards from their phone. The items and prices are in the organizers' files (temp/info-from-2025/prices.md and preus-cartrons.md; event.md › Money).
- **The bar's side:** the bar gets the orders on a tablet, a laptop or their phones.
- **The tables:** 3D-printed holders on the tables hold the corn seeds and show the table's number, with a QR that opens the app with that table as a parameter.
- **Paying:**
  - from the phone with Stripe (the user has an account): Google Pay, Apple Pay or similar;
  - or when the waiter brings the order, by card or cash;
  - or the player marks that they'll pick it up.
- **A reference per order,** from 1 to 99 and then starting again, so the numbers stay small and the waiters know whose it is.
- **The phone's corner buttons** become two: one for managing your orders, and one for the game's info, with the prizes and the schedule inside.
- **Why it seems easy:** the realtime feed and the login are already set up.

**Before it's developed:**
- the research on table-ordering software;
- the details with the organizers;
- the design, then an implementation doc and a plan for a session.

