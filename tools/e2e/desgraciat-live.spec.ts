// The Desgraciat round on a DEPLOYED cloud, opt-in: the relay and the show page run here, the cloud link goes to
// the live Worker with the laptop's service token (apps/cloud/.env.link), and a phone follows its public feed and
// its player app. The round is played Next by Next until one card stands, that card claims, its Check passes,
// and the Celebration plays. Checked on the way: the phone gets every landing, the round's kind and card type,
// the 'standing' winner and the round's end with no Line; nothing private ever reaches it; the link never has an
// entry refused and ends with the cloud holding the whole journal.
//
//   QUINA_LIVE_CLOUD=https://quina-dev.barrakudesbegur.org npm run test:e2e -- desgraciat-live
//
// It writes a rehearsal Game to that cloud, which becomes its current Game, so it never runs unless asked. It
// never saves a plan there. Screenshots of the phone go to results/ (and the HTML report).
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { defaultCardType, type ShowState } from '@quina/protocol';
import { CloudLink } from '../../apps/cloud/laptop/link.ts';
import { Phone } from './support/cloud.ts';
import { REPO, hasPreparedRepertoire, startRelay, type Relay } from './support/relay.ts';
import { Remote } from './support/remote.ts';

const LIVE = process.env.QUINA_LIVE_CLOUD?.replace(/\/+$/, '') ?? null;
const ENV_LINK = path.join(REPO, 'apps/cloud/.env.link');
/** The card type the Desgraciat round plays when the plan names none (D70: the especial card, as in 2025). */
const CARD_TYPE = defaultCardType('desgraciat');
/** Few cards of that type in play, so one stands after about twenty landings (with 300, about thirty-five). */
const PLAYED = cardIdsOfType(CARD_TYPE).slice(0, 30);
const CARDS_IN_PLAY = PLAYED.join(',');
/** The phone follows these (anonymous card numbers, as a player's saved cards). */
const PHONE_CARDS = PLAYED.slice(0, 3);
const LANDING_MS = 90_000;
const MAX_LANDINGS = 77;

test.skip(!LIVE, 'opt-in: set QUINA_LIVE_CLOUD to a deployed cloud (it gets a rehearsal Game)');
// No trace: minutes of a show page streaming audio make one so big that saving it after a failure outlasted the
// hook timeout. The screenshots and the attachments say what happened.
test.use({ trace: 'off' });
test.skip(!hasPreparedRepertoire(), 'the default repertoire is not prepared here (npm run prep in apps/show)');
test.skip(!fs.existsSync(ENV_LINK), 'no apps/cloud/.env.link: the laptop service token is needed');
test.skip(PLAYED.length < 30, `fewer than 30 ${CARD_TYPE} cards in apps/cards/dist/cards.json (npm run build in apps/cards)`);

/** The printed cards of one type, by number (the default repertoire's cards, as the relay serves them). */
function cardIdsOfType(type: string): number[] {
  const file = path.join(REPO, 'apps/cards/dist/cards.json');
  if (!fs.existsSync(file)) return [];
  const cards = JSON.parse(fs.readFileSync(file, 'utf8')) as { id: number; type?: string }[];
  return cards.filter((c) => c.type === type).map((c) => c.id).sort((a, b) => a - b);
}

let relay: Relay;
let remote: Remote;
let link: CloudLink;
let phone: Phone;
const linkLog: string[] = [];
/** Closed before the relay stops, so it never waits on a page left open. */
const contexts: BrowserContext[] = [];

