// The player-app settings sent to the cloud (D227; the Platform session's Worker, same origin, organizers only):
//   PUT /api/sounds  { soundsDefault: boolean }       → { ok: true } | 400 { ok: false, error }
//   PUT /api/notice  { notice: string | null }        → { ok: true } | 400 { ok: false, error } (at most 200 characters)
//   GET /api/sounds → { soundsDefault }, GET /api/notice → { notice }: what every phone has now, so the form starts there.
// The cloud publishes each change on the public feed (`notice`, `soundsDefault`), so every phone gets it, and a phone
// that connects later finds it in its first snapshot. Never throws. It imports nothing that needs a browser, so
// apps/cloud's tests run it against the real Worker.
import { noticeBody, readCloudSettings, soundsBody, type CloudPlayerSettings, type PlayerSettings, type SendState } from '../logic/player-settings.ts';

/** The fetch a PUT needs (Admin's `FetchLike`, packages/ui/data/cloud-plan.ts, is one). */
export type PutFetch = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

async function put(fetchImpl: PutFetch, path: string, body: unknown): Promise<{ ok: true } | { ok: false; status: number }> {
  try {
    const res = await fetchImpl(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok ? { ok: true } : { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Send both settings to the phones: the sounds default, then the message. `sent` only when the cloud took both. */
export async function sendPlayerSettings(fetchImpl: PutFetch, settings: PlayerSettings): Promise<Extract<SendState, { kind: 'sent' | 'failed' }>> {
  const sounds = await put(fetchImpl, '/api/sounds', soundsBody(settings));
  const notice = await put(fetchImpl, '/api/notice', noticeBody(settings));
  const failed = [sounds, notice].find((r) => !r.ok);
  return failed && !failed.ok ? { kind: 'failed', status: failed.status } : { kind: 'sent' };
}

/** The fetch a GET needs (Admin's `FetchLike` is one). */
export type GetFetch = (input: string, init?: { method?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

async function get(fetchImpl: GetFetch, path: string): Promise<unknown> {
  try {
    const res = await fetchImpl(path, { method: 'GET' });
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

/** What every phone has now (both GETs), or null when the cloud didn't answer both as it should. */
export async function fetchPlayerSettings(fetchImpl: GetFetch): Promise<CloudPlayerSettings | null> {
  const [notice, sounds] = await Promise.all([get(fetchImpl, '/api/notice'), get(fetchImpl, '/api/sounds')]);
  return readCloudSettings(notice, sounds);
}
