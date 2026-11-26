// The listening demo (open question U13): one round of the real show on last year's pool, played headless in Chrome
// on its own relay and recorded from the page's output (`?record=1`, engine/src/demo-recorder.ts), with a
// timestamped cue list for the user's notes. The round climbs from early to final (the Phase forced step by step, so
// a 7-minute file covers what a whole round would), with an Aguanta, a forced Count-in, a Suspense and its release,
// a Line's Check and Celebration, then the Bingo's Check and Celebration into the Interval.
//
//   node apps/show/tests/support/listen-demo.ts [--out data/out/listen-demo] [--no-build]
//
// Writes <out>/listen-demo.webm (Opus 256 kbps, the recording), <out>/listen-demo.m4a (AAC 256 kbps, seekable on
// phones) and <out>/cues.md (and cues.json). data/out is gitignored: the
// recording is copyrighted audio and never goes in git or online.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { ShowState } from '@quina/protocol';
import type { DemoRecording } from '../../engine/src/demo-recorder.ts';
import { REPO, SHOW, hasPreparedRepertoire, startRelay } from '../../../../tools/e2e/support/relay.ts';
import { Remote } from '../../../../tools/e2e/support/remote.ts';

const args = process.argv.slice(2);
const OUT = path.resolve(REPO, args.includes('--out') ? args[args.indexOf('--out') + 1] ?? '' : 'data/out/listen-demo');
const PACE = 14;

/** Card 144: every song playable, 11 of its 12 with an approved Signature. Three other songs open the round. */
const CARD = 144;
const cards = JSON.parse(fs.readFileSync(path.join(REPO, 'apps/cards/dist/cards.json'), 'utf8')) as { id: number; sides: { side: number; lines: { id: number }[][] }[] }[];
// The round plays side 1 (D178).
const rows = (cards.find((c) => c.id === CARD)?.sides.find((s) => s.side === 1)?.lines ?? []).map((line) => line.map((s) => s.id));
const OPENERS = [8, 37, 71].filter((id) => !rows.flat().includes(id));
/** Landing 3 + 4 completes the card's first row (its Line); landing 3 + 12 the whole card (its Bingo). */
const QUEUE = [...OPENERS, ...rows.flat()];

/** The Phase for each landing (1-based), so the round escalates within the file: early, mid, late, final. */
const phaseFor = (landing: number) => (landing <= 5 ? 'early' : landing <= 9 ? 'mid' : landing <= 12 ? 'late' : 'final');

/** The show page's `window.demo` under `?record=1` (engine/main.ts). */
interface DemoWindow {
  demo?: { start(): void; stop(): Promise<DemoRecording> };
}

