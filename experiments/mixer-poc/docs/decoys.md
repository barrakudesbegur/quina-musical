# Decoys (experiment, off by default)

A Decoy teases a song that is not next. One beat after the outgoing song's exit downbeat, in the first bars of an S2 bridge, the "wrong record" comes in as the outgoing song's echo or wash fades: a song that already landed this round, low-passed, from its hook. A tape stop cuts it off, and the real build carries on into the song that lands.

**Rules.** The code enforces these, and `tests/decoys.test.ts` checks them:
- It is never the song that lands, nor the one that is leaving. It is always a song that already counted, so marking it again changes nothing.
- It ends, tape stop included, before anything of the landing song is heard, and at least a bar before the landing. The landing is unmistakable.
- It needs an S2 transition (an exit, then a bridge) with the outgoing song playing and a bridge of at least 2 bars.

## Try it

- **On one show page:** open `/show/show.html?decoys=1`. The default chances apply: none early, 12% mid, 18% late, none final.
- **Everywhere:** set `DECOYS.enabled = true` in `engine/src/config.ts`.
- **In a test:** pass `decoys: { enabled: true, chance: { … } }` to `new Show(…)` or to the harness's `setup(…)`.

## Tune it

Everything is in `DECOYS` in `engine/src/config.ts`:

| Setting | What it does |
|---|---|
| `chance` | Per Phase, how often a transition gets a Decoy |
| `minSec`, `maxSec` | How long it plays before the cut |
| `gainDb`, `lpfHz` | How loud it is (on top of its own loudness trim) and how muffled ("the wrong record") |
| `cutSec`, `cutSfx` | The tape stop's length, and the sound on the cut |
| `minBridgeBars` | The shortest bridge it may use |

`chance.final` is 0 on purpose. The final phase mostly plays R10 (the power-down), and a Decoy over its tape stop and heartbeat would muddy the moment. Raise it only after listening.

## Remove it

The experiment touches these places only:
- `engine/src/plan/decoys.ts` (the logic) and `tests/decoys.test.ts`;
- `DECOYS` and `DecoyConfig` in `engine/src/config.ts`;
- the `DecoyEvent` type and its place in the `PlanEvent` union (`plan/recipes.ts`), and the `'decoy'` case in `eventStart` (`plan/planner.ts`);
- the `decoy` output and its case in `audio/scheduler.ts`;
- `addDecoy` and the `decoys` option in `show/show.ts`;
- `playDecoy` and the `?decoys=1` switch in `main.ts`, plus the `decoys` option in `tests/support/harness.ts`.

Delete those and `npm test` shows anything left over.

## Open questions

- Should a Decoy ever use a song that hasn't landed yet? That would be more surprising, but players could mark it. The default is no: only songs that already counted.
- Should the show page say so, for example a "nope" on screen at the cut? That belongs to the UI. The engine's plan carries the Decoy event, so a scene can react to it.
