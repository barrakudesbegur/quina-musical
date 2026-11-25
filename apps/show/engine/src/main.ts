// Show runtime: wires the pure show state machine (show/show.ts) to Web Audio, the drum, the page and
// the relay. The machine decides; this file carries out its effects. Commands from the page, the keyboard
// and the remotes all go through the same protocol (@quina/protocol).
import { AudioClock } from './clock.ts';
import { SongLoader, fetchJson, isRecord } from './audio/loader.ts';
import { AudioGraph } from './audio/graph.ts';
import { Deck } from './audio/deck.ts';
import { applyPlan } from './audio/scheduler.ts';
import { HoldMusic } from './audio/holdmusic.ts';
import { IntervalPlayer } from './audio/interval.ts';
import { StemStore } from './audio/stems.ts';
import { SignatureStore } from './audio/signatures.ts';
import { BlendStore } from './audio/blend.ts';
import { PreverbStore } from './audio/preverb.ts';
import { plannerWithInputs } from './audio/plan-inputs.ts';
import { CheckPlayer, SnippetStore } from './audio/check.ts';
import { WinningLoop } from './audio/celebration.ts';
import { hookLoop } from './plan/hookloop.ts';
import { SYNTHS } from './audio/synth/fx.ts';
import { solveSpin, type SolutionMethod } from './wheel/solver.ts';
import { DrumView, type DrumCard } from './wheel/drum.ts';
import { Bus } from './net/bus.ts';
import { LocalJournal, chooseResume, parseJournalLines, type CloudCopy, type KeyValueStorage } from './journal-store.ts';
import { mountStage } from '../../../stage/stage.ts';
import { Show, type Effect, type EffectOf, type HoldMood, type ShowOptions, type ShowPlan } from './show/show.ts';
import type { DecoyEvent } from './plan/recipes.ts';
import {
  checkGamePlan,
  makeCommand,
  makeEvent,
  isPhaseName,
  type CommandArgs,
  type CommandName,
  type ShowEvent,
  type ShowState,
  type SoundName,
} from '@quina/protocol';
import { playableSongs } from './analysis.ts';
import { ENGINE, FLOW, HOLD, LOOP, PACE, SUSPENSE, isStingerName } from './config.ts';
import { secureShuffle, secureRandom } from './rng.ts';
import { el as $, targetOf } from './dom.ts';
import type { Card } from './game/cards.ts';

/** A command's fields, which may be left out when it has none that are required. */

/** Something to run once the audio clock passes `at`. */
interface Task {
  at: number;
  fn: () => void;
}

/** The audio objects for what the machine calls current / incoming / outgoing, and what the page shows. */
interface Runtime {
  current: Deck | null;
  incoming: Deck | null;
  outgoing: Deck | null;
  tasks: Task[];
  lastState: ShowState | null;
  catalog: Map<number, DrumCard>;
}

/** How the drum's Spin for a plan was solved (debug HUD). */
interface SpinStats {
  method: SolutionMethod;
  scale: number;
  laps: number;
  solveMs: number;
  cards: number;
}

/** Chrome's non-standard `performance.memory`. */
interface MemoryInfo {
  usedJSHeapSize: number;
}

/** Exposed as `window.mixer` for tests and debugging. */
interface MixerDebug {
  readonly show: Show | null;
  rt: Runtime;
  ctx: AudioContext;
  clock: AudioClock;
  graph: AudioGraph;
  loader: SongLoader;
  drum: DrumView;
  holdMusic: HoldMusic;
  intervalPlayer: IntervalPlayer;
  send: typeof send;
  bus: Bus<ShowEvent>;
  checkPlayer: CheckPlayer;
  winningLoop: WinningLoop;
}

declare global {
  interface Window {
    mixer?: MixerDebug;
  }
}

const hasMemoryInfo = (p: Performance): p is Performance & { memory: MemoryInfo } =>
  'memory' in p && isRecord(p.memory) && typeof p.memory.usedJSHeapSize === 'number';
const errorText = (error: unknown) => (error instanceof Error ? error.message || String(error) : String(error));
const isArray = (x: unknown): x is readonly unknown[] => Array.isArray(x);
const isCardSongRef = (x: unknown) => Number.isInteger(x) || (isRecord(x) && Number.isInteger(x.id));
const isCard = (x: unknown): x is Card =>
  isRecord(x) && Number.isInteger(x.id) && typeof x.type === 'string' && isArray(x.lines) && x.lines.every((line) => isArray(line) && line.every(isCardSongRef));

/** apps/cards' cards.json, checked: card ids, types and song ids (titles are trusted). */
function checkCards(json: unknown): readonly Card[] {
  if (!isArray(json) || !json.every(isCard)) throw new Error('cards.json: not a list of cards');
  return json;
}

// Browser storage is per song pool (the relay's --pool): ids restart at 1 in every pool. The default pool
// keeps the original key names, so what is already stored stays.
let storagePrefix = 'mixer';
const cardsKey = () => `${storagePrefix}.cardsInPlay`;
const CONTROLS_KEY = 'mixer.controls';
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
// The Game journal: kept in this browser's storage so a reload resumes the Game. A test show with a fixed
// Queue (`?queue=`) or `?journal=0` keeps it in memory only; `?fresh=1` starts a new Game (the old journal stays).
const browserStorage = (): KeyValueStorage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const persistJournal = !params.has('queue') && params.get('journal') !== '0';
let journal = new LocalJournal(null); // replaced in boot(), once the pool is known
// What the laptop's cloud link left for this page (relay /cloud/, read-only); anything missing reads as null.
const cloudCopy: CloudCopy = {
  resume: async () => {
    const r = await fetchJson('/cloud/resume.json').catch(() => null);
    return isRecord(r) && typeof r.gameId === 'string' && Number.isInteger(r.seq) && typeof r.atMs === 'number' ? { gameId: r.gameId, seq: Number(r.seq), atMs: r.atMs } : null;
  },
  current: async () => {
    const response = await fetch('/cloud/current', { cache: 'no-store' }).catch(() => null);
    const text = response?.ok ? (await response.text()).trim() : '';
    return text || null;
  },
  journal: async (gameId) => {
    const response = await fetch(`/cloud/journal/${encodeURIComponent(gameId)}.jsonl`, { cache: 'no-store' }).catch(() => null);
    return response?.ok ? parseJournalLines(await response.text()) : null;
  },
};

