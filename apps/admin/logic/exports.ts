// What Admin downloads: the plan alone (the import format), or the full export (the plan plus what the
// engine knows about the night: Winners and cards in play). The full export holds the Winners' names, which
// are PRIVATE: it is for the organizers' records, never for git or the projector. Pure.
import type { CardsInfo } from '@quina/protocol';
import type { GamePlan } from '../../ui/plan.ts';
import type { WinnerInfo } from '../../ui/flow.ts';

export const FULL_EXPORT_KIND = 'quina.fullExport';
export const FULL_EXPORT_VERSION = 1;

export interface FullExport {
  kind: typeof FULL_EXPORT_KIND;
  v: typeof FULL_EXPORT_VERSION;
  /** PRIVATE: names and notes of Winners. */
  private: true;
  exportedAtMs: number;
  plan: GamePlan;
  /** The engine's view at export time, or null when it wasn't connected. */
  game: {
    cardsInPlay: string;
    cardsInPlayCount: number;
    winners: WinnerInfo[];
  } | null;
}

export function fullExport(plan: GamePlan, cards: CardsInfo | null, winners: readonly WinnerInfo[] | null, exportedAtMs: number): FullExport {
  return {
    kind: FULL_EXPORT_KIND,
    v: FULL_EXPORT_VERSION,
    private: true,
    exportedAtMs,
    plan,
    game: cards || winners ? { cardsInPlay: cards?.inPlay ?? '', cardsInPlayCount: cards?.inPlayCount ?? 0, winners: [...(winners ?? [])] } : null,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "quina-26-pla.json", "quina-26-complet-20261226-2315.json" (local time). */
export function exportFileName(edition: string, kind: 'pla' | 'complet', atMs: number): string {
  const safe = edition.replace(/[^0-9a-z]/gi, '') || 'xx';
  if (kind === 'pla') return `quina-${safe}-pla.json`;
  const d = new Date(atMs);
  return `quina-${safe}-complet-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/** Pretty JSON, as downloaded and copied. */
export const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
