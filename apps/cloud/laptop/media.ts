// Push this laptop's prepared repertoire to the cloud's private R2 bucket, or pull it onto a takeover laptop; or fetch
// the edition's Game plan and its images into the link folder (a laptop's setup, without connecting as the show
// laptop, which would take over from the one playing):
//   npm run media -- push|pull|plan [--repertoire default] [--cloud https://quina-dev.barrakudesbegur.org]
// And to make room in the bucket (the free tier is 10 GB), e.g. for this year's repertoire: list them, or delete one:
//   npm run media -- prune                             the repertoires in the bucket and their sizes
//   npm run media -- prune --repertoire default        what deleting that one would free (a dry run)
//   npm run media -- prune --repertoire default --yes  delete it (every file and its manifest; laptops keep their copies)
// The cloud and the service token come from flags, the environment or `.env.link`, as for the link
// (QUINA_CLOUD_URL's wss://…/ws/show gives the https origin). Run it the day before the show, not during it:
// every file is one request of the daily quota (about 730 for last year's songs).
import fs from 'node:fs';
import path from 'node:path';
import { LINK, loadRepertoire } from '../../show/relay/repertoire.ts';
import { CLOUD_PLAN_FILE } from '../../show/relay/plan.ts';
import { pull, push } from './media-sync.ts';
import { fetchPlanMedia } from './plan-media.ts';
import { repertoireRoots } from './repertoire-roots.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env.link');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const action = args[0];
if (action !== 'push' && action !== 'pull' && action !== 'plan' && action !== 'prune') {
  console.error('usage: npm run media -- push|pull|plan|prune [--repertoire NAME] [--yes] [--cloud https://…]');
  process.exit(1);
}
const wsUrl = process.env.QUINA_CLOUD_URL ?? 'ws://localhost:8787/ws/show';
const cloud = (flag('--cloud') ?? wsUrl.replace(/^ws/, 'http').replace(/\/ws\/show$/, '')).replace(/\/+$/, '');
const id = process.env.CF_ACCESS_CLIENT_ID;
const secret = process.env.CF_ACCESS_CLIENT_SECRET;
const headers = (id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {}) as Record<string, string>;
if (action === 'prune') await prune(flag('--repertoire'), args.includes('--yes'));
const repertoire = loadRepertoire(flag('--repertoire'));
const options = {
  cloud,
  headers,
  repertoire: repertoire.name,
  roots: repertoireRoots(repertoire),
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
console.log(`media ${action}: repertoire ${repertoire.name} ↔ ${cloud}`);
const report = await (action === 'push' ? push(options) : pull(options));
console.log(`done: ${report.moved} of ${report.files} files moved, ${(report.bytes / 1e6).toFixed(1)} MB${report.skipped.length ? `, ${report.skipped.length} skipped` : ''}`);

/** The bucket's repertoires and their sizes; with one named, what deleting it frees, and with --yes, the deletion. */
async function prune(name: string | undefined, yes: boolean): Promise<never> {
  const gb = (bytes: number) => `${(bytes / 1e9).toFixed(2)} GB`;
  const res = await fetch(`${cloud}/api/sync`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    console.error(`the bucket's repertoires: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const overview = (await res.json()) as { repertoires: { name: string; files: number; bytes: number; updatedAtMs: number }[]; totalBytes: number; freeTierBytes: number };
  console.log(`R2 bucket: ${gb(overview.totalBytes)} of the free tier's ${gb(overview.freeTierBytes)}`);
  for (const r of overview.repertoires) console.log(`  ${r.name.padEnd(12)} ${String(r.files).padStart(5)} files  ${gb(r.bytes).padStart(9)}  pushed ${r.updatedAtMs ? new Date(r.updatedAtMs).toISOString().slice(0, 16).replace('T', ' ') : '(no manifest)'}`);
  if (!name) process.exit(0);
  const target = overview.repertoires.find((r) => r.name === name);
  if (!target) {
    console.error(`no repertoire "${name}" in the bucket`);
    process.exit(1);
  }
  if (!yes) {
    console.log(`Dry run: deleting repertoire ${name} would free ${gb(target.bytes)} (${target.files} files), leaving ${gb(overview.totalBytes - target.bytes)}.`);
    console.log('Laptops keep their own copies. Run again with --yes to delete it.');
    process.exit(0);
  }
  const del = await fetch(`${cloud}/api/sync/${name}/manifest`, { method: 'DELETE', headers: { ...headers, 'x-confirm-repertoire': name }, signal: AbortSignal.timeout(120_000) });
  if (!del.ok) {
    console.error(`delete repertoire ${name}: HTTP ${del.status} ${await del.text()}`);
    process.exit(1);
  }
  const { deleted } = (await del.json()) as { deleted: number };
  console.log(`deleted repertoire ${name} from the bucket: ${deleted} files, ${gb(target.bytes)} freed`);
  process.exit(0);
}