const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
const clock = new AudioClock(ctx);
const graph = new AudioGraph(ctx);
// ?mute=1: everything runs and is scheduled as usual, but nothing reaches the speakers (headless smoke tests).
if (params.get('mute') === '1') {
  const silent = ctx.createGain();
  silent.gain.value = 0;
  graph.limiter.disconnect();
  graph.limiter.connect(silent).connect(ctx.destination);
}
const loader = new SongLoader(ctx);
const holdMusic = new HoldMusic(graph);
// The Interval playlist; how far a Game's order has got is kept per pool, so a reload doesn't repeat tracks.
const intervalPlayer = new IntervalPlayer(graph, { storage: browserStorage(), storageKey: () => `${storagePrefix}.interval` });
intervalPlayer.onTrack = (track, at) => show && run(show.intervalTrack(track, at));
const stems = new StemStore(ctx);
const signatures = new SignatureStore(ctx);
const blends = new BlendStore(ctx);
const preverbs = new PreverbStore();
const snippets = new SnippetStore(ctx);
const checkPlayer = new CheckPlayer(graph, snippets, FLOW.check);
const winningLoop = new WinningLoop(graph);
clock.extraLatencySec = graph.processingLatencySec;
const bus = new Bus<ShowEvent>({ role: 'show' });
// The projector stage (stage/, the UI session's): scenes drawn around the drum. Read-only on this page's bus;
// mounted before boot() so it sees the first state. `?stage=0` shows the bare engine page.
const stageEl = document.getElementById('stage');
const stageMounted = Boolean(stageEl && params.get('stage') !== '0');
if (stageEl && stageMounted) {
  mountStage(stageEl, { bus });
  document.body.classList.add('has-stage');
  // Over the projected stage the operator's controls are hidden unless H showed them last time (remembered),
  // the debug HUD needs ?debug=1 (it shows the next song and the Phase), and flash messages show only with
  // the controls.
  if (readStored(CONTROLS_KEY) !== 'shown') document.body.classList.add('hide-controls');
}

// Audio objects for what the machine calls current / incoming / outgoing.
const rt: Runtime = { current: null, incoming: null, outgoing: null, tasks: [], lastState: null, catalog: new Map() };
let show: Show | null = null;
// Solve stats per plan, for the HUD (the plan itself belongs to the machine).
const spinStats = new WeakMap<ShowPlan, SpinStats>();

// The machine, once boot() has created it; effects and decode results only come after that.
function machine(): Show {
  if (!show) throw new Error('the show has not started');
  return show;
}

const drum = new DrumView({
  drum: $('drum'),
  viewport: $('viewport'),
  flapper: $('flapper'),
  reticle: $('reticle'),
  blurNode: $('motion-blur-node', SVGFEGaussianBlurElement),
  ctx,
  tickDestination: () => graph.drumBus,
  reducedMotion,
  onLand: (spin) => showNowPlaying(spin.targetId),
});

// ---------------------------------------------------------------------------------------------- boot
async function boot() {
  const pool = await fetchJson('/api/pool').catch(() => null);
  const poolName = isRecord(pool) && typeof pool.name === 'string' && /^[a-z0-9-]+$/.test(pool.name) ? pool.name : 'default';
  if (poolName !== 'default') storagePrefix = `mixer.${poolName}`;
  journal = new LocalJournal(persistJournal ? browserStorage() : null, `${storagePrefix}.journal`);
  const songs = playableSongs(await fetchJson('/analysis/index.json'));
  let cards: readonly Card[] = [];
  try {
    cards = checkCards(await fetchJson('/cards/cards.json'));
  } catch (error) {
    console.warn('cards.json not available; the Phase falls back to the placeholder', error);
  }
  for (const s of songs) rt.catalog.set(s.id, { id: s.id, title: s.title, artist: s.artist, cover: `/covers/${s.id}.jpg` });
  const fixedQueue = params.get('queue')?.split(',').map(Number).filter(Number.isInteger) ?? null;
  const settings: NonNullable<ShowOptions['settings']> = {};
  if (params.has('suw')) settings.songsUntilWinner = Number(params.get('suw'));
  const phase = params.get('phase');
  if (isPhaseName(phase)) settings.phaseOverride = phase;
  if (params.get('auto') === '0') settings.autoAdvance = false;
  if (params.has('pace')) settings.pace = Number(params.get('pace'));
  // Resume: Admin's manual resume from the cloud, else this page's own journal, else the cloud copy's current
  // Game (a new laptop). `?fresh=1` starts a new Game; old journals are never deleted.
  let restore: ShowOptions['restore'] = null;
  let resumedFrom: 'cloud' | 'local' | null = null;
  if (persistJournal && params.get('fresh') !== '1') {
    const choice = await chooseResume({ local: journal, cloud: cloudCopy, nowMs: Date.now(), maxAgeMs: ENGINE.resumeWithinMs });
    for (const warning of choice.warnings) console.warn(warning);
    if (choice.source !== 'none') {
      restore = choice.record;
      resumedFrom = choice.source;
    }
  }
  const created = new Show({
    env: {
      now: () => ctx.currentTime,
      nowMs: () => Date.now(),
      toEpochMs: (t) => clock.ctxToEpochMs(t),
      analysis: (id) => loader.get(id)?.analysis ?? null,
      isDecoded: (id) => loader.isReady(id),
      stems: (id) => stems.summary(id),
      signatures: (id) => signatures.summary(id),
      blend: (aSongId, hookId) => blends.summary(aSongId, hookId),
      // The planner plus what the audio stores have for the two songs (A's stem lanes, B's pre-verbs, keys).
      plan: plannerWithInputs({ stems, preverbs, blends }),
      random: secureRandom,
    },
    songs: [...rt.catalog.values()],
    cards,
    cardsInPlay: params.get('cards') ?? readStored(cardsKey()) ?? '',
    fixedQueue,
    settings,
    restore,
  });
  show = created;
  run(created.flush());
  const resumed = restore?.round;
  if (resumed) {
    const where = resumedFrom === 'cloud' ? 'des del núvol' : "des d'aquest portàtil";
    console.info(`resumed game ${created.gameId} (${resumedFrom}): round ${resumed.number}, song ${resumed.position + 1} of ${resumed.queue.length}`);
    showStatusLine(`Represa ${where}: Quina ${resumed.number}, cançó ${resumed.position + 1}`);
  }
  bus.on((message, { local }) => {
    if (!local && isRecord(message) && message.type === 'cmd') run(created.command(message));
    // The edition's plan, pushed by the relay: the Schedule and the Interval's countdown follow it.
    if (!local && isRecord(message) && message.type === 'relay.plan') {
      const check = message.plan == null ? null : checkGamePlan(message.plan);
      run(created.setPlan(check?.ok ? check.plan : null));
    }
  });
  bus.onOpen = () => run(created.command(makeCommand('getState')));
  bus.connect();
  graph.loadSamples(ENGINE.fxSamples);
  blends.loadKeys();
  graph.loadSamples(ENGINE.stingers, '/stingers/');
  holdMusic.prepare().catch((error) => console.warn('hold music', error));
  void intervalPlayer.prepare();
  void snippets.loadIndex();
  setInterval(tick, ENGINE.taskIntervalMs);
  setInterval(emitHealth, ENGINE.healthIntervalMs);
  setInterval(watchdog, 1000);
  watchLongTasks();
  requestAnimationFrame(frame);
}

