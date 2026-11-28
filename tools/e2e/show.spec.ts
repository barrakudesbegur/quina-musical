// One whole show, headless: the relay, the show page (with its stage), the console and a player on the relay, plus
// the phones' production path (the cloud link, the Worker in wrangler dev, a phone on /feed and the player app as
// the cloud serves it), driven through the protocol like the presenters' tablet. Each step waits for the engine's
// state, then checks every screen through its stable hooks (data-scene, data-testid; agreed with the UI session)
// and what the phones follow; at the end, that the phones never got anything private:
//   before → round 1 introduced → Shuffle → three landings → Parlem → Aguanta → Suspense → a claim put under
//   review and discarded → a Line claimed, checked press by press and celebrated → back to the round → a Bingo
//   claimed for two cards, checked with automatic reveal (the first passes, the second fails), celebrated → the
//   Interval → round 2 introduced → Shuffle → its first landing.
// The claims are real wins: the Check decides (a card that fails it can't be accepted), so the show runs a fixed
// Queue (?queue=) that completes a Line of the first card, then all of the second card. The Check is the
// presenter-paced one (D107–D124): each press reveals a song, then the cue.
// It needs the default repertoire prepared on this machine; without it the test is skipped.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { PublicMessage, ShowState } from '@quina/protocol';
import { PLAN, SECRET_PRIZE } from '../../apps/cloud/test/support/plan.ts';
import { Phone, startCloud, type Cloud } from './support/cloud.ts';
import { REPO, hasPreparedRepertoire, startRelay, type Relay } from './support/relay.ts';
import { Remote } from './support/remote.ts';

/** The player follows these cards (the first two are the ones claimed). */
const CARDS = [12, 34];

type PrintedLines = { id: number }[][];
/** The default repertoire's printed cards (apps/cards): one side's songs line by line, the side the rounds play (D178). */
function printedCard(id: number, side = 1): number[][] {
  if (!hasPreparedRepertoire()) return [[]];
  const cards = JSON.parse(fs.readFileSync(path.join(REPO, 'apps/cards/dist/cards.json'), 'utf8')) as { id: number; sides?: { side: number; lines: PrintedLines }[]; lines?: PrintedLines }[];
  const card = cards.find((c) => c.id === id);
  // A card from before sides has its side 1 as `lines`, as the engine reads it (cardFace).
  const lines = card?.sides?.length ? card.sides.find((s) => s.side === side)?.lines : side === 1 ? card?.lines : undefined;
  if (!lines) throw new Error(`card ${id} has no side ${side} in cards.json`);
  return lines.map((line) => line.map((song) => song.id));
}
/** The first card's first Line, the second card's twelve songs (its Bingo), then the rest of a few other cards. */
const LINE_SONGS = printedCard(CARDS[0] as number)[0] as number[];
const BINGO_SONGS = printedCard(CARDS[1] as number).flat();
const QUEUE = [...new Set([...LINE_SONGS, ...BINGO_SONGS, ...[1, 2, 3, 4, 5].flatMap((id) => printedCard(id).flat())])];
const LANDING_MS = 90_000;
/** The screens' checks: soft, so one run lists them all. */
const soft = expect.configure({ soft: true });

test.skip(!hasPreparedRepertoire(), 'the default repertoire is not prepared here (npm run prep in apps/show)');

let relay: Relay;
let remote: Remote;
let cloud: Cloud;
let phone: Phone;
/** What the screens logged as errors and warnings. */
const logs: string[] = [];

test.beforeAll(async () => {
  relay = await startRelay();
  remote = await Remote.connect(relay.ws);
  cloud = await startCloud(relay.ws, relay.linkDir);
  // Admin's plan in the cloud: round 2's prizes stay secret until its intro (perRound). Both rounds are normal,
  // like the show this test plays (cards 1-300 in play).
  const plan = { ...PLAN, rounds: PLAN.rounds.map((r) => ({ ...r, kind: 'normal' as const, cardType: 'normal' })) };
  const saved = await fetch(`${cloud.server.http}/api/plan`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan) });
  if (!saved.ok) throw new Error(`the cloud refused the test plan: ${saved.status} ${await saved.text()}`);
  phone = new Phone(`${cloud.server.ws}/feed?cards=${CARDS.join(',')}`);
});

