// Send an edition's plan to the cloud by hand (D116): show what changes, save the cloud's current plan to a
// timestamped local backup (U69 (b): gitignored, like the link folder it lives in), then replace it.
// Without `yes` it stops after showing the change, so nothing is ever replaced blind. The save is based on the
// version it read (`x-quina-plan-base`), so if Admin saved in between, the cloud refuses it and nothing is lost.
import fs from 'node:fs';
import path from 'node:path';
import { checkGamePlan, type GamePlan } from '@quina/protocol';
import { planSummary } from './plan.ts';

export interface UploadOptions {
  /** The cloud's https origin, e.g. https://quina-dev.barrakudesbegur.org, or the local Worker's http://localhost:8787. */
  cloud: string;
  /** The laptop's Access service token headers (any signed-in caller may GET and PUT the plan). */
  headers: Record<string, string>;
  plan: GamePlan;
  backupDir: string;
  yes: boolean;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (line: string) => void;
}

export interface UploadResult {
  uploaded: boolean;
  /** The saved copy of the cloud's plan, when one was written. */
  backup: string | null;
}

/** The plan as the cloud compares it: the tablet's volumes are the cloud's own (it keeps them on every save). */
const comparable = (plan: unknown): string => {
  if (!plan || typeof plan !== 'object') return JSON.stringify(plan);
  const { volumes: _volumes, ...rest } = plan as Record<string, unknown>;
  return JSON.stringify(rest);
};

export async function uploadPlan(o: UploadOptions): Promise<UploadResult> {
  const fetchImpl = o.fetch ?? fetch;
  const log = o.log ?? console.log;
  const url = `${o.cloud}/api/plan`;

  const got = await fetchImpl(url, { headers: o.headers, signal: AbortSignal.timeout(20_000) });
  if (!got.ok) throw new Error(`the cloud's plan: HTTP ${got.status} ${(await got.text()).slice(0, 200)}`);
  const body = (await got.json()) as { plan?: unknown; savedAtMs?: number | null };
  const current = body.plan ?? null;
  const read = current ? checkGamePlan(current) : null;

  log(`the cloud's plan now (${o.cloud}):`);
  for (const line of read?.ok ? planSummary(read.plan) : [current ? '(a plan this check refuses)' : '(no plan)']) log(`  ${line}`);
  log('the plan to upload:');
  for (const line of planSummary(o.plan)) log(`  ${line}`);

  if (current && comparable(current) === comparable(o.plan)) {
    log('the cloud already has this plan: nothing to do.');
    return { uploaded: false, backup: null };
  }
  if (!o.yes) {
    log("Run again with --yes to save the cloud's plan and replace it.");
    return { uploaded: false, backup: null };
  }

  // Save first (D116): exactly what the cloud answered, with where and when it was saved.
  const stamp = new Date((o.now ?? Date.now)()).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const host = new URL(o.cloud).host.replace(/[^a-z0-9.-]/gi, '_');
  fs.mkdirSync(o.backupDir, { recursive: true });
  const backup = path.join(o.backupDir, `${host}-plan-${stamp}.json`);
  fs.writeFileSync(backup, `${JSON.stringify({ cloud: o.cloud, savedAtMs: body.savedAtMs ?? null, plan: current }, null, 2)}\n`, { mode: 0o600 });
  log(`saved the cloud's plan to ${backup}`);

  const put = await fetchImpl(url, {
    method: 'PUT',
    headers: { ...o.headers, 'content-type': 'application/json', 'x-quina-plan-base': body.savedAtMs == null ? 'none' : String(body.savedAtMs) },
    body: JSON.stringify(o.plan),
    signal: AbortSignal.timeout(20_000),
  });
  const answer = (await put.json().catch(() => null)) as { ok?: boolean; errors?: string[] } | null;
  if (put.status === 409) {
    throw new Error(`the cloud's plan changed after it was read (someone saved in Admin?): nothing was replaced. Run the upload again to see the change.\nThe copy read is saved in ${backup}.`);
  }
  if (!put.ok || !answer?.ok) {
    throw new Error(`the cloud refused the plan (HTTP ${put.status})${answer?.errors?.length ? `:\n  ${answer.errors.join('\n  ')}` : ''}\nIts old plan is unchanged, and saved in ${backup}.`);
  }
  log(`uploaded. To undo: npm run edition -- upload ${backup} --yes`);
  return { uploaded: true, backup };
}
