# Team

The new Quina musical is built by several Claude sessions working in parallel, each with one focus. Each challenges the others' work where it touches its own. The user sets requirements and reviews; the orchestrator keeps the big picture.

## Roles

| Session | Role | Owns |
|---|---|---|
| `Song mixer POC research ⑂` | **Orchestrator** | Requirements, decisions and their docs (`GLOSSARY.md`, `docs/`), the big picture, coordination between sessions, the user's questions |
| `quina-musical-ed` | **Sound engine** | The audio engine and DJ transitions, effects, Signatures, Suspense, Decoys, the song preparation pipeline, the shared protocol `@quina/protocol` and the Game journal |
| `quina-musical-1e` | **UI/UX and animation** | Every screen: projector scenes, console, Admin, player app, cheat sheet |
| `quina-musical-b2` | **Platform** | The cloud backend (Worker, Durable Object with SQLite, Cloudflare Access, R2 media sync, the public feed for phones), the laptop's sync and offline Plan B, load tests |

## Contracts between roles

- **`@quina/protocol`** (in `experiments/mixer-poc/protocol/`, documented in `docs/protocol.md` there) is the only coupling between engine, screens and cloud. Anyone may propose changes. The sound engine session reviews and merges them, with tests.
- **The Game journal** (`protocol/journal.ts`) is shared by the laptop and the Durable Object. Changes to it are reviewed by both Sound engine and Platform.
- **The public feed for phones** is defined by Platform and UI together. It never carries the Queue, the next song or possible winners.

## Working rules

- **Decisions:** read [`GLOSSARY.md`](../GLOSSARY.md), [`docs/adr/`](adr), [`mixer-design-decisions.md`](mixer-design-decisions.md) and [`show-ui-and-platform-decisions.md`](show-ui-and-platform-decisions.md). Use the glossary's terms in code and docs.
- **Quality:** proofs of concept are a foundation, not a hackathon. TypeScript strict, pure logic separate from I/O, versioned contracts, tests, one config place for tunables.
- **Don't block on the user.** When a question isn't urgent, pick the most reversible sensible default, note it in [`open-questions.md`](open-questions.md), and keep going.
- **Stay in your lane.** Don't edit another role's files. Send a proposal or a message instead.
- **Commits:** commit only your own files, by path (`git commit -m "…" -- <paths>`), because several sessions share one checkout. Never push without the user's approval.
- **Never commit:** copyrighted audio, `cache/`, `reference/`, `data/spotify_features.json`, secrets, or personal data (the repo is public).
- **No external changes without the user:** no deployments, account changes or purchases (Cloudflare included) until the user approves.
