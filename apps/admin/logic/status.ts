// What Admin's header says: its title, the connection badge and the plan's save badge, and why the plan couldn't
// load. Pure, from the session's and the socket's state, so each state's words are tested (tests/ui/admin/status.test.ts).
import type { StoreKind } from '../data/admin-plan-store.ts';
import type { LoadPhase, SaveStatus } from '../state/plan-session.svelte.ts';
import { S } from '../strings.ts';

export type BadgeStatus = 'ok' | 'warn' | 'error' | 'calm';
export interface Badge {
  text: string;
  status: BadgeStatus;
}

/** Why the plan couldn't load: no answer in time, or the cloud's or the relay's answer (cloud-plan.ts's details). */
export type LoadFailure = { cause: 'timeout'; seconds: number } | { cause: 'answer'; detail: string };

/** The plan's failure as one plain Catalan sentence, naming where it was loading from. */
export function loadFailureText(failure: LoadFailure, where: StoreKind): string {
  const why = S.save.loadFailedWhy;
  if (failure.cause === 'timeout') return why.timeout(where, failure.seconds);
  const status = /^HTTP (\d+)$/.exec(failure.detail);
  if (status) return why.status(where, status[1]);
  if (failure.detail === 'the plan there does not pass the check') return why.badPlan(where);
  if (failure.detail === 'not a plan answer' || failure.detail === 'no savedAtMs') return why.badAnswer(where);
  // fetch() itself failed (offline, refused, a CORS or TLS error): its message is the browser's.
  return why.network(where);
}

/**
 * The header's title: «Admin · <the plan's title>», just «Admin» while there's no plan (loading, failed, or a blank
 * one with no title). When the plan on screen couldn't be saved (refused as stale, or failed), it says so.
 */
export function headerTitle(planTitle: string | null | undefined, unsaved: boolean): string {
  const title = planTitle?.trim();
  if (!title) return S.heading;
  return `${S.heading} · ${title}${unsaved ? ` ${S.headingUnsaved}` : ''}`;
}

/** The connection badge: the socket goes to the cloud when Admin is served from it, else to the show's laptop. */
export function connBadge(c: { demo: string | null; connected: boolean; wasConnected: boolean; showOnline: boolean; where: StoreKind }): Badge {
  if (c.demo) return { text: S.conn.demo(c.demo), status: 'calm' };
  if (!c.connected) return { text: c.wasConnected ? S.conn.offline(c.where) : S.conn.connecting(c.where), status: 'error' };
  if (!c.showOnline) return { text: S.conn.noShow, status: 'warn' };
  return { text: S.conn.online, status: 'ok' };
}

/**
 * The plan's badge. «Desat…» only for a plan that is somewhere: with none anywhere yet, the blank one on screen is
 * not saved until someone edits it (7.5).
 */
export function saveBadge(s: { phase: LoadPhase['kind']; status: SaveStatus; where: StoreKind; hasSavedPlan: boolean; clock: (ms: number) => string }): Badge {
  if (s.phase === 'loading') return { text: S.save.loading(s.where), status: 'calm' };
  if (s.phase === 'failed') return { text: S.save.loadFailed, status: 'error' };
  const st = s.status;
  switch (st.kind) {
    case 'saved':
      if (st.atMs) return { text: S.save.saved(s.clock(st.atMs)), status: 'ok' };
      return s.hasSavedPlan ? { text: S.save.loaded(s.where), status: 'ok' } : { text: S.save.nothingSaved, status: 'calm' };
    case 'pending':
      return { text: S.save.pending, status: 'calm' };
    case 'invalid':
      return { text: S.save.invalid(st.count), status: 'warn' };
    case 'failed':
      return { text: st.reason === 'quota' ? S.save.quota : st.reason === 'stale' ? S.save.stale : S.save.error(st.detail), status: 'error' };
    case 'demo':
      return { text: S.save.demo, status: 'calm' };
    case 'unavailable':
      return { text: S.save.unavailable, status: 'error' };
  }
}
