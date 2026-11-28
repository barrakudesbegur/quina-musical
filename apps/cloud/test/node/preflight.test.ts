// The preflight's verdicts, from facts shaped like the real ones (macOS tools, the repertoire's files, the link's status).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../../laptop/preflight/checks.ts';
import { VOICE_CUES, roundCardPrice, type GamePlan } from '@quina/protocol';
import { PLAN } from '../support/plan.ts';
import { CHROME, HELPER, psLine } from '../support/chrome.ts';
import { RUNBOOK_COMMANDS, SHOW_CHROME_FLAGS } from '../../laptop/chrome-profiles.ts';

const device = (name: string, transport: string, extra: Record<string, string> = {}) => ({
  SPAudioDataType: [{ _items: [{ _name: 'MacBook Pro Microphone', coreaudio_device_transport: 'coreaudio_device_type_builtin' }, { _name: name, coreaudio_default_audio_output_device: 'spaudio_yes', coreaudio_device_transport: `coreaudio_device_type_${transport}`, ...extra }] }],
});

test('audio output: wireless fails (its delay breaks the landings), the laptop speakers warn, a wire passes', () => {
  assert.equal(c.audioOutputCheck(device('AirPods', 'bluetooth')).status, 'fail');
  assert.equal(c.audioOutputCheck(device('Living room', 'airplay')).status, 'fail');
  assert.equal(c.audioOutputCheck(device('MacBook Pro Speakers', 'builtin', { coreaudio_output_source: 'MacBook Pro Speakers' })).status, 'warn');
  assert.equal(c.audioOutputCheck(device('MacBook Pro Speakers', 'builtin', { coreaudio_output_source: 'External Headphones' })).status, 'warn', 'the name still says speakers');
  assert.equal(c.audioOutputCheck(device('External Headphones', 'builtin')).status, 'pass');
  assert.equal(c.audioOutputCheck(device('Scarlett 2i2', 'usb')).status, 'pass');
  assert.equal(c.audioOutputCheck(device('LG TV', 'hdmi')).status, 'pass');
  assert.match(c.audioOutputCheck(device('LG TV', 'hdmi')).detail, /6 dB/, 'the sound check note (D157)');
  assert.equal(c.audioOutputCheck(device('BlackHole', 'virtual')).status, 'warn');
  assert.equal(c.audioOutputCheck({ SPAudioDataType: [] }).status, 'fail');
  assert.equal(c.audioOutputCheck(null).status, 'fail');
});

test('sleep: never, or prevented right now, passes; otherwise the show would stop: fail', () => {
  const prevented = ' sleep                1 (sleep prevented by caffeinate)\n displaysleep         2 (display sleep prevented by CaffeineMate)\n';
  assert.deepEqual(c.sleepChecks(prevented, '').map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.sleepChecks(' sleep 0\n displaysleep 0\n', '').map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.sleepChecks(' sleep 10\n displaysleep 5\n', '').map((x) => x.status), ['fail', 'fail']);
  assert.deepEqual(c.sleepChecks(' sleep 10\n displaysleep 5\n', '   PreventUserIdleDisplaySleep    1\n   PreventUserIdleSystemSleep     1\n').map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.sleepChecks(' sleep 10\n displaysleep 5\n', '   PreventUserIdleDisplaySleep    0\n   PreventUserIdleSystemSleep     1\n').map((x) => x.status), ['pass', 'fail']);
});

test('power, disk and the browser', () => {
  assert.equal(c.powerCheck("Now drawing from 'AC Power'\n").status, 'pass');
  assert.match(c.powerCheck("Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t97%; discharging").detail, /97%/);
  assert.equal(c.diskCheck(0.5e9).status, 'fail');
  assert.equal(c.diskCheck(3e9).status, 'warn');
  assert.equal(c.diskCheck(50e9).status, 'pass');
  // The runbook's command (step 5), as ps shows it; then the same with a flag left out.
  const show = psLine(RUNBOOK_COMMANDS.show);
  const without = (flag: string) => show.replace(` ${flag}`, '');
  assert.equal(c.browserCheck([show]).status, 'pass');
  assert.match(c.browserCheck([show]).detail, /kiosk/);
  // Without the throttling flags a covered window stalls the show: fail.
  assert.equal(c.browserCheck([without('--disable-renderer-backgrounding')]).status, 'fail');
  assert.equal(c.browserCheck([without('--disable-renderer-backgrounding').replace(' --disable-backgrounding-occluded-windows', '')]).status, 'fail');
  // The flags but no autoplay: the page waits for a click.
  assert.equal(c.browserCheck([without('--autoplay-policy=no-user-gesture-required')]).status, 'warn');
  // Found by its profile alone (the address typed in later), and last year's /tmp command by its address.
  assert.equal(c.browserCheck([`${CHROME} --user-data-dir=/Users/tech/Library/Application Support/Quina/chrome-show --autoplay-policy=no-user-gesture-required ${SHOW_CHROME_FLAGS.join(' ')}`]).status, 'pass');
  assert.equal(c.browserCheck([`${CHROME} --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required ${SHOW_CHROME_FLAGS.join(' ')} --kiosk http://localhost:5174/show/?autostart=1`]).status, 'pass');
  // A profile merely named like it is not the show's.
  assert.equal(c.browserCheck([`${CHROME} --user-data-dir=/Users/tech/chrome-show-old`]).status, 'warn');
  // Only someone's everyday Chrome, the console, a helper or a headless tool: not the show's.
  assert.equal(c.browserCheck([`${CHROME} --profile-directory=Default`]).status, 'warn');
  assert.equal(c.browserCheck([psLine(RUNBOOK_COMMANDS.console)]).status, 'warn');
  assert.equal(c.browserCheck([CHROME, `${HELPER} --type=renderer --user-data-dir=/Users/tech/Library/Application Support/Quina/chrome-show --kiosk`]).status, 'warn');
  assert.equal(c.browserCheck([`${CHROME} --headless=new --remote-debugging-port=9401 --user-data-dir=/var/folders/h7/x/T/quina-shoot-KeO5ZC --hide-scrollbars --no-first-run about:blank`]).status, 'warn');
  assert.equal(c.browserCheck(['/usr/bin/zsh']).status, 'warn');
});