function send<C extends CommandName>(cmd: C, ...fields: CommandArgs<C>): void {
  if (!show) return;
  // Commands from this page carry a `local-` reqId instead of the one makeCommand draws.
  run(show.command({ ...makeCommand(cmd, ...fields), reqId: `local-${Date.now().toString(36)}` }));
}

// ------------------------------------------------------------------------------------------ effects
function run(effects: readonly Effect[]): void {
  for (const effect of effects) {
    try {
      apply(effect);
    } catch (error) {
      console.error('effect failed', effect.type, error);
      ensureMusic();
    }
  }
}

function apply(effect: Effect): void {
  const now = ctx.currentTime;
  switch (effect.type) {
    case 'emit':
      bus.emit(effect.message);
      if (effect.message.type === 'state') renderState(effect.message);
      return;
    case 'reject':
      return flash(`${effect.cmd ?? 'command'}: ${effect.reason}${effect.detail ? ` (${effect.detail})` : ''}`);
    case 'prefetch':
      return prefetch(effect.ids);
    case 'startTransition':
      return startTransition(effect);
    case 'landed':
      return landed(effect.plan);
    case 'cancelTransition':
      return cancelTransition(effect);
    case 'duck':
      return graph.glide(graph.holdDuck.gain, effect.db, effect.seconds);
    case 'cue':
      // A repeat of the phrase loop (Aguanta, Suspense): the playing song jumps back to the phrase's start.
      if (rt.current?.songId === effect.songId) rt.current.cue(effect.at, effect.offset, LOOP.fadeSec);
      return;
    case 'holdMusic': {
      const start = { at: effect.at, levelDb: effect.levelDb, fadeSec: effect.fadeSec, mood: effect.mood };
      if (!effect.switch) return void holdMusic.start(start).catch((e) => console.error('hold music', e));
      // Other music gives way: the Celebration's loop, the Interval playlist, or Hold music of another mood.
      winningLoop.stop({ at: effect.at, fadeSec: effect.fadeSec });
      intervalPlayer.stop({ at: effect.at, fadeSec: effect.fadeSec });
      return void holdMusic.switchTo(start).catch((e) => console.error('hold music', e));
    }
    case 'songToHoldMusic':
      return songToHoldMusic(effect.fadeSec, effect.mood);
    case 'rewind':
      rt.current?.rewindOut(now + 0.02, HOLD.rewindSec);
      rt.current = null;
      SYNTHS.downlifter(ctx, graph.synthBus, { t0: now + 0.02, t1: now + HOLD.rewindSec + 0.2, peakDb: -15 });
      return;
    case 'drumBack':
      drum.turnBack({ audible: clock.audible(), card: cardFor(effect.insertId), select: effect.selectId != null });
      if (effect.selectId == null) showStatusLine('');
      return;
    case 'drumReset':
      drum.spin = null;
      // A restored Game's last landing stays under the pointer; otherwise any card may be.
      drum.setCards(
        (effect.selectId == null ? secureShuffle(effect.ids) : [effect.selectId, ...secureShuffle(effect.ids.filter((id) => id !== effect.selectId))])
          .map(cardFor)
          .filter((card) => card !== null),
        0,
      );
      showStatusLine(show?.status === 'locked' ? 'Loading…' : 'Press Next to start');
      return;
    case 'stopAll':
      return stopAll(effect.fadeSec);
    case 'sfx':
      return void playSfx(effect.name, effect.at);
    case 'journal':
      return journal.append(effect.entry);
    case 'journalRequest':
      bus.emit(makeEvent({ type: 'journal.entries', reqId: effect.reqId, gameId: journal.gameId, entries: journal.entries.filter((e) => e.seq >= effect.fromSeq) }));
      return;
    case 'startSuspense':
      return startSuspense(effect);
    case 'suspenseBar':
      // Over A's loop a bar also thins A out and may tease a hovered song.
      applyPlan({ events: effect.events }, { graph, decks: { A: rt.outgoing }, decoy: playDecoy });
      return;
    case 'suspenseHover':
      drum.hoverTo({ audible: clock.audible(), targetId: effect.cardId, arriveAt: effect.at, until: effect.until });
      return;
    case 'prepareBlend':
      blends.retain([effect.aSongId]);
      return void blends.prepare(effect);
    case 'checkSnippets':
      return checkPlayer.play(effect);
    case 'cancelCheck':
      if (checkPlayer.claimId === effect.claimId) checkPlayer.cancel();
      return;
    case 'celebrationMusic':
      return void celebrationMusic(effect);
    case 'intervalMusic': {
      dropCurrentSong(effect.fadeSec);
      // The music playing (the victory track, Hold music, the Winning song's loop) hands over on its downbeat.
      const from = holdMusic.handoff() ?? winningLoop.handoff();
      winningLoop.stop({ at: effect.at, fadeSec: effect.fadeSec });
      holdMusic.stop({ at: effect.at, fadeSec: effect.fadeSec });
      void holdMusic.starting?.then(() => holdMusic.stop({ fadeSec: effect.fadeSec })); // one still loading gives way too
      return intervalPlayer.start({ levelDb: effect.levelDb, gameId: machine().gameId, from });
    }
    case 'intervalSkip':
      if (!intervalPlayer.skip()) console.info('interval: nothing to skip yet');
      return;
    case 'intervalVolume':
      return intervalPlayer.setVolume(effect.db, effect.seconds);
    case 'pauseOverlay':
      // With the stage mounted it shows "Tornem de seguida" itself.
      $('pause-overlay').hidden = stageMounted || !effect.on;
      return;
    case 'log':
      if (effect.level === 'warn') console.warn(effect.message);
      else console.info(effect.message);
      return;
    default: {
      const unhandled: never = effect; // every effect is handled above; an unknown one is only logged
      console.warn('unknown effect', unhandled);
    }
  }
}

