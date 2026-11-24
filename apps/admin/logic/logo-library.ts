// The logo library's search: a library item matches when every word of the query is in its name or key,
// ignoring case and accents ("can pere" finds "Can Pere", key "can-pere"). An empty query matches all. Pure.
import type { MediaItem } from '../../../packages/ui/data/cloud-plan.ts';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u00b7]/g, '')
    .toLowerCase();

export function matchesQuery(item: Pick<MediaItem, 'name' | 'key'>, query: string): boolean {
  const words = fold(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fold(`${item.name ?? ''} ${item.key}`).replace(/[^a-z0-9]+/g, ' ');
  return words.every((w) => haystack.includes(w));
}
