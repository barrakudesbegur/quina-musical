// The Game plan and media through the cloud's HTTP API (the Platform session's Worker, same origin, behind
// Access), and the show laptop's relay, which answers /api/plan the same way:
//   GET  /api/plan   → { plan: GamePlan | null, savedAtMs: number | null }
//   PUT  /api/plan   (the whole GamePlan; header `x-quina-plan-base`: the `savedAtMs` it was loaded at, or `none`)
//                    → 200 { ok: true, plan, savedAtMs } | 400 { ok: false, errors: string[] }
//                    | 409 { ok: false, stale: true, savedAtMs, errors } (the plan changed since: reload)
//   POST /api/media  (a PNG or JPEG body, ≤ 300 KB; WebP is refused) → 201 { ok: true, path: '/media/<key>.png|.jpg', key }
//   PUT  /api/media/<key>.jxl  (its JPEG XL, ≤ 300 KB) → 201 { ok: true, path: '/media/<key>.jxl', key }
// CloudPlanStore keeps the PlanStore interface the screens already use (a synchronous `load()` from a
// cache), and adds `refresh()` and `put()`, which talk to the cloud and report failures as values, never throwing.
// The plan's `savedAtMs` is its version: a save names the version it was based on, so one made from a page that
// never loaded the plan, or loaded an older one, is refused instead of replacing the plan (whats-left 7.1).
import { checkGamePlan, type GamePlan } from '../plan.ts';
import type { PlanStore } from './plan-store.ts';

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string | Blob }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** A plan's version: when it was saved (the cloud's or the relay's clock), or null for "no plan yet". */
export type PlanVersion = number | null;

/** The header a save names its base version in (`none`: saved where there was no plan). Read by apps/cloud's
 * worker and the relay (apps/show/relay/plan.ts), which spell it the same. */
export const PLAN_BASE_HEADER = 'x-quina-plan-base';

export const planBaseValue = (base: PlanVersion): string => (base === null ? 'none' : String(base));

/** What a GET of the plan gave: the plan (null: none yet) and its version, or why it couldn't be read. */
export type PlanLoad = { ok: true; plan: GamePlan | null; savedAtMs: PlanVersion } | { ok: false; detail: string };

/** `stale`: refused because the plan changed since the base version (409); `savedAtMs` is the version there now. */
export type PutResult =
  | { ok: true; plan: GamePlan; savedAtMs: PlanVersion }
  | { ok: false; status: number; errors: string[]; stale: boolean };
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
  private savedAtMs: PlanVersion = null;
  private readonly listeners = new Set<(plan: GamePlan | null) => void>();
  private readonly fetchImpl: FetchLike;
  private readonly base: string;

  constructor(fetchImpl: FetchLike, base = '') {
    this.fetchImpl = fetchImpl;
    this.base = base;
  }

  /** The last plan fetched, pushed or saved (null before the first). */
  load(): GamePlan | null {
    return this.plan;
  }

  /** The version of `load()`'s plan (null: none, or nothing heard yet). */
  version(): PlanVersion {
    return this.savedAtMs;
  }

  /** Fire-and-forget save for the PlanStore interface, based on the cached version; prefer `put()`. */
  save(plan: GamePlan): void {
    void this.put(plan, this.savedAtMs);
  }

  subscribe(listener: (plan: GamePlan | null) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /**
   * Fetch the plan; subscribers hear about it when it is newer than the cached one. A failed request, or a body
   * that isn't a plan this code reads, is a failure (never "no plan"): the cache stays as it was.
   */
  async refresh(): Promise<PlanLoad> {
    try {
      const res = await this.fetchImpl(`${this.base}/api/plan`);
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
      const body = await res.json();
      if (!isRec(body)) return { ok: false, detail: 'not a plan answer' };
      const plan = checkedPlan(body.plan);
      if (plan === undefined) return { ok: false, detail: 'the plan there does not pass the check' };
      const savedAtMs = version(body.savedAtMs);
      if (savedAtMs === undefined) return { ok: false, detail: 'no savedAtMs' };
      this.take(plan, savedAtMs);
      return { ok: true, plan, savedAtMs };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  /** A plan pushed on the console socket (`relay.plan`, with its savedAtMs): subscribers hear about it when it changed. */
  receive(raw: unknown, rawSavedAtMs?: unknown): void {
    const plan = checkedPlan(raw);
    const savedAtMs = version(rawSavedAtMs);
    if (plan === undefined || savedAtMs === undefined) return;
    this.take(plan, savedAtMs);
  }

  /**
   * Save the whole plan, based on version `base` (what the page loaded, or last saved). The cloud validates it with
   * the same checkGamePlan; its errors come back with paths. A changed plan there refuses it (`stale`).
   */
  async put(plan: GamePlan, base: PlanVersion): Promise<PutResult> {
    try {
      const res = await this.fetchImpl(`${this.base}/api/plan`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', [PLAN_BASE_HEADER]: planBaseValue(base) },
        body: JSON.stringify(plan),
      });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) {
        // Our own save: update the cache without notifying (subscribers hear about other people's changes).
        const saved = isRec(body) && body.plan ? checkGamePlan(body.plan) : null;
        const savedAtMs = isRec(body) ? version(body.savedAtMs) : undefined;
        this.plan = saved?.ok ? saved.plan : plan;
        this.savedAtMs = savedAtMs ?? null;
        return { ok: true, plan: this.plan, savedAtMs: this.savedAtMs };
      }
      const errors = isRec(body) && Array.isArray(body.errors) ? body.errors.map(String) : [`HTTP ${res.status}`];
      return { ok: false, status: res.status, errors, stale: res.status === 409 };
    } catch (e) {
      return { ok: false, status: 0, errors: [e instanceof Error ? e.message : String(e)], stale: false };
    }
  }

  /**
   * Keep a plan heard from the server, unless it is older than the cached one (a GET answered before a push that
   * arrived first). Subscribers hear about a changed plan or version (`version()` is already the new one).
   */
  private take(plan: GamePlan | null, savedAtMs: PlanVersion): void {
    if (savedAtMs !== null && this.savedAtMs !== null && savedAtMs < this.savedAtMs) return;
    if (savedAtMs === this.savedAtMs && JSON.stringify(plan) === JSON.stringify(this.plan)) return;
    this.plan = plan;
    this.savedAtMs = savedAtMs;
    for (const l of this.listeners) l(plan);
  }
}

