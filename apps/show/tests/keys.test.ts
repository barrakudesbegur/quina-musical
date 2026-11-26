import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NOTE_NAMES, pitchClass, toCamelot, parseCamelot, parseKeyName, camelotOf, relation, compatible, compatibleCodes,
} from '../engine/src/plan/keys.ts';
import type { KeyInfo, Mode } from '../engine/src/plan/keys.ts';
import { OUT } from '../relay/repertoire.ts';

/** A key as data/keys/index.json stores it. */
type StoredKey = Required<Pick<KeyInfo, 'key' | 'mode' | 'camelot' | 'confidence'>>;
interface KeysIndex {
  songs: { songId: number; global: StoredKey; hooks: Record<string, StoredKey> }[];
}

// The standard Camelot wheel.
const WHEEL: Record<Mode, Record<string, string>> = {
  major: { C: '8B', G: '9B', D: '10B', A: '11B', E: '12B', B: '1B', 'F#': '2B', Db: '3B', Ab: '4B', Eb: '5B', Bb: '6B', F: '7B' },
  minor: { A: '8A', E: '9A', B: '10A', 'F#': '11A', 'C#': '12A', 'G#': '1A', 'D#': '2A', Bb: '3A', F: '4A', C: '5A', G: '6A', D: '7A' },
};

test('toCamelot matches the wheel for all 24 keys', () => {
  for (const mode of ['major', 'minor'] as const) {
    for (const [note, code] of Object.entries(WHEEL[mode])) {
      assert.equal(toCamelot(note, mode), code, `${note} ${mode}`);
      const pc = pitchClass(note);
      assert.ok(pc != null, note);
      assert.equal(toCamelot(pc, mode), code);
    }
  }
  const codes = new Set(NOTE_NAMES.flatMap((n) => [toCamelot(n, 'major'), toCamelot(n, 'minor')]));
  assert.equal(codes.size, 24);
  assert.throws(() => toCamelot(12, 'major'), RangeError);
  assert.throws(() => toCamelot('H', 'minor'), RangeError);
});

test('note names, key names and Camelot codes parse', () => {
  assert.equal(pitchClass('C#'), 1);
  assert.equal(pitchClass('Db'), 1);
  assert.equal(pitchClass('Cb'), 11);
  assert.equal(pitchClass('bb'), 10);
  assert.equal(pitchClass('X'), null);
  assert.deepEqual(parseCamelot('12b'), { number: 12, letter: 'B' });
  assert.equal(parseCamelot('13A'), null);
  assert.equal(parseCamelot('0A'), null);
  assert.deepEqual(parseKeyName('F#m'), { pitchClass: 6, mode: 'minor' });
  assert.deepEqual(parseKeyName('Bb major'), { pitchClass: 10, mode: 'major' });
  assert.deepEqual(parseKeyName('A minor'), { pitchClass: 9, mode: 'minor' });
  assert.deepEqual(parseKeyName('E'), { pitchClass: 4, mode: 'major' });
  assert.equal(camelotOf('Am'), '8A');
  assert.equal(camelotOf('8a'), '8A');
  assert.equal(camelotOf({ key: 'G', mode: 'major', confidence: 0.8 }), '9B');
  assert.equal(camelotOf({ pitchClass: 4, mode: 'minor' }), '9A');
  assert.equal(camelotOf({ camelot: '3A', key: 'C', mode: 'major' }), '3A', 'an explicit code wins');
  assert.equal(camelotOf({ key: 'G' }), null, 'a key without a mode is unknown');
  assert.equal(camelotOf(null), null);
  assert.equal(camelotOf('nonsense'), null);
});

test('relation: same, adjacent (with wrap-around), relative, none', () => {
  assert.equal(relation('8A', '8A'), 'same');
  assert.equal(relation('8A', '9A'), 'adjacent');
  assert.equal(relation('8A', '7A'), 'adjacent');
  assert.equal(relation('12B', '1B'), 'adjacent');
  assert.equal(relation('1A', '12A'), 'adjacent');
  assert.equal(relation('8A', '8B'), 'relative');
  assert.equal(relation('C major', 'Am'), 'relative');
  assert.equal(relation('8A', '9B'), 'none', 'diagonal moves are not in the compatible set');
  assert.equal(relation('8A', '10A'), 'none');
  assert.equal(relation('8A', '2A'), 'none');
  assert.equal(relation('8A', undefined), null);
});

test('compatible is symmetric and matches the four-code neighbourhood', () => {
  const all = NOTE_NAMES.flatMap((n) => [toCamelot(n, 'major'), toCamelot(n, 'minor')]);
  for (const a of all) {
    const near = compatibleCodes(a);
    assert.equal(near.length, 4);
    assert.equal(new Set(near).size, 4);
    for (const b of all) {
      assert.equal(compatible(a, b), compatible(b, a));
      assert.equal(compatible(a, b), near.includes(b), `${a} vs ${b}`);
    }
  }
  assert.deepEqual(compatibleCodes('12B'), ['12B', '1B', '11B', '12A']);
  assert.deepEqual(compatibleCodes(null), []);
  // A key compatible with G major: G, D, C majors and E minor.
  assert.ok(['G', 'D', 'C'].every((k) => compatible({ key: 'G', mode: 'major' }, { key: k, mode: 'major' })));
  assert.ok(compatible({ key: 'G', mode: 'major' }, { key: 'E', mode: 'minor' }));
  assert.ok(!compatible({ key: 'G', mode: 'major' }, { key: 'A', mode: 'major' }));
});

test('unknown or low-confidence keys are never compatible', () => {
  assert.equal(compatible(null, '8A'), false);
  assert.equal(compatible('8A', { key: 'A' }), false);
  const sure: KeyInfo = { key: 'A', mode: 'minor', confidence: 0.8 };
  const unsure: KeyInfo = { key: 'C', mode: 'major', confidence: 0.3 };
  assert.equal(compatible(sure, unsure), true);
  assert.equal(compatible(sure, unsure, { minConfidence: 0.5 }), false);
  assert.equal(compatible(sure, { ...unsure, confidence: 0.6 }, { minConfidence: 0.5 }), true);
});

test('data/keys agrees with keys.ts (when it has been generated)', () => {
  const index = join(OUT, 'keys', 'index.json');
  if (!existsSync(index)) return;
  const { songs }: KeysIndex = JSON.parse(readFileSync(index, 'utf8'));
  assert.ok(songs.length > 0);
  for (const song of songs) {
    for (const k of [song.global, ...Object.values(song.hooks)]) {
      assert.equal(toCamelot(k.key, k.mode), k.camelot, `song ${song.songId}`);
      assert.ok(k.confidence >= 0 && k.confidence <= 1);
    }
  }
});
