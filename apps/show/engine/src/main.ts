// Show runtime: wires the pure show state machine (show/show.ts) to Web Audio, the drum, the page and
// the relay. The machine decides; this file carries out its effects. Commands from the page, the keyboard
// and the remotes all go through the same protocol (@quina/protocol).
import { AudioClock } from './clock.ts';
import { SongLoader, fetchJson, isRecord } from './audio/loader.ts';
import { AudioGraph } from './audio/graph.ts';
import { Deck } from './audio/deck.ts';
import { applyPlan } from './audio/scheduler.ts';
import { HoldMusic } from './audio/holdmusic.ts';
import { IntervalPlayer, type SuspendedInterval } from './audio/interval.ts';
import { ThrowPlayer } from './audio/throw.ts';
import { VoicePlayer } from './audio/voice.ts';
import { DrumRoll } from './audio/padhold.ts';
import type { SuspendedHold } from './audio/holdmusic.ts';
import type { SuspendedLoop } from './audio/celebration.ts';
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
import { DemoRecorder } from './demo-recorder.ts';
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
  isPoolId,
  isSide,
  AUTO_SOUNDS_DEFAULT,
  VOLUME_DEFAULTS,
  type AutoSounds,
  type CardTypeSides,
  type CommandArgs,
  type CommandName,
  MUSIC_SETS,
  SFX_NAMES,
  type MusicSet,
  type ShowEvent,
  type ShowState,
  type SoundName,
  type Volumes,
} from '@quina/protocol';
import { indexPools, playableSongs } from './analysis.ts';
import { ENGINE, FLOW, HOLD, INTERVAL, INTRO, LOOP, PACE, SUSPENSE, THROW, isStingerName } from './config.ts';
import { drumTick } from './audio/synth/clicks.ts';
import { seededRandom, secureRandom } from './rng.ts';
import { el as $, targetOf } from './dom.ts';
import type { PrintedCard } from './game/cards.ts';

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
  sets: Record<MusicSet, IntervalPlayer>;
  throwPlayer: ThrowPlayer;
  voicePlayer: VoicePlayer;
  drumRoll: DrumRoll;
  send: typeof send;
  bus: Bus<ShowEvent>;
  checkPlayer: CheckPlayer;
  winningLoop: WinningLoop;
}

declare global {
  interface Window {
    mixer?: MixerDebug;
    /** `?record=1`: the listening demo's recorder (demo-recorder.ts; tests/support/listen-demo.ts drives it). */
    demo?: DemoRecorder;
  }
}

const hasMemoryInfo = (p: Performance): p is Performance & { memory: MemoryInfo } =>
  'memory' in p && isRecord(p.memory) && typeof p.memory.usedJSHeapSize === 'number';
const errorText = (error: unknown) => (error instanceof Error ? error.message || String(error) : String(error));
const isArray = (x: unknown): x is readonly unknown[] => Array.isArray(x);
const isCardSongRef = (x: unknown) => Number.isInteger(x) || (isRecord(x) && Number.isInteger(x.id));
const isLines = (x: unknown) => isArray(x) && x.every((line) => isArray(line) && line.every(isCardSongRef));
const isCard = (x: unknown): x is PrintedCard =>
  isRecord(x) && Number.isInteger(x.id) && typeof x.type === 'string' &&
  (isLines(x.lines) || (isArray(x.sides) && x.sides.length > 0 && x.sides.every((s) => isRecord(s) && isSide(s.side) && isLines(s.lines))));

/** apps/cards' cards.json, checked: card ids, types, sides and song ids (titles are trusted). */
function checkCards(json: unknown): readonly PrintedCard[] {
  if (!isArray(json) || !json.every(isCard)) throw new Error('cards.json: not a list of cards');
  return json;
}

/** apps/cards' card-types.json, as far as sides go (D178): a type without sides has one, side 1 on pool 1. */
function checkCardTypes(json: unknown): CardTypeSides[] {
  if (!isArray(json)) throw new Error('card-types.json: not a list');
  return json.flatMap((t): CardTypeSides[] => {
    if (!isRecord(t) || typeof t.type !== 'string') return [];
    const sides = isArray(t.sides) ? t.sides.flatMap((s) => (isRecord(s) && isSide(s.side) && isPoolId(s.pool) ? [{ side: s.side, pool: s.pool, ...(typeof s.label === 'string' ? { label: s.label } : {}) }] : [])) : undefined;
    return [{ type: t.type, ...(typeof t.name === 'string' ? { name: t.name } : {}), ...(sides?.length ? { sides } : {}) }];
  });
}

