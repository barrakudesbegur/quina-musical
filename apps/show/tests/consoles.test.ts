// Several consoles at once (D234): the presenters' tablet, the tech's laptop, a Wii's console. Adding sold cards
// merges, so two consoles adding at the same moment keep both; a two-level button held on one shows locked on the
// others (the lock mirror), the relay saying which console sent each command.
import nodeTest from 'node:test';
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { checkCommand, formatCardRanges, makeCommand, parseCardRanges, replayJournal, stampCommandFrom, type CommandFields, type JournalEntry } from '@quina/protocol';
import { TWO_LEVEL, SUSPENSE } from '../engine/src/config.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { allCards, setup } from './support/harness.ts';

const rejected = (effects: readonly Effect[]) => effects.filter((e) => e.type === 'reject').map((e) => e.reason);
const rejection = (effects: readonly Effect[]) => effects.find((e) => e.type === 'reject');
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const cardsOf = (h: ReturnType<typeof setup>) => h.show.snapshot().cards;

nodeTest('formatCardRanges writes sorted ids back as ranges that parseCardRanges reads the same', () => {
  assert.equal(formatCardRanges([1, 2, 3, 7, 9, 10]), '1-3, 7, 9-10');
  assert.equal(formatCardRanges([]), '');
  const ids = parseCardRanges('400-450, 1-100, 452 460');
  assert.deepEqual(parseCardRanges(formatCardRanges(ids)), ids);
});

test('D234: addCardsInPlay merges into the cards in play; two adds in a row keep both', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  h.send('addCardsInPlay', { ranges: '400-450' });
  // The second console's add, sent before it saw the first one's: both stay.
  h.send('addCardsInPlay', { ranges: '452, 460' });
  assert.equal(cardsOf(h).inPlay, '1-100, 400-450, 452, 460');
  assert.equal(cardsOf(h).inPlayCount, 100 + 51 + 2);
  assert.deepEqual(h.show.cardsInPlay, parseCardRanges('1-100, 400-450, 452, 460'));
});

test('D234: addCardsInPlay refuses numbers that aren’t printed, whole, and nothing changes', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  const max = Math.max(...allCards.map((c) => c.id));
  const out = h.send('addCardsInPlay', { ranges: `200, ${max + 1}-${max + 3}` });
  assert.deepEqual(rejected(out), ['invalid']);
  assert.equal(rejection(out)?.type === 'reject' && rejection(out)?.detail, `${max + 1}-${max + 3}`, 'the unprinted numbers, as ranges');
  assert.deepEqual(journalOf(out), []);
  assert.equal(cardsOf(h).inPlay, '1-100');
  assert.deepEqual(rejected(h.send('addCardsInPlay', { ranges: '12a' })), ['invalid'], 'not a range');
  assert.deepEqual(rejected(h.dispatch({ v: 1, type: 'cmd', cmd: 'addCardsInPlay', reqId: 'r', ranges: '' })), ['invalid'], 'empty');
  assert.deepEqual(rejected(h.send('addCardsInPlay', { ranges: ' , ' })), ['invalid'], 'no numbers');
  assert.equal(cardsOf(h).lastAdd, null);
});

test('D234: addCardsInPlay reports the numbers already in play in the state, for the console that sent it', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  const add = makeCommand('addCardsInPlay', { ranges: '95-105' });
  h.dispatch(add);
  assert.deepEqual(cardsOf(h).lastAdd, { reqId: add.reqId, added: '101-105', alreadyIn: '95-100' });
  // Everything in already (another console added them a moment before): nothing changes, nothing journaled.
  const again = makeCommand('addCardsInPlay', { ranges: '101-105' });
  const out = h.dispatch(again);
  assert.deepEqual(rejected(out), []);
  assert.deepEqual(journalOf(out), []);
  assert.deepEqual(cardsOf(h).lastAdd, { reqId: again.reqId, added: '', alreadyIn: '101-105' });
  assert.equal(cardsOf(h).inPlay, '1-105');
});

test('D234: addCardsInPlay is journaled as cards.set with the merged list, as setCardsInPlay is, and replays', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  const [added] = journalOf(h.send('addCardsInPlay', { ranges: '400-450' })).filter((e) => e.kind === 'cards.set');
  const [set] = journalOf(h.send('setCardsInPlay', { ranges: '1-100, 400-450' })).filter((e) => e.kind === 'cards.set');
  const shape = (e: JournalEntry) => Object.keys(e).sort();
  assert.deepEqual(shape(added), shape(set));
  assert.deepEqual([added.kind === 'cards.set' && added.ranges, set.kind === 'cards.set' && set.ranges], ['1-100, 400-450', '1-100, 400-450']);
  h.send('addCardsInPlay', { ranges: '460' });
  const record = replayJournal(journalOf(h.log));
  assert.equal(record.cardsInPlay, '1-100, 400-450, 460');
  assert.equal(setup({ seed: 4, cards: allCards, restore: record }).show.snapshot().cards.inPlay, '1-100, 400-450, 460');
});

// ---- the lock mirror ------------------------------------------------------------------------------------------
const TABLET = 'tauleta-a1b2c';
const LAPTOP = 'portatil-x9y8z';
/** A two-level press or release from a console, as the relay forwards it (its `from`). */
const twoLevel = (h: ReturnType<typeof setup>, from: string | null, fields: CommandFields['twoLevelHold']) =>
  h.dispatch({ ...makeCommand('twoLevelHold', fields), ...(from ? { from } : {}) });
