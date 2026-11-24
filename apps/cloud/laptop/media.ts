// Push this laptop's prepared pool to the cloud's private R2 bucket, or pull it onto a takeover laptop; or fetch
// the edition's Game plan and its images into the link folder (a laptop's setup, without connecting as the show
// laptop, which would take over from the one playing):
//   npm run media -- push|pull|plan [--pool default] [--cloud https://quina-dev.barrakudesbegur.org]
// The cloud and the service token come from flags, the environment or `.env.link`, as for the link
// (QUINA_CLOUD_URL's wss://…/ws/show gives the https origin). Run it the day before the show, not during it:
// every file is one request of the daily quota (about 730 for last year's pool).
import fs from 'node:fs';
import path from 'node:path';
import { LINK, loadPool } from '../../show/relay/pool.ts';
import { CLOUD_PLAN_FILE } from '../../show/relay/plan.ts';
import { pull, push } from './media-sync.ts';
import { fetchPlanMedia } from './plan-media.ts';
import { poolRoots } from './pool-roots.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env.link');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const action = args[0];
if (action !== 'push' && action !== 'pull' && action !== 'plan') {
  console.error('usage: npm run media -- push|pull|plan [--pool NAME] [--cloud https://…]');
  process.exit(1);
}
const wsUrl = process.env.QUINA_CLOUD_URL ?? 'ws://localhost:8787/ws/show';
const cloud = (flag('--cloud') ?? wsUrl.replace(/^ws/, 'http').replace(/\/ws\/show$/, '')).replace(/\/+$/, '');
const id = process.env.CF_ACCESS_CLIENT_ID;
const secret = process.env.CF_ACCESS_CLIENT_SECRET;
const pool = loadPool(flag('--pool'));
const options = {
  cloud,
  headers: (id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {}) as Record<string, string>,
  pool: pool.name,
  roots: poolRoots(pool),
  dataDir: LINK,
};
if (action === 'plan') {
  // The whole plan, as the link would keep it (cloud-plan.json), then the images it uses.
  const res = await fetch(`${cloud}/api/plan`, { headers: options.headers, signal: AbortSignal.timeout(20_000) }).catch((error: unknown) => ({ ok: false, status: 0, error }) as const);
  if (!res.ok) {
    console.error(`the cloud's plan: ${'status' in res && res.status ? `HTTP ${res.status}` : String((res as { error?: unknown }).error)} (check .env.link: QUINA_CLOUD_URL and the service token)`);
    process.exit(1);
  }
  const body = (await (res as Response).json()) as { plan: { title?: string } | null; savedAtMs?: number | null };
  if (!body.plan) {
    console.log('the cloud has no Game plan yet (Admin saves one)');
    process.exit(0);
  }
  fs.mkdirSync(LINK, { recursive: true });
  const file = path.join(LINK, CLOUD_PLAN_FILE);
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify({ savedAtMs: body.savedAtMs ?? 0, plan: body.plan }, null, 2)}\n`);
  fs.renameSync(`${file}.tmp`, file);
  const images = await fetchPlanMedia(body.plan, { base: cloud, headers: options.headers, dataDir: LINK, log: (line) => console.log(line) });
  console.log(`the Game plan "${body.plan.title ?? ''}" kept in ${file}; ${images} new image(s)`);
  process.exit(0);
}
console.log(`media ${action}: pool ${pool.name} ↔ ${cloud}`);
const report = await (action === 'push' ? push(options) : pull(options));
console.log(`done: ${report.moved} of ${report.files} files moved, ${(report.bytes / 1e6).toFixed(1)} MB${report.skipped.length ? `, ${report.skipped.length} skipped` : ''}`);
