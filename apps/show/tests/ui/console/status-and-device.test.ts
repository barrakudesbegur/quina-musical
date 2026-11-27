// The header (connections, alerts, Heat, round on screen), the toasts, and this device's settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { flowOf } from '../../../../../packages/ui/flow.ts';
import { looksUnpaired, consoleAlert, heatPercent, linksOf, roundOnScreen, wiiLink } from '../../../../console/logic/status.ts';
import { SentLog, dismissToast, holdToasts, isOwnRejection, liveToasts, pushToast, releaseToasts, shownToasts, type Toast } from '../../../../console/logic/toasts.ts';
import { consoleLinkFor, lastSpinOf, normalizeLabel, parseChecklist, resolveLabel, resolveTheme, senderOf } from '../../../../console/logic/device.ts';
import { defaultClaimKind, prizeRevealOf, roundPrizes, tabIndexForKey, winnersByRound, celebrationWinners, songTitleOf } from '../../../../console/logic/show-data.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { PROTOCOL_VERSION } from '@quina/protocol';
import { S } from '../../../../console/strings.ts';

const NOW = 1_800_000_000_000;

test('links: relay and show are real, the rest unknown for now', () => {
  assert.deepEqual(linksOf(true, true), { relay: 'up', show: 'up', cloud: 'unknown', feed: 'unknown', wii: 'unknown' });
  assert.equal(linksOf(true, false).show, 'down');
  assert.equal(linksOf(false, false).show, 'unknown', 'without the relay the show page cannot be known');
});

test('the Wii link: up when connected, down only when a connected remote went away, otherwise unknown', () => {
  assert.equal(linksOf(true, true, 'connected').wii, 'up');
  assert.equal(linksOf(true, true, 'lost').wii, 'down');
  assert.equal(linksOf(true, true, 'disconnected').wii, 'unknown', 'optional: none yet is no alarm');
  assert.equal(linksOf(true, true, 'connecting').wii, 'unknown');
  assert.equal(linksOf(true, true, 'unsupported').wii, 'unknown', 'a tablet: the remote pairs with the laptop');
  assert.equal(wiiLink('connected'), 'up');
});

test('the alert names the most serious failure first', () => {
  assert.equal(consoleAlert({ connected: false, showOnline: false, hasState: true, status: 'playing' }), 'disconnected');
  assert.equal(consoleAlert({ connected: true, showOnline: false, hasState: true, status: 'playing' }), 'showOffline');
  assert.equal(consoleAlert({ connected: true, showOnline: true, hasState: false, status: null }), 'waiting');
  assert.equal(consoleAlert({ connected: true, showOnline: true, hasState: true, status: 'locked' }), 'locked');
  assert.equal(consoleAlert({ connected: true, showOnline: true, hasState: true, status: 'hold' }), null);
  assert.equal(consoleAlert({ connected: true, showOnline: false, hasState: false, status: null, unpaired: true }), 'unpaired');
});

test('Heat as a whole percentage', () => {
  assert.equal(heatPercent(0.71), 71);
  assert.equal(heatPercent(1.4), 100);
  assert.equal(heatPercent(-1), 0);
  assert.equal(heatPercent(null), null);
  assert.equal(heatPercent(Number.NaN), null);
});

