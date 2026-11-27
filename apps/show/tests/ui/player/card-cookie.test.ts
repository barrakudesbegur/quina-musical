// The card list's copy in a cookie (D221): an iPhone's Home Screen app starts with empty localStorage but a copy of
// the cookies, and restores the cards from it. logic/card-cookie.ts and PlayerStorage.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAYER_CONFIG } from '../../../../player/config.ts';
import { CARD_COOKIE, CARD_COOKIE_MAX, cardCookieClear, cardCookieValue, cardCookieWrite, readCardCookie } from '../../../../player/logic/card-cookie.ts';
import { MemoryStorage, PlayerStorage, addCard, emptyData, renameCard, type CookieJarLike, type PlayerData } from '../../../../player/logic/storage.ts';

/** A browser's cookie jar, as document.cookie behaves: each assignment sets or (Max-Age=0) deletes one cookie. */
class FakeJar implements CookieJarLike {
  readonly jar = new Map<string, string>();
  readonly writes: string[] = [];
  readonly secure = true;
  readonly path = '/26/';
  readable = true;
  read(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  write(assignment: string): void {
    this.writes.push(assignment);
    const [pair, ...attrs] = assignment.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    if (attrs.includes('Max-Age=0')) this.jar.delete(name);
    else this.jar.set(name, pair.slice(eq + 1));
  }
}

const cards = (data: PlayerData, ...ids: number[]) =>
  ids.reduce((d, id) => {
    const r = addCard(d, id, 1000);
    assert.ok(r.ok);
    return r.data;
  }, data);

test('the value keeps each card’s number, icon and name, compactly', () => {
  assert.equal(cardCookieValue('26', [{ id: 123, color: 3, name: 'Àvia' }, { id: 57, color: 1, name: null }]), '1~26~123.3.%C3%80via~57.1.');
  assert.equal(cardCookieValue('26', []), '1~26');
});

test('it reads back what it wrote, any name included (dots, tildes, semicolons, emoji)', () => {
  const list = [
    { id: 1, color: 1, name: 'a.b~c; d=e, "f"' },
    { id: 4000, color: 10, name: 'Tieta 🎵' },
    { id: 88, color: 2, name: null },
  ];
  const value = cardCookieValue('26', list);
  assert.doesNotMatch(value, /[;,\s"]/);
  assert.deepEqual(readCardCookie(`other=1; ${CARD_COOKIE}=${value}; x=y`, '26'), list);
});

test('none, another edition’s, another format or a broken one reads as nothing; bad cards are skipped', () => {
  assert.equal(readCardCookie('', '26'), null);
  assert.equal(readCardCookie('a=1; b=2', '26'), null);
  assert.equal(readCardCookie(`${CARD_COOKIE}=1~25~123.3.`, '26'), null);
  assert.equal(readCardCookie(`${CARD_COOKIE}=9~26~123.3.`, '26'), null);
  assert.deepEqual(readCardCookie(`${CARD_COOKIE}=1~26~0.1.~99999.1.~abc.2.~12.2.%E0%A4%A~12.5.x~7`, '26'), [
    { id: 12, color: 2, name: null },
    { id: 7, color: 0, name: null },
  ]);
});

test('a long list stays under the size a browser keeps: the last names go first, never a number while it fits', () => {
  const long = Array.from({ length: PLAYER_CONFIG.maxCards }, (_, i) => ({ id: 1000 + i, color: (i % 10) + 1, name: 'Àèìòú'.repeat(4) }));
  const value = cardCookieValue('26', long);
  assert.ok(value.length <= CARD_COOKIE_MAX, String(value.length));
  const back = readCardCookie(`${CARD_COOKIE}=${value}`, '26');
  assert.equal(back?.length, PLAYER_CONFIG.maxCards);
  assert.equal(back?.[0].name, 'Àèìòú'.repeat(4));
  assert.equal(back?.at(-1)?.name, null);
});

test('the cookie: only the app’s own pages (/26/), a year and more, never sent from another site, Secure on https', () => {
  const scope = { path: '/26/', secure: true };
  assert.equal(cardCookieWrite('26', [{ id: 5, color: 1, name: null }], scope), `${CARD_COOKIE}=1~26~5.1.; Max-Age=34560000; Path=/26/; SameSite=Strict; Secure`);
  assert.doesNotMatch(cardCookieWrite('26', [], { path: '/player/', secure: false }), /Secure/);
  assert.equal(cardCookieClear(scope), `${CARD_COOKIE}=; Max-Age=0; Path=/26/; SameSite=Strict; Secure`);
});

test('every save copies the card list into the cookie', () => {
  const jar = new FakeJar();
  const storage = new PlayerStorage(new MemoryStorage(), 'k', jar);
  storage.save(renameCard(cards(emptyData('26'), 123, 57), 123, 'Àvia'));
  assert.deepEqual(readCardCookie(jar.read(), '26'), [
    { id: 123, color: 1, name: 'Àvia' },
    { id: 57, color: 2, name: null },
  ]);
});

test('an iPhone’s Home Screen app: empty localStorage, the copied cookie → the cards come back, and are saved', () => {
  const browser = new FakeJar();
  new PlayerStorage(new MemoryStorage(), 'k', browser).save(renameCard(cards(emptyData('26'), 123, 57), 57, 'Tieta'));
  // Added to the Home Screen: its own empty storage, the browser's cookies copied once.
  const app = new FakeJar();
  for (const [k, v] of browser.jar) app.jar.set(k, v);
  const local = new MemoryStorage();
  const { data, outcome } = new PlayerStorage(local, 'k', app).load('26', 5000);
  assert.equal(outcome, 'restored');
  assert.deepEqual(
    data.cards.map((c) => [c.id, c.color, c.name]),
    [
      [123, 1, null],
      [57, 2, 'Tieta'],
    ],
  );
  assert.ok(local.getItem('k')?.includes('"Tieta"'));
  // the next open reads localStorage as usual
  assert.equal(new PlayerStorage(local, 'k', app).load('26').outcome, 'kept');
});

test('the cookie never overrides data the app already has, even an empty list (the cards were removed)', () => {
  const jar = new FakeJar();
  jar.write(cardCookieWrite('26', [{ id: 9, color: 1, name: null }], { path: '/26/', secure: true }));
  const local = new MemoryStorage();
  local.setItem('k', JSON.stringify(emptyData('26')));
  const { data, outcome } = new PlayerStorage(local, 'k', jar).load('26');
  assert.equal(outcome, 'kept');
  assert.deepEqual(data.cards, []);
  // …and the copy follows the app's data
  assert.deepEqual(readCardCookie(jar.read(), '26'), []);
});

test('another edition’s cookie restores nothing', () => {
  const jar = new FakeJar();
  jar.write(cardCookieWrite('25', [{ id: 9, color: 1, name: null }], { path: '/26/', secure: true }));
  assert.equal(new PlayerStorage(new MemoryStorage(), 'k', jar).load('26').outcome, 'fresh');
});

test('"Esborrar dades" forgets the cookie too, so nothing comes back', () => {
  const jar = new FakeJar();
  const local = new MemoryStorage();
  const storage = new PlayerStorage(local, 'k', jar);
  storage.save(cards(emptyData('26'), 1, 2));
  storage.clear();
  assert.equal(jar.read(), '');
  assert.equal(new PlayerStorage(new MemoryStorage(), 'k', jar).load('26').outcome, 'fresh');
});

test('cookies that throw (a sandboxed page) never stop the storage', () => {
  const broken: CookieJarLike = {
    secure: true,
    path: '/26/',
    readable: true,
    read: () => {
      throw new Error('denied');
    },
    write: () => {
      throw new Error('denied');
    },
  };
  const local = new MemoryStorage();
  const storage = new PlayerStorage(local, 'k', broken);
  assert.equal(storage.load('26').outcome, 'fresh');
  assert.ok(storage.save(cards(emptyData('26'), 3)));
  assert.doesNotThrow(() => storage.clear());
});

test('a page loaded outside the cookie’s path (the root) writes the cards, but never an empty list over a copy it can’t see', () => {
  const jar = new FakeJar();
  jar.write(cardCookieWrite('26', [{ id: 9, color: 1, name: null }], { path: '/26/', secure: true }));
  jar.readable = false;
  const storage = new PlayerStorage(new MemoryStorage(), 'k', jar);
  storage.save(emptyData('26'));
  assert.deepEqual(readCardCookie(jar.read(), '26'), [{ id: 9, color: 1, name: null }]);
  storage.save(cards(emptyData('26'), 4));
  assert.deepEqual(readCardCookie(jar.read(), '26')?.map((c) => c.id), [4]);
  // "Esborrar dades" still forgets it
  storage.clear();
  assert.equal(jar.read(), '');
});
