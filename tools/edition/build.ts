// `build`: assemble an edition file (D116) from its plan source, its repertoire's songs (editionSongs, Sound engine's)
// and the repertoire's printed card types and cards, then check it all fits with the protocol's checkEdition.
// Whether the cards stay in the file for good (U68, U75) is the user's; today they're in, so the check covers them.
import fs from 'node:fs';
import path from 'node:path';
import { checkEdition, EDITION_VERSION, type EditionCheck } from '@quina/protocol';
import type { Repertoire } from '../../apps/show/relay/repertoire.ts';
import { editionSongs } from './songs.ts';

/** The edition file's parts, before the check: what each reader takes from it. */
export function assembleEdition(parts: { repertoire: string; plan: unknown; songs: unknown; cardTypes?: unknown; cards?: unknown }): Record<string, unknown> {
  return {
    v: EDITION_VERSION,
    repertoire: parts.repertoire,
    plan: parts.plan,
    songs: parts.songs,
    ...(parts.cardTypes != null ? { cardTypes: parts.cardTypes } : {}),
    ...(parts.cards != null ? { cards: parts.cards } : {}),
  };
}

type RawSong = number | { id?: unknown };
interface RawCard {
  id?: unknown;
  type?: unknown;
  sides?: { side?: unknown; lines?: RawSong[][] }[];
  lines?: RawSong[][];
}

/**
 * cards.json as apps/cards writes it (wrapped in `{ cards }` or a plain list; each line a list of songs with their
 * ids) → the edition's cards, song ids only (EditionCard). A card from before sides has `lines`: its side 1, as the
 * engine reads it. Anything malformed passes through as it is, for checkEdition to name.
 */
export function editionCards(json: unknown): unknown {
  const list = json && typeof json === 'object' && !Array.isArray(json) && 'cards' in json ? (json as { cards: unknown }).cards : json;
  if (!Array.isArray(list)) return list;
  const ids = (lines: RawSong[][] | undefined) => (Array.isArray(lines) ? lines.map((line) => (Array.isArray(line) ? line.map((song) => (typeof song === 'number' ? song : song?.id)) : line)) : lines);
  return (list as RawCard[]).map((card) => ({
    id: card.id,
    type: card.type,
    sides: Array.isArray(card.sides) ? card.sides.map((side) => ({ side: side.side, lines: ids(side.lines) })) : [{ side: 1, lines: ids(card.lines) }],
  }));
}

/** Read the repertoire's parts and the plan source, assemble the edition and check it. Never writes. */
export function buildEdition(repertoire: Repertoire, plan: unknown): EditionCheck {
  const read = (file: string | null | undefined): unknown => (file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
  const typesFile = repertoire.cardsJson ? path.join(path.dirname(repertoire.cardsJson), 'card-types.json') : null;
  return checkEdition(
    assembleEdition({
      repertoire: repertoire.name,
      plan,
      songs: editionSongs(repertoire),
      cardTypes: read(typesFile),
      cards: editionCards(read(repertoire.cardsJson)),
    }),
  );
}
