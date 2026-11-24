// The sameness of a night's transitions, judged the way a listener hears them: how often a transition repeats
// what the last ones did (the family, how A leaves, the landing, the build's length, the gap), how predictable
// each Phase is, and how often the music beds come back. Pure over NightLog (night.ts).
//
// Run `node tests/support/variety.ts [nights] [firstSeed]` to print the table; tests/variety.test.ts keeps it
// from regressing.
import { familyGroup } from '../../engine/src/plan/recipes.ts';
import { holdMusicPicks, intervalPicks, runNight } from './night.ts';
import type { NightLog, NightTransition } from './night.ts';

export const SCOPES = ['all', 'early', 'mid', 'late', 'final'] as const;
export type Scope = (typeof SCOPES)[number];

/** A listener's memory: the transitions heard just before, in the same round. */
export const WINDOW = 3;
/** The same Signature again within this many transitions is a reuse. */
export const SIGNATURE_WINDOW = 10;

/** How A leaves, as the ear hears it, whatever recipe does it (an S2 exit and an S1 move can sound alike). */
export function aExit(t: NightTransition): string {
  const { plan } = t;
  if (!plan.a) return 'none';
  if (plan.exit) return plan.exit;
  const kind = plan.variant?.kind;
  switch (plan.recipe) {
    case 'R1': return kind === 'stab' ? 'stab' : 'filter';
    case 'R2': return kind === 'vocalThrow' ? 'throw' : kind === 'freeze' ? 'freeze' : 'echo';
    case 'R4': return 'roll';
    case 'R5': return kind === 'brake' ? 'brake' : 'spinback';
    case 'R6': return 'wash';
    case 'R8': case 'D10': case 'D16': return kind === 'throw' ? 'throw' : kind === 'wash' ? 'wash' : 'echo';
    case 'D1': return 'gate';
    case 'D2': return 'hits';
    case 'D3': return 'spiral';
    case 'D7': return 'rush';
    case 'D8': return 'peel';
    case 'D15': return 'braker';
    default: return kind ?? plan.recipe;
  }
}

/** The length of the build or of A's move: an S2 bridge in B's bars, else the move's bars when it reports them. */
export function buildBars(t: NightTransition): number {
  const { plan } = t;
  if (plan.shape === 'S2') return plan.bridgeBars;
  const bars = plan.variant?.bars;
  return typeof bars === 'number' ? bars : 1;
}

/** The flavour of the first riser: 'noise', 'tone' (noise and a climbing saw, the synth's default), or 'none'. */
export function riserOf(t: NightTransition): string {
  for (const e of t.plan.events) if (e.kind === 'synth' && e.name === 'riser') return e.params.tone === false ? 'noise' : 'tone';
  return 'none';
}

/** The samples hit on the landing (their attack sits up to 40 ms before T); 'dry' when there are none. */
export function impactOf(t: NightTransition): string {
  const { T } = t.plan;
  const names = t.plan.events.flatMap((e) => (e.kind === 'sfx' && e.at >= T - 0.06 && e.at <= T + 1e-6 ? [e.name] : []));
  return names.sort().join('+') || 'dry';
}

/** What makes two transitions "sound the same": family, exit, landing and build length. */
export const soundKey = (t: NightTransition): string => `${familyGroup(t.plan.family)}|${aExit(t)}|${t.plan.landing}|${buildBars(t)}`;

export interface Share {
  name: string;
  share: number;
}

/** The sameness of one scope (the whole night, or one Phase). Shares are 0–1. */
export interface Sameness {
  n: number;
  topRecipe: Share;
  /** Shannon entropy of the recipes, in bits, and its 2^H (the "effective number" of recipes). */
  recipeBits: number;
  effectiveRecipes: number;
  /** The most common back-to-back recipe pair (share of the pairs ending in this scope). */
  topPair: Share;
  /** The longest run of one family (the spiral counts as an echo). */
  maxFamilyRun: number;
  /** The family is one of the previous 3. */
  familyWithin3: number;
  topExit: Share;
  /** How A leaves: the same as the previous transition, and one of the previous 3. */
  exitRepeat: number;
  exitWithin3: number;
  topLanding: Share;
  landingRepeat: number;
  /** The impact's samples, and the riser's flavour, are the previous transition's. */
  impactRepeat: number;
  riserRepeat: number;
  /** Builds from silence (no A): the most common recipe, of those. */
  topOpener: Share;
  /** R7's bridge pattern is the previous R7's (in the round). */
  bridgeRepeat: number;
  /** Bridge lengths (S2, B's bars): how many distinct, and the most common. */
  bridgeLengths: number;
  topBridgeLength: Share;
  /** The build length (bridge or A's move) is the previous one's. */
  buildRepeat: number;
  /** The Spin's length D: its spread (standard deviation, s) and range. */
  dStd: number;
  dRange: number;
  /** The gap before the pickup is the previous one's; how many distinct gaps. */
  gapRepeat: number;
  gaps: number;
  /** Share of transitions carrying each layer, a Signature, a Tease, a Blend. */
  layers: Readonly<Record<string, number>>;
  /** Transitions with a Signature that already played within SIGNATURE_WINDOW (of those with one). */
  signatureReuse: number;
  /** The transition sounds like one of the previous 3 (same family, exit, landing and build length). */
  sameAsRecent: number;
}

