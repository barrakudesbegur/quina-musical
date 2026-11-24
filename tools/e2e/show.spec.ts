// One whole show, headless: the relay, the show page (with its stage), the console and a player, driven through
// the protocol like the presenters' tablet. Each step waits for the engine's state, then checks every screen
// through its stable hooks (data-scene, data-testid; agreed with the UI session):
//   before → round 1 introduced → Shuffle → three landings → Parlem → Aguanta → Suspense → a Line claimed,
//   checked and celebrated → back to the round → the Bingo claimed, checked and celebrated → the Interval →
//   round 2 introduced → Shuffle → its first landing.
// It needs the default pool prepared on this machine; without it the test is skipped.
import { expect, test, type Page } from '@playwright/test';
import type { ShowState } from '@quina/protocol';
import { hasPreparedPool, startRelay, type Relay } from './support/relay.ts';
import { Remote } from './support/remote.ts';

/** The player follows these cards (the first two are the ones claimed). */
const CARDS = [12, 34];
const LANDING_MS = 90_000;
/** The screens' checks: soft, so one run lists them all. */
const soft = expect.configure({ soft: true });

test.skip(!hasPreparedPool(), 'the default pool is not prepared here (npm run prep in apps/show)');

let relay: Relay;
let remote: Remote;
/** What the screens logged as errors and warnings. */
const logs: string[] = [];

test.beforeAll(async () => {
  relay = await startRelay();
  remote = await Remote.connect(relay.ws);
});

// On failure: the screens' logs and the protocol's last events, attached to the report.
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach('screens-console.txt', { body: logs.join('\n') || '(nothing)', contentType: 'text/plain' });
  const tail = remote.events.slice(-80).map((e) => JSON.stringify(e).slice(0, 400));
  await testInfo.attach('last-events.txt', { body: tail.join('\n'), contentType: 'text/plain' });
});

test.afterAll(async () => {
  remote?.close();
  await relay?.stop();
});

/** Each screen's scene, as its root says it. */
async function sceneOf(page: Page, root: string): Promise<string | null> {
  return page.locator(root).first().getAttribute('data-scene');
}

// The screens' checks are soft: one run lists every screen that didn't follow, while the protocol's (the engine's
// state and events) stop the test at once.
async function expectScenes(screens: { show: Page; console: Page; player: Page }, scene: string): Promise<void> {
  await soft.poll(() => sceneOf(screens.console, '.console'), { message: `console in ${scene}` }).toBe(scene);
  await soft.poll(() => sceneOf(screens.player, '[data-scene]'), { message: `player in ${scene}` }).toBe(scene);
  await soft(screens.show.locator(`#stage [data-scene="${scene}"]`).first(), `stage in ${scene}`).toBeVisible();
}

/** Ask for the next song and wait until it has landed and plays. */
async function land(previous: number | null): Promise<ShowState> {
  await remote.command('next');
  return remote.until('a landing', (s) => s.status === 'playing' && s.current !== null && s.current.songId !== previous && s.transition === null, LANDING_MS);
}

