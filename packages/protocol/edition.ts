// The edition file (D116): one JSON per edition with all it needs, kept in git and sent to the cloud by hand
// (tools/edition). This is its shape and the one check every reader shares: the edition tool before it writes or
// uploads one, and later the cloud before it accepts one. It never holds audio, covers, hooks, Games, winners'
// names, resume codes, seeds or money (U68–U75's proposal). Which parts it carries beyond the plan and the songs
// (the cards as uploaded data, U68; one file or split, U75) is still the user's call, so those parts are optional.
import { checkGamePlan, roundCardType, roundSide, sideWarnings, type GamePlan } from './plan.ts';
import { cardTypeSides, isCardTypeId, isPoolId, isSide, sidePool, type CardTypeSides } from './vocabulary.ts';

export const EDITION_VERSION = 1;

/**
 * One song as the edition carries it: what screens and cards show, and the pools it's in (D178, D268): sorted, one
 * or more, so a song shared by two pools is listed once, with one id.
 */
export interface EditionSong {
  id: number;
  title: string;
  artist: string;
  pools: string[];
}

/** One side of a printed card: its 3 lines of 4 song ids. */
export interface EditionCardSide {
  side: number;
  lines: number[][];
}

/** A printed card: its number, its type, and its sides (cards.json's shape, song ids only). */
export interface EditionCard {
  id: number;
  type: string;
  sides: EditionCardSide[];
}

export interface EditionFile {
  v: typeof EDITION_VERSION;
  /** The repertoire it was built from (data/repertoires/<name>.json). */
  repertoire: string;
  plan: GamePlan;
  songs: EditionSong[];
  /** card-types.json, when the edition carries the cards. */
  cardTypes?: CardTypeSides[];
  cards?: EditionCard[];
}