test('round on screen: none before the night, the introduced one at round start', () => {
  const before = FIXTURES.before(NOW).state;
  assert.equal(roundOnScreen(before, flowOf(before)), null);
  const play = FIXTURES.play(NOW).state;
  assert.deepEqual(roundOnScreen(play, flowOf(play)), { number: 3, kind: 'normal' });
  const start = { ...FIXTURES.roundStart(NOW).state, intro: { round: 7, kind: 'special' as const, sinceMs: NOW } };
  assert.deepEqual(roundOnScreen(start, flowOf(start)), { number: 7, kind: 'special' });
  // The header names them with no number ("Quina Especial", not "Quina 7 · especial").
  assert.equal(S.round({ number: 7, kind: 'special' }, SAMPLE_PLAN), 'Quina Especial');
  // The Desgraciat round, at its intro and in play: the header reads "Quina Desgraciada".
  const intro = FIXTURES.desgraciatIntro(NOW).state;
  assert.deepEqual(roundOnScreen(intro, flowOf(intro)), { number: 5, kind: 'desgraciat' });
  const desgraciat = FIXTURES.desgraciat(NOW).state;
  const round = roundOnScreen(desgraciat, flowOf(desgraciat));
  assert.ok(round);
  assert.equal(S.round(round, SAMPLE_PLAN), 'Quina Desgraciada');
  assert.equal(S.round({ number: 3, kind: 'normal' }, SAMPLE_PLAN), 'Quina 3');
  // After the Desgraciat round 5, round 6 is Quina 5; without a plan, its plan number.
  assert.equal(S.round({ number: 6, kind: 'normal' }, SAMPLE_PLAN), 'Quina 5');
  assert.equal(S.round({ number: 6, kind: 'normal' }, null), 'Quina 6');
  assert.equal(S.menu.subtitle('Tauleta', S.roundOf({ number: 6, kind: 'normal' }, SAMPLE_PLAN, 8)), 'Tauleta · Quina 5 de 8');
  assert.equal(S.menu.subtitle(null, null), '');
  assert.equal(roundOnScreen(null, flowOf(null)), null);
});

test('toasts: bounded, expire, dismiss', () => {
  const t = (id: number, untilMs: number): Toast => ({ id, tone: 'error', text: String(id), detail: null, untilMs });
  let list = pushToast([], t(1, 10), 2);
  list = pushToast(list, t(2, 20), 2);
  list = pushToast(list, t(3, 30), 2);
  assert.deepEqual(list.map((x) => x.id), [2, 3]);
  assert.deepEqual(liveToasts(list, 25).map((x) => x.id), [3]);
  assert.equal(liveToasts(list, 5), list, 'unchanged list when nothing expired');
  assert.deepEqual(dismissToast(list, 3).map((x) => x.id), [2]);
});

test('toasts wait behind an open dialog and show, for their full time, when it closes', () => {
  const t = (id: number, untilMs: number | null): Toast => ({ id, tone: 'error', text: String(id), detail: null, untilMs });
  const list = [t(1, 10), t(2, null)];
  assert.deepEqual(shownToasts(list).map((x) => x.id), [1], 'a waiting toast is not on screen');
  assert.deepEqual(liveToasts(list, 50).map((x) => x.id), [2], 'a waiting toast never expires');
  const held = holdToasts(list);
  assert.ok(held.every((x) => x.untilMs === null), 'a dialog opening holds the ones already showing too');
  assert.equal(holdToasts(held), held, 'unchanged when all already wait');
  const back = releaseToasts(held, 4000);
  assert.deepEqual(back.map((x) => x.untilMs), [4000, 4000]);
  assert.equal(shownToasts(back), back);
  assert.equal(releaseToasts(back, 9000), back, 'unchanged when none waits');
});

test('only this console’s rejections are toasted', () => {
  const sent = new SentLog(2);
  sent.remember('a');
  sent.remember('b');
  sent.remember('c');
  const rej = (reqId: string | null) => ({ v: PROTOCOL_VERSION, type: 'command.rejected' as const, reqId, cmd: 'next', reason: 'busy' as const });
  assert.equal(isOwnRejection(rej('a'), sent), false, 'forgotten after the bound');
  assert.equal(isOwnRejection(rej('c'), sent), true);
  assert.equal(isOwnRejection(rej('someone-else'), sent), false);
  assert.equal(isOwnRejection(rej(null), sent), true);
});

