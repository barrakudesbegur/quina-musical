// Which commands the relay forwards to the show page (docs/protocol.md › Relay › Who may say what). Pure, so the rules
// are tested without a socket (tests/relay-gate.test.ts); relay/server.ts asks it for every command that arrives.
import { PROTOCOL_VERSION, isTestCommand, type RelayMode, type Role } from '@quina/protocol';

/** The roles whose commands go to the show: the paired consoles (tablet, admin) and the cloud link. */
export const COMMANDERS: readonly Role[] = ['tablet', 'admin', 'cloud'];

/**
 * Whether the relay forwards command `cmd` (untrusted) from a socket of `role` to the show page: only from the consoles
 * and the cloud link; `getJournal` only from the link; the test tools (TEST_COMMANDS, rehearsal test runs only) only when
 * the relay runs with `--test` (`testMode`), and never from the link, whose commands are the cloud's consoles'.
 */
export function relayAcceptsCommand(cmd: unknown, role: Role | 'unknown', testMode: boolean): boolean {
  if (role === 'unknown' || !COMMANDERS.includes(role)) return false;
  if (cmd === 'getJournal') return role === 'cloud';
  if (isTestCommand(cmd)) return testMode && role !== 'cloud';
  return true;
}

/** The relay's test mode, for every paired socket right after its hello (protocol RelayMode). */
export const relayModeMessage = (testMode: boolean): RelayMode => ({ v: PROTOCOL_VERSION, type: 'relay.mode', test: testMode });

/** The relay's start-up banner in test mode (`--test`): it must be impossible to miss, and never seen on the night. */
export const TEST_MODE_BANNER = [
  '',
  '############################################################################',
  '##  TEST MODE (--test): the consoles can reset the Game or jump in it     ##',
  '##  (testReset, testJump). Rehearsal test runs only, NEVER on the night:  ##',
  '##  restart the relay without --test before the show.                     ##',
  '############################################################################',
  '',
].join('\n');