export type EditionCheck =
  | { ok: true; edition: EditionFile; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1;
/** A card's lines: 3 of 4 song ids. */
const LINES = 3;
const PER_LINE = 4;
/** Errors past this many are summed up: a broken file shouldn't print thousands of lines. */
const MAX_ERRORS = 50;

/**
 * An edition file as every reader takes it: the plan as the cloud reads it (checkGamePlan), the songs (unique ids,
 * a title, an artist and one or more pools each), and, when present, the card types and the cards: each card's type
 * printed, each side one its type has, 3 lines of 4 songs that are members of that side's pool (a song shared by two
 * pools is a member of both, D268). A round on a side its card type lacks is an error; a side no round plays and a
 * pool with no songs are warnings (sideWarnings, counting a shared song in each of its pools).
 */
export function checkEdition(doc: unknown): EditionCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (message: string) => {
    if (errors.length < MAX_ERRORS) errors.push(message);
    else if (errors.length === MAX_ERRORS) errors.push('… more errors not shown');
  };
  if (!isRecord(doc)) return { ok: false, errors: ['an edition file is a JSON object'], warnings };
  if (doc.v !== EDITION_VERSION) err(`v: expected ${EDITION_VERSION}, got ${JSON.stringify(doc.v)}`);
  if (typeof doc.repertoire !== 'string' || !doc.repertoire) err('repertoire: the repertoire it was built from, by name');

  const plan = checkGamePlan(doc.plan);
  if (!plan.ok) for (const e of plan.errors) err(e.startsWith('plan') ? e : `plan: ${e}`);

  // ---- songs
  const pools = new Map<number, readonly string[]>();
  const poolSongs: Record<string, number> = {};
  if (!Array.isArray(doc.songs)) err('songs: a list of { id, title, artist, pools }');
  else doc.songs.forEach((song, i) => {
    const at = `songs[${i}]`;
    if (!isRecord(song)) return err(`${at}: not an object`);
    if (!isId(song.id)) return err(`${at}.id: a positive integer`);
    if (pools.has(song.id)) return err(`${at}.id: ${song.id} is listed twice`);
    if (typeof song.title !== 'string' || !song.title) err(`${at}.title: a non-empty string`);
    if (typeof song.artist !== 'string') err(`${at}.artist: a string`);
    const own = Array.isArray(song.pools) ? song.pools : [];
    if (!own.length || !own.every(isPoolId)) err(`${at}.pools: a non-empty list of pool ids (["1"], ["1", "2"])`);
    else if (new Set(own).size !== own.length) err(`${at}.pools: lists a pool twice`);
    const valid = [...new Set(own.filter(isPoolId))];
    pools.set(song.id, valid);
    for (const pool of valid) poolSongs[pool] = (poolSongs[pool] ?? 0) + 1;
  });

  // ---- card types and cards (optional together)
  let types: CardTypeSides[] | null = null;
  if (doc.cardTypes != null) {
    if (!Array.isArray(doc.cardTypes)) err('cardTypes: card-types.json\'s list');
    else {
      types = [];
      doc.cardTypes.forEach((t, i) => {
        const at = `cardTypes[${i}]`;
        if (!isRecord(t) || !isCardTypeId(t.type)) return err(`${at}.type: a card type id`);
        const sides = Array.isArray(t.sides) ? t.sides : [];
        const bad = sides.find((s) => !isRecord(s) || !isSide(s.side) || !isPoolId(s.pool));
        if (bad) return err(`${at}.sides: each { side: 1…, pool: "1"… }`);
        types!.push({ type: t.type, ...(typeof t.name === 'string' ? { name: t.name } : {}), ...(sides.length ? { sides: sides as CardTypeSides['sides'] } : {}) });
      });
    }
  }
  if (doc.cards != null) {
    if (!types) err('cards: an edition with cards needs its cardTypes');
    else if (!Array.isArray(doc.cards)) err('cards: cards.json\'s list');
    else {
      const seen = new Set<number>();
      doc.cards.forEach((card, i) => {
        const at = `cards[${i}]`;
        if (!isRecord(card) || !isId(card.id)) return err(`${at}.id: a positive integer`);
        if (seen.has(card.id)) return err(`${at}.id: card ${card.id} is listed twice`);
        seen.add(card.id);
        const type = types!.find((t) => t.type === card.type);
        if (!type) return err(`${at}.type: card ${card.id}'s type ${JSON.stringify(card.type)} isn't in cardTypes`);
        if (!Array.isArray(card.sides) || !card.sides.length) return err(`${at}.sides: card ${card.id} has no sides`);
        for (const side of card.sides) {
          if (!isRecord(side) || !isSide(side.side)) return err(`${at}.sides: card ${card.id} has a side without its number`);
          const pool = cardTypeSides(type).find((s) => s.side === side.side)?.pool;
          if (pool == null) return err(`${at}: card ${card.id} has a side ${side.side}, which type "${type.type}" doesn't print`);
          const lines = side.lines;
          if (!Array.isArray(lines) || lines.length !== LINES || lines.some((l) => !Array.isArray(l) || l.length !== PER_LINE)) {
            return err(`${at}: card ${card.id}'s side ${side.side} isn't ${LINES} lines of ${PER_LINE} songs`);
          }
          const ids = lines.flat();
          const off = ids.filter((id) => !pools.get(id as number)?.includes(pool));
          if (off.length) err(`${at}: card ${card.id}'s side ${side.side} has song(s) ${off.join(', ')} outside pool ${pool}`);
          if (new Set(ids).size !== ids.length) err(`${at}: card ${card.id}'s side ${side.side} repeats a song`);
        }
      });
    }
  }

  // ---- the plan against the card types
  if (plan.ok && types) {
    plan.plan.rounds.forEach((round, i) => {
      if (sidePool(types!, roundCardType(round), roundSide(round)) == null) {
        err(`plan.rounds[${i}].side: round ${round.number} plays side ${roundSide(round)} of card type "${roundCardType(round)}", which cardTypes doesn't have`);
      }
    });
    for (const w of sideWarnings(plan.plan, types, poolSongs)) if (!/has no side/.test(w.message)) warnings.push(`${w.path}: ${w.message}`);
  }

  if (errors.length || !plan.ok) return { ok: false, errors, warnings };
  return { ok: true, edition: { ...(doc as unknown as EditionFile), plan: plan.plan }, warnings };
}
