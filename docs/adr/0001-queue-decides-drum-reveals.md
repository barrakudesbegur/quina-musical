# The queue decides the songs; the drum only reveals them

Each round's song order is shuffled once at the start (the Shuffle, shown on the projector) and is never changed afterwards, not even by admins. The drum's spin is staged to land on the next song in that queue. It is not a random draw at the moment Next is pressed.

We chose this over drawing at the moment Next is pressed because knowing the next song in advance lets the mixer prepare a real DJ transition: stems, tempo-matched sections and a tease at the incoming song's tempo, all landing exactly when the drum stops. A draw made on the press would leave 5–11 seconds to do that for any of the remaining songs. Fairness comes from the shuffle being secure, public and immutable, not from the drum animation.

## Consequences

- The drum's physics is solved to stop on a chosen card at a chosen time. Anyone reading that code will see the outcome being set, and that is intended.
- Manual reordering and manual song picking from the current app are removed.
- Back (undoing a landing, e.g. after a late Bingo claim) only moves the round's position in the queue back by one. The order itself never changes.
