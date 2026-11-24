// Small pure pieces of the stage: the QR path, the player app link, confetti, Catalan formatting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { playerAppLink, qrPathData } from '../../../../stage/model/qr.ts';
import { confettiPieces } from '../../../../stage/model/confetti.ts';
import { cardsLabel, joinCa, STAGE_TEXT } from '../../../../stage/strings.ts';

test('the QR path draws one run per row of dark modules, inside a quiet zone', () => {
  const dark = new Set(['0,0', '0,1', '1,1']);
  const path = qrPathData({ size: 2, isDark: (r, c) => dark.has(`${r},${c}`) }, 1);
  assert.equal(path.viewBox, 4);
  assert.equal(path.d, 'M1 1h2v1h-2zM2 2h1v1h-1z');
});

test('the QR path covers every dark module of a real code', () => {
  const code = QRCode.create('https://quina.barrakudesbegur.org/26', { errorCorrectionLevel: 'M' });
  const m = code.modules;
  const path = qrPathData({ size: m.size, isDark: (r, c) => m.get(r, c) === 1 }, 2);
  const runs = [...path.d.matchAll(/h(\d+)v1/g)].reduce((sum, r) => sum + Number(r[1]), 0);
  let darkCount = 0;
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) darkCount += m.get(r, c);
  assert.equal(runs, darkCount);
  assert.equal(path.viewBox, m.size + 4);
});

test('the player app link carries the edition', () => {
  const app = { origin: 'https://quina.barrakudesbegur.org', label: 'quina.barrakudesbegur.org' };
  assert.deepEqual(playerAppLink('26', app), { href: 'https://quina.barrakudesbegur.org/26', label: 'quina.barrakudesbegur.org/26' });
  assert.deepEqual(playerAppLink(null, app), { href: app.origin, label: app.label });
  assert.deepEqual(playerAppLink('../x', app), { href: app.origin, label: app.label });
});

test('confetti: the bursts, tones in range, from the injected source', () => {
  const pieces = confettiPieces([100, 100], 5, () => 0.5);
  assert.equal(pieces.length, 200);
  assert.deepEqual([...new Set(pieces.map((p) => p.burst))], [0, 1]);
  assert.ok(confettiPieces([50], 5, () => 1).every((p) => p.tone === 4 && p.x < 1));
});

test('Catalan lists and labels', () => {
  assert.equal(joinCa([]), '');
  assert.equal(joinCa([57]), '57');
  assert.equal(joinCa([57, 301]), '57 i 301');
  assert.equal(joinCa([12, 57, 301]), '12, 57 i 301');
  assert.equal(cardsLabel([123]), 'Cartró 123');
  assert.equal(cardsLabel([57, 301]), 'Cartrons 57 i 301');
  assert.equal(STAGE_TEXT.countdown.minutes('start', 1), "Comencem d'aquí a un minut");
  assert.equal(STAGE_TEXT.countdown.minutes('back', 5), "Tornem d'aquí a uns 5 minuts");
  assert.equal(STAGE_TEXT.winnerLine('bingo', [57, 301]), 'Quina: 57 i 301');
});