// On failure: the screens' logs and the protocol's last events, attached to the report.
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach('screens-console.txt', { body: logs.join('\n') || '(nothing)', contentType: 'text/plain' });
  const tail = remote.events.slice(-80).map((e) => JSON.stringify(e).slice(0, 400));
  await testInfo.attach('last-events.txt', { body: tail.join('\n'), contentType: 'text/plain' });
});

test.afterAll(async () => {
  phone?.close();
  remote?.close();
  await cloud?.stop();
  await relay?.stop();
});

/** Each screen's scene, as its root says it. */
async function sceneOf(page: Page, root: string): Promise<string | null> {
  return page.locator(root).first().getAttribute('data-scene');
}

// The screens' checks are soft: one run lists every screen that didn't follow, while the protocol's (the engine's
// state and events) stop the test at once.
async function expectScenes(screens: { show: Page; console: Page; player: Page; phonePage: Page }, scene: string): Promise<void> {
  await soft.poll(() => sceneOf(screens.console, '.console'), { message: `console in ${scene}` }).toBe(scene);
  await soft.poll(() => sceneOf(screens.player, '[data-scene]'), { message: `player in ${scene}` }).toBe(scene);
  await soft(screens.show.locator(`#stage [data-scene="${scene}"]`).first(), `stage in ${scene}`).toBeVisible();
  // The phones' production path: the public feed through the link and the cloud, and the player as served there.
  await soft.poll(() => phone.view?.state.scene, { message: `phone (feed) in ${scene}` }).toBe(scene);
  await soft.poll(() => sceneOf(screens.phonePage, '[data-scene]'), { message: `phone (player on the cloud) in ${scene}` }).toBe(scene);
}

/** Every song landed so far in round 1 (the claims wait for their card's songs). */
const landed = new Set<number>();

/** Ask for the next song and wait until it has landed and plays. */
async function land(previous: number | null): Promise<ShowState> {
  await remote.command('next');
  const state = await remote.until('a landing', (s) => s.status === 'playing' && s.current !== null && s.current.songId !== previous && s.transition === null, LANDING_MS);
  if (state.current) landed.add(state.current.songId);
  return state;
}