/** Night-wide reuse of the music beds. */
export interface BedReuse {
  holdStarts: number;
  /** Hold-music starts that replay a loop (track and loop) already heard that night. */
  holdLoopReuse: number;
  victoryStarts: number;
  victoryLoopReuse: number;
  intervalTracks: number;
  /** Interval tracks played again in the same night. */
  intervalReuse: number;
}

export interface VarietyReport {
  nights: number;
  transitions: number;
  scopes: Record<Scope, Sameness>;
  beds: BedReuse;
}

const top = (counts: ReadonlyMap<string, number>, total: number): Share => {
  let best: Share = { name: '-', share: 0 };
  for (const [name, c] of counts) if (c / Math.max(1, total) > best.share) best = { name, share: c / Math.max(1, total) };
  return best;
};
const bump = (counts: Map<string, number>, key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
const ratio = (hits: number, of: number) => (of ? hits / of : 0);

/** A night's transitions, round by round, in order. */
export function roundsOf(log: NightLog): NightTransition[][] {
  const map = new Map<number, NightTransition[]>();
  for (const t of log.transitions) {
    const list = map.get(t.round) ?? [];
    list.push(t);
    map.set(t.round, list);
  }
  return [...map.values()];
}

/** The transitions of each round of every night, in order. */
const byRound = (logs: readonly NightLog[]): NightTransition[][] => logs.flatMap(roundsOf);

const LAYER_NAMES = ['ghost', 'ghostVoice', 'riff', 'gapChop', 'gapScratch', 'signature', 'tease', 'blend'] as const;

function scopeSameness(rounds: readonly NightTransition[][], scope: Scope): Sameness {
  const inScope = (t: NightTransition) => scope === 'all' || t.phase === scope;
  const recipes = new Map<string, number>();
  const pairs = new Map<string, number>();
  const exits = new Map<string, number>();
  const landings = new Map<string, number>();
  const openers = new Map<string, number>();
  let openerCount = 0;
  let impactRepeat = 0;
  let riserRepeat = 0;
  const bridgeLengths = new Map<string, number>();
  const layerCounts = new Map<string, number>();
  let n = 0;
  let pairTotal = 0;
  let maxFamilyRun = 0;
  let familyWithin3 = 0;
  let exitRepeat = 0;
  let exitWithin3 = 0;
  let landingRepeat = 0;
  let bridgeRepeat = 0;
  let bridgeTotal = 0;
  let buildRepeat = 0;
  let gapRepeat = 0;
  let sameAsRecent = 0;
  let withSignature = 0;
  let signatureReuse = 0;
  let s2 = 0;
  let afterFirst = 0;
  const gaps = new Set<number>();
  const ds: number[] = [];
  for (const round of rounds) {
    let run = 0;
    let lastR7: string | null = null;
    round.forEach((t, k) => {
      const recent = round.slice(Math.max(0, k - WINDOW), k);
      const prev = round[k - 1];
      const family = familyGroup(t.plan.family);
      run = prev && familyGroup(prev.plan.family) === family ? run + 1 : 1;
      const pattern = t.plan.recipe === 'R7' ? String(t.plan.variant?.kind ?? 'roll') : null;
      const sigId = t.plan.signature?.id ?? null;
      const sigSeen = sigId != null && round.slice(Math.max(0, k - SIGNATURE_WINDOW), k).some((x) => x.plan.signature?.id === sigId);
      if (inScope(t)) {
        n++;
        bump(recipes, t.plan.recipe);
        bump(exits, aExit(t));
        bump(landings, t.plan.landing);
        ds.push(t.plan.D);
        gaps.add(t.plan.gapBeats);
        maxFamilyRun = Math.max(maxFamilyRun, run);
        if (recent.some((x) => familyGroup(x.plan.family) === family)) familyWithin3++;
        if (recent.some((x) => aExit(x) === aExit(t))) exitWithin3++;
        if (recent.some((x) => soundKey(x) === soundKey(t))) sameAsRecent++;
        if (prev) {
          afterFirst++;
          pairTotal++;
          bump(pairs, `${prev.plan.recipe}→${t.plan.recipe}`);
          if (aExit(prev) === aExit(t)) exitRepeat++;
          if (prev.plan.landing === t.plan.landing) landingRepeat++;
          if (impactOf(prev) === impactOf(t)) impactRepeat++;
          if (riserOf(prev) === riserOf(t)) riserRepeat++;
          if (buildBars(prev) === buildBars(t)) buildRepeat++;
          if (prev.plan.gapBeats === t.plan.gapBeats) gapRepeat++;
        }
        if (!t.plan.a) {
          openerCount++;
          bump(openers, t.plan.recipe);
        }
        if (t.plan.shape === 'S2') {
          s2++;
          bump(bridgeLengths, String(t.plan.bridgeBars));
        }
        if (pattern != null && lastR7 != null) {
          bridgeTotal++;
          if (pattern === lastR7) bridgeRepeat++;
        }
        for (const l of t.plan.layers) bump(layerCounts, l);
        if (t.plan.signature) bump(layerCounts, 'signature');
        if (t.plan.teaseStyle) bump(layerCounts, 'tease');
        if (t.plan.blend) bump(layerCounts, 'blend');
        if (sigId != null) {
          withSignature++;
          if (sigSeen) signatureReuse++;
        }
      }
      if (pattern != null) lastR7 = pattern;
    });
  }
  const total = [...recipes.values()].reduce((a, b) => a + b, 0);
  const bits = -[...recipes.values()].reduce((h, c) => h + (c / total) * Math.log2(c / total), 0);
  const mean = ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length);
  const std = Math.sqrt(ds.reduce((a, d) => a + (d - mean) ** 2, 0) / Math.max(1, ds.length));
  return {
    n,
    topRecipe: top(recipes, n),
    recipeBits: bits,
    effectiveRecipes: 2 ** bits,
    topPair: top(pairs, pairTotal),
    maxFamilyRun,
    familyWithin3: ratio(familyWithin3, n),
    topExit: top(exits, n),
    exitRepeat: ratio(exitRepeat, afterFirst),
    exitWithin3: ratio(exitWithin3, n),
    topLanding: top(landings, n),
    landingRepeat: ratio(landingRepeat, afterFirst),
    impactRepeat: ratio(impactRepeat, afterFirst),
    riserRepeat: ratio(riserRepeat, afterFirst),
    topOpener: top(openers, openerCount),
    bridgeRepeat: ratio(bridgeRepeat, bridgeTotal),
    bridgeLengths: bridgeLengths.size,
    topBridgeLength: top(bridgeLengths, s2),
    buildRepeat: ratio(buildRepeat, afterFirst),
    dStd: std,
    dRange: ds.length ? Math.max(...ds) - Math.min(...ds) : 0,
    gapRepeat: ratio(gapRepeat, afterFirst),
    gaps: gaps.size,
    layers: Object.fromEntries(LAYER_NAMES.map((l) => [l, ratio(layerCounts.get(l) ?? 0, n)])),
    signatureReuse: ratio(signatureReuse, withSignature),
    sameAsRecent: ratio(sameAsRecent, n),
  };
}

