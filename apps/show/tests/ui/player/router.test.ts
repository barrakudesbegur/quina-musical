// Opening the player app: this year's card links (path and dev hash), last year's ?c= links, other editions,
// the address after a link is taken in, the review hints, and which feed the URL picks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devHints, homeHref, homePath, legacyCardIds, parseRoute, settledHref } from '../../../../player/logic/router.ts';
import { chooseFeed, isLocalHost } from '../../../../player/feed/feed.ts';

const opts = { edition: '26', base: '/player/' };
const url = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

test('a production card link adds that card', () => {
  assert.deepEqual(parseRoute(url('/26/123'), opts), { kind: 'card', edition: '26', cardId: 123 });
  assert.deepEqual(parseRoute(url('/26/123/'), opts), { kind: 'card', edition: '26', cardId: 123 });
  assert.deepEqual(parseRoute(url('/26/0007'), opts), { kind: 'card', edition: '26', cardId: 7 });
});

test('in development the same route works as a hash under /player/', () => {
  assert.deepEqual(parseRoute(url('/player/', '', '#/26/123'), opts), { kind: 'card', edition: '26', cardId: 123 });
  assert.deepEqual(parseRoute(url('/player/index.html', '?demo=play', '#/26/45'), opts), { kind: 'card', edition: '26', cardId: 45 });
  assert.deepEqual(parseRoute(url('/player/26/123'), opts), { kind: 'card', edition: '26', cardId: 123 });
});

test('no card, an edition without a card, or a bad number is just home', () => {
  assert.deepEqual(parseRoute(url('/'), opts), { kind: 'home' });
  assert.deepEqual(parseRoute(url('/player/'), opts), { kind: 'home' });
  assert.deepEqual(parseRoute(url('/26/'), opts), { kind: 'home' });
  assert.deepEqual(parseRoute(url('/26/abc'), opts), { kind: 'home' });
  assert.deepEqual(parseRoute(url('/26/0'), opts), { kind: 'home' });
  assert.deepEqual(parseRoute(url('/26/12345'), opts), { kind: 'home' });
});

test("last year's ?c= links are recognised (one or several cards)", () => {
  assert.deepEqual(parseRoute(url('/', '?c=123'), opts), { kind: 'legacy', cardIds: [123] });
  assert.deepEqual(parseRoute(url('/', '?c=101&c=205'), opts), { kind: 'legacy', cardIds: [101, 205] });
  assert.deepEqual(legacyCardIds('?c=101,205,101'), [101, 205]);
  assert.deepEqual(legacyCardIds('?c=junk'), []);
});

test("another edition's card link is flagged, older or not", () => {
  assert.deepEqual(parseRoute(url('/25/123'), opts), { kind: 'otherEdition', edition: '25', cardId: 123, older: true });
  assert.deepEqual(parseRoute(url('/27/9'), opts), { kind: 'otherEdition', edition: '27', cardId: 9, older: false });
});

test('this year\'s path wins over a stray ?c=', () => {
  assert.deepEqual(parseRoute(url('/26/5', '?c=99'), opts), { kind: 'card', edition: '26', cardId: 5 });
});

test('after taking a link in, the address drops the card and c= but keeps dev hints', () => {
  assert.equal(homeHref(url('/26/123'), opts), '/26/');
  assert.equal(homeHref(url('/', '?c=123'), opts), '/26/');
  assert.equal(homeHref(url('/player/', '?demo=play', '#/26/123'), opts), '/player/?demo=play');
  assert.equal(homeHref(url('/player/', '?c=1&feed=relay'), opts), '/player/?feed=relay');
});

test('the app settles on this year’s home before it reads the cards, the root included (the cards’ cookie path)', () => {
  const prod = { edition: '26' };
  assert.equal(settledHref(url('/26/123'), prod), '/26/');
  assert.equal(settledHref(url('/'), prod), '/26/');
  assert.equal(settledHref(url('/index.html'), prod), '/26/');
  assert.equal(settledHref(url('/', '?c=123'), prod), '/26/');
  assert.equal(settledHref(url('/25/88'), prod), '/26/');
  assert.equal(settledHref(url('/26'), prod), '/26/');
  assert.equal(settledHref(url('/26/'), prod), null);
  assert.equal(settledHref(url('/26/', '?feed=relay'), prod), null);
  assert.equal(settledHref(url('/player/', '?demo=play'), opts), null);
  assert.equal(settledHref(url('/player/', '', '#/26/123'), opts), '/player/');
  assert.equal(homePath(url('/26/123'), prod), '/26/');
  assert.equal(homePath(url('/', '?feed=relay'), prod), '/26/');
  assert.equal(homePath(url('/player/', '?demo=play'), opts), '/player/');
});

test('review hints: the home screen\'s view, a drawer to open and demo cards', () => {
  assert.deepEqual(devHints('?open=pad&cards=123,57'), { view: null, open: 'pad', cards: [123, 57], install: null });
  assert.deepEqual(devHints('?open=horari'), { view: null, open: 'horari', cards: null, install: null });
  assert.deepEqual(devHints('?open=ajustos&view=cartrons'), { view: 'cartrons', open: 'ajustos', cards: null, install: null });
  assert.deepEqual(devHints('?view=historial'), { view: 'historial', open: null, cards: null, install: null });
  assert.deepEqual(devHints('?open=menu&tab=premis'), { view: null, open: null, cards: null, install: null }, 'the tabs and the menu are gone (no fallback, D84)');
  assert.deepEqual(devHints('?cards='), { view: null, open: null, cards: [], install: null });
  // what installing the app offers (D221), for reviewing its screens
  assert.equal(devHints('?install=steps').install, 'steps');
  assert.equal(devHints('?install=prompt&open=install').open, 'install');
  assert.equal(devHints('?install=yes').install, null);
});

test('the feed comes from the URL: demo, relay, cloud; dev on this machine or the LAN defaults to the relay', () => {
  assert.deepEqual(chooseFeed({ search: '?demo=play', hostname: 'quina.barrakudesbegur.org', dev: false }), { kind: 'demo', demo: 'play' });
  // A production build never takes the relay (it hands out the full private state), whatever the URL says.
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: 'quina.barrakudesbegur.org', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: '192.168.1.20', dev: false }), { kind: 'cloud', demo: null });
  // …except on this machine itself, when asked: the laptop running the built show (`npm start`, the e2e test).
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: '127.0.0.1', dev: false }), { kind: 'relay', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: 'localhost', dev: false }), { kind: 'relay', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: '[::1]', dev: false }), { kind: 'relay', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: 'quina.local', dev: false }), { kind: 'cloud', demo: null }, 'the LAN never');
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: '127.0.0.1.evil.example', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: 'quina.example.org', dev: true }), { kind: 'relay', demo: null });
  assert.deepEqual(chooseFeed({ search: '', hostname: 'quina.barrakudesbegur.org', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '', hostname: 'localhost', dev: true }), { kind: 'relay', demo: null });
  assert.deepEqual(chooseFeed({ search: '', hostname: 'localhost', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=cloud', hostname: 'localhost', dev: true }), { kind: 'cloud', demo: null });
  assert.equal(isLocalHost('192.168.1.20'), true);
  assert.equal(isLocalHost('quina.barrakudesbegur.org'), false);
});
