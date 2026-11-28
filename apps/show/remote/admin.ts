// Remote for the presenters' tablet and the admin phone. It sends protocol commands to the show engine
// through the relay and renders the engine's events. It holds no game logic: everything it shows comes
// from the engine's `state` snapshots; countdowns are computed locally from their epoch-ms times.
import { Bus } from '../engine/src/net/bus.ts';
import { el as $, targetOf } from '../engine/src/dom.ts';
import {
  makeCommand,
  isEvent,
  isPhaseName,
  COMMANDS,
  PACE_PRESETS_SEC,
  PACE_FINE_STEP_SEC,
  STINGER_NAMES,
  SFX_NAMES,
  type Command,
  type CommandArgs,
  type CommandName,
  type PossibleWinner,
  type ShowState,
  type ShowStatus,
  type SoundName,
} from '@quina/protocol';

// On the hotspot the relay pairs this remote by its token (the LAN URL's `?t=`); on the laptop it needs none.
const bus = new Bus<Command>({ role: 'tablet', token: new URLSearchParams(location.search).get('t') });
let state: ShowState | null = null;

/** A command's fields, which may be left out when it has none that are required. */
const send = <C extends CommandName>(cmd: C, ...fields: CommandArgs<C>) => bus.sendRemote(makeCommand(cmd, ...fields));
const isCommandName = (name: string | undefined): name is CommandName => name !== undefined && Object.hasOwn(COMMANDS, name);

bus.on((message, { local }) => {
  if (local || !isEvent(message)) return;
  switch (message.type) {
    case 'state':
      state = message;
      render();
      break;
    case 'command.rejected':
      say(`Ignored ${message.cmd ?? 'command'}: ${message.reason}`);
      break;
    case 'transition.cancelled':
      say('Spin cancelled');
      break;
    case 'landing.undone':
      say('Last landing undone');
      break;
    case 'relay.clients': {
      const show = message.clients.some((c) => c.role === 'show');
      $('conn').textContent = show ? 'show connected' : 'show page not open';
      $('conn').dataset.ok = String(show);
      break;
    }
  }
});
bus.onOpen = () => send('getState');
bus.connect();

let messageTimer: ReturnType<typeof setTimeout> | undefined;
function say(text: string) {
  $('message').textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => ($('message').textContent = ''), 4000);
}

const clockTime = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const drift = (sec: number) => (Math.abs(sec) < 30 ? 'on time' : `${Math.round(Math.abs(sec) / 60)} min ${sec > 0 ? 'behind' : 'ahead'}`);
const STATUS: Record<ShowStatus, string> = { locked: 'Show page needs “Start show”', idle: 'Ready', playing: 'Playing', transition: 'Spinning', hold: 'Hold' };

function render() {
  if (!state) return;
  const s = state;
  $('status').textContent = s.suspense ? 'Suspense' : STATUS[s.status] ?? s.status;
  $('suspense').textContent = s.suspense ? '▶ Release' : 'Suspense';
  $('suspense').dataset.active = String(Boolean(s.suspense));
  $('phase').textContent = `${s.phase}${s.game.phaseOverride ? ' (fixed)' : ''}`;
  $('phase').dataset.phase = s.phase;
  $('position').textContent = `round ${s.round.number} · song ${s.queue.position + 1} of ${s.queue.length}`;
  const cur = s.current;
  $('now-title').textContent = cur ? cur.title : s.status === 'hold' && s.holdMusic ? 'Hold music' : '—';
  $('now-meta').textContent = cur ? cur.artist : '';
  $('next-title').textContent = s.next ? `Next: ${s.next.title} — ${s.next.artist}` : 'End of the queue';
  $('hold').textContent = s.status === 'hold' ? '▶ Release' : '❚❚ Hold';
  $('hold').dataset.active = String(s.status === 'hold');
  document.body.dataset.status = s.status;
  $('pace-value').textContent = `${s.pace.sec} s`;
  $('pace-lock', HTMLInputElement).checked = s.pace.locked;
  $('pace-info').textContent = `spin ${s.pace.spinSec} s · slot ${s.pace.slotSec} s${s.pace.nudge !== 1 ? ` · catch-up ×${s.pace.nudge}` : ''}`;
  for (const button of $('presets').children) {
    if (button instanceof HTMLElement) button.dataset.active = String(Number(button.dataset.pace) === s.pace.sec);
  }
  $('auto', HTMLInputElement).checked = s.game.autoAdvance;
  $('auto-final', HTMLInputElement).checked = s.game.autoAdvanceFinal;
  $('final-lap', HTMLInputElement).checked = s.game.autoSounds.finalLap;
  $('schedule').textContent = `Round ends ≈ ${clockTime(s.schedule.roundEndMs)} (${drift(s.schedule.roundDriftSec)}) · game ends ≈ ${clockTime(s.schedule.gameEndMs)}`;
  if (document.activeElement !== $('suw')) $('suw', HTMLInputElement).value = String(s.game.songsUntilWinner);
  if (document.activeElement !== $('cards-in-play')) $('cards-in-play', HTMLInputElement).value = s.cards.inPlay;
  $('cards-info').textContent = s.cards.inPlayCount ? `${s.cards.inPlayCount} cards · ${s.cards.validCount} valid this round` : 'none entered';
  $('phase-source').textContent = `from ${s.cards.phaseSource}${s.cards.phaseSource === 'cards' ? `, towards the ${s.cards.climbingTo === 'bingo' ? 'Bingo' : 'Line'}` : ''}`;
  renderWinners(s);
  $('phase-override', HTMLSelectElement).value = s.game.phaseOverride || '';
  $('recipe', HTMLSelectElement).value = s.game.nextRecipe || '';
  $('landings').replaceChildren(
    ...[...s.landings].reverse().map((l) => {
      const li = document.createElement('li');
      li.textContent = `${l.position + 1}. ${l.title} — ${l.artist}`;
      if (l.undone) li.classList.add('undone');
      return li;
    }),
  );
}

