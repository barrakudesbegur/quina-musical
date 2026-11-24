// What each sponsor gives, from the organisers' sheet ("Val per sopar 2 persones"), kept only in this browser
// (Admin's own memory, never in the plan: the plan is public). Admin shows it as a suggestion when a prize's
// sponsor is chosen. Keyed by sponsor id.
const KEY = 'quina.admin.offers.v1';

function load(): Map<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const json: unknown = raw ? JSON.parse(raw) : null;
    if (!json || typeof json !== 'object' || Array.isArray(json)) return new Map();
    return new Map(Object.entries(json).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length <= 300));
  } catch {
    return new Map();
  }
}

class SponsorOffers {
  all = $state.raw<ReadonlyMap<string, string>>(load());

  get(sponsorId: string | null | undefined): string | null {
    return sponsorId ? (this.all.get(sponsorId) ?? null) : null;
  }

  /** Adds or replaces offers (an import) and keeps them in this browser. */
  merge(offers: ReadonlyMap<string, string>): void {
    if (!offers.size) return;
    this.all = new Map([...this.all, ...offers]);
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(Object.fromEntries(this.all)));
    } catch {
      // Private mode or full storage: the suggestions just last for this page.
    }
  }
}

export const offers = new SponsorOffers();
