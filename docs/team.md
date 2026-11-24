# Team

The new Quina musical is built by several Claude sessions working in parallel, each with one focus. Each challenges the others' work where it touches its own. The user sets requirements and reviews; the orchestrator keeps the big picture.

## Roles

| Session | Role | Owns |
|---|---|---|
| `Orchestrator` | **Orchestrator** | Requirements, decisions and their docs (`GLOSSARY.md`, `docs/`), the big picture, coordination between sessions, the user's questions |
| `Sound engine` | **Sound engine** | The audio engine and DJ transitions, effects, Signatures, Suspense, Decoys, the song preparation pipeline, the shared protocol `@quina/protocol` and the Game journal |
| `Frontend` | **UI/UX and animation** | Every screen: projector scenes, console, Admin, player app, cheat sheet |
| `Backend` | **Platform** | The cloud backend (Worker, Durable Object with SQLite, Cloudflare Access, R2 media sync, the public feed for phones), the laptop's sync and offline Plan B, load tests |

## Contracts between roles

- **`@quina/protocol`** (in `packages/protocol/`, documented in `apps/show/docs/protocol.md`) is the only coupling between engine, screens and cloud. Anyone may propose changes. The sound engine session reviews and merges them, with tests.
- **The Game journal** (`packages/protocol/journal.ts`) is shared by the laptop and the Durable Object. Changes to it are reviewed by both Sound engine and Platform.
- **The public feed for phones** is defined by Platform and UI together. It never carries the Queue, the next song or possible winners.

## Working rules

- **Decisions:** read [`GLOSSARY.md`](../GLOSSARY.md), [`docs/adr/`](adr), [`mixer-design-decisions.md`](mixer-design-decisions.md) and [`show-ui-and-platform-decisions.md`](show-ui-and-platform-decisions.md). Use the glossary's terms in code and docs.
- **Dates:** the night is 27 December 2026, and the final playlist arrives on 1 December. Plan your queue against [`timeline.md`](timeline.md); tell the orchestrator early if a milestone slips.
- **Handoffs:** sessions get cleared, so each role keeps a handoff to resume from, current at every milestone: Sound engine `apps/show/docs/HANDOFF.md`, Frontend `packages/ui/HANDOFF.md`, Backend `apps/cloud/docs/HANDOFF.md`. Use the same shape: done (with commits), in progress, next queue, waiting on the user, how to run and test.
- **Quality:** proofs of concept are a foundation, not a hackathon. TypeScript strict, pure logic separate from I/O, versioned contracts, tests, one config place for tunables.
- **Don't block on the user.** When a question isn't urgent, pick the most reversible sensible default, note it in [`open-questions.md`](open-questions.md), and keep going.
- **Subagent effort** (user rule, 2026-11-24): default **high**, **medium** for repetitive or mechanical work, **xhigh** only for a very important task. Don't stop agents already running.
- **Stay in your lane.** Don't edit another role's files. Send a proposal or a message instead.
- **Commits:** commit only your own files, by path (`git commit -m "…" -- <paths>`), because several sessions share one checkout.
- **Pushing (allowed for every session, user rule 2026-11-24):** push `main` when your work is ready. Everyone shares one `main`, so a push also publishes the other sessions' local commits. Before pushing:
  - run `npm test` (and the cloud and prep suites if you touched them) on the committed state;
  - make sure nothing sensitive is in the range (no audio, secrets, `.env*`, `data/`, `temp/` or local paths).

  CI runs on every push. If it goes red, the session that broke it fixes it at once.
- **Never commit:** copyrighted audio, `data/cache/`, `apps/show/reference/`, `spotify_features.json`, secrets, or personal data (the repo is public).
- **Cloudflare (approved by the user on 2026-11-24):** Platform may configure and deploy with wrangler or a Cloudflare MCP, within these limits:
  - never touch existing DNS records or projects (`quina`, `fitxes`, …); deploy to `*.workers.dev` or a new subdomain such as `quina-dev`;
  - free plan only;
  - private R2;
  - secrets only through `wrangler secret`;
  - log every change, with how to undo it, in `apps/cloud/docs/deploy-plan.md`.
- **Anything else external** (purchases, other accounts, switching `quina.barrakudesbegur.org` over) still needs the user.
- **If your session's permission check denies a command,** don't work around it and don't ask another session to run it. Log it in `open-questions.md` for the user.