test('Chrome profiles: both outside /tmp pass; a temporary or everyday profile, or no laptop console, warns', () => {
  const tmp = ['/tmp', '/private/tmp', '/var/folders/h7/x/T'];
  const show = psLine(RUNBOOK_COMMANDS.show);
  const consoleLine = psLine(RUNBOOK_COMMANDS.console);
  const helper = `${HELPER} --type=gpu-process --user-data-dir=/tmp/quina-show --gpu-preferences=WAAAAAAAAACgAACBAAAAAAAAAAAAAGAAQA`;
  const both = c.chromeProfilesCheck([show, helper, consoleLine, CHROME], false, tmp);
  assert.equal(both.status, 'pass');
  assert.equal(both.group, 'Laptop');
  assert.match(both.detail, /show \/Users\/tech\/Library\/Application Support\/Quina\/chrome-show, console .*chrome-console/);
  // Last year's /tmp commands: each names what a restart would cost.
  const oldShow = `${CHROME} --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required ${SHOW_CHROME_FLAGS.join(' ')} --kiosk http://localhost:5174/show/?autostart=1`;
  const oldConsole = `${CHROME} --user-data-dir=/tmp/quina-console --app=http://localhost:5174/console/`;
  const tmpShow = c.chromeProfilesCheck([oldShow, consoleLine], false, tmp);
  assert.equal(tmpShow.status, 'warn');
  assert.match(tmpShow.detail, /\/tmp\/quina-show .*display offset, the Interval's place and its own copy of the Game \(the link's copy still resumes the Game\).*step 5/);
  const tmpConsole = c.chromeProfilesCheck([show, oldConsole], false, tmp);
  assert.equal(tmpConsole.status, 'warn');
  assert.match(tmpConsole.detail, /\/tmp\/quina-console .*the Wii remote's grant .*saved resume code.*step 7/);
  assert.equal(c.chromeProfilesCheck([oldShow, oldConsole], true, tmp).detail.split('; ').length, 2, 'both named');
  // /private/tmp and the user's temporary folder are emptied too.
  assert.equal(c.chromeProfilesCheck([show.replace('/Users/tech/Library/Application Support/Quina', '/private/tmp'), consoleLine], false, tmp).status, 'warn');
  assert.equal(c.chromeProfilesCheck([show, consoleLine.replace('/Users/tech/Library/Application Support/Quina', '/var/folders/h7/x/T')], false, tmp).status, 'warn');
  // The show in the everyday profile (no --user-data-dir).
  const everyday = c.chromeProfilesCheck([`${CHROME} --autoplay-policy=no-user-gesture-required ${SHOW_CHROME_FLAGS.join(' ')} --kiosk http://localhost:5174/show/?autostart=1`, consoleLine], false, tmp);
  assert.equal(everyday.status, 'warn');
  assert.match(everyday.detail, /everyday Chrome profile/);
  // No laptop console: a warning with the tablet; with --laptop-only the Console check's FAIL says it already.
  const noConsole = c.chromeProfilesCheck([show], false, tmp);
  assert.equal(noConsole.status, 'warn');
  assert.match(noConsole.detail, /console isn't open in its own profile.*Wii remote/);
  assert.equal(c.chromeProfilesCheck([show], true, tmp).status, 'pass');
  // The show not running is the Browser check's: not reported again.
  assert.equal(c.chromeProfilesCheck([consoleLine], false, tmp).status, 'pass');
  assert.equal(c.chromeProfilesCheck([], true, tmp).status, 'pass');
  assert.match(c.chromeProfilesCheck([], true, tmp).detail, /nothing|no show or console/);
  // A headless tool's Chrome in the temporary folder is neither window.
  assert.equal(c.chromeProfilesCheck([show, consoleLine, `${CHROME} --headless=new --user-data-dir=/var/folders/h7/x/T/quina-shoot-KeO5ZC about:blank`], false, tmp).status, 'pass');
});

const line = (...ids: number[]) => ids.map((id) => ({ id }));
const lines = (ids: number[]) => [line(...ids.slice(0, 4)), line(...ids.slice(4, 8)), line(...ids.slice(8, 12))];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test('cards: every song on a card must be in the repertoire and playable, or that card can never be completed', () => {
  const card = (id: number, ids: number[], type = 'normal') => ({ id, type, sides: [{ side: 1, lines: lines(ids) }] });
  const songs = new Map(range(1, 20).map((id) => [id, ['1']]));
  const playable = new Set(songs.keys());
  const ids = range(1, 12);
  const types = [{ type: 'normal' }, { type: 'especial' }];
  const both = c.cardsCheck([card(1, ids), card(2, ids, 'especial')], types, songs, playable);
  assert.equal(both.status, 'pass');
  assert.match(both.detail, /2 cards \(1 normal, 1 especial\)/);
  // A type card-types.json doesn't list (here the round kind's spelling, not the printed one) could never play.
  assert.match(c.cardsCheck([card(1, ids), card(2, ids, 'special')], types, songs, playable).detail, /card 2 has type "special", not in card-types.json \(normal, especial\)/);
  // This year's types are whatever apps/cards prints.
  assert.equal(c.cardsCheck([card(1, ids, 'groc')], [{ type: 'groc' }], songs, playable).status, 'pass');
  // Without card-types.json: the default types stand in, and it warns (screens can't name them).
  const untyped = c.cardsCheck([card(1, ids)], null, songs, playable);
  assert.equal(untyped.status, 'warn');
  assert.match(untyped.detail, /no card-types.json/);
  assert.match(c.cardsCheck([card(1, ids)], types, songs, new Set([...playable].filter((id) => id !== 5))).detail, /can't play.*5/);
  assert.match(c.cardsCheck([card(1, [...ids.slice(0, 11), 99])], types, songs, playable).detail, /99, not in the repertoire/);
  assert.match(c.cardsCheck([card(1, ids), card(1, ids)], types, songs, playable).detail, /twice/);
  assert.match(c.cardsCheck([{ id: 3, type: 'normal', sides: [{ side: 1, lines: [line(1, 2, 3)] }] }], types, songs, playable).detail, /card 3 side 1 is not 3 lines of 4/);
  assert.equal(c.cardsCheck([], types, songs, playable).status, 'fail');
});

test("cards in sides (D178): each side its type prints and no other, each side's songs from its pool; a card from before sides is its side 1", () => {
  const pools = new Map<number, readonly string[]>([...range(1, 12).map((id) => [id, ['1']] as const), ...range(13, 24).map((id) => [id, ['2']] as const)]);
  const playable = new Set(pools.keys());
  const types = [
    { type: 'normal', sides: [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }] },
    { type: 'especial', sides: [{ side: 1, pool: '1' }] },
  ];
  const normal = (id: number, side1: number[], side2: number[]) => ({ id, type: 'normal', sides: [{ side: 1, lines: lines(side1) }, { side: 2, lines: lines(side2) }] });
  const especial = (id: number) => ({ id, type: 'especial', sides: [{ side: 1, lines: lines(range(1, 12)) }] });
  const ok = c.cardsCheck([normal(1, range(1, 12), range(13, 24)), especial(2)], types, pools, playable);
  assert.equal(ok.status, 'pass');
  assert.match(ok.detail, /each side from its pool/);
  const check = (card: unknown) => c.cardsCheck([card], types, pools, playable);
  assert.match(check({ id: 3, type: 'normal', sides: [{ side: 1, lines: lines(range(1, 12)) }] }).detail, /card 3 has no side 2/);
  assert.match(check({ ...especial(4), sides: [...especial(4).sides, { side: 2, lines: lines(range(13, 24)) }] }).detail, /card 4 has a side 2, which its type doesn't print/);
  // Side 2's round shuffles only pool 2: a pool 1 song there would never land.
  assert.match(check(normal(5, range(1, 12), range(1, 12))).detail, /card 5 side 2 has song 1 from pool 1, not pool 2/);
  // A card from before sides: its lines are side 1, as the engine reads it.
  assert.equal(check({ id: 6, type: 'especial', lines: lines(range(1, 12)) }).status, 'pass');
  assert.match(check({ id: 7, type: 'normal', lines: lines(range(1, 12)) }).detail, /card 7 has no side 2/);
  // Today's test repertoire has no pool 2: apps/cards draws side 2 from the whole repertoire, and it warns.
  const onePool = new Map(range(1, 24).map((id) => [id, ['1']]));
  const test = c.cardsCheck([normal(8, range(1, 12), range(13, 24))], types, onePool, playable);
  assert.equal(test.status, 'warn');
  assert.match(test.detail, /pool 2 has no songs here/);
});

test('cards with songs in two pools (D268): a shared song fits a side of either pool; a song only in pool 2 fails on a pool 1 side', () => {
  const pools = new Map<number, readonly string[]>([...range(1, 12).map((id) => [id, ['1']] as const), ...range(13, 24).map((id) => [id, ['2']] as const), [25, ['1', '2']]]);
  const playable = new Set(pools.keys());
  const types = [{ type: 'normal', sides: [{ side: 1, pool: '1' }, { side: 2, pool: '2' }] }];
  const normal = (id: number, side1: number[], side2: number[]) => ({ id, type: 'normal', sides: [{ side: 1, lines: lines(side1) }, { side: 2, lines: lines(side2) }] });
  // Song 25 is in both pools: on side 1 (pool 1) and on side 2 (pool 2) alike.
  assert.equal(c.cardsCheck([normal(1, [...range(1, 11), 25], [...range(13, 23), 25])], types, pools, playable).status, 'pass');
  const wrong = c.cardsCheck([normal(2, [...range(1, 11), 13], range(13, 24))], types, pools, playable);
  assert.equal(wrong.status, 'fail');
  assert.match(wrong.detail, /card 2 side 1 has song 13 from pool 2, not pool 1/);
  // A song in no pool (its songs.json entry is bad: the Songs check says why) fits no side.
  const none = c.cardsCheck([normal(3, [...range(1, 11), 26], range(13, 24))], types, new Map([...pools, [26, []]]), new Set([...playable, 26]));
  assert.match(none.detail, /card 3 side 1 has song 26 from no pool, not pool 1/);
  const shared = new Map<number, readonly string[]>([...pools, [27, ['2', '3']]]);
  assert.match(c.cardsCheck([normal(4, [...range(1, 11), 27], range(13, 24))], types, shared, new Set([...playable, 27])).detail, /song 27 from pools 2, 3, not pool 1/);
  // An unknown id is still not in the repertoire.
  assert.match(c.cardsCheck([normal(5, [...range(1, 11), 99], range(13, 24))], types, pools, playable).detail, /card 5 has song 99, not in the repertoire/);
});

test("card-types.json's types and sides, the songs' pools, and the printed cards by type", () => {
  assert.deepEqual(c.printedCardTypes([{ type: 'normal', name: 'Cartró normal', sides: [{ side: 1, pool: '1' }] }, { type: 'especial' }]), [{ type: 'normal', sides: [{ side: 1, pool: '1' }] }, { type: 'especial' }]);
  assert.equal(c.printedCardTypes(null), null);
  assert.equal(c.printedCardTypes([]), null);
  assert.equal(c.printedCardTypes([{ type: 'Not-An-Id' }]), null);
  assert.deepEqual([...c.songPools([{ id: 1, pools: ['1'] }, { id: 2, pools: ['1', '2'] }, { title: 'no id', pools: ['1'] }]).pools], [[1, ['1']], [2, ['1', '2']]]);
  assert.deepEqual(c.songPools([{ id: 1, pools: ['1'] }]).problems, []);
  assert.deepEqual([...(c.printedByType([{ type: 'normal' }, { type: 'normal' }, { type: 'especial' }]) ?? [])], [['normal', 2], ['especial', 1]]);
});

test("card types (D266): the screens' reader must read card-types.json, or every phone shows stand-in names in grey", () => {
  const good = () => [
    { type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: 'Quina', priceCents: 150, priceRule: 'perRegularRound', sides: [
      { side: 1, pool: '1', label: '1–5', checkLabel: 'Normal 1–5', heading: 'QUINES 1–5' },
      { side: 2, pool: '2', label: '6–10', checkLabel: 'Normal 6–10', heading: 'QUINES 6–10' },
    ] },
    { type: 'especial', name: 'Cartró especial', shortName: 'Especial', color: '#ffd9e8', title: 'Quina', priceCents: 500, priceRule: 'fixed', sides: [
      { side: 1, pool: '1', checkLabel: 'Desgraciat', heading: 'DESGRACIAT' },
      { side: 2, pool: '2', checkLabel: 'Especial', heading: 'ESPECIAL' },
    ] },
  ] as Record<string, unknown>[];
  const ok = c.cardTypesCheck(good());
  assert.equal(ok?.status, 'pass');
  assert.equal(ok?.detail, 'Normal: «Normal 1–5», «Normal 6–10»; Especial: «Desgraciat», «Especial»');

  const noCheckLabel = good();
  delete ((noCheckLabel[0]?.sides as Record<string, unknown>[])[1] as Record<string, unknown>).checkLabel;
  const side = c.cardTypesCheck(noCheckLabel);
  assert.equal(side?.status, 'fail');
  assert.match(side?.detail ?? '', /^card-types\.json: card type "normal", side 2 has no checkLabel: the screens read no card types from it, so the phones and the projector show stand-in names/);
  assert.match(side?.detail ?? '', /in grey/);

  const noShortName = good();
  delete noShortName[1]?.shortName;
  const type = c.cardTypesCheck(noShortName);
  assert.equal(type?.status, 'fail');
  assert.match(type?.detail ?? '', /^card-types\.json: card type "especial" has no shortName: /);

  const blankLabel = good();
  ((blankLabel[1]?.sides as Record<string, unknown>[])[0] as Record<string, unknown>).checkLabel = '  ';
  assert.match(c.cardTypesCheck(blankLabel)?.detail ?? '', /card type "especial", side 1 has no checkLabel/, 'blank is missing');

  const badColour = good();
  (badColour[0] as Record<string, unknown>).color = 'blue';
  assert.match(c.cardTypesCheck(badColour)?.detail ?? '', /^card-types\.json: not what apps\/cards writes: /, 'anything else the reader refuses fails too');

  assert.equal(c.cardTypesCheck(null), null, 'no card-types.json: the cards check warns');
});

test("songs' pools (D268): only `pools` counts, never the older `pool`; a song without a valid list is reported, not put in a pool", () => {
  const read = c.songPools([
    { id: 1, pools: ['1'] },
    { id: 2, pool: '1' },
    { id: 3, pools: [] },
    { id: 4, pools: ['Pool 1', 2] },
    { id: 5, pools: ['1', '1'] },
    { id: 6, pool: '1', pools: ['2'] },
    { id: 7, pools: ['2', '1'] },
  ]);
  assert.deepEqual([...read.pools], [[1, ['1']], [2, []], [3, []], [4, []], [5, []], [6, ['2']], [7, ['2', '1']]], 'unsorted is fine; the bad ones stay in the repertoire with no pool');
  assert.deepEqual(read.problems, [
    'song 2 has no pools',
    'song 3 has pools [], not a list of distinct pool ids ("1", "2")',
    'song 4 has pools ["Pool 1",2], not a list of distinct pool ids ("1", "2")',
    'song 5 has pools ["1","1"], not a list of distinct pool ids ("1", "2")',
  ]);
  // Both fields, disagreeing: `pools` wins, `pool` is ignored.
  assert.deepEqual(c.poolSongCounts([{ id: 6, pool: '1', pools: ['2'] }]), { '2': 1 });
  // The Songs check fails on them: no round can shuffle a song in no pool.
  const songs = new Set([1, 2, 3]);
  const bad = c.songsCheck(songs, songs, [], read.problems);
  assert.equal(bad.status, 'fail');
  assert.match(bad.detail, /^songs.json: song 2 has no pools; song 3 .*; song 5 .*; no round can shuffle those songs$/);
});

test("the Game plan: it must pass the protocol's check, and every round's card type must be printed", () => {
  const printed = new Map([['normal', 399], ['especial', 300]]);
  const ok = c.planCheck(PLAN, printed);
  assert.equal(ok.status, 'pass');
  assert.match(ok.detail, /"Quina Musical", 2 rounds \(1 normal, 1 especial\), edition 26/);
  assert.equal(c.planCheck(null, printed).status, 'warn');
  // A round of a type nobody printed could never be won.
  const groc = c.planCheck({ ...PLAN, rounds: PLAN.rounds.map((r) => (r.number === 2 ? { ...r, cardType: 'groc' } : r)) }, printed);
  assert.equal(groc.status, 'fail');
  assert.match(groc.detail, /round 2 plays "groc" cards, but no printed card has that type/);
  // Without cards.json the cards check fails already: the plan isn't held against it.
  assert.equal(c.planCheck(PLAN, null).status, 'pass');
  // A plan the screens would refuse.
  assert.equal(c.planCheck({ ...PLAN, rounds: 'many' }, printed).status, 'fail');
  // An older plan reads as the current one: v2's card types give each round its type.
  const { rounds, ...rest } = PLAN;
  const v2 = { ...rest, v: 2, cardTypes: [], rounds: rounds.map((r) => ({ number: r.number, kind: r.kind, line: r.line, bingo: r.bingo })) };
  assert.equal(c.planCheck(v2, printed).status, 'pass');
});

test('songs, sounds and media files', () => {
  const songs = new Set([1, 2, 3]);
  assert.equal(c.songsCheck(songs, songs, [], []).status, 'pass');
  assert.equal(c.songsCheck(songs, new Set([1, 2]), [], []).status, 'warn');
  assert.equal(c.songsCheck(songs, songs, [2], []).status, 'fail');
  assert.equal(c.songsCheck(songs, new Set(), [], []).status, 'fail');
  assert.deepEqual(c.soundsCheck([], 4, []).map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.soundsCheck(['mkwii-mission-clear'], 4, ['windows-error-remix']).map((x) => x.status), ['fail', 'fail']);
  const reference = { source: 'the cloud', files: { 'cache/1/mix.flac': { size: 3, sha256: 'a'.repeat(64) }, 'covers/1.jpg': { size: 1, sha256: 'b'.repeat(64) } } };
  const same = new Map(Object.entries(reference.files));
  assert.equal(c.mediaCheck(reference, same, true).status, 'pass');
  assert.equal(c.mediaCheck(reference, new Map([...same].slice(0, 1)), true).status, 'fail', 'a missing file');
  assert.equal(c.mediaCheck(reference, new Map([...same, ['covers/1.jpg', { size: 1, sha256: 'c'.repeat(64) }]]), true).status, 'fail', 'a changed file');
  assert.equal(c.mediaCheck(null, same, true).status, 'warn');
});

test('the relay, the LAN and the cloud', () => {
  assert.equal(c.relayCheck('default', { ok: true, name: 'default' }).status, 'pass');
  assert.equal(c.relayCheck('2026', { ok: true, name: 'default' }).status, 'fail', 'the wrong repertoire');
  assert.equal(c.relayCheck('default', { ok: false, error: 'ECONNREFUSED' }).status, 'fail');
  assert.equal(c.showPageCheck([{ role: 'show' }, { role: 'tablet' }]).status, 'pass');
  assert.equal(c.showPageCheck([{ role: 'tablet' }]).status, 'warn');
  assert.equal(c.lanCheck(null, false).status, 'warn');
  assert.equal(c.lanCheck('http://192.168.1.2:5174/console/', false).status, 'fail');
  assert.equal(c.cloudCheck('https://x', { ok: false, error: 'timeout' }, '26').status, 'fail');
  assert.equal(c.cloudCheck('https://x', { ok: true, edition: '25' }, '26').status, 'fail', 'the wrong edition');
  assert.equal(c.cloudAuthCheck({ ok: false, status: 403 }).status, 'fail');
  assert.equal(c.cloudAuthCheck({ ok: true, rttMs: 80, offsetMs: 40 }).status, 'pass');
  assert.equal(c.cloudAuthCheck({ ok: true, rttMs: 80, offsetMs: -3500 }).status, 'warn', 'the laptop clock is off');
  assert.equal(c.cloudAuthCheck({ ok: true, rttMs: 80, offsetMs: 90_000 }).status, 'fail', 'a minute and a half: the doors cues would play at the wrong time (D203)');
  // The clock against time.apple.com, with or without the cloud (sntp's output: the offset to apply, ± the error).
  assert.equal(c.clockCheck('+0.001106 +/- 0.061031 time.apple.com 17.253.14.45\n').status, 'pass');
  assert.match(c.clockCheck('-3.5 +/- 0.05 time.apple.com 17.253.14.45').detail, /ahead time.apple.com by 3500 ms/);
  assert.equal(c.clockCheck('-3.5 +/- 0.05 time.apple.com 17.253.14.45').status, 'warn');
  assert.equal(c.clockCheck('+125.2 +/- 0.05 time.apple.com 17.253.14.45').status, 'fail');
  assert.equal(c.clockCheck(null).status, 'warn', 'no internet: compare it with a phone');
  assert.equal(c.clockCheck('sntp: Exchange failed: Timeout').status, 'warn');
});

test("Reduce motion: on warns (the projector's drum would spin in its calm mode, unlike the phones'), off or never set passes", () => {
  const ok = (stdout: string) => ({ ok: true, stdout, stderr: '' });
  const failed = (stderr: string) => ({ ok: false, stdout: '', stderr });
  const on = c.reduceMotionCheck(ok('1\n'));
  assert.equal(on.status, 'warn');
  assert.match(on.detail, /Turn off Reduce motion: System Settings → Accessibility → Display/);
  assert.equal(c.reduceMotionCheck(ok('0\n')).status, 'pass');
  // defaults' own words when the key or the whole domain was never written: the default, off.
  assert.equal(c.reduceMotionCheck(failed("Error: Could not find key 'reduceMotion' in domain 'com.apple.universalaccess'.\n")).status, 'pass');
  assert.equal(c.reduceMotionCheck(failed("Error: Domain 'com.apple.universalaccess' not found.\n")).status, 'pass');
  assert.equal(c.reduceMotionCheck(failed('The domain/default pair of (com.apple.universalaccess, reduceMotion) does not exist\n')).status, 'pass');
  // Any other failure (a timeout, no defaults) or an odd answer: couldn't read it, look by hand.
  assert.equal(c.reduceMotionCheck(failed('spawn defaults ENOENT')).status, 'warn');
  assert.match(c.reduceMotionCheck(failed('')).detail, /^couldn't read it/);
  assert.equal(c.reduceMotionCheck(ok('maybe')).status, 'warn');
});

test('voice cues (D198, D202–D204): FAIL a cue missing or without its file, WARN while any is a placeholder', () => {
  const names = [...VOICE_CUES, 'chime', 'fanfare'];
  const all = (placeholder: (name: string) => boolean) => ({ schemaVersion: 1, voices: names.map((name) => ({ name, durationSec: 1, placeholder: placeholder(name) })) });
  assert.equal(c.voicesCheck(null, () => true).status, 'fail');
  assert.equal(c.voicesCheck(all(() => false), () => true).status, 'pass');
  const warn = c.voicesCheck(all((n) => n !== 'start'), () => true);
  assert.equal(warn.status, 'warn');
  assert.match(warn.detail, new RegExp(`^${names.length - 1} of ${names.length} voice cues are still placeholders`));
  const noFile = c.voicesCheck(all(() => false), (n) => n !== 'goodbye');
  assert.equal(noFile.status, 'fail');
  assert.match(noFile.detail, /goodbye$/);
  const unlisted = c.voicesCheck({ voices: all(() => false).voices.filter((v) => v.name !== 'fanfare') }, () => true);
  assert.match(unlisted.detail, /: fanfare$/);
});

test('provisional hooks (D227): WARN while a playable song lands on a bulk-approved best hook', () => {
  const song = (id: number, provisional?: boolean) => ({ id, hooks: [{ tag: 'best', valid: true, ...(provisional === undefined ? {} : { provisional }) }, { tag: 'alt', valid: true, provisional: true }] });
  assert.equal(c.provisionalHooksCheck([]), null);
  assert.equal(c.provisionalHooksCheck([song(1), song(2, false)])?.status, 'pass', "an alternative's flag doesn't count");
  const warn = c.provisionalHooksCheck([song(1), song(7, true), song(9, true)])!;
  assert.equal(warn.status, 'warn');
  assert.match(warn.detail, /^2 of 3 songs land on a provisional hook.*audition page \(songs 7, 9\)$/);
  const many = c.provisionalHooksCheck(Array.from({ length: 20 }, (_, i) => song(i + 1, true)))!;
  assert.match(many.detail, /songs 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12…\)$/);
});

test("the show's build: FAIL, with the fix, unless apps/show/dist was built from the sources checked out", () => {
  const stale = c.distCheck('dist/ was built on 25 Nov 2026, 05:39 from other sources: 3 file(s) changed since (apps/show/engine/src/pausa.ts)');
  assert.equal(stale.status, 'fail');
  assert.match(stale.detail, /^apps\/show\/dist\/ was built on 25 Nov 2026.*: cd apps\/show && npm run build, then restart the relay$/);
  assert.equal(c.distCheck('dist/ has no build stamp (dist/build.json): it was built before stamps or by hand').status, 'fail');
  assert.equal(c.distCheck(null).status, 'pass');
});

test('the cloud link and the Game', () => {
  const now = 1_000_000;
  const status: c.LinkStatusFile = { updatedAtMs: now - 3000, cloud: 'online', gameId: 'g1', journalled: 40, ackSeq: 40, pending: 0, uploader: { kind: 'syncing' } };
  assert.equal(c.linkCheck(status, now).status, 'pass');
  assert.equal(c.linkCheck(null, now).status, 'fail');
  assert.equal(c.linkCheck({ ...status, updatedAtMs: now - 120_000 }, now).status, 'fail', 'the link died');
  assert.equal(c.linkCheck({ ...status, uploader: { kind: 'stopped', reason: 'conflict' } }, now).status, 'fail');
  assert.equal(c.linkCheck({ ...status, cloud: 'replaced' }, now).status, 'fail');
  assert.equal(c.linkCheck({ ...status, pending: 3 }, now).status, 'warn');
  assert.equal(c.gameCheck(status, { gameId: 'g1', seq: 40 }, '26').status, 'pass');
  assert.equal(c.gameCheck(status, { gameId: 'rehearsal', seq: 300 }, '26').status, 'warn');
  assert.equal(c.gameCheck(status, null, null).status, 'warn');
  assert.equal(c.exitCode([{ group: 'Repertoire', name: 'x', status: 'warn', detail: '' }]), 0);
  assert.equal(c.exitCode([{ group: 'Repertoire', name: 'x', status: 'fail', detail: '' }]), 1);
});

test('the daily usage: WARN from 60 %, FAIL from 85 %, with the reset time in Catalonia', () => {
  const stats = (shareRequests: number): c.CloudStats => ({
    phonesConnected: 120,
    today: {
      billedRequests: Math.round(shareRequests * 100_000),
      rowsRead: 0,
      rowsWritten: 0,
      phonesPeak: 180,
      limits: { requests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000 },
      shares: { requests: shareRequests, rowsRead: 0, rowsWritten: 0.01 },
      level: shareRequests >= 0.85 ? 'fail' : shareRequests >= 0.6 ? 'warn' : 'ok',
      resetAtMs: Date.UTC(2026, 11, 21),
    },
    link: { online: true, lastSeenAgoMs: 1000, journalDelayMs: 1200 },
  });
  const night = Date.UTC(2026, 11, 20, 21, 30); // 22:30 in Catalonia
  const ok = c.usageCheck(stats(0.21), night);
  assert.equal(ok.status, 'pass');
  assert.match(ok.detail, /requests 21 % \(21,000 of 100,000\)/);
  assert.match(ok.detail, /120 phones now, 180 at most today; resets at 01:00 \(in 2 h 30 min\)/);
  assert.match(ok.detail, /1\.2 s late/);
  assert.equal(c.usageCheck(stats(0.6), night).status, 'warn');
  assert.equal(c.usageCheck(stats(0.9), night).status, 'fail');
  assert.equal(c.usageCheck(null, night).status, 'warn');
});

test('without the tablet: a console must be open on the laptop, and the LAN address is optional', () => {
  const show = { role: 'show' };
  assert.equal(c.consoleCheck([show, { role: 'tablet' }], true).status, 'pass');
  assert.equal(c.consoleCheck([show], true).status, 'fail');
  assert.equal(c.consoleCheck([show], false).status, 'warn', 'with the tablet, it may just not be open yet');
  assert.equal(c.consoleCheck(null, true).status, 'warn');
  assert.equal(c.lanCheck('http://172.20.10.2:5174/console/', false).status, 'fail');
  assert.equal(c.lanCheck('http://172.20.10.2:5174/console/', false, true).status, 'warn');
});

test("the console's LAN address: the default route's interface, not an earlier VPN or network; a VPN on the default route warns", () => {
  // `route -n get default` on macOS.
  const route = (iface: string) => [
    '   route to: default', 'destination: default', '       mask: default', '    gateway: 192.168.10.1', `  interface: ${iface}`,
    '      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>', ' recvpipe  sendpipe  ssthresh  rtt,msec    rttvar  hopcount      mtu     expire',
    '       0         0         0         0         0         0      1500         0 ', '',
  ].join('\n');
  const v4 = (address: string, internal = false) => ({ address, family: 'IPv4', internal });
  const interfaces = {
    lo0: [v4('127.0.0.1', true), { address: '::1', family: 'IPv6', internal: true }],
    utun4: [v4('172.26.205.80')],
    en0: [{ address: 'fe80::1', family: 'IPv6', internal: false }, v4('192.168.10.153')],
  };
  assert.equal(c.defaultRouteInterface(route('en0')), 'en0');
  assert.equal(c.defaultRouteInterface(''), null);
  assert.equal(c.defaultRouteInterface('route: writing to routing socket: not in table'), null);
  assert.equal(c.defaultRouteInterface(null), null);

  // The default route's en0, over a utun listed first (the 28 Nov relay printed 172.26.205.80; the tablet needed 192.168.10.153).
  const lan = c.lanAddressFrom(route('en0'), interfaces);
  assert.deepEqual(lan, { address: '192.168.10.153', iface: 'en0', others: [{ address: '172.26.205.80', iface: 'utun4' }] });
  assert.equal(c.lanAddressFrom(route('en5'), { en0: [v4('10.0.0.4')], en5: [v4('172.20.10.2')] })?.address, '172.20.10.2', 'over an earlier network');
  // No route, garbage, or a default interface without an IPv4: the first non-internal IPv4, as before.
  for (const output of [null, '', 'garbage\n', route('en9')]) assert.equal(c.lanAddressFrom(output, interfaces)?.address, '172.26.205.80');
  assert.equal(c.lanAddressFrom(route('en0'), { lo0: [v4('127.0.0.1', true)] }), null);
  assert.equal(c.lanAddressFrom(null, { en0: [{ address: '10.0.0.4', family: 4, internal: false }] })?.address, '10.0.0.4', "early Node 18's numeric family");

  // A VPN on the default route: never a silent PASS, reachable or not, and the other addresses are named.
  const vpn = c.lanAddressFrom(route('utun4'), interfaces);
  assert.equal(vpn?.address, '172.26.205.80');
  for (const [reachable, laptopOnly] of [[true, false], [false, false], [false, true]] as const) {
    const v = c.lanCheck('http://172.26.205.80:5174/console/', reachable, laptopOnly, vpn);
    assert.equal(v.status, 'warn');
    assert.match(v.detail, /VPN is on \(utun4\).*172\.26\.205\.80.*turn the VPN off.*cloud console.*192\.168\.10\.153 on en0/i);
  }
  for (const iface of ['utun0', 'ipsec0', 'ppp0']) assert.ok(c.isVpnInterface(iface), iface);
  for (const iface of ['en0', 'en5', 'bridge100']) assert.ok(!c.isVpnInterface(iface), iface);

  // Not a VPN: as before, with the other addresses named on a PASS.
  const pass = c.lanCheck('http://192.168.10.153:5174/console/', true, false, lan);
  assert.equal(pass.status, 'pass');
  assert.match(pass.detail, /172\.26\.205\.80 on utun4/);
  assert.equal(c.lanCheck('http://192.168.10.153:5174/console/', false, false, lan).status, 'fail');
  assert.equal(c.lanCheck('http://192.168.10.153:5174/console/', false, true, lan).status, 'warn');
  assert.equal(c.lanCheck('http://192.168.10.153:5174/console/', true).detail, "http://192.168.10.153:5174/console/ (if the tablet can't open it, the hotspot isolates its clients: see the runbook)");
  assert.equal(c.lanCheck(null, false, false, null).status, 'warn');
});

test('the projector: connected, and never mirroring the laptop when the console is on its screen', () => {
  const display = (name: string, internal: boolean, mirror = false, main = false) => ({
    _name: name,
    spdisplays_connection_type: internal ? 'spdisplays_internal' : 'spdisplays_displayport',
    spdisplays_main: main ? 'spdisplays_yes' : 'spdisplays_no',
    spdisplays_mirror: mirror ? 'spdisplays_on' : 'spdisplays_off',
    spdisplays_online: 'spdisplays_yes',
  });
  const profile = (...ds: object[]) => ({ SPDisplaysDataType: [{ spdisplays_ndrvs: ds }] });
  const separate = c.displaysCheck(profile(display('Color LCD', true, false, true), display('EPSON PJ', false)), true);
  assert.equal(separate.status, 'pass');
  assert.match(separate.detail, /EPSON PJ, a separate display \(main display: Color LCD\)/);
  assert.equal(c.displaysCheck(profile(display('Color LCD', true)), false).status, 'warn', 'no projector yet');
  const mirrored = profile(display('Color LCD', true, true, true), display('EPSON PJ', false, true));
  assert.equal(c.displaysCheck(mirrored, true).status, 'fail', "the console's secrets would be on the projector");
  assert.equal(c.displaysCheck(mirrored, false).status, 'warn');
  assert.equal(c.displaysCheck(null, false).status, 'warn');
});

test('the Wii remote: optional, so it only warns; connected, battery, and when it last dropped', () => {
  const now = 1_800_000_000_000;
  const ok = c.wiiRemoteCheck({ connected: true, battery: 0.8, sinceMs: now - 12 * 60_000 }, now);
  assert.equal(ok.status, 'pass');
  assert.match(ok.detail, /connected for 12 min, battery 80%/);
  assert.equal(c.wiiRemoteCheck({ connected: true, battery: 0.1, sinceMs: now }, now).status, 'warn');
  assert.match(c.wiiRemoteCheck({ connected: false, battery: 0.9, sinceMs: now - 3 * 60_000 }, now).detail, /disconnected 3 min ago.*range/);
  assert.equal(c.wiiRemoteCheck({ connected: true, battery: null, sinceMs: now }, now).status, 'pass');
  // Drops over the host's last 10 minutes (Frontend's 150f213): one is shown, two warn, as the console does.
  const one = c.wiiRemoteCheck({ connected: true, battery: 0.8, sinceMs: now - 60_000, drops: 1, lastDropMs: now - 4 * 60_000 }, now);
  assert.equal(one.status, 'pass');
  assert.match(one.detail, /1 drop in the last 10 min, the latest 4 min ago/);
  const edge = c.wiiRemoteCheck({ connected: true, battery: 0.8, sinceMs: now - 60_000, drops: 2, lastDropMs: now - 60_000 }, now);
  assert.equal(edge.status, 'warn');
  assert.match(edge.detail, /dropped 2 times.*edge of its range/);
  assert.match(c.wiiRemoteCheck({ connected: true, battery: 0.8, sinceMs: now, drops: 0, lastDropMs: null }, now).detail, /no drops in the last 10 min/);
  assert.equal(c.wiiRemoteCheck({ connected: true, battery: 0.22, sinceMs: now }, now).status, 'pass', "the console's own low mark is 20 %");
  assert.equal(c.wiiRemoteCheck(null, now).status, 'warn');
  assert.match(c.wiiRemoteCheck(null, now).detail, /Pair it once with MacWiiPair and its SYNC button, then on this laptop's console: Comandament → Connectar/);
});

test('audio clock (D284): a stalled one fails with the runbook\'s fix; a clock that advances passes; no show page says nothing', () => {
  const now = 1_800_000_000_000;
  const show = [{ role: 'show' }, { role: 'tablet' }];
  const stalled = c.audioClockCheck(show, { audioStalled: { sinceMs: now - 42_000 } }, now);
  assert.equal(stalled?.status, 'fail');
  assert.equal(stalled?.group, 'Network');
  assert.match(stalled?.detail ?? '', /stalled for 42 s/);
  assert.match(stalled?.detail ?? '', /the drum and the Shuffle stay frozen and Next never lands/);
  assert.match(stalled?.detail ?? '', /Quit every Chrome window.*sudo killall coreaudiod.*restart the Mac/);
  assert.match(stalled?.detail ?? '', /night runbook, "When something goes wrong"/);
  assert.equal(c.audioClockCheck(show, { audioStalled: null }, now)?.status, 'pass');
  assert.equal(c.audioClockCheck(show, {}, now)?.status, 'pass', 'a show page from before D284 sends no field');
  assert.equal(c.audioClockCheck(show, null, now), null, 'no state yet: the show page check speaks');
  assert.equal(c.audioClockCheck(null, null, now), null, 'no relay: the relay check speaks');
  assert.equal(c.audioClockCheck([{ role: 'tablet' }], { audioStalled: { sinceMs: now } }, now), null, "the relay's last state from a show page that has gone");
});

test('card prices (U5): every card type a round plays has a price and a known rule', () => {
  const types = [
    { type: 'normal', name: 'Cartró normal', priceCents: 300 },
    { type: 'especial', name: 'Cartró especial', priceCents: 500, priceRule: 'fixed' },
  ];
  const ok = c.cardPricesCheck(types, PLAN);
  assert.equal(ok?.status, 'pass');
  // Round 1 is the plan's only normal round: 3,00 € a round, so 3,00 € before it (the protocol's roundCardPrice).
  assert.match(ok?.detail ?? '', /normal 3,00 € a round \(3,00 € before round 1\); especial 5,00 €/);
  assert.equal(c.cardPricesCheck([{ type: 'normal', priceCents: null }, types[1]], PLAN)?.status, 'warn');
  assert.equal(c.cardPricesCheck([{ ...types[0], priceRule: 'perGame' }, types[1]], PLAN)?.status, 'fail');
  assert.equal(c.cardPricesCheck(types, null), null, 'no plan: the plan check speaks');
});

test('card sides (D178): each round plays a printed side whose pool has songs; a printed side no round plays only warns', () => {
  assert.deepEqual(c.poolSongCounts([{ id: 1, pools: ['1'] }, { id: 2, pools: ['2'] }, { id: 3, pools: ['1', '2'] }, { id: 4 }]), { '1': 2, '2': 2 }, 'a song in two pools counts in both (D268); one without pools in none');
  assert.equal(c.sharedSongCount([{ id: 1, pools: ['1'] }, { id: 3, pools: ['1', '2'] }]), 1);
  const oneSide = [{ type: 'normal' }, { type: 'especial' }];
  const twoSides = [{ type: 'normal', sides: [{ side: 1, pool: '1' }, { side: 2, pool: '2' }] }, { type: 'especial' }];
  assert.equal(c.sidesCheck(PLAN, oneSide, { '1': 70 }, 0)?.status, 'pass', 'a type from before sides: one side 1 on pool 1');
  const onBoth = { ...PLAN, rounds: PLAN.rounds.map((r) => (r.number === 2 ? { ...r, cardType: 'normal', side: 2 } : r)) };
  const shared = c.sidesCheck(onBoth, [twoSides[0]], { '1': 70, '2': 70 }, 4);
  assert.equal(shared?.status, 'pass', shared?.detail ?? '');
  assert.match(shared?.detail ?? '', /\(pool 1: 70 songs, pool 2: 70 songs, 4 in both\)/);
  const unplayed = c.sidesCheck(PLAN, twoSides, { '1': 70, '2': 70 }, 0);
  assert.equal(unplayed?.status, 'warn');
  assert.match(unplayed?.detail ?? '', /no round plays side 2 of card type "normal"/);
  const onSide2 = { ...PLAN, rounds: PLAN.rounds.map((r) => (r.number === 1 ? { ...r, side: 2 } : r)) };
  const unprinted = c.sidesCheck(onSide2, oneSide, { '1': 70 }, 0);
  assert.equal(unprinted?.status, 'fail');
  assert.match(unprinted?.detail ?? '', /round 1: card type "normal" has no side 2/);
  const noSongs = c.sidesCheck(onSide2, twoSides, { '1': 70 }, 0);
  assert.equal(noSongs?.status, 'fail');
  assert.match(noSongs?.detail ?? '', /round 1: side 2 plays pool 2, which has no songs/);
  assert.equal(c.sidesCheck(null, oneSide, {}, 0), null, 'no plan: the plan check speaks');
  assert.equal(c.sidesCheck(PLAN, null, {}, 0), null, 'no card-types.json: the cards check speaks');
});

test("card prices as in 2025 (D69), the Desgraciat on special cards (D70): 15 € before round 1, the special card's 5 € before the Desgraciat", () => {
  const [normal, special] = PLAN.rounds as [GamePlan['rounds'][number], GamePlan['rounds'][number]];
  const rounds = [
    ...Array.from({ length: 10 }, (_, i) => ({ ...normal, number: i + 1 })),
    { ...special, number: 11, kind: 'desgraciat' as const, cardType: 'especial' },
    { ...special, number: 12 },
  ];
  const plan: GamePlan = { ...PLAN, rounds };
  const normalCard = { type: 'normal', name: 'Cartró normal', priceCents: 150, priceRule: 'perRegularRound' as const };
  const specialCard = { type: 'especial', name: 'Cartró especial', priceCents: 500, priceRule: 'fixed' as const };
  const ok = c.cardPricesCheck([normalCard, specialCard], plan);
  assert.equal(ok?.status, 'pass');
  assert.match(ok?.detail ?? '', /normal 1,50 € a round \(15,00 € before round 1\); especial 5,00 €/);
  // What the projector shows at each Interval (the protocol's roundCardPrice): never the Desgraciat counted.
  assert.equal(roundCardPrice(plan, 10, normalCard), 150, 'a normal card before round 10: one regular round left');
  assert.equal(roundCardPrice(plan, 11, specialCard), 500, 'the special card before the Desgraciat');
  assert.equal(roundCardPrice(plan, 12, specialCard), 500, 'and before the Quina Especial');
});
