// Run the show laptop's cloud link next to the relay:
//   npm run link -- [--relay ws://localhost:5174/ws] [--cloud wss://<worker>/ws/show] [--data <folder>]
// Settings come from flags, else from the environment or `.env.link` (gitignored):
//   QUINA_CLOUD_URL            the GameRoom's laptop endpoint (default: wrangler dev, ws://localhost:8787/ws/show)
//   QUINA_RELAY_URL            the relay (default ws://localhost:5174/ws)
//   CF_ACCESS_CLIENT_ID        the Access service token's client ID     } both, or neither (wrangler dev)
//   CF_ACCESS_CLIENT_SECRET    the Access service token's client secret }
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { LINK } from '../../show/relay/pool.ts';
import { CloudLink } from './link.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const envFile = path.join(ROOT, '.env.link');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const relayUrl = flag('--relay') ?? process.env.QUINA_RELAY_URL ?? 'ws://localhost:5174/ws';
const cloudUrl = flag('--cloud') ?? process.env.QUINA_CLOUD_URL ?? 'ws://localhost:8787/ws/show';
// The link's folder (data/link/ by default): the relay serves it at /cloud/.
const dataDir = path.resolve(ROOT, flag('--data') ?? LINK);
const id = process.env.CF_ACCESS_CLIENT_ID;
const secret = process.env.CF_ACCESS_CLIENT_SECRET;
if (Boolean(id) !== Boolean(secret)) {
  console.error('cloud link: set both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, or neither');
  process.exit(1);
}
if (!id && !/^wss?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(cloudUrl)) {
  console.warn('cloud link: no Access service token: a deployed cloud will refuse this link');
}

/** A stable, anonymous id for this laptop's link (never the machine's name). */
function clientId(): string {
  const file = path.join(dataDir, 'client-id');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    fs.mkdirSync(dataDir, { recursive: true });
    const value = `laptop-${randomBytes(3).toString('hex')}`;
    fs.writeFileSync(file, value);
    return value;
  }
}

const link = new CloudLink({
  relayUrl,
  cloudUrl,
  cloudHeaders: id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {},
  dataDir,
  clientId: clientId(),
});
console.log(`[cloud-link] relay ${relayUrl} → cloud ${cloudUrl}; journal copy in ${path.relative(process.cwd(), dataDir) || '.'}`);
link.start();

const report = setInterval(() => {
  const s = link.status();
  const state = s.uploader.kind === 'stopped' ? `STOPPED: ${s.uploader.reason}` : s.uploader.kind;
  console.log(`[cloud-link] relay ${s.relay ? 'up' : 'down'}, cloud ${s.cloud}, Game ${s.gameId ?? '-'}: ${s.journalled} journalled, ${s.ackSeq} in the cloud, ${s.pending} to send (${state})`);
}, 30_000);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(report);
    link.stop();
    process.exit(0);
  });
}
