// Plan B resume tokens (`resumeAt`, the state's `resume`): the round, its Shuffle seed and how far it got, as a
// short code a person can note on paper and type back in, e.g. `Q3N-4K7XM2P-17-S41-L12`:
//   Q<round><N|E|D> round number, then N (normal), E (especial, the special round) or D (the Desgraciat round)
//   <7 chars>      the Shuffle seed, Crockford base32 (no I, L, O or U; reading is case-insensitive and
//                  forgives O→0 and I/L→1)
//   <position>     the Queue index of the last counted song (−1 before the first)
//   S<song id>     that song, so the console can show it and the engine can check it (optional)
//   L<index>       where the Bingo climb started, if a Line was confirmed (optional)
//   A<attempts>    the Shuffle's draw number, when it is not 0 (optional)
//   T<card type>   the round's card type, when it is not its kind's default (optional; read in lowercase)
//   C<side>        the card's side the round plays, when it is not 1 (optional, D178: "cara")
import { DEFAULT_SIDE, defaultCardType, isCardTypeId, isSide, type RoundKind } from './vocabulary.ts';
import type { ResumeToken } from './events.ts';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KIND_LETTER: Readonly<Record<RoundKind, string>> = { normal: 'N', special: 'E', desgraciat: 'D' };

/** A 32-bit seed as 7 Crockford base32 characters. */
export function seedCode(seed: number): string {
  let n = seed >>> 0;
  let out = '';
  for (let i = 0; i < 7; i++) {
    out = ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

/** The seed in a code from `seedCode`, or null when it isn't one. */
export function parseSeedCode(code: string): number | null {
  const clean = code.trim().toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{7}$/.test(clean)) return null;
  let n = 0;
  for (const ch of clean) n = n * 32 + ALPHABET.indexOf(ch);
  return n <= 0xffffffff ? n : null;
}

export type ResumePoint = Omit<ResumeToken, 'text'>;

export function formatResumeToken(t: ResumePoint): string {
  const parts = [`Q${t.round}${KIND_LETTER[t.kind]}`, seedCode(t.shuffleSeed), String(t.position)];
  if (t.lastSongId != null) parts.push(`S${t.lastSongId}`);
  if (t.lineConfirmedFrom != null) parts.push(`L${t.lineConfirmedFrom}`);
  if (t.shuffleAttempts) parts.push(`A${t.shuffleAttempts}`);
  if (t.cardType && t.cardType !== defaultCardType(t.kind)) parts.push(`T${t.cardType.toUpperCase()}`);
  if (t.side != null && t.side !== DEFAULT_SIDE) parts.push(`C${t.side}`);
  return parts.join('-');
}

/** A token's fields from its text (as `formatResumeToken` writes it, any case, spaces ignored), or null. */
export function parseResumeToken(text: string): ResumePoint | null {
  const parts = text.replace(/\s+/g, '').toUpperCase().split('-');
  const head = /^Q(\d{1,2})([NED])$/.exec(parts[0] ?? '');
  const shuffleSeed = parseSeedCode(parts[1] ?? '');
  // The position may be −1: "Q1N-XXXXXXX--1" splits into an empty part before "1".
  let rest = parts.slice(2);
  let position: number | null = null;
  if (rest[0] === '' && /^1$/.test(rest[1] ?? '')) {
    position = -1;
    rest = rest.slice(2);
  } else if (/^\d{1,3}$/.test(rest[0] ?? '')) {
    position = Number(rest[0]);
    rest = rest.slice(1);
  }
  if (!head || shuffleSeed == null || position == null) return null;
  const kind: RoundKind = head[2] === 'E' ? 'special' : head[2] === 'D' ? 'desgraciat' : 'normal';
  const point: ResumePoint = {
    round: Number(head[1]), kind, cardType: defaultCardType(kind),
    shuffleSeed, shuffleAttempts: 0, position, lastSongId: null, lineConfirmedFrom: null,
  };
  for (const part of rest) {
    const type = /^T([A-Z][A-Z0-9]*)$/.exec(part)?.[1]?.toLowerCase();
    if (type !== undefined) {
      if (!isCardTypeId(type)) return null;
      point.cardType = type;
      continue;
    }
    const m = /^([SLAC])(\d{1,4})$/.exec(part);
    if (!m) return null;
    const value = Number(m[2]);
    if (m[1] === 'C') {
      if (!isSide(value)) return null;
      point.side = value;
    } else if (m[1] === 'S') point.lastSongId = value;
    else if (m[1] === 'L') point.lineConfirmedFrom = value;
    else point.shuffleAttempts = value;
  }
  return point.round >= 1 ? point : null;
}
