// The edition file (D116): one JSON per edition with all it needs, kept in git and sent to the cloud by hand.
//   npm run edition -- check <file> [--repertoire 2026]
//   npm run edition -- upload <file> [--repertoire 2026] [--start "2026-11-27 19:00"] [--cloud https://…] [--yes]
// <file> is a plan source (data/editions/2026.plan.json, a GamePlan), an edition file (its `plan`), or a backup
// this tool saved (data/link/backups/…, to undo an upload).
// - check: the plan as the cloud and the screens read it, and, with a repertoire, each round's card side against
//   its card-types.json and each side's pool against its songs.
// - upload: the same check, then what would change. With --yes it saves the cloud's plan to data/link/backups/
//   (gitignored) and replaces it. --start moves the first round (Begur's time) and the doors an hour before, for
//   a test, without touching the file.
// The cloud and the laptop's service token come from apps/cloud/.env.link, as for the link and the media sync.
// Not yet (U68–U75 are with the user): `build` (the songs per pool, Sound engine's; the cards as uploaded data),
// the cloud keeping every replaced version, a rehearsal reset.
import fs from 'node:fs';
import path from 'node:path';
import { printedCardTypes, poolSongCounts } from '../../apps/cloud/laptop/preflight/checks.ts';
import { loadRepertoire } from '../../apps/show/relay/repertoire.ts';
import { checkPlan, venueTimeMs, withStart, type PlanContext } from './plan.ts';
import { uploadPlan } from './upload.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BACKUPS = path.join(ROOT, 'data/link/backups');
const ENV_LINK = path.join(ROOT, 'apps/cloud/.env.link');

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const usage = 'usage: npm run edition -- check|upload <file> [--repertoire NAME] [--start "YYYY-MM-DD HH:MM"] [--cloud https://…] [--yes]';
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const [action, file] = args;
if ((action !== 'check' && action !== 'upload') || !file) fail(usage);
const filePath = path.resolve(process.env.INIT_CWD ?? process.cwd(), file as string);
let json: unknown;
try {
  json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (error) {
  fail(`${file}: ${error instanceof Error ? error.message : String(error)}`);
}

/** What the plan is checked against: the repertoire's printed card types and its songs' pools. */
function context(name: string | undefined): PlanContext {
  if (!name) return { cardTypes: null };
  const repertoire = loadRepertoire(name);
  const readJson = (p: string | null | undefined): unknown => (p && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
  const typesFile = repertoire.cardsJson ? path.join(path.dirname(repertoire.cardsJson), 'card-types.json') : null;
  const cardTypes = printedCardTypes(readJson(typesFile));
  if (!cardTypes) console.warn(`repertoire ${repertoire.name}: no card-types.json beside its cards (${typesFile ?? 'no cardsJson'}), so the sides aren't checked`);
  return { cardTypes, poolSongs: poolSongCounts(readJson(repertoire.songsJson)) };
}

const report = checkPlan(json, context(flag('--repertoire')));
for (const warning of report.warnings) console.warn(`WARN  ${warning}`);
for (const error of report.errors) console.error(`ERROR ${error}`);
if (!report.plan || report.errors.length > 0) fail(`${file}: ${report.errors.length} error(s); nothing was sent.`);
let plan = report.plan!;
console.log(`${file}: the plan passes (${plan.rounds.length} rounds${report.warnings.length ? `, ${report.warnings.length} warning(s)` : ''}).`);

if (action === 'upload') {
  const start = flag('--start');
  if (start !== undefined) {
    const startAtMs = venueTimeMs(start);
    if (startAtMs === null) fail(`--start "${start}": give Begur's local time as YYYY-MM-DD HH:MM`);
    plan = withStart(plan, startAtMs!);
  }
  if (fs.existsSync(ENV_LINK)) process.loadEnvFile(ENV_LINK);
  const wsUrl = process.env.QUINA_CLOUD_URL ?? 'ws://localhost:8787/ws/show';
  const cloud = (flag('--cloud') ?? wsUrl.replace(/^ws/, 'http').replace(/\/ws\/show$/, '')).replace(/\/+$/, '');
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  const headers: Record<string, string> = id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {};
  try {
    await uploadPlan({ cloud, headers, plan, backupDir: BACKUPS, yes: args.includes('--yes') });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
