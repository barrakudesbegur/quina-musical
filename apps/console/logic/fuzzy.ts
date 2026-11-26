// The Cerca tab's fuzzy match (D162): a title or an artist from a few letters, typos and skipped letters accepted
// ("tetadar" finds "Tenía Tanto Que Darte", so do "tenia tanto ke darte", "nena dacon" and "tantoque"), with the
// matched letters to highlight. Pure.
//
// The query is aligned against the text's letters and digits (accents and case ignored, spaces and punctuation
// skipped) by dynamic programming. Moving on to the next letter is free, and so is jumping ahead to the start of a
// word: that is how initials-style queries ("te-ta-dar") match. Everything else is an error: a wrong letter, a letter
// in the query the text doesn't have, or jumping into the middle of a word (letters skipped). A short query allows no
// error, a longer one a few (`maxErrors`).

/** A highlighted run of the original text: [start, end) in UTF-16 units. */
export interface MatchRange {
  start: number;
  end: number;
}

export interface FuzzyMatch {
  /** Lower is better: errors first, then unmatched letters, then how many jumps the match needed. */
  cost: number;
  errors: number;
  /** The matched letters, merged into runs, in text order. */
  ranges: MatchRange[];
}

/** A text's comparable characters: lower case, no accents, letters and digits only, each with its place. */
interface Letters {
  chars: string[];
  /** Index in the original string. */
  at: number[];
  /** The character starts a word (the first one, or after a space or punctuation). */
  wordStart: boolean[];
}

const ALNUM = /[\p{L}\p{N}]/u;

/** One character folded for comparison ("Í" → "i", "ç" → "c"); '' for anything that isn't a letter or a digit. */
const fold = (ch: string): string => {
  const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return ALNUM.test(base) ? base : '';
};

function letters(text: string): Letters {
  const out: Letters = { chars: [], at: [], wordStart: [] };
  let previousWasLetter = false;
  for (let i = 0; i < text.length; i++) {
    const c = fold(text[i]);
    if (!c) {
      previousWasLetter = false;
      continue;
    }
    // A fold can give more than one character ("ß" → "ss"): each one points at the same original character.
    for (const part of c) {
      out.chars.push(part);
      out.at.push(i);
      out.wordStart.push(!previousWasLetter);
      previousWasLetter = true;
    }
  }
  return out;
}

/** The query's comparable characters (spaces and punctuation dropped: "tanto que" and "tantoque" are the same). */
export const foldQuery = (query: string): string => [...query].map(fold).join('');

/** How many errors a query of this many letters may have: none up to 3, one up to 7, two up to 12, then three. */
export function maxErrors(length: number): number {
  return length <= 3 ? 0 : length <= 7 ? 1 : length <= 12 ? 2 : 3;
}

/** The cost's weights: errors first, then the query's letters left unmatched (a wrong letter, rather than a skipped
 * one that lets the right letter match), then jumps (fewer pieces, and an earlier start, read better). */
const ERROR = 1024;
const MISS = 16;
const JUMP = 1;

/** Match `query` against `text`, or null when it needs more errors than the query's length allows. */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = foldQuery(query);
  if (!q) return null;
  const t = letters(text);
  const Q = q.length;
  const T = t.chars.length;
  const INF = Number.POSITIVE_INFINITY;
  // cost[i][j]: the best cost with the first i query characters used and the text consumed up to letter j (the next
  // contiguous letter is j). j = 0 with i = 0 is the start, before any letter. `from` keeps the step for the ranges.
  const cost = Array.from({ length: Q + 1 }, () => new Array<number>(T + 1).fill(INF));
  const from = Array.from({ length: Q + 1 }, () => new Array<{ i: number; j: number; hit: number } | null>(T + 1).fill(null));
  cost[0][0] = 0;
  for (let i = 0; i <= Q; i++) {
    // The cheapest place to jump from: the best cost[i][j'] for every j' < k, kept as k moves right.
    let bestBefore = INF;
    let bestBeforeJ = -1;
    for (let k = 0; k <= T; k++) {
      const here = cost[i][k];
      if (i < Q && here < INF) {
        // A letter in the query the text doesn't have.
        relax(i + 1, k, here + ERROR + MISS, i, k, -1);
        // The next letter, right where the match is.
        if (k < T) relax(i + 1, k + 1, here + letter(i, k), i, k, q[i] === t.chars[k] ? k : -1);
      }
      // A jump to letter k from further back: free onto a word's start, an error into a word's middle.
      if (i < Q && k < T && bestBeforeJ >= 0) {
        const landing = (t.wordStart[k] ? 0 : ERROR) + JUMP;
        relax(i + 1, k + 1, bestBefore + landing + letter(i, k), i, bestBeforeJ, q[i] === t.chars[k] ? k : -1);
      }
      if (here < bestBefore) {
        bestBefore = here;
        bestBeforeJ = k;
      }
    }
  }

  /** Query letter i on text letter k: free when they are the same, else a wrong letter. */
  function letter(i: number, k: number): number {
    return q[i] === t.chars[k] ? 0 : ERROR + MISS;
  }

  function relax(i: number, j: number, value: number, pi: number, pj: number, hit: number): void {
    if (value < cost[i][j]) {
      cost[i][j] = value;
      from[i][j] = { i: pi, j: pj, hit };
    }
  }

  let end = -1;
  for (let j = 0; j <= T; j++) if (cost[Q][j] < (end < 0 ? INF : cost[Q][end])) end = j;
  if (end < 0) return null;
  const total = cost[Q][end];
  const errors = Math.floor(total / ERROR);
  if (errors > maxErrors(Q)) return null;

  const hits: number[] = [];
  for (let i = Q, j = end; i > 0; ) {
    const step = from[i][j]!;
    if (step.hit >= 0) hits.push(t.at[step.hit]);
    i = step.i;
    j = step.j;
  }
  return { cost: total, errors, ranges: rangesOf(hits.reverse()) };
}

/** Matched characters (original indexes, ascending) as runs of neighbours. Two letters folded from one character
 * ("ß" → "ss") share its index. */
function rangesOf(indexes: readonly number[]): MatchRange[] {
  const ranges: MatchRange[] = [];
  for (const i of indexes) {
    const last = ranges[ranges.length - 1];
    if (last && i <= last.end) last.end = Math.max(last.end, i + 1);
    else ranges.push({ start: i, end: i + 1 });
  }
  return ranges;
}

/** A text cut into plain and highlighted pieces, for drawing the match as text spans (never as HTML). */
export interface TextSpan {
  text: string;
  hit: boolean;
}

export function highlightSpans(text: string, ranges: readonly MatchRange[]): TextSpan[] {
  const spans: TextSpan[] = [];
  let at = 0;
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    const start = Math.max(at, Math.min(r.start, text.length));
    const end = Math.min(text.length, r.end);
    if (end <= start) continue;
    if (start > at) spans.push({ text: text.slice(at, start), hit: false });
    spans.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) spans.push({ text: text.slice(at), hit: false });
  return spans;
}
