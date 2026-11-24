// Musical keys on the Camelot wheel, for checking that melodic layers of two songs can overlap.
// Two keys are compatible when they are the same, a fifth apart (±1 on the wheel, same letter), or
// relative major/minor (same number, other letter). Keys come from data/keys/<id>.json
// (tools/prep/keys.py). Pure module: no DOM, no Web Audio.

export type Mode = 'major' | 'minor';
export type CamelotLetter = 'A' | 'B';
export interface Camelot {
  number: number;
  letter: CamelotLetter;
}
/** A detected key as stored in data/keys/<id>.json (global or per hook). */
export interface KeyInfo {
  key?: string;
  mode?: Mode;
  camelot?: string;
  pitchClass?: number;
  confidence?: number;
}
/** Anything key-like: a Camelot code, a key name, a detected key, or nothing. */
export type KeyLike = string | KeyInfo | null | undefined;
export type Relation = 'same' | 'adjacent' | 'relative' | 'none';

/** Pitch-class names used in data/keys (0 = C). */
export const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const LETTER_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class (0–11) of a note name such as "C", "F#", "Db" or "bb"; null if it isn't one. */
export function pitchClass(name: string): number | null {
  const m = /^([A-Ga-g])([#♯b♭]?)$/.exec(name.trim());
  if (!m) return null;
  const base = LETTER_PC[m[1].toUpperCase()];
  const shift = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return (base + shift + 12) % 12;
}

/**
 * Camelot code of a key: C major = "8B", A minor = "8A", a fifth up adds 1 (12 wraps to 1).
 * @param key  pitch class or note name
 */
export function toCamelot(key: number | string, mode: Mode): string {
  const pc = typeof key === 'number' ? key : pitchClass(key);
  if (pc == null || !Number.isInteger(pc) || pc < 0 || pc > 11) throw new RangeError(`not a key: ${key}`);
  const majorPc = mode === 'major' ? pc : (pc + 3) % 12;
  return `${((7 * majorPc + 7) % 12) + 1}${mode === 'major' ? 'B' : 'A'}`;
}

/** Parse a Camelot code such as "8A" or "12b". */
export function parseCamelot(code: string): Camelot | null {
  const m = /^(1[0-2]|[1-9])([ABab])$/.exec(code.trim());
  if (!m) return null;
  return { number: Number(m[1]), letter: m[2].toUpperCase() === 'A' ? 'A' : 'B' };
}

/** Parse a key name: "Am", "A minor", "F#m", "Bb", "C major". */
export function parseKeyName(text: string): { pitchClass: number; mode: Mode } | null {
  const m = /^([A-Ga-g][#♯b♭]?)\s*(m|min|minor|maj|major)?$/.exec(text.trim());
  if (!m) return null;
  const pc = pitchClass(m[1]);
  if (pc == null) return null;
  const mode = m[2] && m[2].startsWith('m') && !m[2].startsWith('maj') ? 'minor' : 'major';
  return { pitchClass: pc, mode };
}

/** The Camelot code of anything key-like, or null when it is unknown. */
export function camelotOf(k: KeyLike): string | null {
  if (k == null) return null;
  if (typeof k === 'string') {
    const c = parseCamelot(k);
    if (c) return `${c.number}${c.letter}`;
    const named = parseKeyName(k);
    return named ? toCamelot(named.pitchClass, named.mode) : null;
  }
  if (k.camelot) return camelotOf(k.camelot);
  if (k.mode !== 'major' && k.mode !== 'minor') return null;
  if (typeof k.pitchClass === 'number') return toCamelot(k.pitchClass, k.mode);
  if (k.key) {
    const pc = pitchClass(k.key);
    return pc == null ? null : toCamelot(pc, k.mode);
  }
  return null;
}

/** How two keys sit on the Camelot wheel, or null when either is unknown. */
export function relation(a: KeyLike, b: KeyLike): Relation | null {
  const ca = camelotOf(a);
  const cb = camelotOf(b);
  // camelotOf only returns codes that parse, so pa and pb are null only when a key is unknown.
  const pa = ca ? parseCamelot(ca) : null;
  const pb = cb ? parseCamelot(cb) : null;
  if (!pa || !pb) return null;
  if (pa.number === pb.number) return pa.letter === pb.letter ? 'same' : 'relative';
  const step = (((pa.number - pb.number) % 12) + 12) % 12;
  if (pa.letter === pb.letter && (step === 1 || step === 11)) return 'adjacent';
  return 'none';
}

/**
 * Camelot-wheel compatibility: same key, ±1 on the wheel with the same letter, or relative
 * major/minor. Unknown keys, and keys whose confidence is below `minConfidence`, are not compatible.
 */
export function compatible(a: KeyLike, b: KeyLike, { minConfidence = 0 }: { minConfidence?: number } = {}): boolean {
  if (minConfidence > 0) {
    for (const k of [a, b]) {
      if (k && typeof k === 'object' && (k.confidence ?? 0) < minConfidence) return false;
    }
  }
  const r = relation(a, b);
  return r != null && r !== 'none';
}

/**
 * The four codes compatible with a key: itself, ±1 and the relative.
 * @returns empty when the key is unknown
 */
export function compatibleCodes(k: KeyLike): string[] {
  const code = camelotOf(k);
  const parsed = code ? parseCamelot(code) : null;
  if (!parsed) return [];
  const { number, letter } = parsed;
  const wrap = (n: number) => ((n + 11) % 12) + 1;
  return [`${number}${letter}`, `${wrap(number + 1)}${letter}`, `${wrap(number - 1)}${letter}`, `${number}${letter === 'A' ? 'B' : 'A'}`];
}
