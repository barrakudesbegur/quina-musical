// The menu's «Proves» card (test runs only, never on the night): whether the relay runs in test mode, and the two test
// commands it sends. Pure, apart from `sendTestCommand`, which only builds the message.
//
// The relay says it on every hello (`relay.mode { test }`, always sent; true only when started with `--test`; the cloud
// never forwards it). No message means an older relay, so not a test run: the card stays hidden.
//
// UNTIL the protocol has them (Sound engine's `RelayMode`, `testReset`, `testJump`), the shapes below are local. When
// they land, the switch is:
//   1. `RelayModeMessage` → the protocol's `RelayMode`; keep `testModeAfter` (or read it in ShowClient once isEvent
//      accepts it);
//   2. delete `TestCommandFields`, `TestCommandName`, `testCanSend` and `sendTestCommand`: the model sends with
//      `this.act(cmd, fields)` and checks `this.can(cmd)` (model.svelte.ts › testAct, canTest);
//   3. add `testReset` and `testJump` to config.ts CONSOLE_COMMANDS and their names to strings.ts S.commands (and drop
//      S.tests.commands and its line in commandText).
import { PROTOCOL_VERSION, defaultCardType, newReqId, type ProtocolVersion, type RoundKind, type ShowState } from '@quina/protocol';
import type { CatalogCard } from '../../../packages/ui/data/catalog.ts';
import type { GamePlan } from '../../../packages/ui/plan.ts';
import { roundCards } from './future.ts';

export const RELAY_MODE_TYPE = 'relay.mode';

/** LOCAL until the protocol's `RelayMode`. */
export interface RelayModeMessage {
  v: ProtocolVersion;
  type: typeof RELAY_MODE_TYPE;
  test: boolean;
}

/** LOCAL until the protocol's COMMANDS have them: «Nova partida» and «Anar a la ronda». */
export interface TestCommandFields {
  /** A new Game: the show page reloads fresh (its start overlay asks for the click). */
  testReset: Record<string, never>;
  /** Round `round`'s intro; with `songs`, the round in play with a fresh Shuffle and its first `songs` counted (0 …
   * the round's songs; past the Queue the engine refuses it as `invalid`). */
  testJump: { round: number; songs?: number };
}
export type TestCommandName = keyof TestCommandFields;

/** Whether the «Proves» card shows after `message` (any message from the relay, untrusted): a `relay.mode` decides
 * (only `test: true` shows it); any other message leaves it as it was. */
export function testModeAfter(current: boolean, message: unknown): boolean {
  if (!message || typeof message !== 'object') return current;
  const m = message as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || m.type !== RELAY_MODE_TYPE) return current;
  return m.test === true;
}

/** LOCAL: the scene rule both commands will have ('any', Pausa included), over the console's usual gate (online, a
 * snapshot, the show page not locked: logic/scene.ts canSend). */
export function testCanSend({ online, state }: { online: boolean; state: Pick<ShowState, 'status'> | null }): boolean {
  return online && state !== null && state.status !== 'locked';
}

/** LOCAL: the command message as ShowClient.send builds it. */
export function sendTestCommand<C extends TestCommandName>(cmd: C, fields: TestCommandFields[C], prefix: string): { reqId: string; message: TestCommandFields[C] & { v: ProtocolVersion; type: 'cmd'; cmd: C; reqId: string } } {
  const reqId = newReqId(prefix);
  return { reqId, message: { ...fields, v: PROTOCOL_VERSION, type: 'cmd', cmd, reqId } };
}

/** «Anar a la ronda»: its intro (`songs` null), or in play after `songs` counted. */
export function testJumpArgs(round: number, songs: number | null): TestCommandFields['testJump'] {
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