/** Starts that replay something already heard that night, of all starts. */
function reuse<T>(items: readonly T[], key: (x: T) => string): number {
  const seen = new Set<string>();
  let again = 0;
  for (const x of items) {
    const k = key(x);
    if (seen.has(k)) again++;
    seen.add(k);
  }
  return ratio(again, items.length);
}

function bedReuse(logs: readonly NightLog[]): BedReuse {
  let holdStarts = 0;
  let holdReuse = 0;
  let victoryStarts = 0;
  let victoryReuse = 0;
  let intervalTracks = 0;
  let intervalReuse = 0;
  for (const log of logs) {
    const picks = holdMusicPicks(log.music);
    const hold = picks.filter((p) => p.mood !== 'celebration');
    const victory = picks.filter((p) => p.mood === 'celebration');
    holdStarts += hold.length;
    holdReuse += reuse(hold, (p) => `${p.track}:${p.loop}`) * hold.length;
    victoryStarts += victory.length;
    victoryReuse += reuse(victory, (p) => `${p.track}:${p.loop}`) * victory.length;
    const tracks = intervalPicks(log);
    intervalTracks += tracks.length;
    intervalReuse += reuse(tracks, (s) => s) * tracks.length;
  }
  const nights = Math.max(1, logs.length);
  return {
    holdStarts: holdStarts / nights,
    holdLoopReuse: ratio(holdReuse, holdStarts),
    victoryStarts: victoryStarts / nights,
    victoryLoopReuse: ratio(victoryReuse, victoryStarts),
    intervalTracks: intervalTracks / nights,
    intervalReuse: ratio(intervalReuse, intervalTracks),
  };
}