const heldOf = (h: ReturnType<typeof setup>) => h.show.snapshot().twoLevelHeld;

test('D234: a console holds a two-level button and lets it go; the state says which and who; not journaled', () => {
  const h = setup({ seed: 3 });
  h.send('unlock');
  assert.equal(heldOf(h), null);
  const press = twoLevel(h, TABLET, { button: 'hold', on: true });
  assert.deepEqual(heldOf(h), { button: 'hold', clientId: TABLET, label: TABLET, sinceMs: h.env.nowMs() });
  assert.ok(press.some((e) => e.type === 'emit' && e.message.type === 'state'), 'the consoles hear it');
  const release = twoLevel(h, TABLET, { button: 'hold', on: false });
  assert.equal(heldOf(h), null);
  assert.deepEqual([...journalOf(press), ...journalOf(release)], []);
  // Aguanta's, the same.
  twoLevel(h, LAPTOP, { button: 'stay', on: true });
  assert.equal(heldOf(h)?.button, 'stay');
});

test('D234: while one console holds, another’s press is refused busy and its release ignored; the first keeps it', () => {
  const h = setup({ seed: 3 });
  h.send('unlock');
  twoLevel(h, TABLET, { button: 'hold', on: true });
  assert.deepEqual(rejected(twoLevel(h, LAPTOP, { button: 'stay', on: true })), ['busy']);
  assert.deepEqual(rejected(twoLevel(h, LAPTOP, { button: 'hold', on: true })), ['busy']);
  assert.equal(heldOf(h)?.clientId, TABLET);
  assert.deepEqual(rejected(twoLevel(h, LAPTOP, { button: 'hold', on: false })), [], 'ignored, silently');
  assert.equal(heldOf(h)?.clientId, TABLET);
  twoLevel(h, TABLET, { button: 'stay', on: false });
  assert.equal(heldOf(h)?.button, 'hold', 'the release of the other button is not this one’s');
  twoLevel(h, TABLET, { button: 'hold', on: false });
  assert.equal(heldOf(h), null);
  assert.deepEqual(rejected(twoLevel(h, LAPTOP, { button: 'hold', on: true })), [], 'free again');
});

test('D234: the holder disconnecting lets the button go; another console leaving does not', () => {
  const h = setup({ seed: 3 });
  h.send('unlock');
  twoLevel(h, TABLET, { button: 'stay', on: true });
  h.show.clientsChanged(['show-1', TABLET]);
  assert.equal(heldOf(h)?.clientId, TABLET, 'still connected');
  const gone = h.show.clientsChanged(['show-1', LAPTOP]);
  assert.equal(heldOf(h), null);
  assert.ok(gone.some((e) => e.type === 'emit' && e.message.type === 'state'));
  // The show page's own command (no `from`) is never in the relay's list: only the timeout or its release clear it.
  twoLevel(h, null, { button: 'hold', on: true });
  h.show.clientsChanged(['show-1']);
  assert.equal(heldOf(h)?.clientId, 'local');
});

test('D234: a lost release clears by itself after the timeout; Aguanta’s outlasts the Suspense it may escalate to', () => {
  const h = setup({ seed: 3 });
  h.send('unlock');
  twoLevel(h, TABLET, { button: 'hold', on: true });
  h.advance(TWO_LEVEL.timeoutSec.hold - 0.5);
  assert.equal(heldOf(h)?.clientId, TABLET);
  const out = h.advance(1);
  assert.equal(heldOf(h), null);
  assert.ok(out.some((e) => e.type === 'emit' && e.message.type === 'state' && e.message.twoLevelHeld === null));
  twoLevel(h, TABLET, { button: 'stay', on: true });
  h.advance(SUSPENSE.autoReleaseSec + 1);
  assert.equal(heldOf(h)?.button, 'stay', 'held through a whole Suspens');
  h.advance(TWO_LEVEL.timeoutSec.stay - SUSPENSE.autoReleaseSec);
  assert.equal(heldOf(h), null);
});

test('D234: the release goes through in any scene, Pausa included (Parlem’s press escalates to it)', () => {
  const h = setup({ seed: 3 });
  h.send('unlock');
  twoLevel(h, TABLET, { button: 'hold', on: true });
  h.send('pause', { on: true });
  assert.deepEqual(rejected(twoLevel(h, TABLET, { button: 'hold', on: false })), []);
  assert.equal(heldOf(h), null);
});

nodeTest('D234: the relay stamps the sender on every command, over any `from` the sender set; the engine checks it', () => {
  const forged: Record<string, unknown> = { ...makeCommand('twoLevelHold', { button: 'hold', on: true }), from: LAPTOP };
  stampCommandFrom(forged, TABLET);
  assert.equal(forged.from, TABLET);
  const anonymous: Record<string, unknown> = { ...makeCommand('next'), from: LAPTOP };
  stampCommandFrom(anonymous, '');
  assert.equal('from' in anonymous, false, 'no clientId: none');
  assert.ok(checkCommand(forged).ok);
  assert.ok(checkCommand(anonymous).ok);
  assert.equal(checkCommand({ ...makeCommand('next'), from: 7 }).ok, false);
  assert.equal(checkCommand({ ...makeCommand('next'), from: '' }).ok, false);
  assert.equal(checkCommand({ ...makeCommand('twoLevelHold', { button: 'hold', on: true }), button: 'next' }).ok, false);
});
