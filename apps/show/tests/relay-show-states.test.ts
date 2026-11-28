// The relay keeps each show page's state by socket (relay/show-states.ts, whats-left 1.7): while two are connected the
// consoles hear the latest sender's, as before; when one closes they get the other's at once (or it is asked to resend),
// and with none left a console's hello hears no state, never a closed page's. The rules as a pure class, then a
// spawned relay (the verify's sequence: the real page clicked, a stale second one opened, then closed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, type ShowState } from '@quina/protocol';
import { ShowStates } from '../relay/show-states.ts';
import { peer, startRelay, type Peer } from './support/relay.ts';

/** A show state as far as the relay goes: it never reads one, it only keeps and forwards it. */
const state = (page: string, status: 'idle' | 'locked') => ({ v: PROTOCOL_VERSION, type: 'state', status, page }) as unknown as ShowState;
const pageOf = (s: ShowState | null) => (s as unknown as { page?: string } | null)?.page ?? null;

test('ShowStates: the latest sender is current; a closed page takes its state with it', () => {
  const states = new ShowStates<string>();
  assert.equal(states.current(), null);
  states.connected('a');
  assert.equal(states.current(), null, 'no state before its first');
  states.sent('a', state('a', 'idle'));
  states.connected('b');
  assert.equal(pageOf(states.current()), 'a', "a page that hasn't sent yet changes nothing");
  states.sent('b', state('b', 'locked'));
  assert.equal(pageOf(states.current()), 'b', 'two pages: the latest sender, as before');
  const left = states.left('b');
  assert.equal(left.kind, 'replay');
  assert.equal(left.kind === 'replay' && pageOf(left.state), 'a', "the other page's state, at once");
  assert.equal(pageOf(states.current()), 'a');
  assert.deepEqual(states.left('a'), { kind: 'gone' });
  assert.equal(states.current(), null, 'none left: no state');
});

test('ShowStates: a page that was not current leaves nothing to do; a page with no state yet is asked', () => {
  const states = new ShowStates<string>();
  states.connected('a');
  states.sent('a', state('a', 'idle'));
  states.connected('b');
  states.sent('b', state('b', 'locked'));
  states.sent('a', state('a', 'idle'));
  assert.deepEqual(states.left('b'), { kind: 'none' }, "the consoles already hear a's");
  assert.equal(pageOf(states.current()), 'a');
  states.connected('c');
  assert.deepEqual(states.left('a'), { kind: 'ask', pages: ['c'] }, 'c has sent nothing: ask it');
  assert.equal(states.current(), null, "no state until c's answer");
  states.sent('c', state('c', 'idle'));
  assert.equal(pageOf(states.current()), 'c');
  assert.deepEqual(states.left('nobody'), { kind: 'none' }, 'a socket that was never a show page');
});

test('ShowStates: of several pages left, the one that sent last', () => {
  const states = new ShowStates<string>();
  for (const page of ['a', 'b', 'c']) states.connected(page);
  states.sent('b', state('b', 'idle'));
  states.sent('a', state('a', 'idle'));
  states.sent('c', state('c', 'locked'));
  const left = states.left('c');
  assert.equal(left.kind === 'replay' && pageOf(left.state), 'a');
});

/** The states `p` heard, by page. */
const statesHeard = (p: Peer) => p.heard.filter((m) => m.type === 'state').map((m) => m.page);
/** `predicate`, only for what `p` hears from now on. */
const fromNow = (p: Peer, predicate: (m: Record<string, unknown>) => boolean) => {
  const start = p.heard.length;
  return (m: Record<string, unknown>) => p.heard.indexOf(m) >= start && predicate(m);
};

test("a spawned relay: a stale second show page closed, the consoles get the real page's state at once, and none after the last", async () => {
  const relay = await startRelay([]);
  const peers: Peer[] = [];
  try {
    const real = await peer(relay.ws, 'show', 'show-real');
    peers.push(real);
    real.send(state('real', 'idle') as unknown as Record<string, unknown>);
    const tablet = await peer(relay.ws, 'tablet', 'tablet-1');
    peers.push(tablet);
    await tablet.hears((m) => m.type === 'state' && m.page === 'real', "the real page's state on hello");

    const stale = await peer(relay.ws, 'show', 'show-stale');
    peers.push(stale);
    stale.send(state('stale', 'locked') as unknown as Record<string, unknown>);
    await tablet.hears((m) => m.type === 'state' && m.page === 'stale', "the stale page's state (unchanged while both are open)");

    const shows = (m: Record<string, unknown>) => Array.isArray(m.clients) ? m.clients.filter((c) => (c as { role?: string }).role === 'show').length : -1;
    const closed = fromNow(tablet, (m) => m.type === 'relay.clients' && shows(m) === 1);
    stale.close();
    await tablet.hears(closed, 'one show page in relay.clients after the close');
    assert.deepEqual(statesHeard(tablet), ['real', 'stale', 'real'], "the real page's state again, before the client list");
    assert.equal(real.heard.some((m) => m.type === 'cmd'), false, 'the relay held its state: no need to ask');

    const late = await peer(relay.ws, 'admin', 'preflight');
    peers.push(late);
    await late.hears((m) => m.type === 'relay.mode', 'relay.mode');
    assert.deepEqual(statesHeard(late), ['real'], "a hello after the close hears the real page's, never the closed one's");

    const none = fromNow(tablet, (m) => m.type === 'relay.clients' && shows(m) === 0);
    real.close();
    await tablet.hears(none, 'no show page in relay.clients');
    const after = await peer(relay.ws, 'tablet', 'tablet-2');
    peers.push(after);
    await after.hears((m) => m.type === 'relay.mode', 'relay.mode');
    assert.deepEqual(statesHeard(after), [], 'none left: no state on hello');
  } finally {
    for (const p of peers) p.close();
    await relay.stop();
  }
});

test('a spawned relay: the current page closed and the other has sent no state yet: it is asked (getState)', async () => {
  const relay = await startRelay([]);
  const peers: Peer[] = [];
  try {
    const first = await peer(relay.ws, 'show', 'show-1');
    peers.push(first);
    first.send(state('first', 'idle') as unknown as Record<string, unknown>);
    const tablet = await peer(relay.ws, 'tablet', 'tablet-1');
    peers.push(tablet);
    await tablet.hears((m) => m.type === 'state' && m.page === 'first', "the first page's state");
    const second = await peer(relay.ws, 'show', 'show-2');
    peers.push(second);
    await second.hears((m) => m.type === 'relay.mode', 'relay.mode');
    first.close();
    const ask = await second.hears((m) => m.type === 'cmd', 'a command');
    assert.equal(ask.cmd, 'getState');
    assert.equal(ask.v, PROTOCOL_VERSION);
    second.send(state('second', 'idle') as unknown as Record<string, unknown>);
    await tablet.hears((m) => m.type === 'state' && m.page === 'second', "the second page's answer");
  } finally {
    for (const p of peers) p.close();
    await relay.stop();
  }
});
