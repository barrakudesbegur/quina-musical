// The menu's «Proves» card (test runs only, never on the night): whether the relay runs in test mode, and the
// arguments of its two commands (the protocol's TEST_COMMANDS, sent with the model's `act` like any other).
//
// The relay says it on every hello (`relay.mode { test }`, the protocol's RelayMode, always sent; true only when started
// with `--test`; the cloud never forwards it). No message means an older relay, so not a test run: the card stays hidden.
import { PROTOCOL_VERSION, defaultCardType, isRelayMode, type CommandFields, type RelayMode, type RoundKind } from '@quina/protocol';
import type { CatalogCard } from '../../../packages/ui/data/catalog.ts';
import type { GamePlan } from '../../../packages/ui/plan.ts';
import { roundCards } from './future.ts';

/** Whether the «Proves» card shows after `message` (any message from the relay, untrusted): a `relay.mode` decides
 * (only `test: true` shows it; a malformed one hides it); any other message leaves it as it was. */
export function testModeAfter(current: boolean, message: unknown): boolean {
  if (isRelayMode(message)) return message.test;
  const m = message as Partial<Record<keyof RelayMode, unknown>> | null;
  return typeof m === 'object' && m !== null && m.v === PROTOCOL_VERSION && m.type === 'relay.mode' ? false : current;
}

/** «Anar a la ronda»: its intro (`songs` null), or in play after `songs` counted. */
export function testJumpArgs(round: number, songs: number | null): CommandFields['testJump'] {
  return songs === null ? { round } : { round, songs };
}

/** A round the picker offers. `songs`: how many songs its Queue has, as far as the printed cards tell (the distinct
 * songs on its card type's side), or null before cards.json loads. */
export interface TestRound {
  number: number;
  kind: RoundKind;
  songs: number | null;
}

/** The plan's rounds in order (without a plan, 1 … `roundsTotal`, as normal rounds), each with its song count. */
export function testRounds(plan: Pick<GamePlan, 'rounds'> | null, roundsTotal: number, printed: ReadonlyMap<number, CatalogCard> | null): TestRound[] {
  const planned = plan?.rounds.length
    ? [...plan.rounds].sort((a, b) => a.number - b.number).map((r) => ({ number: r.number, kind: r.kind, cardType: r.cardType, side: r.side ?? 1 }))
    : Array.from({ length: Math.max(0, roundsTotal) }, (_, i) => ({ number: i + 1, kind: 'normal' as RoundKind, cardType: defaultCardType('normal'), side: 1 }));
  return planned.map(({ number, kind, cardType, side }) => ({ number, kind, songs: printed ? songCount(printed, cardType, side) : null }));
}

/** The distinct songs on the printed cards of a card type's side (0 when none is printed). */
function songCount(printed: ReadonlyMap<number, CatalogCard>, cardType: string, side: number): number {
  return new Set(roundCards(printed, cardType, side).flatMap((c) => c.lines.flat())).size;
}

/** The most songs «després de K cançons» offers: the round's count, else the protocol's bound (the engine refuses a K
 * past the Queue). */
export const TEST_SONGS_FALLBACK_MAX = 999;
export const testSongsMax = (round: TestRound | null): number => round?.songs ?? TEST_SONGS_FALLBACK_MAX;
