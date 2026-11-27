// The player's own data, kept only on the phone (localStorage), tagged with the edition: the cards they
// follow (each with its colour and optional name), their sound choice, Ara's Historial | Cartrons choice, and the
// round view of the current Game.
// - Data of another edition is wiped automatically (on load, and when the feed reports a new edition).
// - A new gameId (a rehearsal, then the real night) resets only the round view, never the cards.
// The transforms are pure; PlayerStorage is the thin I/O wrapper around a Storage.
import { PLAYER_CONFIG } from '../config.ts';
import { isAraView, type AraView } from './tabs.ts';

export const DATA_VERSION = 1;

export interface SavedCard {
  id: number;
  /** 1..cardColors: the --card-color-N token. */
  color: number;
  name: string | null;
  addedAtMs: number;
}

export interface PlayerData {
  v: typeof DATA_VERSION;
  edition: string;
  /** In the order they were added. */
  cards: SavedCard[];
  /** The player's own choice for interface sounds; null until they toggle (Admin's default applies). */
  sounds: boolean | null;
  /**
   * Ara's Historial | Cartrons switch, as the player last left it on this device; null until they tap it.
   * Added within version 1: older data simply has no choice yet (an additive field needs no new version).
   */
  araView: AraView | null;
  /** The Game the round view belongs to. */
  gameId: string | null;
  /** Round view: one-off screens already closed in this Game (for example 'celebration:3:line'). */
  dismissed: string[];
}

/** A card's display name: the player's own name for it, else only its number («#123»). Never a generated name, such
 *  as its icon's (the user, 27 Nov): the icon is shown beside it, not read as its name. */
export const cardLabel = (card: Pick<SavedCard, 'id' | 'name'>): string => card.name ?? `#${card.id}`;

export const emptyData = (edition: string): PlayerData => ({ v: DATA_VERSION, edition, cards: [], sounds: null, araView: null, gameId: null, dismissed: [] });

export type LoadOutcome = 'fresh' | 'kept' | 'otherEdition' | 'corrupt';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const cleanName = (name: unknown): string | null => {
  if (typeof name !== 'string') return null;
  const t = name.replace(/\s+/g, ' ').trim().slice(0, PLAYER_CONFIG.maxNameLength);
  return t || null;
};

const validId = (id: unknown): id is number => Number.isInteger(id) && (id as number) >= PLAYER_CONFIG.cardIdMin && (id as number) <= PLAYER_CONFIG.cardIdMax;

/** Read stored data for this edition. Anything unreadable starts fresh; another edition's data is wiped. */
export function readData(raw: string | null, edition: string): { data: PlayerData; outcome: LoadOutcome } {
  if (raw === null) return { data: emptyData(edition), outcome: 'fresh' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { data: emptyData(edition), outcome: 'corrupt' };
  }
  if (!isRec(json) || json.v !== DATA_VERSION || typeof json.edition !== 'string' || !Array.isArray(json.cards)) return { data: emptyData(edition), outcome: 'corrupt' };
  if (json.edition !== edition) return { data: emptyData(edition), outcome: 'otherEdition' };
  const cards: SavedCard[] = [];
  for (const c of json.cards) {
    if (!isRec(c) || !validId(c.id) || cards.some((o) => o.id === c.id)) continue;
    const color = Number.isInteger(c.color) && (c.color as number) >= 1 && (c.color as number) <= PLAYER_CONFIG.cardColors ? (c.color as number) : nextColor(cards);
    cards.push({ id: c.id, color, name: cleanName(c.name), addedAtMs: typeof c.addedAtMs === 'number' ? c.addedAtMs : 0 });
    if (cards.length >= PLAYER_CONFIG.maxCards) break;
  }
  return {
    data: {
      v: DATA_VERSION,
      edition,
      cards,
      sounds: typeof json.sounds === 'boolean' ? json.sounds : null,
      araView: isAraView(json.araView) ? json.araView : null,
      gameId: typeof json.gameId === 'string' ? json.gameId : null,
      dismissed: Array.isArray(json.dismissed) ? json.dismissed.filter((k): k is string => typeof k === 'string').slice(-50) : [],
    },
    outcome: 'kept',
  };
}

/** The colour for a new card: the first --card-color-N no card uses yet, in order; once all are used, they cycle. */
export function nextColor(cards: readonly Pick<SavedCard, 'color'>[], colors = PLAYER_CONFIG.cardColors): number {
  const used = new Set(cards.map((c) => c.color));
  for (let n = 1; n <= colors; n++) if (!used.has(n)) return n;
  return (cards.length % colors) + 1;
}

/**
 * Can a card use this identity (icon and colour)? Each card gets its own while any is free; once all are
 * used (a phone can follow more cards than there are icons), any can repeat. `others` excludes the card itself.
 */
export function identityFree(others: readonly Pick<SavedCard, 'color'>[], identity: number, colors = PLAYER_CONFIG.cardColors): boolean {
  if (!Number.isInteger(identity) || identity < 1 || identity > colors) return false;
  const used = new Set(others.map((c) => c.color));
  return !used.has(identity) || used.size >= colors;
}

export type AddResult = { ok: true; data: PlayerData; card: SavedCard } | { ok: false; reason: 'invalid' | 'duplicate' | 'full' };

