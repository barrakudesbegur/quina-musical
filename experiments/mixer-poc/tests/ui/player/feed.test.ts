// The phone's feed path: FeedFollower over the contract's followFeed (snapshot, deltas, gap → resync, clock
// offset), the full-jitter backoff, and CloudFeed driven by a fake socket (URL, gap reconnect, retries,
// coming back to the foreground).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Backoff, resumeDelayMs } from '../../../player/feed/backoff.ts';
import { CloudFeed, cloudFeedUrl, defaultFeedBase, type SocketLike, type Timers, type VisibilitySource } from '../../../player/feed/cloud-feed.ts';
import type { FeedUpdate } from '../../../player/feed/feed.ts';
import { FeedFollower } from '../../../player/feed/follow.ts';
import { emptyPublicState, PUBLIC_FEED, type PublicChange, type PublicDelta, type PublicSnapshot } from '../../../player/feed/public.ts';

const snapshot = (seq: number, nowMs = 10_000): PublicSnapshot => ({ v: 1, type: 'public.state', seq, nowMs, state: { ...emptyPublicState('26'), gameId: 'g' } });
const delta = (seq: number, changes: PublicChange[], nowMs = 10_000): PublicDelta => ({ v: 1, type: 'public.delta', seq, nowMs, changes });
const round = { number: 1, kind: 'normal' as const, startedAtMs: 0, lineConfirmed: false, ended: false, landings: [] };

test('a snapshot, then deltas in order, build the state', () => {
  const f = new FeedFollower();
  assert.equal(f.receive(snapshot(5), 0), 'ok');
  assert.equal(f.receive(delta(6, [{ kind: 'round', round }]), 0), 'ok');
  assert.equal(f.receive(delta(7, [{ kind: 'landed', round: 1, landing: { position: 0, songId: 42, atMs: 1 } }, { kind: 'spin', spin: null }]), 0), 'ok');
  assert.deepEqual(f.state?.rounds[0].landings, [{ position: 0, songId: 42, atMs: 1 }]);
  assert.equal(f.view?.seq, 7);
});

test('a seq gap, or a delta before any snapshot, asks for a resync and changes nothing', () => {
  const f = new FeedFollower();
  assert.equal(f.receive(delta(1, []), 0), 'resync');
  assert.equal(f.state, null);
  f.receive(snapshot(5), 0);
  assert.equal(f.receive(delta(7, [{ kind: 'round', round }]), 0), 'resync');
  assert.equal(f.view?.seq, 5);
  assert.deepEqual(f.state?.rounds, []);
});

test('anything else is ignored: bad JSON, other versions, unknown types', () => {
  const f = new FeedFollower();
  assert.equal(f.receiveText('{nope', 0), 'ignore');
  assert.equal(f.receive({ ...snapshot(1), v: 2 }, 0), 'ignore');
  assert.equal(f.receive({ v: 1, type: 'public.other', seq: 1, nowMs: 0 }, 0), 'ignore');
});

test("every message's nowMs refines the clock offset", () => {
  const f = new FeedFollower();
  f.receive(snapshot(1, 50_000), 40_000);
  assert.equal(f.now(41_000), 51_000);
  f.receive(delta(2, [], 52_500), 42_000);
  assert.equal(f.now(42_000), 52_500, 'the least delayed sample wins');
});

test('backoff: full jitter under a ceiling doubling from 1 s to 30 s, reset by success', () => {
  const max = new Backoff(() => 0.999999);
  const ceilings = Array.from({ length: 8 }, () => max.next());
  assert.deepEqual(ceilings, [999, 1999, 3999, 7999, 15999, 29999, 29999, 29999]);
  const min = new Backoff(() => 0);
  assert.equal(min.next(), 0);
  max.reset();
  assert.equal(max.attempt, 0);
  assert.ok(max.next() < 1000);
  assert.ok(resumeDelayMs(() => 0.999999) < PUBLIC_FEED.resumeJitterMs);
  assert.equal(resumeDelayMs(() => 0), 0);
});

test('the feed URL names up to 30 valid cards, sorted and unique', () => {
  assert.equal(cloudFeedUrl('wss://h/feed', []), 'wss://h/feed');
  assert.equal(cloudFeedUrl('wss://h/feed', [123, 12, 123, 0, 10000]), 'wss://h/feed?cards=12,123');
  const many = Array.from({ length: 40 }, (_, i) => i + 1);
  assert.equal(cloudFeedUrl('wss://h/feed', many).split('=')[1].split(',').length, 30);
  assert.equal(defaultFeedBase({ protocol: 'https:', host: 'quina.barrakudesbegur.org' }), 'wss://quina.barrakudesbegur.org/feed');
  assert.equal(defaultFeedBase({ protocol: 'http:', host: 'localhost:8787' }), 'ws://localhost:8787/feed');
});