/** A version as sent: a number, null (no plan), or undefined when it is neither. */
function version(raw: unknown): PlanVersion | undefined {
  if (raw === null) return null;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

/** The media key in a `/media/<key>.<ext>` path, or null. */
export const mediaKey = (path: string): string | null => /^\/media\/([^/?#.]+)\.[a-z0-9]+$/i.exec(path)?.[1] ?? null;

const mediaFailure = (status: number): MediaResult => ({ ok: false, status, reason: status === 415 ? 'type' : status === 413 ? 'size' : status === 507 ? 'full' : 'error' });

/** Upload an image's fallback (PNG for logos and pictures, JPEG for photos) and get its public, immutable path. */
export async function uploadMedia(fetchImpl: FetchLike, image: Blob, base = '', name?: string): Promise<MediaResult> {
  try {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    const res = await fetchImpl(`${base}/api/media${query}`, { method: 'POST', headers: { 'content-type': image.type || 'application/octet-stream' }, body: image });
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

/** One uploaded image in the cloud's media library (GET /api/media, admins only). */
export interface MediaItem {
  key: string;
  /** The name given at upload (`?name=`), or null. */
  name: string | null;
  /** The fallback's public path (`/media/<key>.png|.jpg`): what a plan stores. */
  fallback: string;
  /** Whether its JPEG XL exists. */
  jxl: boolean;
  uploadedAtMs: number;
}

export type MediaList = { ok: true; media: MediaItem[] } | { ok: false; status: number };

/** The media library, newest first. Malformed entries are skipped; failures are values, never thrown. */
export async function listMedia(fetchImpl: FetchLike, base = ''): Promise<MediaList> {
  try {
    const res = await fetchImpl(`${base}/api/media`);
    if (!res.ok) return { ok: false, status: res.status };
    const body: unknown = await res.json().catch(() => null);
    const raw = isRec(body) && Array.isArray(body.media) ? body.media : [];
    const media: MediaItem[] = [];
    for (const m of raw) {
      if (!isRec(m) || typeof m.key !== 'string' || typeof m.fallback !== 'string' || !m.fallback.startsWith('/media/')) continue;
      media.push({
        key: m.key,
        name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : null,
        fallback: m.fallback,
        jxl: Boolean(m.jxl),
        uploadedAtMs: typeof m.uploadedAtMs === 'number' ? m.uploadedAtMs : 0,
      });
    }
    return { ok: true, media: media.sort((a, b) => b.uploadedAtMs - a.uploadedAtMs) };
  } catch {
    return { ok: false, status: 0 };
  }
}