test('one whole show, every screen following', async ({ browser }) => {
  const context = await browser.newContext();
  const show = await context.newPage();
  const consolePage = await context.newPage();
  const player = await (await browser.newContext()).newPage(); // its own storage, like a phone
  const phonePage = await (await browser.newContext()).newPage(); // a phone on the cloud, as the player app runs there
  const errors: string[] = [];
  for (const [name, page] of [['show', show], ['console', consolePage], ['player', player], ['phone', phonePage]] as const) {
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`${name} ${m.type()}: ${m.text()}`);
    });
  }

  // ---- the show page starts, the screens connect --------------------------------------------------------
  // Silent (mute), fresh (no local journal), no auto-advance, the shortest Pace (Spins of about 4 s).
  await show.goto(`${relay.url}/show/show.html?fresh=1&auto=0&mute=1&pace=8&queue=${QUEUE.join(',')}`);
  await show.locator('#start-button').click();
  await remote.until('the show unlocked', (s) => s.status !== 'locked');
  await remote.command('setCardsInPlay', { ranges: '1-300' });
  await consolePage.goto(`${relay.url}/console/`);
  await player.goto(`${relay.url}/player/?feed=relay#/26/${CARDS[0]}`);
  await phonePage.goto(`${cloud.server.http}/#/26/${CARDS[0]}`);
  const screens = { show, console: consolePage, player, phonePage };
  await expectScenes(screens, 'before');

  // ---- round 1: introduced, then the Shuffle -------------------------------------------------------------
  await remote.command('roundIntro', { number: 1 });
  await remote.until('round 1 introduced', (s) => s.scene === 'roundStart' && s.intro !== null);
  await expectScenes(screens, 'roundStart');
  // Round 1 was drawn at boot, yet its intro reaches the phones too.
  await soft.poll(() => phone.view?.state.intro?.round, { message: "the phone sees round 1's intro" }).toBe(1);
  await remote.command('newRound', { number: 1 });
  const shuffled = await remote.until('the Shuffle drawn', (s) => s.shuffle !== null);
  await remote.waitFor(() => Date.now() > (shuffled.shuffle?.endAtMs ?? 0) + 200, 60_000);

  // ---- three landings --------------------------------------------------------------------------------------
  let state = await land(null);
  await expectScenes(screens, 'play');
  for (let i = 0; i < 2; i++) state = await land(state.current?.songId ?? null);
  const playing = state.current?.songId;
  await soft(consolePage.getByTestId('now-playing')).toHaveAttribute('data-song-id', String(playing));
  await soft(player.getByTestId('now')).toHaveAttribute('data-song-id', String(playing));
  await soft(show.getByTestId('drum')).toHaveAttribute('data-landed-id', String(playing));
  await soft(phonePage.getByTestId('now')).toHaveAttribute('data-song-id', String(playing));
  await soft.poll(() => phone.view?.state.rounds.find((r) => r.number === 1)?.landings.length, { message: 'the phone counted three landings' }).toBe(3);
  // The phone's drum matches the projector's (D237): the round's public drumSeed, and each Spin's spinSeed.
  soft(typeof phone.view?.state.rounds.find((r) => r.number === 1)?.drumSeed, "round 1's drumSeed reached the phone").toBe('number');
  const spins = phone.raw.flatMap((text) => {
    const message = JSON.parse(text) as PublicMessage;
    return message.type === 'public.delta' ? message.changes.flatMap((c) => (c.kind === 'spin' && c.spin ? [c.spin] : [])) : [];
  });
  soft(spins.length, 'the phone saw the Spins').toBeGreaterThan(0);
  soft(spins.filter((spin) => typeof spin.spinSeed !== 'number'), 'every Spin came with its spinSeed').toEqual([]);
  // And its landing song from its start (D277, U206): every Spin with a landAtMs names one, and the next song
  // that landed is that one. Each landing pairs with the last landing Spin before it in the feed.
  soft(spins.filter((spin) => spin.landAtMs !== null && typeof spin.targetId !== 'number'), 'every landing Spin came with its targetId').toEqual([]);
  const aimed: { targetId: number | undefined; songId: number }[] = [];
  let target: number | undefined;
  for (const text of phone.raw) {
    const message = JSON.parse(text) as PublicMessage;
    if (message.type !== 'public.delta') continue;
    for (const change of message.changes) {
      if (change.kind === 'spin' && change.spin?.landAtMs != null) target = change.spin.targetId;
      if (change.kind === 'landed') aimed.push({ targetId: target, songId: change.landing.songId });
    }
  }
  soft(aimed.length, 'the phone saw the landings').toBeGreaterThan(0);
  soft(aimed.filter((a) => a.targetId !== a.songId), "each song landed on its Spin's targetId").toEqual([]);

  // ---- Parlem (the song ducks), then Aguanta (it stays up) -------------------------------------------------
  await remote.command('hold', { on: true });
  await remote.until('Parlem', (s) => s.status === 'hold' && s.hold?.ducked !== false);
  await soft(consolePage.getByTestId('hold')).toHaveAttribute('data-mode', 'talk');
  await remote.command('hold', { duck: false });
  await remote.until('Aguanta', (s) => s.status === 'hold' && s.hold?.ducked === false);
  await soft(consolePage.getByTestId('hold')).toHaveAttribute('data-mode', 'stay');
  await remote.command('hold', { on: false });
  await remote.until('released', (s) => s.status === 'playing');
  await soft(consolePage.getByTestId('hold')).toHaveAttribute('data-mode', 'none');

  // ---- Suspense, released into its landing (Next can't: D133) ---------------------------------------------
  await remote.command('suspense', { on: true });
  await remote.until('Suspense', (s) => s.suspense !== null);
  await remote.command('suspense', { on: false });
  state = await remote.until('the Suspense landed', (s) => s.status === 'playing' && s.current !== null && s.current.songId !== playing && s.transition === null && s.suspense === null, LANDING_MS);
  if (state.current) landed.add(state.current.songId);

  // ---- a claim put under review, then discarded: no verdict, no winner, back in Parlem (D118–D125) -----------
  await remote.command('claim', { cardId: CARDS[1], kind: 'line' });
  const reviewed = await remote.until('the claim to review on screen', (s) => s.scene === 'check' && s.check?.cardId === CARDS[1]);
  const reviewedId = reviewed.check?.claimId as string;
  await soft.poll(() => phone.view?.state.check, { message: 'the phone sees the Check pending' }).toMatchObject({ cardId: CARDS[1], result: 'pending' });
  await remote.command('checkReview', { claimId: reviewedId });
  await remote.until('under review', (s) => s.claims.find((c) => c.claimId === reviewedId)?.status === 'reviewing' && s.check?.reviewing === true);
  await soft(show.getByTestId('check'), 'the projector says "Revisió manual" (D123)').toHaveAttribute('data-reviewing', 'true');
  await soft(consolePage.getByTestId('review-panel'), "the console's review choices (D121)").toBeVisible();
  await soft.poll(() => phone.view?.state.check?.result, { message: 'a review stays pending on phones (U79)' }).toBe('pending');
  await remote.command('reviewEnd', { claimId: reviewedId, outcome: 'discard' });
  await remote.until('discarded, back in Parlem', (s) => s.claims.find((c) => c.claimId === reviewedId)?.status === 'discarded' && s.hold?.reason === 'discarded');
  await soft.poll(() => phone.view?.state.check, { message: 'the discarded Check leaves the phones' }).toBe(null);
  await soft.poll(() => phone.view?.state.winners.length, { message: 'a discard wins nothing' }).toBe(0);

  // ---- a Line: claimed, checked, celebrated, back to the round ---------------------------------------------
  expect(LINE_SONGS.every((id) => landed.has(id)), `card ${CARDS[0]}'s first Line has landed`).toBe(true);
  await remote.command('claim', { cardId: CARDS[0], kind: 'line' });
  const checking = await remote.until('the Line on screen', (s) => s.scene === 'check' && s.check?.cardId === CARDS[0]);
  expect(checking.check?.revealed, 'nothing revealed before the first press').toEqual([]);
  await expectScenes(screens, 'check');
  // One card claimed: the console shows its board (the claimed-cards strip only from two cards on, D110).
  await soft(consolePage.getByTestId('check-board')).toHaveAttribute('data-card-id', String(CARDS[0]));
  await soft(show.getByTestId('check'), 'the projector, nothing revealed yet').toHaveAttribute('data-revealed', '0');
  const lineId = checking.check?.claimId as string;
  const lineDone = await remote.checkByPresses(lineId);
  expect(lineDone.claims.find((c) => c.claimId === lineId)?.status, 'the Line passed its Check').toBe('valid');
  // A lone pass goes straight to the Celebration: the stage's Check is read only while its scene is `check`.
  await remote.until('the Line celebrated', (s) => s.scene === 'celebration' && s.celebration?.kind === 'line');
  await expectScenes(screens, 'celebration');
  await soft(show.getByTestId('celebration')).toHaveAttribute('data-kind', 'line');
  state = await land(state.current?.songId ?? null);
  await expectScenes(screens, 'play');

  // ---- the Bingo, then the Interval -----------------------------------------------------------------------
  // Until all twelve of the second card's songs have landed (the fixed Queue brings them next).
  for (let i = 0; i < BINGO_SONGS.length && !BINGO_SONGS.every((id) => landed.has(id)); i++) state = await land(state.current?.songId ?? null);
  expect(BINGO_SONGS.every((id) => landed.has(id)), `all of card ${CARDS[1]} has landed`).toBe(true);
  // Two numbers from the claim pad (D110), checked in turn: the second card hasn't its Bingo, so it fails after the
  // first passed, and one more press starts the shared Celebration. Automatic reveal (only in the Check's scene) does
  // the presses between.
  await remote.command('claim', { cardIds: [CARDS[1], CARDS[0]], kind: 'bingo' });
  const bingo = await remote.until('the Bingo on screen', (s) => s.scene === 'check' && s.check?.kind === 'bingo' && s.check.cardId === CARDS[1]);
  await remote.command('checkAuto', { on: true });
  const [passId, failId] = [CARDS[1], CARDS[0]].map((card) => bingo.claims.find((c) => c.cardId === card && c.status !== 'discarded' && c.status !== 'valid')?.claimId as string);
  expect((await remote.checkByPresses(passId as string)).claims.find((c) => c.claimId === passId)?.status, 'the full card passes').toBe('valid');
  const failed = await remote.checkByPresses(failId as string);
  expect(failed.claims.find((c) => c.claimId === failId)?.status, 'the other card fails').toBe('invalid');
  // The press the shared Celebration waits for: the engine says which claim and step (D110).
  const next = await remote.until('the Celebration waits for a press', (s) => s.celebrationNext !== null || s.scene === 'celebration');
  if (next.scene === 'check') await remote.command('checkAuto', { on: false });
  if (next.celebrationNext) await remote.command('checkNext', next.celebrationNext);
  await remote.until('the Bingo celebrated', (s) => s.scene === 'celebration' && s.celebration?.kind === 'bingo');
  await soft.poll(() => phone.view?.state.winners.at(-1), { message: 'only the card that passed wins' }).toEqual({ round: 1, kind: 'bingo', cardIds: [CARDS[1]] });
  await soft(show.getByTestId('celebration')).toHaveAttribute('data-kind', 'bingo');
  await remote.command('interval');
  await remote.until('the Interval', (s) => s.scene === 'interval');
  await expectScenes(screens, 'interval');
  await soft(show.getByTestId('interval')).toBeVisible();

  // ---- round 2 -------------------------------------------------------------------------------------------
  // Prize secrecy: until round 2's intro, nothing of its prizes has reached a phone.
  expect(phone.everything(), "round 2's prize before its intro").not.toContain(SECRET_PRIZE);
  await remote.command('roundIntro', { number: 2 });
  // The intro names the round to come; the state's round changes when its Shuffle starts it.
  await remote.until('round 2 introduced', (s) => s.scene === 'roundStart' && s.intro?.round === 2);
  await expect.poll(() => phone.view?.state.plan?.rounds.find((r) => r.number === 2)?.revealed, { message: "round 2's prizes revealed at its intro", timeout: 20_000 }).toBe(true);
  expect(phone.everything()).toContain(SECRET_PRIZE);
  await remote.command('newRound', { number: 2 });
  const shuffled2 = await remote.until('round 2 Shuffle', (s) => s.shuffle !== null && s.shuffle.round === 2);
  await remote.waitFor(() => Date.now() > (shuffled2.shuffle?.endAtMs ?? 0) + 200, 60_000);
  state = await land(null);
  expect(state.round.number).toBe(2);
  await expectScenes(screens, 'play');

  // The protocol all along: every step's event came (the engine's own markers), nothing was rejected, and no
  // page threw.
  const seen = new Set(remote.events.map((e) => e.type));
  for (const type of ['shuffle.scheduled', 'scene.changed', 'transition.scheduled', 'transition.landed', 'suspense.started', 'claim.opened', 'check.started', 'check.revealed', 'check.reviewing', 'check.cue', 'claim.decided', 'celebration.started']) {
    expect(seen.has(type as never), `an event ${type}`).toBe(true);
  }
  expect(remote.events.filter((e) => e.type === 'command.rejected')).toEqual([]);
  soft(errors).toEqual([]);

  // What the phones got, all show long: a gap-free feed with nothing private in it. Not the Queue or the next
  // song, not possible winners or the Futur (nor the Desgraciat round's standing cards and curve), no Check
  // outcome before the verdict, no private seeds (the drum's are public, D237) or resume codes, no Spin's drum
  // (its landing song is public from its start, D277, U206: the targetId), no cheat sheet, no Wii status, no
  // stalled audio clock (D284).
  expect(phone.gaps, 'the feed never had to resync').toBe(0);
  const all = phone.everything();
  for (const secret of ['"queue"', '"next":', '"possibleWinners"', '"future"', '"standing":', '"lastStandingAt"', '"standingCurve"', '"fellLast"', '"outcome"', '"slip"', '"shuffleSeed"', '"phaseSeed"', '"resume"', '"drum":', '"removeId"', 'cheatSheet', 'remote.status', '"claims"', '"markedCard"', '"revealUntil"', '"cueNext"', '"reviewing"', '"manual":', '"finale":', '"byHand"', '"audioStalled"']) {
    expect(all, `phones never get ${secret}`).not.toContain(secret);
  }
});
