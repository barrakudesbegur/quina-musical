// Cerca's fuzzy match (D162): initials, typos and skipped letters, accents and case ignored, and the letters to
// highlight as plain text spans.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldQuery, fuzzyMatch, highlightSpans, maxErrors } from '../../../../console/logic/fuzzy.ts';

const TITLE = 'Tenía Tanto Que Darte';
/** The match drawn with its hits in brackets: "[Te]nía [Ta]nto Que [Dar]te". */
const marked = (query: string, text: string): string | null => {
  const m = fuzzyMatch(query, text);
  return m && highlightSpans(text, m.ranges).map((s) => (s.hit ? `[${s.text}]` : s.text)).join('');
};

test('"tetadar" finds "Tenía Tanto Que Darte" by its words\' starts, with no error', () => {
  const m = fuzzyMatch('tetadar', TITLE);
  assert.ok(m);
  assert.equal(m.errors, 0);
  assert.deepEqual(m.ranges, [{ start: 0, end: 2 }, { start: 6, end: 8 }, { start: 16, end: 19 }]);
  assert.equal(marked('tetadar', TITLE), '[Te]nía [Ta]nto Que [Dar]te');
});

test('typos, a missing space and a cut-off word still find it (the board\'s examples)', () => {
  const typo = fuzzyMatch('tenia tanto ke darte', TITLE);
  assert.ok(typo);
  assert.equal(typo.errors, 2, '"ke" for "que": a wrong letter and a skipped one');
  assert.equal(marked('tenia tanto ke darte', TITLE), '[Tenía] [Tanto] Qu[e] [Darte]', 'the right letters stay highlighted');
  assert.equal(marked('tantoque', TITLE), 'Tenía [Tanto] [Que] Darte', 'spaces in the query are optional');
  assert.equal(marked('nena dacon', 'Nena Daconte'), '[Nena] [Dacon]te');
});

test('accents and case are ignored; the highlight keeps the original letters', () => {
  assert.equal(marked('ASEREJE', 'Aserejé'), '[Aserejé]');
  assert.equal(marked('cuidate', 'Cuídate'), '[Cuídate]');
  assert.equal(foldQuery('Ça Plane, Pour Moi!'), 'caplanepourmoi');
});

test('too many errors for the query\'s length: no match', () => {
  assert.deepEqual([1, 3, 4, 7, 8, 12, 13, 30].map(maxErrors), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(fuzzyMatch('xyz', TITLE), null);
  assert.equal(fuzzyMatch('tx', TITLE), null, 'a short query allows no error');
  assert.equal(fuzzyMatch('', TITLE), null);
  assert.equal(fuzzyMatch('  !! ', TITLE), null, 'nothing to look for');
  assert.equal(fuzzyMatch('titanium', 'Dancing Queen'), null);
});

test('a better match costs less: exact before initials, initials before letters inside words', () => {
  const cost = (q: string, t: string) => fuzzyMatch(q, t)?.cost ?? Number.POSITIVE_INFINITY;
  assert.ok(cost('tita', 'Titanium') < cost('tita', TITLE), '"Tita" in one word beats "T…ta" across two');
  assert.ok(cost('que', 'Que Sera') < cost('que', 'Dancing Queen Que'), 'an earlier start is better');
  assert.ok(cost('anium', 'Titanium') > 0, 'starting inside a word is an error');
});

test('highlight spans: plain and hit pieces covering the whole text, clipped and in order', () => {
  assert.deepEqual(highlightSpans('Abc', []), [{ text: 'Abc', hit: false }]);
  assert.deepEqual(highlightSpans('Abcdef', [{ start: 4, end: 9 }, { start: 0, end: 1 }]), [
    { text: 'A', hit: true },
    { text: 'bcd', hit: false },
    { text: 'ef', hit: true },
  ]);
  assert.deepEqual(highlightSpans('Abc', [{ start: 0, end: 2 }, { start: 1, end: 3 }]), [
    { text: 'Ab', hit: true },
    { text: 'c', hit: true },
  ], 'overlaps never repeat a letter');
  assert.equal(highlightSpans(TITLE, fuzzyMatch('tetadar', TITLE)!.ranges).map((s) => s.text).join(''), TITLE);
});