test('one whole show, every screen following', async ({ browser }) => {
  const context = await browser.newContext();
  const show = await context.newPage();
  const consolePage = await context.newPage();
  const player = await (await browser.newContext()).newPage(); // its own storage, like a phone
  const errors: string[] = [];
  for (const [name, page] of [['show', show], ['console', consolePage], ['player', player]] as const) {
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`${name} ${m.type()}: ${m.text()}`);
    });
  }

  // ---- the show page starts, the screens connect --------------------------------------------------------
  // Silent (mute), fresh (no local journal), no auto-advance, the shortest Pace (Spins of about 4 s).
  await show.goto(`${relay.url}/show/show.html?fresh=1&auto=0&mute=1&pace=8`);
  await show.locator('#start-button').click();
  await remote.until('the show unlocked', (s) => s.status !== 'locked');
  await remote.command('setCardsInPlay', { ranges: '1-300' });
  await consolePage.goto(`${relay.url}/console/`);
  await player.goto(`${relay.url}/player/?feed=relay#/26/${CARDS[0]}`);
  const screens = { show, console: consolePage, player };
  await expectScenes(screens, 'before');

  // ---- round 1: introduced, then the Shuffle -------------------------------------------------------------
  await remote.command('roundIntro', { number: 1 });
  await remote.until('round 1 introduced', (s) => s.scene === 'roundStart' && s.intro !== null);
  await expectScenes(screens, 'roundStart');
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

  // ---- Suspense, resolved by the next landing --------------------------------------------------------------
  await remote.command('suspense', { on: true });
  await remote.until('Suspense', (s) => s.suspense !== null);
  state = await land(playing ?? null);

  // ---- a Line: claimed, checked, celebrated, back to the round ---------------------------------------------
  await remote.command('claim', { cardId: CARDS[0], kind: 'line' });
  const checking = await remote.until('the Line checked', (s) => s.scene === 'check' && s.check !== null);
  await expectScenes(screens, 'check');
  await soft(consolePage.getByTestId('claim-row').first()).toHaveAttribute('data-card-id', String(CARDS[0]));
  await remote.until('the Check shown', (s) => s.check !== null && Date.now() >= s.check.endAtMs, 60_000);
  await soft(consolePage.getByTestId('check-result')).toHaveAttribute('data-outcome', checking.check?.outcome ?? '');
  await remote.command('decide', { claimId: checking.check?.claimId, valid: true });
  await remote.until('the Line celebrated', (s) => s.scene === 'celebration' && s.celebration?.kind === 'line');
  await expectScenes(screens, 'celebration');
  await soft(show.getByTestId('celebration')).toHaveAttribute('data-kind', 'line');
  state = await land(state.current?.songId ?? null);
  await expectScenes(screens, 'play');

  // ---- the Bingo, then the Interval -----------------------------------------------------------------------
  await remote.command('claim', { cardId: CARDS[1], kind: 'bingo' });
  const bingo = await remote.until('the Bingo checked', (s) => s.scene === 'check' && s.check?.kind === 'bingo');
  await remote.command('decide', { claimId: bingo.check?.claimId, valid: true });
  await remote.until('the Bingo celebrated', (s) => s.scene === 'celebration' && s.celebration?.kind === 'bingo');
  await soft(show.getByTestId('celebration')).toHaveAttribute('data-kind', 'bingo');
  await remote.command('interval');
  await remote.until('the Interval', (s) => s.scene === 'interval');
  await expectScenes(screens, 'interval');
  await soft(show.getByTestId('interval')).toBeVisible();

  // ---- round 2 -------------------------------------------------------------------------------------------
  await remote.command('roundIntro', { number: 2 });
  await remote.until('round 2 introduced', (s) => s.scene === 'roundStart' && s.round.number === 2);
  await remote.command('newRound', { number: 2 });
  const shuffled2 = await remote.until('round 2 Shuffle', (s) => s.shuffle !== null && s.shuffle.round === 2);
  await remote.waitFor(() => Date.now() > (shuffled2.shuffle?.endAtMs ?? 0) + 200, 60_000);
  state = await land(null);
  expect(state.round.number).toBe(2);
  await expectScenes(screens, 'play');

  // The protocol all along: every step's event came (the engine's own markers), nothing was rejected, and no
  // page threw.
  const seen = new Set(remote.events.map((e) => e.type));
  for (const type of ['shuffle.scheduled', 'scene.changed', 'transition.scheduled', 'transition.landed', 'suspense.started', 'claim.opened', 'check.scheduled', 'claim.decided', 'celebration.started']) {
    expect(seen.has(type as never), `an event ${type}`).toBe(true);
  }
  expect(remote.events.filter((e) => e.type === 'command.rejected')).toEqual([]);
  soft(errors).toEqual([]);
});