function renderWinners(s: ShowState) {
  const { line, bingo } = s.possibleWinners;
  const title = (id: number | null) => s.landings.find((l) => l.songId === id)?.title ?? `#${id}`;
  const describe = (list: PossibleWinner[], what: 'Line' | 'Bingo') => {
    if (!list.length) return `No ${what} yet.`;
    const cards = list.map((w) => `${w.cardId}${what === 'Line' ? ` (line ${w.lines.map((n) => n + 1).join(', ')})` : ''}`).join(' · ');
    const last = list[list.length - 1];
    return `${what}: ${cards}${list.length >= 60 ? ' …' : ''} — last completed by ${title(last.completedBy)}`;
  };
  $('winners-line').textContent = s.cards.validCount ? describe(line, 'Line') : 'Enter the cards in play to see possible winners.';
  $('winners-bingo').textContent = s.cards.validCount && bingo.length ? describe(bingo, 'Bingo') : '';
  $('winners-card').dataset.hot = String(Boolean(s.cards.validCount && (s.round.lineConfirmed ? bingo.length : line.length)));
}

function tickCountdown() {
  requestAnimationFrame(tickCountdown);
  const s = state;
  let text = '';
  if (s?.transition) text = `Landing in ${Math.max(0, (s.transition.landAtMs - Date.now()) / 1000).toFixed(1)} s`;
  else if (s?.suspense) text = `Suspense ${Math.round((Date.now() - s.suspense.sinceMs) / 1000)} s · releases by itself in ${Math.max(0, Math.round((s.suspense.autoReleaseAtMs - Date.now()) / 1000))} s`;
  else if (s?.status === 'playing' && s.autoAtMs) text = `Next spin in ${Math.max(0, (s.autoAtMs - Date.now()) / 1000).toFixed(0)} s`;
  else if (s?.status === 'hold' && s.hold) {
    const held = Math.round((Date.now() - s.hold.sinceMs) / 1000);
    text = `Holding ${held} s`;
  }
  $('countdown').textContent = text;
}
requestAnimationFrame(tickCountdown);

// Two taps for anything that cannot be undone from here.
function confirmTap(button: HTMLElement, label: string, action: () => void) {
  let armed: ReturnType<typeof setTimeout> | null = null;
  button.addEventListener('click', () => {
    if (armed) {
      clearTimeout(armed);
      armed = null;
      button.textContent = label;
      action();
      return;
    }
    button.textContent = 'Tap again to confirm';
    armed = setTimeout(() => {
      armed = null;
      button.textContent = label;
    }, 3000);
  });
}

for (const pace of PACE_PRESETS_SEC) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.pace = String(pace);
  button.textContent = `${pace} s`;
  button.addEventListener('click', () => send('setPace', { pace }));
  $('presets').append(button);
}
const stingers: readonly SoundName[] = STINGER_NAMES;
for (const name of [...STINGER_NAMES, ...SFX_NAMES]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = name.replace(/^mkwii-/, '').replaceAll('-', ' ');
  if (stingers.includes(name)) button.classList.add('stinger');
  button.addEventListener('click', () => send('sfx', { name }));
  $('sfx').append(button);
}

document.querySelectorAll('[data-cmd]').forEach((button) =>
  button.addEventListener('click', () => {
    const cmd = button instanceof HTMLElement ? button.dataset.cmd : undefined;
    if (isCommandName(cmd)) send(cmd);
  }),
);
$('hold').addEventListener('click', () => send('hold', { on: state?.status !== 'hold' }));
$('suspense').addEventListener('click', () => send('suspense', { on: !state?.suspense }));
$('pace-down').addEventListener('click', () => send('setPace', { delta: -PACE_FINE_STEP_SEC }));
$('pace-up').addEventListener('click', () => send('setPace', { delta: PACE_FINE_STEP_SEC }));
$('pace-lock').addEventListener('change', (e) => send('setPace', { locked: targetOf(e, HTMLInputElement).checked }));
$('auto').addEventListener('change', (e) => send('setGame', { autoAdvance: targetOf(e, HTMLInputElement).checked }));
$('auto-final').addEventListener('change', (e) => send('setGame', { autoAdvanceFinal: targetOf(e, HTMLInputElement).checked }));
$('final-lap').addEventListener('change', (e) => send('setAutoSound', { key: 'finalLap', on: targetOf(e, HTMLInputElement).checked }));
$('suw').addEventListener('change', (e) => send('setGame', { songsUntilWinner: Math.max(0, Math.round(Number(targetOf(e, HTMLInputElement).value))) }));
$('phase-override').addEventListener('change', (e) => {
  const phase = targetOf(e, HTMLSelectElement).value;
  send('setGame', { phaseOverride: isPhaseName(phase) ? phase : null });
});
$('recipe').addEventListener('change', (e) => send('overrideNextRecipe', { recipe: targetOf(e, HTMLSelectElement).value || null }));
$('cards-form').addEventListener('submit', (e) => {
  e.preventDefault();
  send('setCardsInPlay', { ranges: $('cards-in-play', HTMLInputElement).value.trim() });
  $('cards-in-play').blur();
});
confirmTap($('new-round'), 'New round', () => send('newRound'));
confirmTap($('panic'), 'Panic', () => send('panic'));