function startTransition({ plan, fromHoldMusic, drum: wheel }: EffectOf<'startTransition'>): void {
  const entry = loader.get(plan.b.songId);
  if (!entry) throw new Error(`song ${plan.b.songId} is not decoded`);
  // Audio: B is scheduled sample-exactly so its hook downbeat sounds at T (with a tape start, its rate climbs to
  // the pickup and it still lands there: P5).
  const deck = new Deck(graph, { songId: plan.b.songId, buffer: entry.buffer, analysis: entry.analysis, trimDb: plan.b.trimDb });
  deck.fader.gain.value = 0;
  deck.start(plan.b.startCtx, plan.b.offset, plan.b.rate, plan.b.powerUp ?? null);
  deck.hookId = plan.hook.id;
  deck.stems = stems.forHook(plan.b.songId, plan.hook.id);
  deck.signatures = signatures.buffersFor(plan.b.songId);
  deck.blend = plan.blend && plan.a ? blends.forPair(plan.a.songId, plan.hook.id) : null;
  deck.preverbs = preverbs.buffersFor(plan.b.songId);
  // A released Suspense: A is already finishing (or has finished) the exit it started when the Suspense opened.
  const outgoing = wheel.brake ? rt.outgoing : plan.a ? rt.current : null;
  if (!plan.a && !wheel.brake && rt.current) rt.current.fadeOut(0.8); // ran out: whatever is left goes under the build
  applyPlan(plan, { graph, decks: { A: outgoing, B: deck }, decoy: playDecoy });
  if (outgoing && plan.a) outgoing.stop(plan.a.stopAt);
  if (fromHoldMusic) {
    holdMusic.stop({ at: plan.spinStart + 0.2, fadeSec: 1.6 });
    winningLoop.stop({ at: plan.spinStart + 0.2, fadeSec: 1.6 });
    intervalPlayer.stop({ at: plan.spinStart + 0.2, fadeSec: 1.6 });
  }
  rt.incoming = deck;
  rt.outgoing = outgoing;
  rt.current = outgoing;

  if (wheel.brake) {
    // The drum has been coasting since the Suspense opened: it brakes onto the card exactly at T.
    drum.brakeTo({ audible: clock.audible(), targetId: wheel.targetId, landAt: plan.T });
    showStatusLine('♪');
    renderHud();
    return;
  }
  // Drum: the last counted card leaves, then a solved Spin lands on the target at T.
  drum.settle();
  if (wheel.removeId != null) drum.removeCard(wheel.removeId);
  const targetIndex = drum.indexOf(wheel.targetId);
  const t0 = performance.now();
  const solution = solveSpin({
    cardCount: drum.cards.length,
    fromIndex: drum.currentIndex,
    targetIndex,
    durationSec: plan.D,
    isCalm: reducedMotion,
    minLaps: drum.cards.length < 3 ? 0 : wheel.minLaps,
  });
  spinStats.set(plan, { method: solution.method, scale: solution.scale, laps: Math.abs(solution.traveled) / drum.cards.length, solveMs: performance.now() - t0, cards: drum.cards.length });
  drum.startSpin({ solution, startCtx: plan.spinStart, landAt: plan.T, targetId: wheel.targetId });
  showStatusLine('♪');
  renderHud();
}

