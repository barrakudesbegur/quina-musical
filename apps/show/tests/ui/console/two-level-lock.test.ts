// The lock mirror (D234): who holds Parlem or Aguanta, this console or another; when the lock shows; the holder's name;
// and this console's presses from the touch screen and the Wii, told to the engine once each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCK_BUTTON, LockPresses, NO_PRESSES, holderName, lockedBy, wiiLockButton } from '../../../../console/logic/two-level-lock.ts';
import { CONSOLE } from '../../../../console/config.ts';

const OWN = 'Tauleta-3f2a';
const RULES = { afterMs: 300, raceMs: 250, echoMs: 1500 };
const held = (button: 'hold' | 'stay', clientId: string, sinceMs = 0) => ({ button, clientId, label: clientId, sinceMs });
const own = (presses = NO_PRESSES) => ({ clientId: OWN, presses });

test('a button held on another console is locked here, by its label; ours, the other button or none is not', () => {
  assert.equal(lockedBy(held('stay', 'Mobil_admin-x1y2'), 'stay', own(), 1000, RULES), 'Mobil_admin-x1y2');
  assert.equal(lockedBy(held('stay', 'Mobil_admin-x1y2'), 'hold', own(), 1000, RULES), null, 'only that button');
  assert.equal(lockedBy(held('stay', OWN), 'stay', own(), 1000, RULES), null, 'our own hold');
  assert.equal(lockedBy(null, 'stay', own(), 1000, RULES), null);
  assert.equal(lockedBy(undefined, 'hold', own(), 1000, RULES), null, 'an older engine');
});

test('a press elsewhere shows as a lock only once it has lasted a moment: a tap never flashes it', () => {
  assert.equal(lockedBy(held('hold', 'Mobil_admin-x1y2', 1000), 'hold', own(), 1200, RULES), null);
  assert.equal(lockedBy(held('hold', 'Mobil_admin-x1y2', 1000), 'hold', own(), 1300, RULES), 'Mobil_admin-x1y2');
});

test("through the cloud (one clientId for every console): our own press and its release on the way aren't a lock", () => {
  const link = 'cloud-link';
  const presses = new LockPresses();
  presses.press('hold', 'touch', 980);
  assert.equal(lockedBy(held('hold', link, 1000), 'hold', own(presses.presses), 5000, RULES), null, 'pressing it here');
  presses.release('hold', 'touch', 5000);
  assert.equal(lockedBy(held('hold', link, 1000), 'hold', own(presses.presses), 5400, RULES), null, 'just let go');
  assert.equal(lockedBy(held('hold', link, 1000), 'hold', own(presses.presses), 6600, RULES), link, 'a lost release is a lock again');
  // Another console's new press after our release locks it at once (past the tap's moment).
  assert.equal(lockedBy(held('hold', link, 5200), 'hold', own(presses.presses), 5600, RULES), link);
});

test("a hold that started well before this console's own press is another's: locked, and the press drops", () => {
  const presses = new LockPresses();
  presses.press('stay', 'touch', 2000);
  assert.equal(lockedBy(held('stay', 'Mobil_admin-x1y2', 1000), 'stay', own(presses.presses), 2100, RULES), 'Mobil_admin-x1y2', 'by its clientId');
  // Through the cloud: a hold 600 ms before our press isn't ours; one from about our press's moment is.
  assert.equal(lockedBy(held('stay', 'cloud-link', 1400), 'stay', own(presses.presses), 2100, RULES), 'cloud-link');
  assert.equal(lockedBy(held('stay', 'cloud-link', 1900), 'stay', own(presses.presses), 2400, RULES), null, 'our own, the clocks a little apart');
});

test('presses from the touch screen and the Wii are one hold: the engine hears the first press and the last let-go', () => {
  const presses = new LockPresses();
  assert.deepEqual(presses.press('stay', 'touch', 0), { button: 'stay', on: true });
  assert.equal(presses.press('stay', 'wii-b', 5), null, 'already held');
  assert.equal(presses.presses.holding.get('stay'), 0, 'from the first press');
  assert.equal(presses.release('stay', 'touch', 10), null, 'B still down');
  assert.deepEqual([...presses.presses.holding.keys()], ['stay']);
  assert.deepEqual(presses.release('stay', 'wii-b', 20), { button: 'stay', on: false });
  assert.equal(presses.presses.holding.size, 0);
  assert.equal(presses.presses.releasedAtMs.stay, 20);
  assert.equal(presses.release('stay', 'wii-b', 30), null, 'a second release sends nothing');
  // − and + together are Parlem's one hold.
  presses.press('hold', 'wii-minus', 30);
  presses.press('hold', 'wii-plus', 31);
  assert.equal(presses.release('hold', 'wii-minus', 40), null);
  assert.deepEqual(presses.release('hold', 'wii-plus', 50), { button: 'hold', on: false });
});

test('the remote going away lets go of what its keys held', () => {
  const presses = new LockPresses();
  presses.press('stay', 'wii-b', 1);
  presses.press('hold', 'touch', 2);
  assert.deepEqual(presses.releaseAll('wii-b', 7), [{ button: 'stay', on: false }]);
  assert.deepEqual([...presses.presses.holding.keys()], ['hold'], 'the finger on Parlem still holds');
});

test("the Wii's keys: B is Aguanta's, − and + Parlem's; each mode has its button", () => {
  assert.equal(wiiLockButton('b'), 'stay');
  assert.equal(wiiLockButton('minus'), 'hold');
  assert.equal(wiiLockButton('plus'), 'hold');
  assert.equal(wiiLockButton('a'), null);
  assert.equal(wiiLockButton('one'), null);
  assert.deepEqual(LOCK_BUTTON, { talk: 'hold', stay: 'stay' });
});

test("the holder's name: its device label, accents back for the presets; none for a console with no label", () => {
  const presets = CONSOLE.labelPresets;
  assert.equal(holderName('Mobil_admin-x1y2', presets), 'Mòbil admin');
  assert.equal(holderName('Tauleta-3f2a', presets), 'Tauleta');
  assert.equal(holderName('Portatil_tecnic-9z', presets), 'Portatil tecnic');
  assert.equal(holderName('tablet-ab12c', presets), null, "the Bus's default");
  assert.equal(holderName('local', presets), null, "the show page's own");
  assert.equal(holderName('', presets), null);
});