test.beforeAll(async () => {
  const env = parseEnv(fs.readFileSync(ENV_LINK, 'utf8'));
  if (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET) throw new Error('.env.link has no service token');
  relay = await startRelay();
  remote = await Remote.connect(relay.ws);
  const wsBase = (LIVE as string).replace(/^http/, 'ws');
  link = new CloudLink({
    relayUrl: relay.ws,
    cloudUrl: `${wsBase}/ws/show`,
    cloudHeaders: { 'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET },
    dataDir: relay.linkDir,
    clientId: 'e2e-live-laptop',
    log: (line) => linkLog.push(line),
  });
  link.start();
  for (let i = 0; i < 200 && link.status().cloud !== 'online'; i++) await new Promise((r) => setTimeout(r, 100));
  if (link.status().cloud !== 'online') throw new Error(`the cloud link did not connect to ${LIVE}: ${linkLog.join(' | ')}`);
  phone = new Phone(`${wsBase}/feed?cards=${PHONE_CARDS.join(',')}`);
});

test.afterEach(async ({}, testInfo) => {
  await testInfo.attach('cloud link log', { body: linkLog.join('\n'), contentType: 'text/plain' });
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach('last events', { body: JSON.stringify(remote.events.slice(-40), null, 2), contentType: 'application/json' });
});

/** One teardown step, at most `ms`: a step that hangs is named in the output instead of holding the run. */
async function bounded(what: string, step: () => unknown, ms = 15_000): Promise<void> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<'late'>((resolve) => (timer = setTimeout(() => resolve('late'), ms)));
  const result = await Promise.race([Promise.resolve().then(step).then(() => 'done' as const), late]);
  clearTimeout(timer);
  if (result === 'late') console.warn(`teardown: ${what} still not done after ${ms} ms; going on`);
  else if (Date.now() - started > 2000) console.warn(`teardown: ${what} took ${Date.now() - started} ms`);
}

test.afterAll(async () => {
  for (const [i, context] of contexts.entries()) await bounded(`closing browser context ${i}`, () => context.close());
  await bounded('the phone', () => phone?.close());
  await bounded('the cloud link', () => link?.stop());
  await bounded('the remote', () => remote?.close());
  await bounded('the relay', () => relay?.stop());
});

async function land(previous: number | null): Promise<ShowState> {
  await remote.command('next');
  return remote.until('a landing', (s) => s.status === 'playing' && s.current !== null && s.current.songId !== previous && s.transition === null, LANDING_MS);
}

/** The phone's reel (the player's Ara reel, also its strip above the cards). */
const reelState = (page: Page) => page.getByTestId('reel').getAttribute('data-phase');

/** A screenshot once the landing's 400 ms flip-in is over (earlier ones catch it half-way). */
async function snap(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(700);
  const file = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: file });
  await test.info().attach(name, { path: file, contentType: 'image/png' });
}