// A Decoy (a Suspense tease of a song the drum hovers over): low-passed, cut off by a tape stop. It plays through the fx
// bus, so a cancelled Spin (graph.resetTransient) silences it too.
function playDecoy({ songId, at, offset, cutAt, cutSec, gainDb, lpfHz }: DecoyEvent): void {
  const buffer = loader.get(songId)?.buffer;
  const now = ctx.currentTime;
  if (!buffer || cutAt <= now) return;
  const start = Math.max(at, now + 0.01);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = lpfHz;
  const gain = ctx.createGain();
  const level = 10 ** (gainDb / 20);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + 0.03);
  gain.gain.setValueAtTime(level, cutAt);
  gain.gain.linearRampToValueAtTime(0, cutAt + cutSec);
  source.playbackRate.setValueAtTime(1, cutAt);
  source.playbackRate.linearRampToValueAtTime(0.12, cutAt + cutSec);
  source.connect(lpf).connect(gain).connect(graph.fxBus);
  source.start(start, offset + (start - at));
  source.stop(cutAt + cutSec + 0.05);
}

// Suspense opens: A ducks and exits on its downbeat, the loop's bars follow (suspenseBar effects), the drum coasts.
function startSuspense({ open, fromHoldMusic, drum: wheel }: EffectOf<'startSuspense'>): void {
  // Over A's loop A keeps playing (its phrase repeats by `cue` effects); otherwise it exits, or fades if it can't.
  const keepsA = open.loop != null && rt.current?.songId === open.loop.songId;
  const outgoing = open.a || keepsA ? rt.current : null;
  if (!open.a && !keepsA && rt.current) rt.current.fadeOut(0.8);
  applyPlan({ events: open.events }, { graph, decks: { A: outgoing } });
  if (outgoing && open.a) outgoing.stop(open.a.stopAt);
  if (fromHoldMusic) {
    holdMusic.stop({ at: open.spinStart + 0.2, fadeSec: 1.6 });
    winningLoop.stop({ at: open.spinStart + 0.2, fadeSec: 1.6 });
    intervalPlayer.stop({ at: open.spinStart + 0.2, fadeSec: 1.6 });
  }
  rt.incoming = null;
  rt.outgoing = outgoing;
  rt.current = outgoing;
  drum.settle();
  if (wheel.removeId != null) drum.removeCard(wheel.removeId);
  drum.coast({
    startCtx: open.spinStart,
    durationSec: SUSPENSE.autoReleaseSec + 15,
    spinUpSec: SUSPENSE.coastSpinUpSec,
    amp1: SUSPENSE.wanderCards[0],
    period1: SUSPENSE.wanderBars[0] * open.bar,
    amp2: SUSPENSE.wanderCards[1],
    period2: SUSPENSE.wanderBars[1] * open.bar,
    random: secureRandom,
  });
  showStatusLine('Suspense…');
  renderHud();
}

function landed(plan: ShowPlan): void {
  const outgoing = rt.outgoing;
  rt.current = rt.incoming;
  rt.incoming = null;
  rt.outgoing = null;
  // The landed song's stem lanes (P1), for its own exit next time.
  const deck = rt.current;
  if (deck?.hookId) void stems.ensureLanes(deck.songId, deck.hookId, deck.analysis).then((lanes) => (deck.lanes = lanes));
  if (outgoing) addTask(Math.max(plan.a?.stopAt ?? plan.T, plan.T) + 3, () => outgoing.dispose());
}

function cancelTransition({ keepOutgoing, drum: wheel }: EffectOf<'cancelTransition'>): void {
  const now = ctx.currentTime;
  graph.resetTransient(0.08);
  rt.incoming?.fadeOut(0.06);
  rt.incoming = null;
  if (keepOutgoing && rt.outgoing) {
    rt.outgoing.restore(0.3);
    rt.current = rt.outgoing;
  } else {
    rt.outgoing?.fadeOut(0.25);
    rt.current = null;
  }
  rt.outgoing = null;
  SYNTHS.downlifter(ctx, graph.synthBus, { t0: now, t1: now + 0.9, peakDb: -14 });
  drum.cancelSpin({ audible: clock.audible(), card: cardFor(wheel.insertId), select: wheel.selectId != null });
  if (wheel.selectId == null) showStatusLine('');
}

// The ducked song washes out into reverb while Hold music comes in.
function songToHoldMusic(fadeSec: number, mood: HoldMood): void {
  const now = ctx.currentTime;
  dropCurrentSong(fadeSec);
  holdMusic.start({ at: now + fadeSec * 0.3, levelDb: HOLD.holdMusicLevelDb, fadeSec, mood }).catch((e) => console.error('hold music', e));
}

// The playing (usually ducked) song washes out into reverb: other music takes over. The Hold duck moves into
// its own fader, so the music bus is back at full level for the next song (which would otherwise land ducked).
function dropCurrentSong(fadeSec: number): void {
  const deck = rt.current;
  rt.current = null;
  if (!deck) return;
  const now = ctx.currentTime;
  const duck = graph.holdDuck.gain.value;
  deck.cancelAutomation(now);
  deck.fader.gain.setValueAtTime(Math.max(0.0002, deck.fader.gain.value * duck), now);
  graph.holdDuck.gain.cancelScheduledValues(now);
  graph.holdDuck.gain.setValueAtTime(1, now);
  for (const [p, to, curve] of [[deck.reverbSend.gain, 0.7, 'lin'], [deck.lpf.frequency, 400, 'exp'], [deck.fader.gain, 0.0001, 'exp']] as const) {
    if (p !== deck.fader.gain) p.setValueAtTime(p.value, now);
    if (curve === 'exp') p.exponentialRampToValueAtTime(to, now + fadeSec);
    else p.linearRampToValueAtTime(to, now + fadeSec * 0.4);
  }
  deck.stop(now + fadeSec + 0.05);
  addTask(now + fadeSec + 3, () => deck.dispose());
}