// Browser storage is per repertoire (the relay's --repertoire): ids restart at 1 in every repertoire. The default repertoire
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
let journal = new LocalJournal(null); // replaced in boot(), once the repertoire is known
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
// ?record=1: record what the page plays, with a cue per transition and show moment, for the listening demo.
const recorder = params.get('record') === '1' ? new DemoRecorder(ctx, graph.limiter) : null;
if (recorder) window.demo = recorder;
const loader = new SongLoader(ctx);
const holdMusic = new HoldMusic(graph);
// The music sets (D129), each on its own player and slider; how far a Game's order has got is kept per pool and set,
// so a reload doesn't repeat tracks. The end's set is the breaks' tracks in their playlist order for now (U97).
const setPlayer = (set: MusicSet, folder: string, ordered: boolean) => {
  const player = new IntervalPlayer(graph, { source: { set, folder, ordered }, out: graph.vol[set], storage: browserStorage(), storageKey: () => `${storagePrefix}.interval.${set}` });
  player.onTrack = (track, at) => show && run(show.intervalTrack(track, at, set));
  return player;
};
const sets: Record<MusicSet, IntervalPlayer> = { breaks: setPlayer('breaks', 'breaks', false), pausa: setPlayer('pausa', 'pausa', false), end: setPlayer('end', 'breaks', true) };
const intervalPlayer = sets.breaks;
const allSets = () => Object.values(sets);
/** The sets give way (to a Spin's build, Hold music, the Celebration's music). */
const stopSets = (options: { at?: number; fadeSec?: number }) => {
  for (const player of allSets()) player.stop(options);
};
const throwPlayer = new ThrowPlayer(graph);
const voicePlayer = new VoicePlayer(graph);
const drumRoll = new DrumRoll(graph);
throwPlayer.onEnded = () => show && run(show.throwEnded());
/** What Pausa saved (D128): the song deck and every bed, each where it was. */
let paused: { deck: Deck | null; hold: SuspendedHold | null; loop: SuspendedLoop | null; sets: Partial<Record<MusicSet, SuspendedInterval>>; throwAt: ReturnType<ThrowPlayer['suspend']> } | null = null;
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
/** A Spin turned into a Suspense after A's exit started (D177): its build's bars wait here until the Spin is cut. */
let spinCut: { bars: EffectOf<'suspenseBar'>[]; incoming: Deck | null } | null = null;
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
  const repertoire = await fetchJson('/api/repertoire').catch(() => null);
  const repertoireName = isRecord(repertoire) && typeof repertoire.name === 'string' && /^[a-z0-9-]+$/.test(repertoire.name) ? repertoire.name : 'default';
  if (repertoireName !== 'default') storagePrefix = `mixer.${repertoireName}`;
  journal = new LocalJournal(persistJournal ? browserStorage() : null, `${storagePrefix}.journal`);
  const songs = playableSongs(await fetchJson('/analysis/index.json'));
  let cards: readonly PrintedCard[] = [];
  try {
    cards = checkCards(await fetchJson('/cards/cards.json'));
  } catch (error) {
    console.warn('cards.json not available; the Phase falls back to the placeholder', error);
  }
  let cardTypes: CardTypeSides[] = [];
  try {
    cardTypes = checkCardTypes(await fetchJson('/cards/card-types.json'));
  } catch (error) {
    console.warn('card-types.json not available; every card type plays one side, on pool 1', error);
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
    // Each song with its pools (D178, D268): a round's Queue is a Shuffle of its side's pool's members.
    songs: songs.map((s) => ({ id: s.id, title: s.title, artist: s.artist, pools: indexPools(s) })),
    cards,
    cardTypes,
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
    // Who is connected: a two-level button held on a console that left is let go (D234).
    if (!local && isRecord(message) && message.type === 'relay.clients' && Array.isArray(message.clients)) {
      run(created.clientsChanged(message.clients.flatMap((c: unknown) => (isRecord(c) && typeof c.clientId === 'string' ? [c.clientId] : []))));
    }
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
  for (const player of allSets()) void player.prepare();
  for (const song of Object.values(THROW.songs)) void throwPlayer.load(song.name);
  void voicePlayer.load();
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
      recorder?.event(effect.message);
      bus.emit(effect.message);
      if (effect.message.type === 'state') renderState(effect.message);
      return;
    case 'reject':
      return flash(`${effect.cmd ?? 'command'}: ${effect.reason}${effect.detail ? ` (${effect.detail})` : ''}`);
    case 'prefetch':
      return prefetch(effect.ids);
    case 'startTransition':
      recorder?.plan(effect.plan);
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
      // Other music gives way: the Celebration's loop, a set, or Hold music of another mood.
      winningLoop.stop({ at: effect.at, fadeSec: effect.fadeSec });
      stopSets({ at: effect.at, fadeSec: effect.fadeSec });
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
      drum.turnBack({ audible: clock.audible(), cards: cardsFor(effect.ids), targetId: effect.insertId, select: effect.selectId != null });
      if (effect.selectId == null) showStatusLine('');
      return;
    case 'drumReset':
      drum.spin = null;
      // A restored Game's last landing stays under the pointer; otherwise any card may be.
      // The engine's order (drumOrder from the round's public drumSeed, D237), so the phones lay out the same drum.
      {
        const cards = cardsFor(effect.ids);
        drum.setCards(cards, Math.max(0, cards.findIndex((card) => card.id === effect.selectId)));
      }
      showStatusLine(show?.status === 'locked' ? 'Loading…' : 'Press Next to start');
      return;
    case 'stopAll':
      return stopAll(effect.fadeSec);
    case 'sfx':
      return void playSfx(effect.name, effect.at, graph.vol[effect.volume]);
    case 'journal':
      return journal.append(effect.entry);
    case 'journalRequest':
      bus.emit(makeEvent({ type: 'journal.entries', reqId: effect.reqId, gameId: journal.gameId, entries: journal.entries.filter((e) => e.seq >= effect.fromSeq) }));
      return;
    case 'startSuspense':
      return startSuspense(effect);
    case 'suspenseBar':
      if (spinCut) return void spinCut.bars.push(effect);
      return suspenseBar(effect);
    case 'suspenseHover':
      drum.hoverTo({ audible: clock.audible(), targetId: effect.cardId, arriveAt: effect.at, until: effect.until });
      return;
    case 'prepareBlend':
      blends.retain([effect.aSongId]);
      return void blends.prepare(effect);
    case 'checkReveal':
      return checkPlayer.reveal(effect.claimId, effect.step);
    case 'checkDuck':
      return checkPlayer.duck(effect.on);
    case 'cancelCheck':
      return checkPlayer.cancel();
    case 'celebrationMusic':
      return void celebrationMusic(effect);
    case 'intervalMusic': {
      dropCurrentSong(effect.fadeSec);
      // The music playing (the victory track, Hold music, the Winning song's loop, the intro) hands over on its downbeat.
      const from = holdMusic.handoff() ?? winningLoop.handoff();
      winningLoop.stop({ at: effect.at, fadeSec: effect.fadeSec });
      holdMusic.stop({ at: effect.at, fadeSec: effect.fadeSec });
      void holdMusic.starting?.then(() => holdMusic.stop({ fadeSec: effect.fadeSec })); // one still loading gives way too
      // Another set (the breaks' as the end's begins, or Pausa's as a break switches back, D228) fades out under it.
      for (const set of MUSIC_SETS) if (set !== effect.set) sets[set].stop({ at: effect.at, fadeSec: effect.fadeSec });
      return sets[effect.set].start({ levelDb: effect.levelDb, gameId: machine().gameId, from });
    }
    case 'intervalSkip':
      if (!sets[effect.set].skip()) console.info(`${effect.set}: nothing to skip yet`);
      return;
    case 'introMusic':
      // A round's intro track (D129) on the Hold music player; whatever plays gives way.
      dropCurrentSong(effect.fadeSec);
      winningLoop.stop({ at: effect.at, fadeSec: effect.fadeSec });
      stopSets({ at: effect.at, fadeSec: effect.fadeSec });
      return void holdMusic.switchTo({ at: effect.at, levelDb: effect.levelDb, fadeSec: effect.fadeSec, mood: 'intro' }).catch((e) => console.error('intro music', e));
    case 'throwSong':
      if (effect.action === 'play' && effect.track) return void throwPlayer.play(effect.at, effect.offsetSec, effect.track);
      return throwPlayer.stop(effect.at, effect.fadeSec ?? THROW.fadeSec);
    case 'voice': {
      if (effect.action === 'stop' || !effect.cue || !effect.lead) return voicePlayer.stop();
      const cue = effect.cue;
      // When it has played out the machine hears so (what it led into follows); a missing file is a silent cue.
      return void voicePlayer.play(cue, effect.lead, effect.at).then(({ start, end }) => {
        run(machine().voiceStarted(cue, start, end - start));
        addTask(end, () => voicePlayer.finish(cue) && run(machine().voiceEnded(cue)));
      });
    }
    case 'padHold':
      if (effect.action === 'start' && effect.grid) return drumRoll.start(effect.at, effect.grid, effect.intensity);
      if (effect.action === 'intensity') return drumRoll.setIntensity(effect.intensity);
      return drumRoll.release(effect.at, effect.land === true);
    case 'volumes':
      lastVolumes = effect.volumes;
      lastAutoSounds = effect.autoSounds;
      // During a sound test the switched-off sounds stay audible: the test plays its kind whatever its switch says.
      return graph.setVolumes(effect.volumes, soundTestStop ? AUTO_SOUNDS_DEFAULT : effect.autoSounds);
    case 'bedDuck':
      return graph.glide(graph.bedDuck.gain, effect.db, effect.seconds);
    case 'pausePlayback':
      return pausePlayback(effect.at, effect.fadeSec);
    case 'resumePlayback':
      return resumePlayback(effect);
    case 'pausaMusic':
      if (effect.on) return sets.pausa.start({ levelDb: effect.levelDb, gameId: machine().gameId });
      return sets.pausa.stop({ at: effect.at, fadeSec: effect.fadeSec });
    case 'pauseOverlay':
      // With the stage mounted it shows "Tornem de seguida" itself.
      $('pause-overlay').hidden = stageMounted || !effect.on;
      return;
    case 'soundTest':
      return soundTest(effect);
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
  finishSpinCut(); // a Suspense released before its Spin was cut
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
    stopSets({ at: plan.spinStart + 0.2, fadeSec: 1.6 });
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
    random: seededRandom(wheel.seed), // the public spinSeed (D237): a phone's solver replays this very Spin
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
// Over A's loop a bar also thins A out and may tease a hovered song.
function suspenseBar(effect: EffectOf<'suspenseBar'>): void {
  applyPlan({ events: effect.events }, { graph, decks: { A: rt.outgoing }, decoy: playDecoy });
}

/**
 * The running Spin becomes a Suspense (D177). While A is still itself, the Spin's build and B's part stop now and A comes
 * back up (its phrase then loops). After A's exit started, the exit plays out: the rest of the Spin (B, the build, the
 * landing's impact) is cut where it ends, and the Suspense's bars start there, on fresh buses.
 */
function spinIntoSuspense({ keepA, cutAt }: NonNullable<EffectOf<'startSuspense'>['fromSpin']>): void {
  const incoming = rt.incoming;
  rt.incoming = null;
  if (keepA) {
    graph.resetTransient(0.3);
    incoming?.fadeOut(0.3);
    if (rt.outgoing) {
      rt.outgoing.restore(0.3);
      rt.current = rt.outgoing;
    }
    rt.outgoing = null;
    return;
  }
  rt.current = rt.outgoing;
  rt.outgoing = null;
  const cut = { bars: [] as EffectOf<'suspenseBar'>[], incoming };
  spinCut = cut;
  addTask(cutAt - 0.06, () => spinCut === cut && finishSpinCut());
  if (incoming) addTask(cutAt + 3, () => incoming.dispose());
}

/** The pending cut of a Spin turned Suspense, now: before its time when the Suspense is released, cancelled or stopped. */
function finishSpinCut(): void {
  const cut = spinCut;
  if (!cut) return;
  spinCut = null;
  graph.resetTransient(0.05);
  cut.incoming?.fadeOut(0.05);
  for (const bar of cut.bars) suspenseBar(bar);
}

function startSuspense({ open, fromHoldMusic, drum: wheel, fromSpin }: EffectOf<'startSuspense'>): void {
  if (fromSpin) spinIntoSuspense(fromSpin);
  // Over A's loop A keeps playing (its phrase repeats by `cue` effects); otherwise it exits, or fades if it can't.
  const keepsA = open.loop != null && rt.current?.songId === open.loop.songId;
  const outgoing = open.a || keepsA ? rt.current : null;
  if (!open.a && !keepsA && rt.current) rt.current.fadeOut(0.8);
  applyPlan({ events: open.events }, { graph, decks: { A: outgoing } });
  if (outgoing && open.a) outgoing.stop(open.a.stopAt);
  if (fromHoldMusic) {
    holdMusic.stop({ at: open.spinStart + 0.2, fadeSec: 1.6 });
    winningLoop.stop({ at: open.spinStart + 0.2, fadeSec: 1.6 });
    stopSets({ at: open.spinStart + 0.2, fadeSec: 1.6 });
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

// A cancelled Spin: the build stops at once. A cancelled Suspense (`backOut`, D144) backs out instead: the build's
// layers, echoes and high-pass fade away over SUSPENSE.backOutSec while the song comes back up, under a long fall.
function cancelTransition({ keepOutgoing, drum: wheel, backOut = false }: EffectOf<'cancelTransition'>): void {
  finishSpinCut();
  const now = ctx.currentTime;
  const fade = backOut ? SUSPENSE.backOutSec : 0.08;
  graph.resetTransient(fade);
  rt.incoming?.fadeOut(backOut ? fade : 0.06);
  rt.incoming = null;
  if (keepOutgoing && rt.outgoing) {
    rt.outgoing.restore(backOut ? fade : 0.3);
    rt.current = rt.outgoing;
  } else {
    rt.outgoing?.fadeOut(0.25);
    rt.current = null;
  }
  rt.outgoing = null;
  SYNTHS.downlifter(ctx, graph.synthBus, { t0: now, t1: now + (backOut ? fade + 0.8 : 0.9), peakDb: backOut ? -18 : -14 });
  drum.cancelSpin({ audible: clock.audible(), cards: cardsFor(wheel.ids), targetId: wheel.insertId, select: wheel.selectId != null });
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
  stopSets({ at, fadeSec });
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
  finishSpinCut();
  const now = ctx.currentTime;
  graph.glide(graph.master.gain, -80, fadeSec);
  drum.freeze(clock.audible());
  const decks = [rt.current, rt.incoming, rt.outgoing];
  rt.current = rt.incoming = rt.outgoing = null;
  checkPlayer.cancel();
  winningLoop.stop({ fadeSec });
  throwPlayer.stop(now, fadeSec);
  voicePlayer.stop();
  drumRoll.stopNow();
  if (paused?.deck) decks.push(paused.deck);
  paused = null;
  setTimeout(() => {
    for (const deck of decks) deck?.dispose();
    holdMusic.kill();
    for (const player of allSets()) player.kill();
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

async function playSfx(name: SoundName, at = ctx.currentTime + 0.01, out: AudioNode = graph.vol.padFx): Promise<void> {
  if (!graph.samples.has(name)) await graph.loadSamples([name], isStingerName(name) ? '/stingers/' : '/fx/');
  graph.playSample(name, Math.max(at, ctx.currentTime + 0.01), -4, out);
}

// The sound test (D229): one kind at a time, on a loop, through that slider's node, so the tech sets the PA on the
// day with the real levels. Songs and the Check play their 3 s hook snippets (trimmed as in a Check); the music
// kinds play their own player; the short sounds repeat every few seconds. A new kind, or null, stops the last one.
// A switched-off automatic sound (D237) mutes its node, so while a test plays the mutes are lifted, and stopping it puts
// the last ones back.
let soundTestStop: (() => void) | null = null;
const testSnippets = new SnippetStore(ctx);
/** The sliders and the automatic sounds the engine last sent (`volumes`), for the sound test's lifted mutes. */
let lastVolumes: Readonly<Volumes> = VOLUME_DEFAULTS;
let lastAutoSounds: Readonly<AutoSounds> = AUTO_SOUNDS_DEFAULT;
function soundTest(effect: EffectOf<'soundTest'>): void {
  const wasTesting = soundTestStop != null;
  soundTestStop?.();
  soundTestStop = null;
  const kind = effect.kind;
  if (kind) graph.setVolumes(lastVolumes, AUTO_SOUNDS_DEFAULT);
  else if (wasTesting) graph.setVolumes(lastVolumes, lastAutoSounds);
  if (!kind) return;
  const fade = 0.4;
  let alive = true;
  const stops: (() => void)[] = [() => (alive = false)];
  soundTestStop = () => stops.forEach((stop) => stop());
  /** `play(t)` now and every `sec` after, until stopped. */
  const every = (sec: number, play: (t: number, k: number) => void) => {
    const tick = (t: number, k: number) => {
      if (!alive) return;
      play(t, k);
      addTask(t + sec - 0.2, () => tick(t + sec, k + 1));
    };
    tick(ctx.currentTime + 0.1, 0);
  };
  const snippets = (out: AudioNode, gainDb = 0) => {
    void testSnippets.loadIndex();
    every(3.5, (t, k) => {
      const id = effect.songIds[k % Math.max(1, effect.songIds.length)];
      if (id == null) return;
      void testSnippets.get(id).then((buffer) => {
        if (!buffer || !alive) return;
        const source = ctx.createBufferSource();
        const level = ctx.createGain();
        level.gain.value = 10 ** (((testSnippets.gains.get(id) ?? 0) + gainDb) / 20);
        source.buffer = buffer;
        source.connect(level).connect(out);
        source.start(Math.max(t, ctx.currentTime + 0.02));
      });
    });
  };
  switch (kind) {
    case 'songs':
      return snippets(graph.musicBus);
    case 'songsParlem':
      return snippets(graph.musicBus, effect.parlemDb);
    case 'check':
      return snippets(graph.vol.check);
    case 'djFx':
      return every(4, (t) => {
        SYNTHS.riser(ctx, graph.synthBus, { t0: t, t1: t + 2, fromHz: 700, toHz: 9500, fromDb: -36, toDb: -12 });
        SYNTHS.impact(ctx, graph.synthBus, { at: t + 2, level: 1 });
      });
    case 'padFx':
      return every(3, (t, k) => void playSfx(SFX_NAMES[k % SFX_NAMES.length], t, graph.vol.padFx));
    case 'finalLap':
      return every(6, (t) => void playSfx('mkwii-final-lap', t, graph.vol.finalLap));
    case 'ticks':
      return every(2, (t) => {
        for (let i = 0; i < 12; i++) drumTick(ctx, graph.drumBus, t + i * 0.09, 11);
      });
    case 'holdMusic':
    case 'win':
    case 'fail':
    case 'intros': {
      const mood = kind === 'holdMusic' ? 'hold' : kind === 'win' ? 'celebration' : kind === 'fail' ? 'error' : 'intro';
      void holdMusic.switchTo({ at: ctx.currentTime + 0.05, levelDb: kind === 'intros' ? INTRO.levelDb : HOLD.holdMusicLevelDb, fadeSec: fade, mood });
      stops.push(() => holdMusic.stop({ fadeSec: fade }));
      // Their sliders also move the fanfares (winFx, failFx): the Celebration's fanfare and impact, a failed Check's.
      if (kind === 'win')
        every(12, (t) => {
          void playSfx(FLOW.celebration.fanfare, t, graph.vol.winFx);
          void playSfx(FLOW.celebration.impact, t, graph.vol.winFx);
        });
      else if (kind === 'fail') every(12, (t) => void playSfx(FLOW.failureFanfare, t, graph.vol.failFx));
      return;
    }
    case 'breaks':
    case 'pausa':
    case 'end':
      sets[kind].start({ levelDb: INTERVAL.volumeDb, gameId: machine().gameId });
      stops.push(() => sets[kind].stop({ fadeSec: fade }));
      return;
    case 'throws': {
      const { name, trimDb, hookSec } = THROW.songs.throw;
      throwPlayer.play(ctx.currentTime + 0.1, hookSec, { name, trimDb });
      stops.push(() => throwPlayer.stop(ctx.currentTime, fade));
      return;
    }
    case 'voices':
      every(8, (t) => void voicePlayer.play('doors-15', 'chime', t));
      stops.push(() => voicePlayer.stop());
      return;
  }
}

// Pausa (D128): the song deck and every bed fade out where they are and wait; effects and snippets ring out (U113).
function pausePlayback(at: number, fadeSec: number): void {
  const deck = rt.current;
  rt.current = null;
  deck?.suspend(at, fadeSec);
  const saved: NonNullable<typeof paused> = {
    deck,
    hold: holdMusic.suspend({ at, fadeSec }),
    loop: winningLoop.suspend({ at, fadeSec }),
    sets: {},
    throwAt: throwPlayer.suspend(at, fadeSec),
  };
  for (const set of ['breaks', 'end'] as const) {
    const s = sets[set].suspend({ at, fadeSec });
    if (s) saved.sets[set] = s;
  }
  paused = saved;
}

// Pausa ends: what it saved plays on from where it was, fading in (D135); the song from where the machine says. Or,
// when Next ended it (or Panic, the end), it's dropped.
function resumePlayback({ at, fadeSec, song, discard }: EffectOf<'resumePlayback'>): void {
  const saved = paused;
  paused = null;
  if (!saved) return;
  if (discard) {
    if (saved.deck) addTask(at + 1, () => saved.deck?.dispose());
    return;
  }
  if (saved.deck && song && saved.deck.songId === song.songId) {
    saved.deck.resume(at, song.offset, song.rate, fadeSec);
    rt.current = saved.deck;
  } else if (saved.deck) addTask(at + 1, () => saved.deck?.dispose());
  if (saved.hold) holdMusic.resume(saved.hold, { at, fadeSec });
  if (saved.loop) winningLoop.resume(saved.loop, { at, fadeSec });
  for (const set of ['breaks', 'end'] as const) {
    const s = saved.sets[set];
    if (s) sets[set].resume(s, { at, fadeSec });
  }
  if (saved.throwAt) void throwPlayer.play(at, saved.throwAt.posSec, saved.throwAt.track);
}

// The music never stops by accident: whatever went wrong, Hold music covers silence the machine did not ask for.
function ensureMusic(): void {
  if (!show || ['locked', 'idle'].includes(show.status)) return;
  if (rt.current || rt.incoming || holdMusic.playing || winningLoop.playing || allSets().some((p) => p.playing) || throwPlayer.playing) return;
  console.warn('watchdog: no music while', show.status, '— starting Hold music');
  holdMusic.start({ levelDb: HOLD.holdMusicLevelDb, fadeSec: 1 }).catch((e) => console.error('hold music', e));
}

// Act only when the silence lasts two checks in a row (a track may be starting).
let silentChecks = 0;
function watchdog(): void {
  if (ctx.state !== 'running' || !show || ['locked', 'idle'].includes(show.status)) return;
  const silent = !rt.current && !rt.incoming && !holdMusic.playing && !winningLoop.playing && !allSets().some((p) => p.playing) && !throwPlayer.playing;
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
  drumRoll.tick(now);
  for (const player of allSets()) player.tick();
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

/** The drum's cards in the engine's order (the round's drum order, D237). */
function cardsFor(ids: readonly number[]): DrumCard[] {
  return ids.map(cardFor).filter((card) => card !== null);
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
window.mixer = { get show() { return show; }, rt, ctx, clock, graph, loader, drum, holdMusic, intervalPlayer, sets, throwPlayer, voicePlayer, drumRoll, send, bus, checkPlayer, winningLoop };
boot().catch((error: unknown) => {
  console.error(error);
  showStatusLine(`Failed to start: ${errorText(error)}`);
});
