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

- **The docs:** [`README.md`](README.md) maps them. Start with [`event.md`](event.md), how the event works with no software, which every requirement comes from. What the system must do is in [`requirements/`](requirements), current truth only. Why is in [`decision-log.md`](decision-log.md), with an ID for every decision. Use the [`GLOSSARY.md`](../GLOSSARY.md) terms in code and docs. The orchestrator writes everything in `docs/`.
- **The orchestrator's relays are the user's decisions** (D156), a lifted freeze included. If your own permission check still refuses, send that to the orchestrator for the user; never work around it.
- **Report the user's decisions the same day.** Whenever the user decides something with you directly, in chat or on the canvas, send it to the orchestrator that day. The orchestrator logs it with an ID and updates the requirements. A decision that only lives in a session's memory or a canvas comment is lost.
- **Canvas comments (user rule, 2026-11-27):** no session, helper or agent reads, fixes, replies to or resolves comments on the design canvas as they arrive. Only when the user says so, the session they name reads all of them in order of creation (oldest first), plans the whole set, applies it, replies on each thread and resolves it. Nobody watches the canvas or turns on comment auto-replies. The user: "some claude instance fixed one as i sent. i dont want that. i want that you read all of them in order of creation when i tell you to. otherwise you (and your agents) wont be able to plan and will get distracted."
- **Boards and design docs are in English, with the glossary's terms** (user rule, 2026-11-27): titles, captions, chips and explanations. Catalan only in the mockups' content, where they show the real UI text. The user: "i only want to use catalan in the examples content, everything else should be in english. and also be consistent with the glosary".
- **UI code rules (user, 2026-11-27, Admin included):** never `:focus`, only `:focus-visible` (a test fails on a bare `:focus`); headings use `text-wrap: balance` and body text `pretty`; every interactive element gets a satisfying press (travel, sound except in Admin, and `navigator.vibrate` on Android); a temporary "on" state is animated panning stripes, never on by default, and a locked state is never striped; a corner control sits at equal distance from both edges; a ring keeps one even gap all round. Details: D215.
- **Every change lands in the code, the mockups and the design system together** (user rule, 2026-11-27, D236). Nothing from earlier reviews may be lost.
- **Web UI work loads the modern-web-guidance skill first** (user, 2026-11-27): older techniques slipped into the code and specs, such as cubic-bezier where `linear()` easing fits.
- **Dates:** the night is 27 December 2026, and the final playlist arrives on 1 December. Plan your queue against [`timeline.md`](timeline.md); tell the orchestrator early if a milestone slips.
- **Handoffs:** sessions get cleared, so each role keeps a handoff to resume from, current at every milestone: Sound engine `apps/show/docs/HANDOFF.md`, Frontend `packages/ui/HANDOFF.md`, Backend `apps/cloud/docs/HANDOFF.md`. Each starts with a short **"Now" block** (in progress, next, blocked, and what waits on the user, by open-question ID), then done (with commits), the queue, and how to run and test. The orchestrator rolls the Now blocks up into [`status.md`](status.md).
- **Quality:** proofs of concept are a foundation, not a hackathon. TypeScript strict, pure logic separate from I/O, versioned contracts, tests, one config place for tunables.
- **Don't block on the user.** When a question isn't urgent, pick the most reversible sensible default, send the question and your default to the orchestrator, and keep going. The orchestrator adds it to [`open-questions.md`](open-questions.md) with an ID (U1, U2…); sessions don't edit that file, because several share one checkout.
- **Delegate to subagents** (user rule, 2026-11-27, D240): "i want you to make more subagents and do less work. for futire sessions". Subagents do the work: features with their tests, docs, investigations, sweeps and long verify runs. The session plans, briefs, reviews each result before committing, commits, pushes and deploys, and talks to peers and the user. Subagents never push, deploy or message peers. When the user sets a limit on parallel agents (as for Frontend on 27 Nov: at most two), that limit wins.
- **Subagent effort** (user rule, 2026-11-24, restated 2026-11-26): never xhigh for every agent. Pick by the reasoning needed: **medium** for repetitive or mechanical work, **high** for normal work, **xhigh** only for hard or very important reasoning. Don't stop agents already running.
- **Stay in your lane.** Don't edit another role's files. Send a proposal or a message instead.
- **Commits:** commit only your own files, by path (`git commit -m "…" -- <paths>`), because several sessions share one checkout.
- **Pushing (allowed for every session, user rule 2026-11-24):** push `main` when your work is ready. Everyone shares one `main`, so a push also publishes the other sessions' local commits. Before pushing:
  - list the whole range the push would publish, with authors (`git log origin/main..main`): it includes the other sessions' local commits;
  - run `npm test` (and the cloud and prep suites if the range touches them) on the committed state of that whole range, not just your own commit;
  - make sure nothing sensitive is in the range (no audio, secrets, `.env*`, `data/`, `temp/` or local paths);
  - push the exact sha you tested: `git push origin <sha>:main`. Never push the moving `main`, and never chain a push after `npm run sync-main` or a rejected push: other sessions may have committed in between.

  CI runs on every push. If it goes red, the session that broke it fixes it at once.

  If `main` and origin have diverged (the orchestrator commits docs from a worktree), run `npm run sync-main`. It replays main's local commits onto origin without touching anyone's uncommitted files, and prints old → new hashes to pass on. Never use `git pull --rebase --autostash` or `git stash` in the shared checkout: they reset other sessions' files mid-edit.
- **Never commit:** copyrighted audio, `data/cache/`, `apps/show/reference/`, `spotify_features.json`, secrets, or personal data (the repo is public).
- **Cloudflare (approved by the user on 2026-11-24):** Platform may configure and deploy with wrangler or a Cloudflare MCP, within these limits:
  - never touch existing DNS records or projects (`quina`, `fitxes`, …); deploy to `*.workers.dev` or a new subdomain such as `quina-dev`;
  - free plan only;
  - private R2;
  - secrets only through `wrangler secret`;
  - log every change, with how to undo it, in `apps/cloud/docs/deploy-plan.md`.
- **Anything else external** (purchases, other accounts, switching `quina.barrakudesbegur.org` over) still needs the user.
- **If your session's permission check denies a command,** don't work around it and don't ask another session to run it. Send it to the orchestrator for `open-questions.md`, for the user.