test('device label: cleaned, ?label= wins and is stored once', () => {
  assert.equal(normalizeLabel('  Mòbil   admin ', 24), 'Mòbil admin');
  assert.equal(normalizeLabel('   ', 24), null);
  assert.equal(normalizeLabel('x'.repeat(40), 24), 'x'.repeat(24));
  assert.deepEqual(resolveLabel('Tauleta', null, 24), { label: 'Tauleta', store: true });
  assert.deepEqual(resolveLabel('Tauleta', 'Tauleta', 24), { label: 'Tauleta', store: false });
  assert.deepEqual(resolveLabel(null, 'Mòbil admin', 24), { label: 'Mòbil admin', store: false });
  assert.deepEqual(resolveLabel('', null, 24), { label: null, store: false });
});

test('theme and checklist from storage', () => {
  assert.equal(resolveTheme('dark', 'light'), 'dark');
  assert.equal(resolveTheme('neon', 'light'), 'light');
  assert.equal(resolveTheme(null, 'light'), 'light');
  assert.deepEqual(parseChecklist('["hotspot","bogus",3]', ['hotspot', 'charger']), ['hotspot']);
  assert.deepEqual(parseChecklist('{', ['hotspot']), []);
  assert.deepEqual(parseChecklist(null, ['hotspot']), []);
});

test('the LAN link for another device is this origin’s /console/ with the label, never localhost', () => {
  assert.equal(consoleLinkFor('http://192.168.43.10:5174', 'Mòbil admin'), 'http://192.168.43.10:5174/console/?label=M%C3%B2bil+admin');
  assert.equal(consoleLinkFor('http://localhost:5174', 'Mòbil admin'), null);
  assert.equal(consoleLinkFor('http://127.0.0.1:5174', 'x'), null);
  assert.equal(consoleLinkFor('http://[::1]:5174', 'x'), null);
  assert.equal(consoleLinkFor('not a url', 'x'), null);
});

test('who sent a command, from its reqId', () => {
  assert.equal(senderOf('Tauleta-mabc12-3'), 'Tauleta');
  assert.equal(senderOf('Mobil_admin-mabc12-3'), 'Mobil admin');
  assert.equal(senderOf('r-mabc12-3'), null, 'an unlabelled console');
  assert.equal(senderOf(null), null, 'the engine by itself (auto-advance)');
  const spin = { v: PROTOCOL_VERSION, type: 'transition.scheduled' as const, id: 't', reqId: 'Tauleta-x-1', from: 7, to: 74, position: 17, phase: 'late' as const, recipe: 'R7' as const, recipeName: 'build', exit: null, shape: 'S2' as const, spinStartAtMs: 0, exitAtMs: 0, landAtMs: 0, durationMs: 0, hookId: 'h', bpm: null, drum: { removeId: null, targetId: 74, minLaps: 1 } };
  assert.deepEqual(lastSpinOf(spin), { by: 'Tauleta', suspense: false });
  assert.deepEqual(lastSpinOf({ ...spin, reqId: null, recipe: 'SUSPENSE' }), { by: null, suspense: true });
});

test('round prize bundles from the plan, headline prizes first, or why not', () => {
  assert.deepEqual(roundPrizes(null, 1), { status: 'noPlan' });
  assert.deepEqual(roundPrizes(SAMPLE_PLAN, 99), { status: 'noRound', number: 99 });
  const r = roundPrizes(SAMPLE_PLAN, 7);
  assert.equal(r.status, 'ok');
  if (r.status === 'ok') {
    assert.equal(r.prizes.kind, 'special');
    assert.equal(r.prizes.line[0].sponsor, '[Patrocinador 1]');
    assert.deepEqual(r.prizes.bingo.map((p) => [p.title, p.headline]).slice(0, 2), [['Televisor', true], ['Xocolata', false]]);
    assert.equal(r.prizes.bingo.length, SAMPLE_PLAN.rounds[6].bingo.length);
  }
  const plan = structuredClone(SAMPLE_PLAN);
  plan.rounds[0].bingo = [{ ...plan.rounds[0].bingo[1], title: 'Tassa' }, { ...plan.rounds[0].bingo[0], title: 'Pernil' }];
  const unsorted = roundPrizes(plan, 1);
  assert.deepEqual(unsorted.status === 'ok' && unsorted.prizes.bingo.map((p) => p.title), ['Pernil', 'Tassa'], 'headline first even from an unsorted bundle');
});