// The Celebration's music: the Winning song's hook looped in whole bars, the victory track, or Hold music.
// The song still playing (ducked under the Check) washes out. Without a usable Winning song, the victory track.
async function celebrationMusic({ choice, songId, hookId, at, fadeSec, levelDb }: EffectOf<'celebrationMusic'>): Promise<void> {
  dropCurrentSong(Math.min(2, fadeSec + 0.5));
  intervalPlayer.stop({ at, fadeSec });
  if (choice === 'winningSong' && songId != null) {
    try {
      const entry = loader.get(songId) ?? (await loader.ensure(songId));
      const region = hookLoop(entry.analysis, hookId, { bars: FLOW.celebration.loopBars, minBars: FLOW.celebration.loopMinBars });
      if (region) {
        holdMusic.stop({ at, fadeSec });
        winningLoop.start(entry.buffer, region, { at, levelDb, fadeSec, beatsPerBar: entry.analysis.tempo.beatsPerBar });
        return;
      }
    } catch (error) {
      console.warn('celebration: the Winning song is not available', songId, error);
    }
  }
  winningLoop.stop({ at, fadeSec });
  const mood = choice === 'holdMusic' ? 'hold' : 'celebration';
  const level = choice === 'holdMusic' ? HOLD.holdMusicLevelDb : choice === 'victory' ? levelDb : FLOW.celebration.victoryDb;
  await holdMusic.switchTo({ at, levelDb: level, fadeSec, mood }).catch((e) => console.error('celebration music', e));
}

function stopAll(fadeSec: number): void {
  const now = ctx.currentTime;
  graph.glide(graph.master.gain, -80, fadeSec);
  drum.freeze(clock.audible());
  const decks = [rt.current, rt.incoming, rt.outgoing];
  rt.current = rt.incoming = rt.outgoing = null;
  checkPlayer.cancel();
  winningLoop.stop({ fadeSec });
  setTimeout(() => {
    for (const deck of decks) deck?.dispose();
    holdMusic.kill();
    intervalPlayer.kill();
    graph.resetTransient();
    graph.holdDuck.gain.cancelScheduledValues(ctx.currentTime);
    graph.holdDuck.gain.setValueAtTime(1, ctx.currentTime);
    graph.glide(graph.master.gain, 0, 0.05);
  }, fadeSec * 1000 + 30);
  void now;
}

function prefetch(ids: readonly number[]): void {
  const keep = [...ids, rt.current?.songId, rt.incoming?.songId, rt.outgoing?.songId];
  loader.retain(keep);
  stems.retain(keep);
  signatures.retain(keep);
  preverbs.retain(keep);
  for (const id of ids) {
    signatures.ensure(id); // the playing song keeps its own for an echo exit
    loader
      .ensure(id)
      .then((entry) => {
        // Stems for the songs still to land (a Tease uses them); a missing stem never blocks the landing.
        if (id !== rt.current?.songId) {
          preverbs.ensure(id, entry.analysis, entry.buffer);
          // D12 from B's voice: a second pre-verb per hook from its vocal stem, once the stems are decoded.
          void stems.ensure(id, entry.analysis).then(() => preverbs.ensureVocals(id, entry.analysis, (hookId) => stems.forHook(id, hookId)));
        }
        run(machine().decoded(id));
      })
      .catch((error: unknown) => {
        console.warn('decode', id, error);
        // The reason goes to this console only: a rejection is broadcast and flashed, and it must not name the
        // next song (its id is in the error).
        run(machine().decodeFailed(id, 'the next song could not be loaded'));
      });
  }
}

async function playSfx(name: SoundName, at = ctx.currentTime + 0.01): Promise<void> {
  if (!graph.samples.has(name)) await graph.loadSamples([name], isStingerName(name) ? '/stingers/' : '/fx/');
  graph.playSample(name, Math.max(at, ctx.currentTime + 0.01), -4);
}

// The music never stops by accident: whatever went wrong, Hold music covers silence the machine did not ask for.
function ensureMusic(): void {
  if (!show || ['locked', 'idle'].includes(show.status)) return;
  if (rt.current || rt.incoming || holdMusic.playing || winningLoop.playing || intervalPlayer.playing) return;
  console.warn('watchdog: no music while', show.status, '— starting Hold music');
  holdMusic.start({ levelDb: HOLD.holdMusicLevelDb, fadeSec: 1 }).catch((e) => console.error('hold music', e));
}

// Act only when the silence lasts two checks in a row (a track may be starting).
let silentChecks = 0;
function watchdog(): void {
  if (ctx.state !== 'running' || !show || ['locked', 'idle'].includes(show.status)) return;
  const silent = !rt.current && !rt.incoming && !holdMusic.playing && !winningLoop.playing && !intervalPlayer.playing;
  silentChecks = silent ? silentChecks + 1 : 0;
  if (silentChecks >= 2) {
    silentChecks = 0;
    ensureMusic();
  }
}

// ------------------------------------------------------------------------------------------ loops
function addTask(at: number, fn: () => void): void {
  rt.tasks.push({ at, fn });
}

function tick(): void {
  if (ctx.state !== 'running' || !show) return;
  const now = ctx.currentTime;
  drum.scheduleTicks(now);
  intervalPlayer.tick();
  const due = rt.tasks.filter((task) => task.at <= now);
  if (due.length) {
    rt.tasks = rt.tasks.filter((task) => task.at > now);
    for (const task of due) task.fn();
  }
  run(show.tick());
}

let lastUi = 0;
function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  const audible = clock.audible(nowMs);
  drum.render(audible);
  if (nowMs - lastUi > 250) {
    lastUi = nowMs;
    renderHud(audible);
    renderCountdown();
  }
}

let longTasks = 0;
function watchLongTasks(): void {
  try {
    new PerformanceObserver((list) => (longTasks += list.getEntries().length)).observe({ type: 'longtask', buffered: false });
  } catch {}
}