// ---- CloudFeed with fakes ---------------------------------------------------------------------------------
class FakeSocket implements SocketLike {
  readyState = 0;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly url: string;
  constructor(url: string) {
    this.url = url;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  send(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }
}

class FakeTimers implements Timers {
  pending: { fn: () => void; ms: number; id: number }[] = [];
  private next = 1;
  set(fn: () => void, ms: number) {
    const id = this.next++;
    this.pending.push({ fn, ms, id });
    return id;
  }
  clear(handle: unknown) {
    this.pending = this.pending.filter((t) => t.id !== handle);
  }
  runAll() {
    const due = this.pending;
    this.pending = [];
    for (const t of due) t.fn();
  }
}

class FakeVisibility implements VisibilitySource {
  hidden = false;
  private listener: (() => void) | null = null;
  addEventListener(_: 'visibilitychange', l: () => void) {
    this.listener = l;
  }
  removeEventListener() {
    this.listener = null;
  }
  set(hidden: boolean) {
    this.hidden = hidden;
    this.listener?.();
  }
}

function setup(cards: number[] = [57, 123]) {
  const sockets: FakeSocket[] = [];
  const timers = new FakeTimers();
  const visibility = new FakeVisibility();
  let now = 1_000_000;
  const feed = new CloudFeed({
    url: 'wss://h/feed',
    cards,
    createSocket: (u) => {
      const s = new FakeSocket(u);
      sockets.push(s);
      return s;
    },
    random: () => 0.5,
    timers,
    visibility,
    clock: () => now,
  });
  const updates: FeedUpdate[] = [];
  feed.subscribe((u) => updates.push(u));
  return { feed, sockets, timers, visibility, updates, advance: (ms: number) => (now += ms) };
}

test('CloudFeed connects with the cards, goes online with the first snapshot, follows deltas', () => {
  const { feed, sockets, updates } = setup();
  feed.start();
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].url, 'wss://h/feed?cards=57,123');
  sockets[0].open();
  assert.equal(updates.at(-1)?.connection.online, false, 'not online until a snapshot arrives');
  sockets[0].send(snapshot(1));
  assert.equal(updates.at(-1)?.connection.online, true);
  sockets[0].send(delta(2, [{ kind: 'scene', scene: 'play' }]));
  assert.equal(updates.at(-1)?.state?.scene, 'play');
});

test('CloudFeed reconnects for a fresh snapshot on a gap, keeping the last state on screen', () => {
  const { feed, sockets, timers, updates } = setup();
  feed.start();
  sockets[0].open();
  sockets[0].send(snapshot(1));
  sockets[0].send(delta(3, [{ kind: 'scene', scene: 'play' }]));
  assert.equal(sockets[0].closed, true);
  assert.equal(updates.at(-1)?.state?.scene, 'before', 'the gapped delta was not applied');
  assert.equal(timers.pending.length, 1);
  assert.ok(timers.pending[0].ms < 1000, 'the first retry is within 1 s');
  timers.runAll();
  assert.equal(sockets.length, 2);
  sockets[1].open();
  sockets[1].send(snapshot(9));
  assert.equal(updates.at(-1)?.connection.online, true);
});

test('CloudFeed backs off while the socket keeps closing, and resets after a snapshot', () => {
  const { feed, sockets, timers } = setup();
  feed.start();
  const waits: number[] = [];
  for (let i = 0; i < 4; i++) {
    sockets.at(-1)!.close();
    waits.push(timers.pending[0].ms);
    timers.runAll();
  }
  assert.deepEqual(waits, [500, 1000, 2000, 4000], 'random 0.5 × 1, 2, 4, 8 s');
  assert.equal(feed.attempts, 4);
  sockets.at(-1)!.send(snapshot(1));
  assert.equal(feed.attempts, 0);
});

test('CloudFeed reconnects after 0–2 s when back in the foreground with a dead or old socket', () => {
  const { feed, sockets, timers, visibility, advance } = setup();
  feed.start();
  sockets[0].open();
  sockets[0].send(snapshot(1));
  visibility.set(true);
  advance(2000);
  visibility.set(false);
  assert.equal(timers.pending.length, 0, 'a short hide with a healthy socket keeps it');
  visibility.set(true);
  advance(60_000);
  visibility.set(false);
  assert.equal(timers.pending.length, 1);
  assert.ok(timers.pending[0].ms <= PUBLIC_FEED.resumeJitterMs);
  timers.runAll();
  assert.equal(sockets.length, 2);
  assert.equal(sockets[0].closed, true);
});

test('CloudFeed reconnects when the cards change, and stop() ends everything', () => {
  const { feed, sockets, timers } = setup([5]);
  feed.start();
  feed.setCards([5]);
  assert.equal(sockets.length, 1, 'same cards: no reconnect');
  feed.setCards([5, 6]);
  assert.equal(sockets.length, 2);
  assert.equal(sockets[1].url, 'wss://h/feed?cards=5,6');
  feed.stop();
  assert.equal(sockets[1].closed, true);
  assert.equal(timers.pending.length, 0);
});
