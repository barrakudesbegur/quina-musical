// The organisers' sponsor sheet → sponsors for the plan. A made-up sheet in the real one's shape: a
// description row, the header row, category rows and business rows, plus private columns that must never be read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alreadySponsor, parseCsv, readSponsorSheet, sheetStatus, sponsorsFromSheet } from '../../../../admin/logic/sponsor-sheet.ts';

const CSV = [
  ',EXEMPLE,,"Amb què col·laboren","Si ens han enviat el logo",Si ens ho han donat,Qui té la col·laboració,Tasques,',
  ',COMERÇ,PARTICIPA,COL·LABORACIÓ,LOGO,ENTREGA,QUI HO TÉ,TASQUES,POSTS',
  ',RESTAURACIÓ,,,,,,,',
  ',Forn de Prova,Si,"Val per esmorzar, 2 persones",OK,OK,Persona A,Recollir,2',
  ',Bar Exemple,Esperant,,,,,,',
  ',Cafè Fictici,No,,,,,,',
  ',Sense Resposta,,,,,,,',
  ',BOTIGUES,,,,,,,',
  ',"Botiga ""La Prova""",PARTICIPA,"Lot de ""productes""",LOGO,Pendent ells,Persona B,,1',
].join('\r\n');

test('CSV: quotes, doubled quotes, commas and CRLF', () => {
  const rows = parseCsv('a,"b, c","d ""e"""\r\nf,g\n"h\ni",j');
  assert.deepEqual(rows, [['a', 'b, c', 'd "e"'], ['f', 'g'], ['h\ni', 'j']]);
  assert.deepEqual(parseCsv('﻿x,y'), [['x', 'y']], 'a leading BOM is dropped');
});

test('the sheet: categories, status, offer and logo per business', () => {
  const r = readSponsorSheet(parseCsv(CSV));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(
    r.entries.map((e) => [e.name, e.category, e.status, e.offer, e.hasLogo]),
    [
      ['Forn de Prova', 'Restauració', 'yes', 'Val per esmorzar, 2 persones', true],
      ['Bar Exemple', 'Restauració', 'waiting', null, false],
      ['Cafè Fictici', 'Restauració', 'no', null, false],
      ['Sense Resposta', 'Restauració', 'unknown', null, false],
      ['Botiga "La Prova"', 'Botigues', 'yes', 'Lot de "productes"', false],
    ],
  );
});

test('private columns (who holds it, delivery, to-dos) are never read', () => {
  const r = readSponsorSheet(parseCsv(CSV));
  assert.ok(r.ok);
  const text = JSON.stringify(r);
  for (const secret of ['Persona A', 'Persona B', 'Recollir', 'Pendent ells']) assert.ok(!text.includes(secret), secret);
});

test('a sheet without the header row is refused', () => {
  assert.deepEqual(readSponsorSheet(parseCsv('nom,regal\nForn,Pa')), { ok: false, reason: 'noHeader' });
});

test('status words, with or without accents', () => {
  assert.deepEqual(['Sí', 'si', 'PARTICIPA', 'Esperant resposta', 'No', '', '?'].map(sheetStatus), ['yes', 'yes', 'yes', 'waiting', 'no', 'unknown', 'unknown']);
});

test('chosen entries become sponsors with unique ids; ones already in the plan are skipped', () => {
  const r = readSponsorSheet(parseCsv(CSV));
  assert.ok(r.ok);
  if (!r.ok) return;
  const existing = [{ id: 'forn-de-prova', name: 'FORN DE PROVA', logo: null }];
  const chosen = r.entries.filter((e) => e.status === 'yes');
  assert.ok(alreadySponsor(chosen[0], existing));
  const { sponsors, offers } = sponsorsFromSheet(chosen, existing);
  assert.deepEqual(sponsors, [{ id: 'botiga-la-prova', name: 'Botiga "La Prova"', logo: null }]);
  assert.deepEqual([...offers], [['botiga-la-prova', 'Lot de "productes"']]);
});