test('a Desgraciat round on the live cloud, a phone following', async ({ browser }) => {
  test.setTimeout(40 * 60_000);
  contexts.push(await browser.newContext(), await browser.newContext({ viewport: { width: 390, height: 844 } }));
  const show = await (contexts[0] as BrowserContext).newPage();
  const phonePage = await (contexts[1] as BrowserContext).newPage(); // a phone: the player app as the cloud serves it
  const errors: string[] = [];
  for (const [name, page] of [['show', show], ['phone', phonePage]] as const) page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));

  // ---- the show page, silent and fresh (a new Game on the cloud), the shortest Pace ------------------------
  await show.goto(`${relay.url}/show/show.html?fresh=1&auto=0&mute=1&pace=8`);
  await show.locator('#start-button').click();
  await remote.until('the show unlocked', (s) => s.status !== 'locked');
  await remote.command('setCardsInPlay', { ranges: CARDS_IN_PLAY });
  await phonePage.goto(`${LIVE}/#/26/${PHONE_CARDS[0]}`);

  // ---- the round: introduced as Desgraciat, then its Shuffle ------------------------------------------------
  await remote.command('roundIntro', { number: 1, kind: 'desgraciat' });
  await remote.until('round 1 introduced', (s) => s.scene === 'roundStart' && s.intro?.round === 1);
  await expect.poll(() => phone.view?.state.intro, { message: 'the phone sees the Desgraciat intro', timeout: 20_000 }).toMatchObject({ round: 1, kind: 'desgraciat', cardType: CARD_TYPE });
  await remote.command('newRound', { number: 1, kind: 'desgraciat' });
  const shuffled = await remote.until('the Shuffle drawn', (s) => s.shuffle !== null);
  await remote.waitFor(() => Date.now() > (shuffled.shuffle?.endAtMs ?? 0) + 200, 60_000);
  const startedWith = remote.state?.standing?.count ?? null;

  // ---- Next by Next until one card stands ------------------------------------------------------------------
  let state = remote.state as ShowState;
  const curve: number[] = [];
  for (let i = 1; i <= MAX_LANDINGS; i++) {
    state = await land(state.current?.songId ?? null);
    const standing = await remote.until('the standing count', (s) => s.standing != null && s.current?.songId === state.current?.songId);
    curve.push(standing.standing?.count ?? -1);
    await expect.poll(() => phone.view?.state.rounds.at(-1)?.landings.length, { message: `the phone got landing ${i}`, timeout: 20_000 }).toBe(i);
    // The player shows the landed song within moments: on 2026-11-25 its reel turned 'landed' 70–150 ms after
    // the engine's landing, through the link and the cloud. Two seconds leaves room for a slow network.
    await expect.poll(() => reelState(phonePage), { message: `the phone's reel shows landing ${i}`, timeout: 2_000 }).toBe('landed');
    if (i === 3) await snap(phonePage, 'phone-after-3-landings');
    if ((standing.standing?.count ?? 0) <= 1) break;
  }
  const last = remote.state?.standing;
  test.info().annotations.push({ type: 'standing', description: `${startedWith} at the start; after each landing: ${curve.join(', ')}` });
  expect(last?.count, 'one card stands').toBe(1);
  const winner = last?.cardIds?.[0] as number;
  expect(phone.view?.state.rounds.at(-1)).toMatchObject({ number: 1, kind: 'desgraciat', cardType: CARD_TYPE, ended: false, lineConfirmed: false });
  await snap(phonePage, 'phone-one-standing');

  // ---- the last card standing claims; its Check; the Celebration --------------------------------------------
  // The phone adds the winning card as a player does, from the card's QR link (/26/<card>), so its Celebration
  // is its own.
  await phonePage.goto(`${LIVE}/26/${winner}`);
  await remote.command('claim', { cardId: winner, kind: 'standing' });
  const checking = await remote.until('the standing Check', (s) => s.scene === 'check' && s.check?.kind === 'standing');
  await expect.poll(() => phone.view?.state.check, { message: 'the phone sees the Check pending', timeout: 20_000 }).toMatchObject({ cardId: winner, kind: 'standing', result: 'pending' });
  await snap(phonePage, 'phone-check');
  // The presenters' presses (D107): each reveals a song of the card, none landed, then the cue.
  const done = await remote.checkByPresses(checking.check?.claimId as string);
  expect(done.claims.find((c) => c.claimId === checking.check?.claimId)?.status, 'the last card standing passes').toBe('valid');
  await remote.until('the last card standing celebrated', (s) => s.scene === 'celebration' && s.celebration?.kind === 'standing');
  await expect.poll(() => phone.view?.state.winners.at(-1), { message: 'the phone sees the winner', timeout: 20_000 }).toEqual({ round: 1, kind: 'standing', cardIds: [winner] });
  await expect.poll(() => phone.view?.state.rounds.at(-1)?.ended, { message: 'the round ended', timeout: 20_000 }).toBe(true);
  expect(phone.view?.state.rounds.at(-1)?.lineConfirmed, 'no Line in a Desgraciat round').toBe(false);
  await expect.poll(() => phonePage.locator('[data-scene]').first().getAttribute('data-scene'), { message: 'the player app in the Celebration', timeout: 20_000 }).toBe('celebration');
  await expect(phonePage.locator('[data-anim="celebrate"][data-state="own"]'), "the winning card's phone celebrates its own card").toBeVisible({ timeout: 20_000 });
  await snap(phonePage, 'phone-celebration');

  // ---- the link: everything journalled is in the cloud, nothing refused ---------------------------------------
  await expect.poll(() => { const s = link.status(); return s.ackSeq === s.journalled && s.pending === 0; }, { message: 'the cloud holds the whole journal', timeout: 30_000 }).toBe(true);
  expect(linkLog.filter((l) => /refused|conflict/i.test(l)), 'no entry refused, no conflict').toEqual([]);

  // ---- what the phone got: gap-free, nothing private -------------------------------------------------------
  expect(phone.gaps, 'the feed never had to resync').toBe(0);
  const all = phone.everything();
  for (const secret of ['"queue"', '"next":', '"possibleWinners"', '"future"', '"standing":', '"lastStandingAt"', '"standingCurve"', '"fellLast"', '"outcome"', '"slip"', '"shuffleSeed"', '"phaseSeed"', '"resume"', 'cheatSheet', 'remote.status', '"claims"', '"markedCard"', '"revealUntil"', '"cueNext"', '"reviewing"', '"manual":', '"finale":', '"byHand"']) {
    expect(all, `phones never get ${secret}`).not.toContain(secret);
  }
  expect(errors, 'no page errors').toEqual([]);
});
