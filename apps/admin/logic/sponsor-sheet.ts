// The organisers' sponsor and prize sheet (exported as CSV from their spreadsheet) turned into sponsors for the
// Game plan. The sheet has a description row, then a header row (COMERÇ, PARTICIPA, COL·LABORACIÓ, LOGO,
// ENTREGA, who holds it, to-dos…), then category rows ("RESTAURACIÓ": a name in capitals and nothing else) and
// one row per business.
//
// PRIVACY: the plan is public (it reaches every phone). Only the business name, its category, whether it takes
// part, what it gives and whether a logo exists are read. Who holds each prize, the delivery state, the to-dos
// and anything else in the sheet are never read, so they can't leak into the plan. Pure.
import type { Sponsor } from '../../../packages/ui/plan.ts';
import { sponsorIdFor } from './plan-edit.ts';

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\ufeff/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type SheetStatus = 'yes' | 'waiting' | 'no' | 'unknown';

export interface SheetEntry {
  name: string;
  /** The category row above it ("Restauració"), or null. */
  category: string | null;
  status: SheetStatus;
  /** What they give ("Val per sopar 2 persones"), or null. */
  offer: string | null;
  /** The sheet says their logo is saved. */
  hasLogo: boolean;
}

export type SheetResult = { ok: true; entries: SheetEntry[] } | { ok: false; reason: 'noHeader' };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u00b7]/g, '')
    .trim()
    .toLowerCase();

/** "si", "sí", "participa", "ok" → yes; "esperant" → waiting; "no" → no. */
export function sheetStatus(cell: string): SheetStatus {
  const v = norm(cell);
  if (!v) return 'unknown';
  if (v === 'si' || v === 'participa' || v === 'ok' || v === 'yes') return 'yes';
  if (v.startsWith('esperant')) return 'waiting';
  if (v === 'no') return 'no';
  return 'unknown';
}

/** "RESTAURACIÓ" → "Restauració". */
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** A category row: only the name cell is filled, in capitals. */
function isCategory(row: readonly string[], nameCol: number): boolean {
  const name = row[nameCol]?.trim() ?? '';
  return name !== '' && /\p{L}/u.test(name) && name === name.toUpperCase() && row.every((c, i) => i === nameCol || !c.trim());
}

/** Reads the sheet's rows into entries (category rows become each entry's category). */
export function readSponsorSheet(rows: readonly (readonly string[])[]): SheetResult {
  const headerAt = rows.findIndex((r) => r.some((c) => norm(c).startsWith('comer')) && r.some((c) => norm(c).startsWith('particip')));
  if (headerAt < 0) return { ok: false, reason: 'noHeader' };
  const header = rows[headerAt].map(norm);
  const col = (test: (h: string) => boolean) => header.findIndex(test);
  const nameCol = col((h) => h.startsWith('comer'));
  const statusCol = col((h) => h.startsWith('particip'));
  const offerCol = col((h) => h.startsWith('col') && h.includes('labora'));
  const logoCol = col((h) => h.startsWith('logo'));
  const entries: SheetEntry[] = [];
  let category: string | null = null;
  for (const row of rows.slice(headerAt + 1)) {
    const name = row[nameCol]?.trim() ?? '';
    if (!name) continue;
    if (isCategory(row, nameCol)) {
      category = titleCase(name);
      continue;
    }
    const offer = offerCol >= 0 ? (row[offerCol]?.trim() ?? '') : '';
    const logo = logoCol >= 0 ? norm(row[logoCol] ?? '') : '';
    entries.push({ name, category, status: statusCol >= 0 ? sheetStatus(row[statusCol] ?? '') : 'unknown', offer: offer || null, hasLogo: logo === 'ok' || logo === 'si' });
  }
  return { ok: true, entries };
}

/** Is this business already a sponsor in the plan (same name, ignoring case and accents)? */
export const alreadySponsor = (entry: Pick<SheetEntry, 'name'>, sponsors: readonly Sponsor[]): boolean => sponsors.some((s) => norm(s.name) === norm(entry.name));

/** New sponsors for the chosen entries (skipping ones already in the plan), with their offers by sponsor id. */
export function sponsorsFromSheet(chosen: readonly SheetEntry[], existing: readonly Sponsor[]): { sponsors: Sponsor[]; offers: Map<string, string> } {
  const ids = existing.map((s) => s.id);
  const sponsors: Sponsor[] = [];
  const offers = new Map<string, string>();
  for (const entry of chosen) {
    if (alreadySponsor(entry, [...existing, ...sponsors])) continue;
    const id = sponsorIdFor(entry.name, ids);
    ids.push(id);
    sponsors.push({ id, name: entry.name, logo: null });
    if (entry.offer) offers.set(id, entry.offer);
  }
  return { sponsors, offers };
}
