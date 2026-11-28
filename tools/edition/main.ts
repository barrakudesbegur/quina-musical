// The edition file (D116): one JSON per edition with all it needs, kept in git and sent to the cloud by hand.
//   npm run edition -- build 2026 [--plan data/editions/2026.plan.json] [--out data/editions/2026.json]
//   npm run edition -- check <file> [--repertoire 2026]
//   npm run edition -- upload <file> [--repertoire 2026] [--start "2026-11-27 19:00"] [--cloud https://…] [--yes]
//   npm run edition -- logos <plan file> --from <list.json> --dir <folder> [--cloud https://…] [--yes]
//   npm run edition -- history [<savedAtMs>] [--cloud https://…]
// <file> is a plan source (data/editions/2026.plan.json, a GamePlan), an edition file (checked whole with the
// protocol's checkEdition, then its `plan`), or a backup this tool saved (data/link/backups/…, to undo an upload).
// - build: the plan source, the repertoire's songs with their pools and its printed card types and cards, in one
//   file checked with checkEdition (the cards' songs from their side's pool). Whether it's committed waits on U75.
// - check: the plan as the cloud and the screens read it, and, with a repertoire, each round's card side against
//   its card-types.json and each side's pool against its songs.
// - upload: the same check, then what would change. With --yes it saves the cloud's plan to data/link/backups/
//   (gitignored) and replaces it. --start moves the first round (Begur's time) and the doors an hour before, for
//   a test, without touching the file.
// - logos: each sponsor's logo file (`--from`: a JSON whose `sponsors` have `id` and `logoFile`, in `--dir`), shrunk
//   to the cloud's limit and uploaded; with --yes, the plan file gets their /media/ paths.
// - history: the plans saves replaced in the cloud (the newest 20: when, size, title, rounds, sponsors); with a
//   savedAtMs, that one saved to data/link/backups/, to restore with `upload <that file> --yes`.
// The cloud and the laptop's service token come from apps/cloud/.env.link, as for the link and the media sync.
// Not yet (U68–U75 are with the user): the cards as uploaded data, a rehearsal reset.
import fs from 'node:fs';
import path from 'node:path';
import { printedCardTypes, poolSongCounts } from '../../apps/cloud/laptop/preflight/checks.ts';
import { loadRepertoire } from '../../apps/show/relay/repertoire.ts';
import { checkEdition } from '@quina/protocol';
import { buildEdition } from './build.ts';
import { uploadLogos } from './logos.ts';
import { checkPlan, venueTimeMs, withStart, type PlanContext } from './plan.ts';
import { uploadPlan } from './upload.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BACKUPS = path.join(ROOT, 'data/link/backups');
const ENV_LINK = path.join(ROOT, 'apps/cloud/.env.link');
/** Where npm was run from: relative paths are the caller's. */
const CALLER = process.env.INIT_CWD ?? process.cwd();

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const usage = [
  'usage: npm run edition -- build <repertoire> [--plan <plan source>] [--out <edition file>]',
  '       npm run edition -- check|upload <file> [--repertoire NAME] [--start "YYYY-MM-DD HH:MM"] [--cloud https://…] [--yes]',
  '       npm run edition -- logos <plan file> --from <list.json> --dir <folder> [--cloud https://…] [--yes]',
  '       npm run edition -- history [<savedAtMs>] [--cloud https://…]',
].join('\n');
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};
const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(CALLER, file), 'utf8'));
  } catch (error) {
    return fail(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/** The cloud's https origin and the laptop's service token headers. */
function cloudAccess(): { cloud: string; headers: Record<string, string> } {
  if (fs.existsSync(ENV_LINK)) process.loadEnvFile(ENV_LINK);
  const wsUrl = process.env.QUINA_CLOUD_URL ?? 'ws://localhost:8787/ws/show';
  const cloud = (flag('--cloud') ?? wsUrl.replace(/^ws/, 'http').replace(/\/ws\/show$/, '')).replace(/\/+$/, '');
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  return { cloud, headers: id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {} };
}

/** What the plan is checked against: the repertoire's printed card types and its songs' pools. */
function context(name: string | undefined): PlanContext {
  if (!name) return { cardTypes: null };
  const repertoire = loadRepertoire(name);
  const read = (p: string | null | undefined): unknown => (p && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
  const typesFile = repertoire.cardsJson ? path.join(path.dirname(repertoire.cardsJson), 'card-types.json') : null;
  const cardTypes = printedCardTypes(read(typesFile));
  if (!cardTypes) console.warn(`repertoire ${repertoire.name}: no card-types.json beside its cards (${typesFile ?? 'no cardsJson'}), so the sides aren't checked`);
  return { cardTypes, poolSongs: poolSongCounts(read(repertoire.songsJson)) };
}

async function logos(file: string): Promise<void> {
  const from = flag('--from');
  const dir = flag('--dir');
  if (!from || !dir) fail(usage);
  const plan = readJson(file) as { sponsors?: { id: string; logo: string | null }[] };
  if (!Array.isArray(plan.sponsors)) fail(`${file}: no sponsors (a plan source has them)`);
  const list = readJson(from!) as { sponsors?: { id?: unknown; logoFile?: unknown }[] };
  const logoFile = new Map((list.sponsors ?? []).filter((s) => typeof s.id === 'string' && typeof s.logoFile === 'string').map((s) => [s.id as string, s.logoFile as string]));
  const files = new Map<string, string>();
  for (const sponsor of plan.sponsors!) {
    const name = logoFile.get(sponsor.id);
    if (name) files.set(sponsor.id, path.resolve(CALLER, dir!, name));
  }
  const without = plan.sponsors!.filter((s) => !files.has(s.id)).map((s) => s.id);
  if (without.length) console.warn(`no logo file for ${without.length} sponsor(s): ${without.join(', ')}`);

  const { cloud, headers } = cloudAccess();
  const yes = args.includes('--yes');
  const results = await uploadLogos(files, {
    yes,
    post: async (bytes, type, name) => {
      const res = await fetch(`${cloud}/api/media?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...headers, 'content-type': type }, body: bytes, signal: AbortSignal.timeout(30_000) });
      const answer = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
      if (!res.ok || !answer?.path) throw new Error(`${name}: the cloud refused the logo (HTTP ${res.status}${answer?.error ? `: ${answer.error}` : ''})`);
      return answer.path;
    },
  });
  for (const r of results.filter((r) => r.problem)) console.warn(`WARN  ${r.sponsorId}: ${path.basename(r.file)}: ${r.problem}`);
  const ok = results.filter((r) => !r.problem);
  console.log(`${ok.length} logo(s), ${(ok.reduce((sum, r) => sum + r.bytes, 0) / 1024).toFixed(0)} KB in all, ${yes ? `uploaded to ${cloud}` : 'ready'}.`);
  if (!yes) {
    console.log('Run again with --yes to upload them and write their paths into the plan file.');
    return;
  }
  const paths = new Map(ok.map((r) => [r.sponsorId, r.path]));
  for (const sponsor of plan.sponsors!) if (paths.get(sponsor.id)) sponsor.logo = paths.get(sponsor.id)!;
  fs.writeFileSync(path.resolve(CALLER, file), `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`${file}: ${paths.size} sponsor logo path(s) written.`);
}

function build(name: string): void {
  const repertoire = loadRepertoire(name);
  const planFile = flag('--plan') ?? path.join(ROOT, 'data/editions', `${repertoire.name}.plan.json`);
  const out = path.resolve(CALLER, flag('--out') ?? path.join(ROOT, 'data/editions', `${repertoire.name}.json`));
  const result = buildEdition(repertoire, readJson(planFile));
  for (const warning of result.warnings) console.warn(`WARN  ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    return fail(`the edition from repertoire ${repertoire.name} doesn't fit: ${result.errors.length} error(s); nothing was written.`);
  }
  const { edition } = result;
  fs.writeFileSync(out, `${JSON.stringify(edition, null, 2)}\n`);
  console.log(`${path.relative(CALLER, out)}: repertoire ${edition.repertoire}, ${edition.plan.rounds.length} rounds, ${edition.songs.length} songs, ${edition.cards?.length ?? 0} cards${result.warnings.length ? `, ${result.warnings.length} warning(s)` : ''}.`);
}

/** The cloud's replaced plans, or one of them saved as a backup file `upload` takes. */
async function history(version: string | undefined): Promise<void> {
  const { cloud, headers } = cloudAccess();
  const get = async (url: string) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return fail(`${url}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json() as Promise<unknown>;
  };
  if (version === undefined) {
    const { history: items } = (await get(`${cloud}/api/plan/history`)) as { history: { savedAtMs: number; replacedAtMs: number; bytes: number; title: string | null; rounds: number | null; sponsors: number | null }[] };
    if (!items.length) return void console.log(`${cloud}: no replaced plan kept yet.`);
    const when = (ms: number) => new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
    for (const h of items) console.log(`${h.savedAtMs}  saved ${when(h.savedAtMs)}, replaced ${when(h.replacedAtMs)}  ${(h.bytes / 1024).toFixed(1)} KB  «${h.title ?? '?'}», ${h.rounds ?? '?'} round(s), ${h.sponsors ?? '?'} sponsor(s)`);
    return void console.log('To restore one: npm run edition -- history <savedAtMs>, then npm run edition -- upload <the file it writes> --yes');
  }
  if (!/^\d{1,16}$/.test(version)) return fail(usage);
  const kept = await get(`${cloud}/api/plan/history/${version}`);
  fs.mkdirSync(BACKUPS, { recursive: true });
  const file = path.join(BACKUPS, `${new URL(cloud).host.replace(/[^a-z0-9.-]/gi, '_')}-plan-history-${version}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ cloud, ...(kept as object) }, null, 2)}\n`, { mode: 0o600 });
  console.log(`saved to ${file}. To restore it: npm run edition -- upload ${file} --yes`);
}

const isEditionFile = (json: unknown): boolean => Boolean(json) && typeof json === 'object' && 'songs' in (json as object) && 'repertoire' in (json as object);

async function main(): Promise<void> {
  const [action, file] = args;
  if (action === 'history') return history(file?.startsWith('--') ? undefined : file);
  if (!file || (action !== 'build' && action !== 'check' && action !== 'upload' && action !== 'logos')) return fail(usage);
  if (action === 'logos') return logos(file);
  if (action === 'build') return build(file);

  const json = readJson(file);
  if (isEditionFile(json)) {
    // A built edition is checked whole (songs, cards against their pools) before its plan goes anywhere.
    const whole = checkEdition(json);
    for (const warning of whole.warnings) console.warn(`WARN  ${warning}`);
    if (!whole.ok) {
      for (const error of whole.errors) console.error(`ERROR ${error}`);
      return fail(`${file}: ${whole.errors.length} error(s); nothing was sent.`);
    }
  }
  const report = checkPlan(json, context(flag('--repertoire')));
  for (const warning of report.warnings) console.warn(`WARN  ${warning}`);
  for (const error of report.errors) console.error(`ERROR ${error}`);
  if (!report.plan || report.errors.length > 0) return fail(`${file}: ${report.errors.length} error(s); nothing was sent.`);
  let plan = report.plan;
  console.log(`${file}: the plan passes (${plan.rounds.length} rounds${report.warnings.length ? `, ${report.warnings.length} warning(s)` : ''}).`);
  if (action === 'check') return;

  const start = flag('--start');
  if (start !== undefined) {
    const startAtMs = venueTimeMs(start);
    if (startAtMs === null) return fail(`--start "${start}": give Begur's local time as YYYY-MM-DD HH:MM`);
    plan = withStart(plan, startAtMs);
  }
  const { cloud, headers } = cloudAccess();
  await uploadPlan({ cloud, headers, plan, backupDir: BACKUPS, yes: args.includes('--yes') });
}

await main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