test('whether phones may see a round\'s prizes: the plan\'s reveal setting over the engine\'s reveals', () => {
  const state = { prizes: { revealed: [{ round: 3, by: 'intro' as const }, { round: 5, by: 'presenters' as const }] } };
  assert.equal(prizeRevealOf(SAMPLE_PLAN, state, 1), 'revealed', 'perRound: round 1 from the start');
  assert.equal(prizeRevealOf(SAMPLE_PLAN, state, 3), 'revealed');
  assert.equal(prizeRevealOf(SAMPLE_PLAN, state, 4), 'secret');
  const secret = { ...SAMPLE_PLAN, prizeReveal: 'allSecret' as const };
  assert.equal(prizeRevealOf(secret, state, 1), 'secret');
  assert.equal(prizeRevealOf(secret, state, 3), 'secret', 'allSecret ignores intro reveals');
  assert.equal(prizeRevealOf(secret, state, 5), 'revealed');
  assert.equal(prizeRevealOf(null, state, 1), 'unknown');
  assert.equal(prizeRevealOf(SAMPLE_PLAN, {}, 1), 'unknown', 'an engine that does not report reveals');
});

test('winners: grouped by round, latest first; a Celebration’s own', () => {
  const s = FIXTURES.celebration(NOW).state;
  const groups = winnersByRound(s.winners ?? []);
  assert.deepEqual(groups.map((g) => g.round), [3, 2, 1]);
  assert.deepEqual(groups[1].winners.map((w) => w.kind), ['line', 'bingo']);
  assert.deepEqual(celebrationWinners(s.winners ?? [], s.celebration ?? null).map((w) => w.cardId), [123]);
  assert.deepEqual(celebrationWinners(s.winners ?? [], null), []);
});

test('song titles come from the snapshot first', () => {
  const s = FIXTURES.play(NOW).state;
  assert.equal(songTitleOf(7, s, null), 'Boig Per Tu');
  assert.equal(songTitleOf(74, s, null), 'Waka Waka');
  assert.equal(songTitleOf(999, s, null), null);
  assert.equal(songTitleOf(null, s, null), null);
});

test('a Claim defaults to what the Phase climbs towards', () => {
  const s = FIXTURES.play(NOW).state;
  assert.equal(defaultClaimKind(s), 'line');
  assert.equal(defaultClaimKind({ ...s, round: { ...s.round, lineConfirmed: true } }), 'bingo');
  assert.equal(defaultClaimKind(null), 'line');
});

test('tab keys wrap around', () => {
  assert.equal(tabIndexForKey(2, 'ArrowRight', 3), 0);
  assert.equal(tabIndexForKey(0, 'ArrowLeft', 3), 2);
  assert.equal(tabIndexForKey(1, 'Home', 3), 0);
  assert.equal(tabIndexForKey(1, 'End', 3), 2);
  assert.equal(tabIndexForKey(1, 'a', 3), null);
});

test('an unpaired device is told so: connected, silent relay, after the grace, not on the laptop itself', () => {
  const base = { connected: true, heardClients: false, hasState: false, hostname: '192.168.43.20', connectedForMs: 4000, graceMs: 3000 };
  assert.equal(looksUnpaired(base), true);
  assert.equal(looksUnpaired({ ...base, connectedForMs: 1000 }), false, 'within the grace');
  assert.equal(looksUnpaired({ ...base, heardClients: true }), false, 'the relay talks: paired');
  assert.equal(looksUnpaired({ ...base, hostname: 'localhost' }), false, 'the laptop needs no token');
  assert.equal(looksUnpaired({ ...base, hostname: '127.0.0.1' }), false);
});
