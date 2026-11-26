// Before every rehearsal and show, on the show laptop, with the relay, the show page and the cloud link running:
//   npm run preflight -- [--repertoire default] [--relay http://127.0.0.1:5174] [--cloud https://…] [--fast] [--json]
//                        [--only Repertoire,Laptop,Network,Cloud] [--laptop-only]
// --laptop-only: the presenters don't use the tablet; the tech drives from the console on the laptop's own screen
// (it must be open, the projector must be a separate display, and the tablet's LAN address is optional).
// A table of checks: FAIL is anything that would hurt the show (fix it before the doors open), WARN is worth a
// look. Exits 1 when anything failed. The cloud and the service token come from `.env.link`, as for the link.
import fs from 'node:fs';
import path from 'node:path';
import { exitCode, type Check } from './preflight/checks.ts';
import { runPreflight } from './preflight/gather.ts';
import { LINK } from '../../show/relay/repertoire.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env.link');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const wsUrl = process.env.QUINA_CLOUD_URL;
const cloud = flag('--cloud') ?? (wsUrl ? wsUrl.replace(/^ws/, 'http').replace(/\/ws\/show$/, '') : null);
const id = process.env.CF_ACCESS_CLIENT_ID;
const secret = process.env.CF_ACCESS_CLIENT_SECRET;

const checks = await runPreflight({
  repertoire: flag('--repertoire'),
  relay: (flag('--relay') ?? 'http://127.0.0.1:5174').replace(/\/+$/, ''),
  cloud: cloud ? cloud.replace(/\/+$/, '') : null,
  headers: id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {},
  dataDir: LINK,
  fast: args.includes('--fast'),
  laptopOnly: args.includes('--laptop-only'),
  only: flag('--only')?.split(',') as Check['group'][] | undefined,
});

if (args.includes('--json')) {
  console.log(JSON.stringify(checks, null, 2));
} else {
  const color = process.stdout.isTTY;
  const paint = (status: Check['status']) => {
    const label = status.toUpperCase().padEnd(4);
    if (!color) return label;
    return `${{ pass: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[1;31m' }[status]}${label}\x1b[0m`;
  };
  const nameWidth = Math.max(...checks.map((c) => c.name.length));
  console.log(`\nQuina Musical preflight, ${new Date().toLocaleString('ca-ES')}\n`);
  let group = '';
  for (const c of checks) {
    if (c.group !== group) {
      group = c.group;
      console.log(`  ${group}`);
    }
    console.log(`    ${paint(c.status)}  ${c.name.padEnd(nameWidth)}  ${c.detail}`);
  }
  const count = (s: Check['status']) => checks.filter((c) => c.status === s).length;
  const ready = exitCode(checks) === 0;
  console.log(`\n  ${count('fail')} FAIL, ${count('warn')} WARN, ${count('pass')} PASS: ${ready ? 'READY' : 'NOT READY: fix every FAIL before the doors open'}\n`);
}
process.exitCode = exitCode(checks);
