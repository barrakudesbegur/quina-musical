// Push this laptop's prepared repertoire to the cloud's private R2 bucket, or pull it onto a takeover laptop; or fetch
// the edition's Game plan and its images into the link folder (a laptop's setup, without connecting as the show
// laptop, which would take over from the one playing):
//   npm run media -- push|pull|plan [--repertoire default] [--cloud https://quina-dev.barrakudesbegur.org]
//   npm run media -- push --repertoire 2026 --dry-run   what a push would upload, by root, without sending anything
//   npm run media -- pull --repertoire 2026 --into /tmp/x   pull into an empty folder instead (each folder at its place
//                                         under it, as under the repo): a check that the bucket alone rebuilds it
// The bucket keeps each distinct file once, by its SHA-256 (D248), so the shared music and a track two pools share
// are stored once. To make room in it (the free tier is 10 GB): the files no repertoire names any more (a replaced
// voice or hook), or a whole repertoire:
//   npm run media -- prune                             the repertoires, the bucket's size, the blobs no manifest names
//   npm run media -- prune --yes                       delete those blobs
//   npm run media -- prune --repertoire default        what dropping that repertoire would free (a dry run)
//   npm run media -- prune --repertoire default --yes  drop its manifest, then delete the blobs no manifest names
// (laptops keep their own copies). The cloud and the service token come from flags, the environment or `.env.link`,
// as for the link (QUINA_CLOUD_URL's wss://…/ws/show gives the https origin). Run it the day before the show, not
// during it: every blob is one request of the daily quota (about 2,800 for 2026's repertoire).
import fs from 'node:fs';
import path from 'node:path';
import { LINK, loadRepertoire } from '../../show/relay/repertoire.ts';
import { CLOUD_PLAN_FILE } from '../../show/relay/plan.ts';
import { prune, pull, push } from './media-sync.ts';
import { fetchPlanMedia } from './plan-media.ts';
import { repertoireRoots, rootsUnder } from './repertoire-roots.ts';

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
  console.error('usage: npm run media -- push|pull|plan|prune [--repertoire NAME] [--dry-run] [--into DIR] [--yes] [--cloud https://…]');
  process.exit(1);
}
const wsUrl = process.env.QUINA_CLOUD_URL ?? 'ws://localhost:8787/ws/show';
const cloud = (flag('--cloud') ?? wsUrl.replace(/^ws/, 'http').replace(/\/ws\/show$/, '')).replace(/\/+$/, '');
const id = process.env.CF_ACCESS_CLIENT_ID;
const secret = process.env.CF_ACCESS_CLIENT_SECRET;
const headers = (id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {}) as Record<string, string>;
if (action === 'prune') {
  try {
    await prune({ cloud, headers, drop: flag('--repertoire'), yes: args.includes('--yes') });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}
const repertoire = loadRepertoire(flag('--repertoire'));
const intoFlag = flag('--into');
if (intoFlag !== undefined && action !== 'pull') {
  console.error('--into is for pull only');
  process.exit(1);
}
const into = intoFlag === undefined ? null : path.resolve(process.env.INIT_CWD ?? process.cwd(), intoFlag);
const options = {
  cloud,
  headers,
  repertoire: repertoire.name,
  roots: into ? rootsUnder(repertoireRoots(repertoire), into) : repertoireRoots(repertoire),
  dataDir: into ? path.join(into, 'data', 'link') : LINK,
  dryRun: args.includes('--dry-run'),
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
console.log(`media ${action}: repertoire ${repertoire.name} ↔ ${cloud}${into ? `, into ${into}` : ''}`);
const report = await (action === 'push' ? push(options) : pull(options));
const moved = action === 'push' ? `${report.moved} blobs uploaded for ${report.files} files` : `${report.moved} of ${report.files} files written`;
console.log(`done: ${moved}, ${(report.bytes / 1e6).toFixed(1)} MB ${action === 'push' ? 'sent' : 'downloaded'}${report.skipped.length ? `, ${report.skipped.length} skipped` : ''}`);

