// Opening the player app: this year's card links (path and dev hash), last year's ?c= links, other editions,
// the address after a link is taken in, the review hints, and which feed the URL picks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devHints, homeHref, legacyCardIds, parseRoute } from '../../../../player/logic/router.ts';
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

test('review hints: tab, dialog and demo cards', () => {
  assert.deepEqual(devHints('?tab=premis&open=pad&cards=123,57'), { tab: 'premis', open: 'pad', cards: [123, 57] });
  assert.deepEqual(devHints('?tab=nope&open=x'), { tab: null, open: null, cards: null });
  assert.deepEqual(devHints('?cards='), { tab: null, open: null, cards: [] });
});

test('the feed comes from the URL: demo, relay, cloud; dev on this machine or the LAN defaults to the relay', () => {
  assert.deepEqual(chooseFeed({ search: '?demo=play', hostname: 'quina.barrakudesbegur.org', dev: false }), { kind: 'demo', demo: 'play' });
  // A production build never takes the relay (it hands out the full private state), whatever the URL says.
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: 'quina.barrakudesbegur.org', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: '192.168.1.20', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=relay', hostname: 'quina.example.org', dev: true }), { kind: 'relay', demo: null });
  assert.deepEqual(chooseFeed({ search: '', hostname: 'quina.barrakudesbegur.org', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '', hostname: 'localhost', dev: true }), { kind: 'relay', demo: null });
  assert.deepEqual(chooseFeed({ search: '', hostname: 'localhost', dev: false }), { kind: 'cloud', demo: null });
  assert.deepEqual(chooseFeed({ search: '?feed=cloud', hostname: 'localhost', dev: true }), { kind: 'cloud', demo: null });
  assert.equal(isLocalHost('192.168.1.20'), true);
  assert.equal(isLocalHost('quina.barrakudesbegur.org'), false);
});