function emitHealth(): void {
  bus.emit(makeEvent({
    type: 'engine.health',
    atMs: Date.now(),
    ...clock.latencyMs(),
    contextState: ctx.state,
    decodedMB: loader.decodedMB(),
    jsHeapMB: hasMemoryInfo(performance) ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
    longTasks,
    holdMusic: holdMusic.title,
  }));
}

// ------------------------------------------------------------------------------------------ page
function cardFor(id: number | null): DrumCard | null {
  return id == null ? null : rt.catalog.get(id) ?? null;
}

function showNowPlaying(id: number | null): void {
  const song = id == null ? undefined : rt.catalog.get(id);
  if (!song) return;
  const title = document.createElement('span');
  title.className = 'result-title';
  title.textContent = song.title;
  const details = document.createElement('span');
  details.className = 'result-details';
  details.textContent = song.artist;
  $('result').replaceChildren(title, details);
}

function showStatusLine(text: string): void {
  const status = document.createElement('span');
  status.className = 'result-status';
  status.textContent = text;
  $('result').replaceChildren(status);
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;
function flash(text: string): void {
  if (stageMounted && document.body.classList.contains('hide-controls')) return console.info(text);
  $('flash').textContent = text;
  $('flash').hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => ($('flash').hidden = true), 1800);
}

const clockTime = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const signed = (sec: number) => `${sec > 0 ? '+' : sec < 0 ? '−' : '±'}${Math.abs(Math.round(sec / 60))} min`;

function renderState(state: ShowState): void {
  rt.lastState = state;
  // Cards in play are entered once for the whole game: keep them across reloads of the show page.
  if (state.cards.inPlay !== readStored(cardsKey())) store(cardsKey(), state.cards.inPlay);
  $('phase-badge').textContent = `${state.phase}${state.game.phaseOverride ? ' (fixed)' : ''}`;
  $('phase-badge').dataset.phase = state.phase;
  $('suw', HTMLInputElement).value = String(state.game.songsUntilWinner);
  $('phase-select', HTMLSelectElement).value = state.game.phaseOverride || '';
  $('auto-advance', HTMLInputElement).checked = state.game.autoAdvance;
  $('auto-final', HTMLInputElement).checked = state.game.autoAdvanceFinal;
  $('pace', HTMLInputElement).value = String(state.pace.sec);
  $('pace-lock', HTMLInputElement).checked = state.pace.locked;
  $('btn-hold').textContent = state.status === 'hold' ? '▶ Release' : '❚❚ Hold';
  $('btn-hold').dataset.active = String(state.status === 'hold');
  $('remaining').textContent = `round ${state.round.number} · ${state.queue.position + 1}/${state.queue.length}`;
  $('schedule').textContent = `ends ${clockTime(state.schedule.roundEndMs)} (${signed(state.schedule.roundDriftSec)}) · game ${clockTime(state.schedule.gameEndMs)}${state.pace.nudge !== 1 ? ` · pace ×${state.pace.nudge}` : ''}`;
  if (state.status === 'hold') showHoldLine(state);
}

function showHoldLine(state: ShowState): void {
  if (drum.spin) return;
  if (!state.current && state.queue.position < 0) showStatusLine(state.holdMusic ? 'Hold ♫' : 'Hold');
}

function renderCountdown(): void {
  const s = rt.lastState;
  let text = '';
  if (s?.status === 'playing' && s.autoAtMs) text = `next in ${Math.max(0, (s.autoAtMs - Date.now()) / 1000).toFixed(0)} s`;
  else if (s?.status === 'hold' && s.hold) text = `hold ${Math.round((Date.now() - s.hold.sinceMs) / 1000)} s${s.holdMusic ? ' ♫' : ''}`;
  $('auto-countdown').textContent = text;
}

function renderHud(audible = clock.audible()): void {
  if ($('hud').hidden || !show) return;
  const cur = rt.current;
  const t = show.transition;
  const p = t?.plan;
  const wheel = p ? spinStats.get(p) : undefined;
  const variant = p?.variant && 'kind' in p.variant ? p.variant.kind : null;
  const last = show.history[show.history.length - 1];
  const lat = clock.latencyMs();
  const nextId = show.queue[show.position + 1];
  const lines = [
    `status ${show.status}${show.pending ? ' (loading)' : ''}${show.hold ? ` (${show.hold.reason})` : ''} · queue ${show.position + 1}/${show.queue.length} · hold music ${holdMusic.title ?? 'off'} · interval ${intervalPlayer.title ?? 'off'}`,
    cur ? `now  #${cur.songId} ${cur.analysis.title} · ${cur.analysis.tempo.bpm} BPM · ${cur.hookId} · pos ${cur.posAt(ctx.currentTime)?.toFixed(1) ?? '—'} s` : 'now  —',
    `next #${nextId ?? '—'} ${loader.isReady(nextId) ? 'decoded' : 'decoding…'}`,
    p
      ? `plan ${p.id} ${p.recipe} ${p.recipeName}${p.exit ? ` (exit ${p.exit})` : ''}${variant ? ` (${variant})` : ''} ${p.phase} D=${p.D.toFixed(2)} s (target ${p.window.dTarget.toFixed(1)}) · bridge ${p.bridgeBars} bars · gap ${p.gapBeats} beat · landing ${p.landing}${p.layers.length ? ` + ${p.layers.join(', ')}` : ''} · tease ${p.teaseBars}${p.teaseStyle ? ` (${p.teaseStyle})` : ''}${p.blend ? ` · blend ${p.blend.bars} bars${p.blend.bass ? ' + bass' : ''} @ ${p.blend.toBpm.toFixed(1)}` : ''}${p.signature ? ` · signature ${p.signature.id} (${p.signature.deck}${p.signature.rate !== 1 ? ` ×${p.signature.rate.toFixed(3)}` : ''})` : ''} · ${p.phraseClass ?? ''}${p.relaxed ? ' (relaxed)' : ''} · hook ${p.hook.id} pickup ${p.hook.pickupSec.toFixed(2)} · lands in ${(p.T - audible).toFixed(2)} s`
      : `last ${last ? `${last.recipe}${last.exit ? `/${last.exit}` : ''} ${last.phase} → #${last.songId} ${last.hookId}` : '—'}`,
    wheel ? `drum ${wheel.method} scale ${wheel.scale.toFixed(3)} laps ${wheel.laps.toFixed(2)} · ${wheel.cards} cards · solved in ${wheel.solveMs.toFixed(1)} ms` : '',
    `phase ${show.phaseName()} from ${show.game.phaseOverride ? 'override' : show.phaseModel.plan ? `cards (${show.phaseModel.valid.length} valid, towards ${show.phaseModel.kind}, heat ${show.phaseStep(show.position + 1)?.heat?.toFixed(2) ?? '—'})` : 'placeholder'}`,
    `pace ${show.game.pace} s${show.game.paceLocked ? ' (locked)' : ''} · nudge ×${show.nudge.toFixed(2)} · auto ${show.game.autoAdvance ? 'on' : 'off'}${show.timers.autoAt ? ` in ${(show.timers.autoAt - ctx.currentTime).toFixed(1)} s` : ''}`,
    `audio out ${lat.outputLatencyMs} ms base ${lat.baseLatencyMs} ms · display offset ${clock.displayOffsetMs} ms · decoded ${loader.decodedMB()} MB`,
  ];
  $('hud').textContent = lines.filter(Boolean).join('\n');
}