export function varietyReport(logs: readonly NightLog[]): VarietyReport {
  const rounds = byRound(logs);
  const scopes = Object.fromEntries(SCOPES.map((s) => [s, scopeSameness(rounds, s)] as const)) as Record<Scope, Sameness>;
  return { nights: logs.length, transitions: logs.reduce((a, l) => a + l.transitions.length, 0), scopes, beds: bedReuse(logs) };
}

/** Nights `firstSeed`, `firstSeed + 1`, …, through the real Show. */
export function runNights(count: number, firstSeed = 1, rounds = 12): NightLog[] {
  return Array.from({ length: count }, (_, k) => runNight({ seed: firstSeed + k, rounds }));
}

// ------------------------------------------------------------------------------------------ the table
const pct = (x: number) => `${Math.round(100 * x)}%`;
const shareCell = (s: Share) => `${s.name} ${pct(s.share)}`;

/** Rows of the sameness table: label → cell per scope. */
export function tableRows(report: VarietyReport): [string, Record<Scope, string>][] {
  const row = (label: string, cell: (s: Sameness) => string): [string, Record<Scope, string>] =>
    [label, Object.fromEntries(SCOPES.map((scope) => [scope, cell(report.scopes[scope])])) as Record<Scope, string>];
  const layerNames = Object.keys(report.scopes.all.layers);
  return [
    row('transitions', (s) => String(s.n)),
    row('top recipe', (s) => shareCell(s.topRecipe)),
    row('recipe entropy (bits / effective)', (s) => `${s.recipeBits.toFixed(2)} / ${s.effectiveRecipes.toFixed(1)}`),
    row('top back-to-back pair', (s) => shareCell(s.topPair)),
    row('max run of one family', (s) => String(s.maxFamilyRun)),
    row('family again within 3', (s) => pct(s.familyWithin3)),
    row('top exit (how A leaves)', (s) => shareCell(s.topExit)),
    row('exit = previous / within 3', (s) => `${pct(s.exitRepeat)} / ${pct(s.exitWithin3)}`),
    row('top landing', (s) => shareCell(s.topLanding)),
    row('landing = previous', (s) => pct(s.landingRepeat)),
    row('impact samples = previous', (s) => pct(s.impactRepeat)),
    row('riser flavour = previous', (s) => pct(s.riserRepeat)),
    row('builds from silence: top', (s) => shareCell(s.topOpener)),
    row('R7 bridge = previous R7', (s) => pct(s.bridgeRepeat)),
    row('bridge lengths (distinct / top)', (s) => `${s.bridgeLengths} / ${shareCell(s.topBridgeLength)}`),
    row('build length = previous', (s) => pct(s.buildRepeat)),
    row('D spread (std / range s)', (s) => `${s.dStd.toFixed(2)} / ${s.dRange.toFixed(1)}`),
    row('gap = previous (distinct gaps)', (s) => `${pct(s.gapRepeat)} (${s.gaps})`),
    ...layerNames.map((l) => row(`layer: ${l}`, (s) => pct(s.layers[l] ?? 0))),
    row(`Signature again within ${SIGNATURE_WINDOW}`, (s) => pct(s.signatureReuse)),
    row('sounds like one of the last 3', (s) => pct(s.sameAsRecent)),
  ];
}

export function formatTable(report: VarietyReport): string {
  const rows = tableRows(report);
  const header = ['', ...SCOPES];
  const lines = [header, ...rows.map(([label, cells]) => [label, ...SCOPES.map((s) => cells[s])])];
  const widths = header.map((_, c) => Math.max(...lines.map((l) => l[c].length)));
  const fmt = (l: string[]) => `| ${l.map((cell, c) => cell.padEnd(widths[c])).join(' | ')} |`;
  const b = report.beds;
  return [
    `${report.nights} nights, ${report.transitions} transitions`,
    fmt(header),
    `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`,
    ...lines.slice(1).map(fmt),
    `Hold music: ${b.holdStarts.toFixed(1)} starts a night, ${pct(b.holdLoopReuse)} replay a loop heard that night; ` +
      `victory track: ${b.victoryStarts.toFixed(1)} a night, ${pct(b.victoryLoopReuse)} replayed; ` +
      `Interval: ${b.intervalTracks.toFixed(1)} tracks a night, ${pct(b.intervalReuse)} replayed.`,
  ].join('\n');
}

if (import.meta.main) {
  const nights = Number(process.argv[2] ?? 4);
  const firstSeed = Number(process.argv[3] ?? 1);
  console.log(formatTable(varietyReport(runNights(nights, firstSeed))));
}
