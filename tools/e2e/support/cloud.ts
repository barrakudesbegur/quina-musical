// The production path for phones, locally: the Worker in wrangler dev (with its own static build, never touching
// apps/cloud/dist), the laptop's cloud link between the relay and it, and a phone following /feed like the player.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { followFeed, type PublicView } from '@quina/protocol';
import { startDevServer, type DevServer } from '../../../apps/cloud/loadtest/dev-server.ts';
import { CloudLink } from '../../../apps/cloud/laptop/link.ts';
import { REPO } from './relay.ts';

export interface Cloud {
  server: DevServer;
  link: CloudLink;
  stop: () => Promise<void>;
}

/** Assemble the Worker's static files from the show's fresh build (the player at the root), into a scratch folder. */
function assembleAssets(): string {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-e2e-assets-'));
  execFileSync(process.execPath, ['scripts/assets.ts', '--ui', path.join(REPO, 'apps/show/dist'), '--out', out], { cwd: path.join(REPO, 'apps/cloud'), stdio: 'ignore' });
  return out;
}

export async function startCloud(relayWs: string, linkDir: string, log: (line: string) => void = () => {}): Promise<Cloud> {
  const assets = assembleAssets();
  const server = await startDevServer({ assets });
  const link = new CloudLink({ relayUrl: relayWs, cloudUrl: `${server.ws}/ws/show`, cloudHeaders: {}, dataDir: linkDir, clientId: 'e2e-laptop', log });
  link.start();
  for (let i = 0; i < 150 && link.status().cloud !== 'online'; i++) await new Promise((r) => setTimeout(r, 100));
  if (link.status().cloud !== 'online') throw new Error('the cloud link did not connect to wrangler dev');
  return {
    server,
    link,
    stop: async () => {
      link.stop();
      await server.stop();
      fs.rmSync(assets, { recursive: true, force: true });
    },
  };
}

/** A phone on the public feed: every raw message it got, and its view of the public state. */
export class Phone {
  readonly raw: string[] = [];
  view: PublicView | null = null;
  gaps = 0;
  private readonly ws: WebSocket;

  constructor(feedUrl: string) {
    this.ws = new WebSocket(feedUrl);
    this.ws.on('message', (data) => {
      const text = String(data);
      this.raw.push(text);
      const result = followFeed(this.view, JSON.parse(text));
      if (result.kind === 'ok') this.view = result.view;
      else if (result.kind === 'resync') this.gaps += 1;
    });
  }

  /** Everything the phone has received so far, as one string (for "never contains" checks). */
  everything(): string {
    return this.raw.join('\n');
  }

  close(): void {
    this.ws.close();
  }
}
