// The Game plan and media through the cloud's HTTP API (the Platform session's Worker, same origin, behind
// Access):
//   GET  /api/plan   → { plan: GamePlan | null }
//   PUT  /api/plan   (the whole GamePlan) → 200 { ok: true, plan } | 400 { ok: false, errors: string[] }
//   POST /api/media  (a PNG or JPEG body, ≤ 300 KB; WebP is refused) → 201 { ok: true, path: '/media/<key>.png|.jpg', key }
//   PUT  /api/media/<key>.jxl  (its JPEG XL, ≤ 300 KB) → 201 { ok: true, path: '/media/<key>.jxl', key }
// CloudPlanStore keeps the PlanStore interface the screens already use (a synchronous `load()` from a
// cache), and adds `refresh()` and `put()`, which talk to the cloud and report failures as values, never throwing.
import { checkGamePlan, type GamePlan } from '../plan.ts';
import type { PlanStore } from './plan-store.ts';

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string | Blob }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type PutResult = { ok: true; plan: GamePlan } | { ok: false; status: number; errors: string[] };
export type MediaResult = { ok: true; path: string; key: string } | { ok: false; status: number; reason: 'type' | 'size' | 'full' | 'network' | 'error' };

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** A pushed or fetched plan, checked: the plan, null for "no plan", or undefined when it isn't a valid plan. */
export function checkedPlan(raw: unknown): GamePlan | null | undefined {
  if (raw === null || raw === undefined) return null;
  const check = checkGamePlan(raw);
  return check.ok ? check.plan : undefined;
}

export class CloudPlanStore implements PlanStore {
  private plan: GamePlan | null = null;
  private readonly listeners = new Set<(plan: GamePlan | null) => void>();
  private readonly fetchImpl: FetchLike;
  private readonly base: string;

  constructor(fetchImpl: FetchLike, base = '') {
    this.fetchImpl = fetchImpl;
    this.base = base;
  }

  /** The last plan fetched or saved (null before the first refresh). */
  load(): GamePlan | null {
    return this.plan;
  }

  /** Fire-and-forget save for the PlanStore interface; prefer `put()` to learn the outcome. */
  save(plan: GamePlan): void {
    void this.put(plan);
  }

  subscribe(listener: (plan: GamePlan | null) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Fetch the cloud's plan; subscribers hear about it. Returns the plan, or null when there is none or the fetch failed. */
  async refresh(): Promise<GamePlan | null> {
    try {
      const res = await this.fetchImpl(`${this.base}/api/plan`);
      if (!res.ok) return this.plan;
      const body = await res.json();
      const raw = isRec(body) ? body.plan : null;
      const check = raw === null || raw === undefined ? null : checkGamePlan(raw);
      this.set(check?.ok ? check.plan : null);
      return this.plan;
    } catch {
      return this.plan;
    }
  }

  /** A plan the cloud pushed on the console socket (`relay.plan`): subscribers hear about it when it changed. */
  receive(raw: unknown): void {
    const plan = checkedPlan(raw);
    if (plan === undefined || JSON.stringify(plan) === JSON.stringify(this.plan)) return;
    this.set(plan);
  }

  /** Save the whole plan. The cloud validates it with the same checkGamePlan; its errors come back with paths. */
  async put(plan: GamePlan): Promise<PutResult> {
    try {
      const res = await this.fetchImpl(`${this.base}/api/plan`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(plan),
      });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) {
        // Our own save: update the cache without notifying (subscribers hear about other people's changes).
        const saved = isRec(body) && body.plan ? checkGamePlan(body.plan) : null;
        this.plan = saved?.ok ? saved.plan : plan;
        return { ok: true, plan: this.plan };
      }
      const errors = isRec(body) && Array.isArray(body.errors) ? body.errors.map(String) : [`HTTP ${res.status}`];
      return { ok: false, status: res.status, errors };
    } catch (e) {
      return { ok: false, status: 0, errors: [e instanceof Error ? e.message : String(e)] };
    }
  }

  private set(plan: GamePlan | null): void {
    this.plan = plan;
    for (const l of this.listeners) l(plan);
  }
}

/** The media key in a `/media/<key>.<ext>` path, or null. */
export const mediaKey = (path: string): string | null => /^\/media\/([^/?#.]+)\.[a-z0-9]+$/i.exec(path)?.[1] ?? null;

const mediaFailure = (status: number): MediaResult => ({ ok: false, status, reason: status === 415 ? 'type' : status === 413 ? 'size' : status === 507 ? 'full' : 'error' });

/** Upload an image's fallback (PNG for logos and pictures, JPEG for photos) and get its public, immutable path. */
export async function uploadMedia(fetchImpl: FetchLike, image: Blob, base = ''): Promise<MediaResult> {
  try {
    const res = await fetchImpl(`${base}/api/media`, { method: 'POST', headers: { 'content-type': image.type || 'application/octet-stream' }, body: image });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && isRec(body) && typeof body.path === 'string') {
      const key = typeof body.key === 'string' ? body.key : mediaKey(body.path);
      if (key) return { ok: true, path: body.path, key };
    }
    return mediaFailure(res.status);
  } catch {
    return { ok: false, status: 0, reason: 'network' };
  }
}

/** Attach the JPEG XL of an uploaded image (`/media/<key>.jxl`). Without it the cloud serves the fallback there. */
export async function uploadMediaJxl(fetchImpl: FetchLike, key: string, jxl: Blob, base = ''): Promise<MediaResult> {
  try {
    const res = await fetchImpl(`${base}/api/media/${encodeURIComponent(key)}.jxl`, { method: 'PUT', headers: { 'content-type': 'image/jxl' }, body: jxl });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && isRec(body) && typeof body.path === 'string') return { ok: true, path: body.path, key };
    return mediaFailure(res.status);
  } catch {
    return { ok: false, status: 0, reason: 'network' };
  }
}
