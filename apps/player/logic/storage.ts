// The player's own data, kept only on the phone (localStorage), tagged with the edition: the cards they
// follow (each with its colour and optional name), their sound choice, and the round view of the current Game.
// - Data of another edition is wiped automatically (on load, and when the feed reports a new edition).
// - A new gameId (a rehearsal, then the real night) resets only the round view, never the cards.
// The transforms are pure; PlayerStorage is the thin I/O wrapper around a Storage.
import { PLAYER_CONFIG } from '../config.ts';

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
  /** The Game the round view belongs to. */
  gameId: string | null;
  /** Round view: one-off screens already closed in this Game (for example 'celebration:3:line'). */
  dismissed: string[];
}

export const emptyData = (edition: string): PlayerData => ({ v: DATA_VERSION, edition, cards: [], sounds: null, gameId: null, dismissed: [] });

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

export type AddResult = { ok: true; data: PlayerData; card: SavedCard } | { ok: false; reason: 'invalid' | 'duplicate' | 'full' };

export function addCard(data: PlayerData, id: number, nowMs: number): AddResult {
  if (!validId(id)) return { ok: false, reason: 'invalid' };
  if (data.cards.some((c) => c.id === id)) return { ok: false, reason: 'duplicate' };
  if (data.cards.length >= PLAYER_CONFIG.maxCards) return { ok: false, reason: 'full' };
  const card: SavedCard = { id, color: nextColor(data.cards), name: null, addedAtMs: nowMs };
  return { ok: true, data: { ...data, cards: [...data.cards, card] }, card };
}

export const removeCard = (data: PlayerData, id: number): PlayerData => ({ ...data, cards: data.cards.filter((c) => c.id !== id) });

export const renameCard = (data: PlayerData, id: number, name: string): PlayerData => ({
  ...data,
  cards: data.cards.map((c) => (c.id === id ? { ...c, name: cleanName(name) } : c)),
});

export const setSounds = (data: PlayerData, on: boolean): PlayerData => ({ ...data, sounds: on });

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
