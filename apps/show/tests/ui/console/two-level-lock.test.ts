// The lock mirror (D234): who holds Parlem or Aguanta, this console or another; when the lock shows; the holder's name;
// and this console's presses from the touch screen and the Wii, told to the engine once each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCK_BUTTON, LockPresses, NO_PRESSES, WiiLockGate, heldByOther, holderName, isLockRefusal, lockedBy, wiiLockButton } from '../../../../console/logic/two-level-lock.ts';
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

test("the remote's rule is the same own-vs-other, without the screen's 300 ms wait", () => {
  const other = held('stay', 'Mobil_admin-x1y2', 1000);
  assert.equal(heldByOther(other, 'stay', own(), 1050, RULES), 'Mobil_admin-x1y2', 'at once');
  assert.equal(lockedBy(other, 'stay', own(), 1050, RULES), null, 'the padlock waits');
  assert.equal(heldByOther(held('stay', OWN, 1000), 'stay', own(), 1050, RULES), null, 'ours');
  assert.equal(heldByOther(other, 'hold', own(), 1050, RULES), null, 'the other button');
  // Through the cloud: our touch press of the same button makes it ours; a release just now too.
  const presses = new LockPresses();
  presses.press('stay', 'touch', 990);
  assert.equal(heldByOther(held('stay', 'cloud-link', 1000), 'stay', own(presses.presses), 1100, RULES), null);
  presses.release('stay', 'touch', 1200);
  assert.equal(heldByOther(held('stay', 'cloud-link', 1000), 'stay', own(presses.presses), 1500, RULES), null, 'its release on the way');
  assert.equal(heldByOther(held('stay', 'cloud-link', 1300), 'stay', own(presses.presses), 1500, RULES), 'cloud-link', 'a new hold after ours');
});

test('the remote under the lock: a key of a button held elsewhere is refused whole, the other button works', () => {
  const gate = new WiiLockGate();
  const stayHeld = (button: 'hold' | 'stay') => button === 'stay';
  assert.equal(gate.press('b', stayHeld), true, 'B: Aguanta is held elsewhere');
  assert.equal(gate.press('a', stayHeld), true, 'A with that B down would be Suspens');
  assert.equal(gate.press('minus', stayHeld), false, 'Parlem stays usable');
  assert.equal(gate.release('a'), true, 'its release does nothing');
  assert.equal(gate.release('b'), true);
  assert.equal(gate.release('minus'), false, 'a key that went through releases as usual');
  assert.equal(gate.press('a', stayHeld), false, 'A alone is the default action');
  assert.equal(gate.release('a'), false);
  // The lock ends while the key is down: it stays refused until it's let go.
  const holdHeld = (button: 'hold' | 'stay') => button === 'hold';
  assert.equal(gate.press('plus', holdHeld), true);
  assert.equal(gate.release('plus'), true);
  assert.equal(gate.press('plus', () => false), false, 'pressed again once it is free');
  // Keys of no two-level button never ask.
  assert.equal(gate.press('home', () => { throw new Error('asked'); }), false);
  assert.equal(gate.press('one', () => { throw new Error('asked'); }), false);
  gate.press('b', stayHeld);
  gate.reset();
  assert.equal(gate.release('b'), false, 'the remote went away');
});

test('the refusals the lock explains: hold, pause, suspense or the mirror itself, busy, held by another console', () => {
  const busy = (cmd: string, detail?: string) => ({ cmd, reason: 'busy' as const, detail });
  for (const cmd of ['hold', 'pause', 'suspense', 'twoLevelHold']) assert.equal(isLockRefusal(busy(cmd, 'held by Mobil_admin-x1y2')), true, cmd);
  assert.equal(isLockRefusal(busy('hold')), false, 'busy for another reason');
  assert.equal(isLockRefusal(busy('endGame', 'held by x')), false);
  assert.equal(isLockRefusal({ cmd: 'hold', reason: 'wrongScene', detail: 'held by x' }), false);
  assert.equal(isLockRefusal({ cmd: null, reason: 'busy', detail: 'held by x' }), false);
});

test("a press the engine refused (another console's came first) isn't ours: the lock shows, and its let-go leaves no echo", () => {
  const presses = new LockPresses();
  presses.press('stay', 'touch', 1000);
  const other = held('stay', 'cloud-link', 990);
  assert.equal(lockedBy(other, 'stay', own(presses.presses), 1400, RULES), null, 'within the race, taken for ours');
  presses.lose('stay');
  assert.equal(presses.presses.holding.has('stay'), false);
  assert.equal(lockedBy(other, 'stay', own(presses.presses), 1400, RULES), 'cloud-link', 'the lock shows at once');
  assert.deepEqual(presses.release('stay', 'touch', 1500), { button: 'stay', on: false }, 'the mirror still hears the let-go');
  assert.equal(presses.presses.releasedAtMs.stay, undefined, 'no echo');
  assert.equal(lockedBy(other, 'stay', own(presses.presses), 1600, RULES), 'cloud-link');
  // A new press is ours again; losing one that isn't pressed does nothing.
  presses.press('stay', 'wii-b', 2000);
  assert.equal(presses.presses.holding.get('stay'), 2000);
  presses.lose('hold');
  assert.equal(presses.presses.holding.size, 1);
});

test('the remote: a press refused late by the engine refuses the rest of it', () => {
  const gate = new WiiLockGate();
  gate.refuse('b');
  assert.equal(gate.press('a', () => false), true, 'A while that B is down would be Suspens');
  assert.equal(gate.release('a'), true);
  assert.equal(gate.release('b'), true, 'its let-go does nothing');
  assert.equal(gate.press('a', () => false), false);
});
