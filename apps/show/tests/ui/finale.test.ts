// The Desgraciat's finale as the screens lay it out (packages/rules/finale.ts), the paper confetti they share
// (packages/ui/motion/paper-confetti.ts), and the finale fixtures checked against the printed cards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { FinaleInfo } from '@quina/protocol';
import { cardFace, parseCards } from '../../../../packages/ui/data/catalog.ts';
import { FINALE_FALLS, FINALE_FINALISTS, FINALE_LANDED_SAVED, DESGRACIAT_LANDED, DESGRACIAT_STANDING_AFTER, FIXTURES } from '../../../../packages/ui/fixtures/states.ts';
import { FINALE_POSES, fellAtLanding, finaleLook, finaleRow, finaleSaved } from '../../../../packages/rules/finale.ts';
import { paperAlpha, paperPieces, stepPaper } from '../../../../packages/ui/motion/paper-confetti.ts';

const NOW = 1_800_000_000_000;
const CARDS_JSON = new URL('../../../cards/dist/cards.json', import.meta.url);

const finale = (patch: Partial<FinaleInfo> = {}): FinaleInfo => ({
  cardIds: [57, 12, 34],
  standing: [57, 12, 34],
  fallen: [],
  winner: null,
  cued: false,
  ...patch,
});

test('each finalist keeps one look, by the order entered; 20 finalists never share one', () => {
  const looks = Array.from({ length: 20 }, (_, i) => finaleLook(i));
  assert.equal(new Set(looks.map((l) => `${l.pose}/${l.hue}`)).size, 20);
  assert.deepEqual(looks.slice(0, FINALE_POSES.length).map((l) => l.pose), [...FINALE_POSES]);
  assert.ok(looks.slice(0, FINALE_POSES.length).every((l) => l.hue === 0), "the first eight keep their drawings' colours");
  const row = finaleRow(finale(), { position: 3, spinning: false });
  assert.deepEqual(row.map((s) => s.cardId), [12, 34, 57], 'ascending, so they can line up');
  assert.deepEqual(row.find((s) => s.cardId === 57)?.look, finaleLook(0), '#57 was entered first');
  assert.deepEqual(finaleRow(finale(), { position: 3, spinning: false }, true).map((s) => s.cardId), [57, 34, 12], '«Al revés»');
});

test('a fallen finalist stays faded at their place until the next Spin, then leaves', () => {
  const f = finale({ standing: [57, 34], fallen: [{ cardId: 12, position: 7, songId: 5, atMs: NOW }] });
  assert.deepEqual(finaleRow(f, { position: 7, spinning: false }).map((s) => [s.cardId, s.fate]), [[12, 'fallen'], [34, 'standing'], [57, 'standing']]);
  assert.deepEqual(finaleRow(f, { position: 7, spinning: true }).map((s) => s.cardId), [34, 57], 'the Spin clears them');
  assert.deepEqual(finaleRow(f, { position: 8, spinning: false }).map((s) => s.cardId), [34, 57], 'a later landing too');
  assert.deepEqual(fellAtLanding(f, 7), [12]);
});

test('the winner stands with the ones that fell at the last landing; a removed finalist is gone', () => {
  const f = finale({
    cardIds: [57, 12],
    standing: [57],
    fallen: [{ cardId: 12, position: 9, songId: 5, atMs: NOW }],
    winner: { cardId: 57, position: 9, songId: 5, atMs: NOW },
  });
  assert.deepEqual(finaleRow(f, { position: 9, spinning: false }).map((s) => [s.cardId, s.fate]), [[12, 'fallen'], [57, 'winner']]);
  assert.deepEqual(finaleRow(finale({ cardIds: [57, 34], standing: [57, 34] }), { position: 9, spinning: false }).map((s) => s.cardId), [34, 57]);
});

