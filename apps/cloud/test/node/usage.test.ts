// The cloud's daily usage against the free plan's limits (src/domain/usage.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_LIMITS, UsageCounter, emptyUsage, nextResetMs, usageReport, utcDay, type DailyUsage } from '../../src/domain/usage.ts';

const T = Date.UTC(2026, 11, 20, 19, 30); // the night, 20:30 in Catalonia

test('billed requests count incoming messages 20 to 1; the worst share sets the level', () => {
  const u = { ...emptyUsage(T), requests: 10_000, wsMessagesIn: 200_000 };
  const r = usageReport(u, T);
  assert.equal(r.billedRequests, 20_000);
  assert.equal(r.shares.requests, 0.2);
  assert.equal(r.level, 'ok');
  assert.equal(usageReport({ ...u, rowsWritten: 0.6 * FREE_LIMITS.rowsWritten }, T).level, 'warn');
  assert.equal(usageReport({ ...u, requests: 85_000 }, T).level, 'fail');
  assert.equal(r.resetAtMs, Date.UTC(2026, 11, 21));
  assert.equal(nextResetMs(Date.UTC(2026, 11, 21)), Date.UTC(2026, 11, 22));
});

test('the counter saves now and then, not on every count, and starts again on a new UTC day', () => {
  const saved: DailyUsage[] = [];
  const c = new UsageCounter(null, T, (u) => saved.push(u), 3, 60_000);
  c.count('requests', 1, T);
  c.count('wsMessagesIn', 5, T + 1);
  assert.equal(saved.length, 0);
  c.count('rowsWritten', 2, T + 2);
  assert.equal(saved.length, 1, 'every 3 counts');
  c.count('requests', 1, T + 70_000);
  assert.equal(saved.length, 2, 'or after a minute');
  c.phones(140, T + 70_001);
  c.phones(90, T + 70_002);
  assert.equal(c.read(T + 70_003).phonesPeak, 140);
  // Midnight UTC: the old day is saved, the new one starts at zero.
  const tomorrow = Date.UTC(2026, 11, 21, 0, 1);
  c.count('requests', 1, tomorrow);
  assert.equal(saved.at(-1)?.day, utcDay(T));
  assert.equal(saved.at(-1)?.phonesPeak, 140);
  assert.deepEqual(c.read(tomorrow), { ...emptyUsage(tomorrow), requests: 1 });
  // Loaded counts carry on within the same day only.
  assert.equal(new UsageCounter({ ...emptyUsage(T), requests: 7 }, T + 5, () => {}).read(T + 5).requests, 7);
  assert.equal(new UsageCounter({ ...emptyUsage(T), requests: 7 }, tomorrow, () => {}).read(tomorrow).requests, 0);
});