// ------------------------------------------------------------------------------------------ inputs
async function unlock(): Promise<void> {
  await ctx.resume();
  $('start-overlay').hidden = true;
  send('unlock');
  if (params.get('autostart') === '1') send('next');
}

$('start-button').addEventListener('click', unlock);
$('btn-next').addEventListener('click', () => send('next'));
$('btn-back').addEventListener('click', () => send('back'));
$('btn-hold').addEventListener('click', () => send('hold'));
$('btn-hold-music').addEventListener('click', () => send('holdMusic'));
$('btn-suspense').addEventListener('click', () => send('suspense'));
$('btn-panic').addEventListener('click', () => send('panic'));
$('btn-line').addEventListener('click', () => send('confirmLine'));
$('btn-round').addEventListener('click', () => send('newRound'));
$('pace').addEventListener('change', (e) => send('setPace', { pace: Number(targetOf(e, HTMLInputElement).value) }));
$('pace-down').addEventListener('click', () => send('setPace', { delta: -PACE.fineStepSec }));
$('pace-up').addEventListener('click', () => send('setPace', { delta: PACE.fineStepSec }));
$('pace-lock').addEventListener('change', (e) => send('setPace', { locked: targetOf(e, HTMLInputElement).checked }));
$('suw').addEventListener('change', (e) => send('setGame', { songsUntilWinner: Math.max(0, Math.round(Number(targetOf(e, HTMLInputElement).value))) }));
$('phase-select').addEventListener('change', (e) => {
  const phase = targetOf(e, HTMLSelectElement).value;
  send('setGame', { phaseOverride: isPhaseName(phase) ? phase : null });
});
$('auto-advance').addEventListener('change', (e) => send('setGame', { autoAdvance: targetOf(e, HTMLInputElement).checked }));
$('auto-final').addEventListener('change', (e) => send('setGame', { autoAdvanceFinal: targetOf(e, HTMLInputElement).checked }));
for (const preset of PACE.presets) {
  const option = document.createElement('option');
  option.value = String(preset);
  option.textContent = `${preset} s`;
  $('pace-presets').append(option);
}

document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.matches('input, select')) return;
  if (show?.status === 'locked') {
    if (e.key === 'Enter' || e.key === ' ') unlock();
    return;
  }
  const key = e.key;
  if (key === 'ArrowRight' || key === 'n' || key === 'Enter') send('next');
  else if (key === 'ArrowLeft' || key === 'b') send('back');
  else if (key === ' ') {
    e.preventDefault();
    send('hold');
  } else if (key === 'm') send('holdMusic');
  else if (key === 's') send('suspense');
  else if (key === 'Escape') send('panic');
  else if (key === '+' || key === '=') send('setPace', { delta: PACE.fineStepSec });
  else if (key === '-') send('setPace', { delta: -PACE.fineStepSec });
  else if (key === 'l') send('setPace', { locked: !machine().game.paceLocked });
  else if (/^[0-4]$/.test(key)) send('setGame', { phaseOverride: ([null, 'early', 'mid', 'late', 'final'] as const)[Number(key)] });
  else if (key === 'a') send('setGame', { autoAdvance: !machine().game.autoAdvance });
  else if (key === 'd') {
    if (stageMounted && params.get('debug') !== '1') return;
    $('hud').hidden = !$('hud').hidden;
    renderHud();
  } else if (key === 'h') {
    const hidden = document.body.classList.toggle('hide-controls');
    if (stageMounted) store(CONTROLS_KEY, hidden ? 'hidden' : 'shown');
  }
  else if (key === '[' || key === ']') {
    clock.setDisplayOffsetMs(clock.displayOffsetMs + (key === ']' ? 5 : -5));
    flash(`display offset ${clock.displayOffsetMs} ms`);
  }
});

// Exposed for tests and debugging.
window.mixer = { get show() { return show; }, rt, ctx, clock, graph, loader, drum, holdMusic, intervalPlayer, send, bus, checkPlayer, winningLoop };
boot().catch((error: unknown) => {
  console.error(error);
  showStatusLine(`Failed to start: ${errorText(error)}`);
});
