// This device's own settings: its label ("Tauleta", "Mòbil admin"), shown in the header so everyone sees
// which console did what, and its theme. Set once, kept in localStorage; `?label=` sets the label from a
// link (the QR in the menu uses it). Also who sent a command, read back from its reqId. Pure: the storage,
// the URL and the events come in as arguments.
import type { SuspenseStarted, TransitionScheduled } from '@quina/protocol';
import type { Theme } from '../config.ts';

/** A clean label: trimmed, single spaces, at most `maxLength` characters; empty → null. */
export function normalizeLabel(raw: string | null | undefined, maxLength: number): string | null {
  if (raw === null || raw === undefined) return null;
  const clean = raw.replace(/\s+/g, ' ').trim().slice(0, maxLength).trim();
  return clean.length ? clean : null;
}

export interface LabelChoice {
  label: string | null;
  /** The label came from the URL and should be stored. */
  store: boolean;
}

/** `?label=` wins over the stored label, and is then stored, so it is set once. */
export function resolveLabel(param: string | null, stored: string | null, maxLength: number): LabelChoice {
  const fromUrl = normalizeLabel(param, maxLength);
  if (fromUrl !== null) return { label: fromUrl, store: fromUrl !== normalizeLabel(stored, maxLength) };
  return { label: normalizeLabel(stored, maxLength), store: false };
}

export const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

/** The stored theme, or the default. */
export function resolveTheme(stored: string | null, fallback: Theme): Theme {
  return isTheme(stored) ? stored : fallback;
}

/** The setup checklist's ticked items, from storage; unknown ids are dropped. Never throws. */
export function parseChecklist(raw: string | null, knownIds: readonly string[]): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && knownIds.includes(v)) : [];
  } catch {
    return [];
  }
}

/**
 * The link for another device to open this console (the menu's QR): this origin's /console/ with the given
 * label preset. Null when the page is on localhost, where another device can't reach it.
 */
export function consoleLinkFor(origin: string, label: string): string | null {
  let url: URL;
  try {
    url = new URL('/console/', origin);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;
  url.searchParams.set('label', label);
  return url.toString();
}

/**
 * The device that sent a command, from its reqId: ui/client starts every reqId with the sender's label made
 * id-safe, with underscores for spaces ("Tauleta-…", "Mobil_admin-…" reads as "Mobil admin"). Null for no
 * reqId (the engine acted by itself) or an unlabelled sender ("r-…").
 */
export function senderOf(reqId: string | null | undefined): string | null {
  if (!reqId) return null;
  const head = reqId.split('-')[0];
  return head && head !== 'r' ? head.replace(/_/g, ' ') : null;
}

export interface LastSpin {
  /** The device that asked for it, or null for auto-advance. */
  by: string | null;
  suspense: boolean;
}

/** Who started a Spin or a Suspense. */
export function lastSpinOf(event: TransitionScheduled | SuspenseStarted): LastSpin {
  return { by: senderOf(event.reqId), suspense: event.type === 'suspense.started' || event.recipe === 'SUSPENSE' };
}