const log = (text: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${text}`);

async function main(): Promise<void> {
  if (!hasPreparedRepertoire()) throw new Error('the default pool is not prepared (npm run prep in apps/show)');
  if (rows.flat().length !== 12) throw new Error(`card ${CARD} not found in cards.json`);
  if (!args.includes('--no-build')) execFileSync('npm', ['run', 'build'], { cwd: SHOW, stdio: 'inherit' });
  fs.mkdirSync(OUT, { recursive: true });
  const relay = await startRelay();
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', '--disable-features=IntensiveWakeUpThrottling'],
  });
  const remote = await Remote.connect(relay.ws);
  try {
    const page = await browser.newPage();
    page.on('console', (m) => m.type() === 'error' && log(`page: ${m.text()}`));
    await page.goto(`${relay.url}/show/show.html?fresh=1&auto=0&record=1&pace=${PACE}&queue=${QUEUE.join(',')}`);
    await page.locator('#start-button').click();
    await remote.until('the show unlocked', (s) => s.status !== 'locked');
    await remote.command('setCardsInPlay', { ranges: '1-200' });
    await remote.command('setPace', { pace: PACE, locked: true });
    await remote.command('setGame', { phaseOverride: 'early', finalLapStinger: true });
    // The round's intro, its Shuffle under the Interval music, then the recording starts on the first Next.
    await remote.command('roundIntro', { number: 1 });
    await remote.command('newRound', { number: 1 });
    const shuffled = await remote.until('the Shuffle drawn', (s) => s.shuffle !== null);
    await page.evaluate(() => (window as unknown as DemoWindow).demo?.start());
    await remote.waitFor(() => Date.now() > (shuffled.shuffle?.endAtMs ?? 0) + 1500, 60_000);
    log('recording');

    const landed = () => (remote.state?.queue.position ?? -1) + 1;
    /** Press Next at the Pace (or now), with the Phase for the coming landing, and wait for it to land. */
    const next = async (extra: Record<string, unknown> = {}) => {
      const target = landed() + 1;
      await remote.command('setGame', { phaseOverride: phaseFor(target) });
      if (extra.recipe) await remote.command('overrideNextRecipe', { recipe: extra.recipe });
      // A transition already under way (a released Hold may start one) lands first.
      await remote.until('ready for Next', (s: ShowState) => s.status !== 'transition', 60_000);
      if (landed() < target) await remote.command('next');
      await remote.until(`landing ${target}`, (s: ShowState) => s.queue.position + 1 === target && s.status === 'playing', 90_000);
      log(`landing ${target} (${phaseFor(target)})`);
      // Let it play to about the Pace before the next press (the transition itself takes part of it).
      await sleep((PACE - 6) * 1000);
    };
    const check = async (kind: 'line' | 'bingo') => {
      await remote.command('claim', { cardId: CARD, kind });
      const checking = await remote.until(`the ${kind} on screen`, (s) => s.scene === 'check' && s.check !== null);
      const claimId = checking.check?.claimId ?? '';
      // The presenter-paced Check (D107): a press as each song is named, then the cue.
      for (let step = 0; step <= (checking.check?.total ?? 0); step++) {
        await sleep(2800);
        await remote.command('checkNext', { claimId, step });
        const now = await remote.until(`press ${step}`, () => true);
        if (now.check?.cue != null || now.scene !== 'check') break;
      }
      await remote.until(`the ${kind} celebrated`, (s) => s.scene === 'celebration');
      log(`${kind} celebrated`);
    };

    // early: the light, quick moves (and the first song out of the Interval music).
    for (let i = 0; i < 5; i++) await next();
    // mid: the escalation; Aguanta on the 7th song, so it plays on and loops its phrase.
    await next();
    await next();
    // The card's first row is complete on landing 7: the Line, its Check and Celebration, then on.
    await check('line');
    await sleep(14_000);
    await next(); // out of the Celebration (the Winning song's loop) with the next song, as the presenters do
    await remote.command('hold', { on: true, duck: false });
    log('Aguanta');
    await sleep(24_000);
    await remote.command('hold', { on: false });
    await sleep(3000);
    await next({ recipe: 'D20' }); // a Count-in, forced once
    // late: bigger moves, then a Suspense held about 12 s and released (it lands on A's phrase boundary).
    await next();
    await next();
    await remote.command('setGame', { phaseOverride: phaseFor(landed() + 1) });
    await remote.command('suspense', { on: true });
    await remote.until('Suspense', (s) => s.suspense !== null);
    log('Suspense');
    await sleep(12_000);
    const before = landed();
    await remote.command('suspense', { on: false });
    await remote.until('the Suspense landed', (s) => s.queue.position + 1 === before + 1 && s.status === 'playing', 60_000);
    log('Suspense released and landed');
    await sleep(6000);
    // final: the last songs of the card, then its Bingo, the Celebration and the Interval.
    while (landed() < QUEUE.length) await next();
    await check('bingo');
    await sleep(20_000);
    await remote.command('interval');
    await remote.until('the Interval', (s) => s.scene === 'interval');
    log('Interval');
    await sleep(25_000);

    const recording = await page.evaluate(() => (window as unknown as DemoWindow).demo!.stop());
    const audio = path.join(OUT, 'listen-demo.webm');
    fs.writeFileSync(audio, Buffer.from(recording.audioBase64, 'base64'));
    fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(recording.cues, null, 1) + '\n');
    fs.writeFileSync(path.join(OUT, 'cues.md'), cueList(recording));
    // MediaRecorder's WebM has no duration, so phones can't seek in it: an AAC copy plays and seeks anywhere.
    execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', audio, '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', path.join(OUT, 'listen-demo.m4a')]);
    log(`wrote ${path.relative(REPO, audio)} (${(fs.statSync(audio).size / 1e6).toFixed(1)} MB, ${fmt(recording.durationSec)}) and cues.md`);
  } finally {
    remote.close();
    await browser.close();
    await relay.stop();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function cueList({ cues, durationSec }: DemoRecording): string {
  const lines = cues
    .filter((c) => c.kind !== 'landing')
    .map((c) => {
      const land = c.kind === 'press' ? cues.find((l) => l.kind === 'landing' && l.atSec >= c.atSec) : null;
      return `- **${fmt(c.atSec)}** ${c.text}${land ? ` (lands at ${fmt(land.atSec)})` : ''}`;
    });
  return `# Listening demo: cue list\n\nOne round of last year's pool through the real engine, ${fmt(durationSec)}. "Next pressed" is when the drum starts spinning; the song lands at the time in brackets. The Phase is forced from early to final so one file covers a whole round's escalation.\n\n${lines.join('\n')}\n`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