test('«Salvats!»: the landing is on every standing card and nobody fell at it', () => {
  const songs: Record<number, number[]> = { 57: [1, 2, 3], 12: [3, 4], 34: [3, 9] };
  const songsOf = (id: number) => songs[id] ?? null;
  assert.equal(finaleSaved(finale(), { position: 4, songId: 3 }, songsOf), true);
  assert.equal(finaleSaved(finale(), { position: 4, songId: 4 }, songsOf), false, 'only on some cards');
  assert.equal(finaleSaved(finale({ standing: [57, 12], fallen: [{ cardId: 34, position: 4, songId: 3, atMs: NOW }] }), { position: 4, songId: 3 }, songsOf), false, 'someone fell at it');
  assert.equal(finaleSaved(finale(), { position: 4, songId: 3 }, (id) => (id === 34 ? null : songsOf(id))), false, 'an unknown card is never a guess');
  assert.equal(finaleSaved(finale({ standing: [57], winner: { cardId: 57, position: 3, songId: 9, atMs: NOW } }), { position: 4, songId: 3 }, songsOf), false);
  assert.equal(finaleSaved(null, { position: 4, songId: 3 }, songsOf), false);
});

test('paper confetti: a short burst up, then each piece drifts down at its own slow speed (D185)', () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pieces = paperPieces({ count: 50, width: 1440, height: 1080, colors: ['#fff'], fallShare: 0.05, random });
  assert.equal(pieces.length, 50);
  assert.ok(pieces.every((p) => p.vy < 0), 'thrown up');
  for (let i = 0; i < 600; i++) stepPaper(pieces, 1 / 60);
  // After 10 s the air has slowed every piece to its fall speed: about 55 px/s on the 1080 px box (0.7–1.3 × 54).
  assert.ok(pieces.every((p) => p.vy > 37 && p.vy < 71 && Math.abs(p.vx) < 1), 'drifting at the slow fall speed');
  assert.equal(paperAlpha(0, 9000), 1);
  assert.ok(paperAlpha(8000, 9000) < 0.5);
  assert.equal(paperAlpha(9000, 9000), 0);
});

test('the finale fixtures follow the printed cards and the D180 rule', () => {
  const { cards } = parseCards(JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8')));
  const songsOf = (id: number) => cardFace(cards.get(id)!, 1)!.lines.flat();
  // The finale among the finalists: a landing takes out each one with its song, unless it would take them all.
  const run = (ids: readonly number[]) => {
    let standing = [...FINALE_FINALISTS];
    const falls: Record<number, number[]> = {};
    ids.forEach((songId, position) => {
      const hit = standing.filter((id) => songsOf(id).includes(songId));
      if (hit.length && hit.length < standing.length) {
        if (position >= 20) falls[position] = hit;
        standing = standing.filter((id) => !hit.includes(id));
      }
    });
    return { standing, falls };
  };
  assert.deepEqual(FINALE_FINALISTS, DESGRACIAT_STANDING_AFTER[20]);
  assert.deepEqual(run(DESGRACIAT_LANDED.slice(0, 20)).standing, FINALE_FINALISTS, 'all eight stand when it starts');
  assert.deepEqual(run(DESGRACIAT_LANDED), { standing: [57], falls: FINALE_FALLS.win });
  assert.deepEqual(run(FINALE_LANDED_SAVED), { standing: [56, 81], falls: FINALE_FALLS.saved });
  assert.ok([56, 81].every((id) => songsOf(id).includes(FINALE_LANDED_SAVED.at(-1)!)), '«La Playa» is on both');

  const at = (name: string) => FIXTURES[name](NOW);
  assert.equal(at('desgraciatEleven').state.standing?.count, 11);
  assert.equal(at('desgraciatNine').state.standing?.count, 9);
  assert.deepEqual(at('finale').state.finale?.standing, FINALE_FINALISTS);
  const win = at('finaleWin').events?.[0]?.event;
  assert.ok(win?.type === 'state' && win.finale?.winner?.cardId === 57 && win.autoAtMs === null);
  const saved = at('finaleSaved').events?.[0]?.event;
  assert.ok(saved?.type === 'state' && saved.finale);
  const landing = saved.landings.at(-1)!;
  assert.equal(finaleSaved(saved.finale, landing, songsOf), true, 'the demo is a «Salvats!»');
  assert.equal(at('finaleCelebration').state.finale?.cued, true);
});