/** Adds a card with the identity the player picked, or the first free one when the pick isn't available. */
export function addCard(data: PlayerData, id: number, nowMs: number, identity?: number): AddResult {
  if (!validId(id)) return { ok: false, reason: 'invalid' };
  if (data.cards.some((c) => c.id === id)) return { ok: false, reason: 'duplicate' };
  if (data.cards.length >= PLAYER_CONFIG.maxCards) return { ok: false, reason: 'full' };
  const color = identity !== undefined && identityFree(data.cards, identity) ? identity : nextColor(data.cards);
  const card: SavedCard = { id, color, name: null, addedAtMs: nowMs };
  return { ok: true, data: { ...data, cards: [...data.cards, card] }, card };
}

/** Gives a card another identity, if no other card has it (or every identity is already in use). */
export function setIdentity(data: PlayerData, id: number, identity: number): PlayerData {
  const others = data.cards.filter((c) => c.id !== id);
  if (!data.cards.some((c) => c.id === id) || !identityFree(others, identity)) return data;
  return { ...data, cards: data.cards.map((c) => (c.id === id ? { ...c, color: identity } : c)) };
}

export type RenumberResult = { ok: true; data: PlayerData } | { ok: false; reason: 'invalid' | 'duplicate' | 'unknown' };

/**
 * The card's edit drawer gives it another number (a typo, or the QR of the right card): the card keeps its place, its
 * name and its icon. Refused when the number can't be a card's, is another of the player's cards, or isn't printed
 * (`printed`, once the catalogue has loaded).
 */
export function renumberCard(data: PlayerData, id: number, to: number, printed: { has(id: number): boolean } | null = null): RenumberResult {
  if (to === id) return { ok: true, data };
  if (!validId(to)) return { ok: false, reason: 'invalid' };
  if (data.cards.some((c) => c.id === to)) return { ok: false, reason: 'duplicate' };
  if (printed && !printed.has(to)) return { ok: false, reason: 'unknown' };
  if (!data.cards.some((c) => c.id === id)) return { ok: false, reason: 'invalid' };
  return { ok: true, data: { ...data, cards: data.cards.map((c) => (c.id === id ? { ...c, id: to } : c)) } };
}

export const removeCard = (data: PlayerData, id: number): PlayerData => ({ ...data, cards: data.cards.filter((c) => c.id !== id) });

/** Moves a card to place `to` (0-based, clamped) in the player's list: the home screen shows the cards in this order. */
export function moveCard(data: PlayerData, id: number, to: number): PlayerData {
  const from = data.cards.findIndex((c) => c.id === id);
  if (from < 0) return data;
  const place = Math.max(0, Math.min(data.cards.length - 1, Math.round(to)));
  if (place === from) return data;
  const cards = [...data.cards];
  const [card] = cards.splice(from, 1);
  cards.splice(place, 0, card);
  return { ...data, cards };
}

export const renameCard = (data: PlayerData, id: number, name: string): PlayerData => ({
  ...data,
  cards: data.cards.map((c) => (c.id === id ? { ...c, name: cleanName(name) } : c)),
});

export const setSounds = (data: PlayerData, on: boolean): PlayerData => ({ ...data, sounds: on });

export const setAraView = (data: PlayerData, view: AraView): PlayerData => (data.araView === view ? data : { ...data, araView: view });

/** Interface sounds: the player's choice wins over Admin's default. */
export const soundsOn = (data: PlayerData, adminDefault: boolean): boolean => data.sounds ?? adminDefault;

/** The feed's Game: a different gameId resets the round view, never the cards. */
export function noteGame(data: PlayerData, gameId: string | null): PlayerData {
  if (gameId === null || gameId === data.gameId) return data;
  return { ...data, gameId, dismissed: [] };
}

/** The feed's edition: a different one wipes everything (last year's cards are of no use). */
export function noteEdition(data: PlayerData, edition: string): { data: PlayerData; wiped: boolean } {
  if (!edition || edition === data.edition) return { data, wiped: false };
  return { data: emptyData(edition), wiped: true };
}

export const dismiss = (data: PlayerData, key: string): PlayerData => (data.dismissed.includes(key) ? data : { ...data, dismissed: [...data.dismissed, key].slice(-50) });

/** The Storage methods PlayerStorage uses (localStorage, or a Map-backed fake in tests and demos). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** An in-memory Storage: demos use it so they never touch the player's real cards. */
export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** Loads and saves PlayerData. Storage may be missing or throw (private mode, quota): it never throws. */
export class PlayerStorage {
  private readonly storage: StorageLike | null;
  private readonly key: string;

  constructor(storage: StorageLike | null, key = PLAYER_CONFIG.storageKey) {
    this.storage = storage;
    this.key = key;
  }

  load(edition: string): { data: PlayerData; outcome: LoadOutcome } {
    let raw: string | null = null;
    try {
      raw = this.storage?.getItem(this.key) ?? null;
    } catch {
      raw = null;
    }
    const result = readData(raw, edition);
    if (result.outcome === 'otherEdition' || result.outcome === 'corrupt') this.save(result.data);
    return result;
  }

  save(data: PlayerData): boolean {
    try {
      this.storage?.setItem(this.key, JSON.stringify(data));
      return Boolean(this.storage);
    } catch {
      return false;
    }
  }

  /** "Esborrar dades": forget everything of this app on this phone. */
  clear(): void {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      // nothing to clear
    }
  }

  /** Is this the key another tab changed (a StorageEvent's key; null means the whole storage was cleared). */
  isOurKey(key: string | null): boolean {
    return key === null || key === this.key;
  }
}
