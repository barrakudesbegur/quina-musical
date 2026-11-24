// Builds Game journals for tests, as the show engine writes them: numbered entries for rounds, landings, undos,
// Lines, scenes, claims and winners. The protocol's own replayJournal checks that what it builds is consistent.
// Shared by the Node tests, the workerd tests and the load test, so it uses no Node or Workers API.
import type { JournalEntry, JournalEntryBody, JournalSettings, RoundKind, ShowScene, WinKind } from '@quina/protocol';

export const SETTINGS: JournalSettings = {
  pace: 14,
  paceLocked: false,
  autoAdvance: true,
  autoAdvanceFinal: false,
  songsUntilWinner: 30,
  phaseOverride: null,
  roundsTotal: 12,
  holdMusicAfterSec: 25,
  finalLapStinger: true,
};

/** A deterministic shuffle of songs 1..count (mulberry32). */
export function shuffledQueue(seed: number, count = 77): number[] {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const queue = Array.from({ length: count }, (_, i) => i + 1);
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j] as number, queue[i] as number];
  }
  return queue;
}

export class JournalBuilder {
  readonly gameId: string;
  readonly entries: JournalEntry[] = [];
  nowMs: number;
  round = 0;
  roundKind: RoundKind = 'normal';
  queue: number[] = [];
  /** Queue index of the last counted landing. */
  position = -1;
  private claims = 0;
  /** A live clock: entries are stamped with it instead of stepping `nowMs` (the load test plays a show live). */
  private readonly clock: (() => number) | null;

  constructor(gameId = 'game-test', nowMs = 1_800_000_000_000, clock: (() => number) | null = null) {
    this.gameId = gameId;
    this.nowMs = nowMs;
    this.clock = clock;
  }

  private push(body: JournalEntryBody, stepMs: number): JournalEntry {
    this.nowMs = this.clock ? this.clock() : this.nowMs + stepMs;
    const entry = { ...body, gameId: this.gameId, seq: this.entries.length + 1, atMs: this.nowMs } as JournalEntry;
    this.entries.push(entry);
    return entry;
  }

  cards(ranges: string): this {
    this.push({ kind: 'cards.set', ranges }, 1_000);
    return this;
  }

  settings(changes: Partial<JournalSettings> = {}): this {
    this.push({ kind: 'settings.changed', settings: { ...SETTINGS, ...changes } }, 1_000);
    return this;
  }

  scene(scene: ShowScene, round = Math.max(this.round, 1), roundKind: RoundKind = this.roundKind): this {
    this.push({ kind: 'scene.changed', scene, round, roundKind }, 2_000);
    return this;
  }

  /** Introduce the next round, Shuffle it and start it, then go to play. */
  startRound(kind: RoundKind = 'normal', queue = shuffledQueue(this.round + 1)): this {
    this.round += 1;
    this.roundKind = kind;
    this.queue = queue;
    this.position = -1;
    this.scene('roundStart', this.round, kind);
    this.push(
      {
        kind: 'round.started',
        round: this.round,
        roundKind: kind,
        queue,
        phaseSeed: 1234 + this.round,
        startedAtMs: this.clock ? this.clock() : this.nowMs + 5_000,
        targetEndMs: this.nowMs + 25 * 60_000,
        settings: SETTINGS,
        shuffleSeed: 99 + this.round,
        shuffleAttempts: 0,
      },
      5_000,
    );
    return this.scene('play');
  }

  /** Land the next `count` songs of the Queue. */
  land(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.position += 1;
      this.push({ kind: 'song.landed', round: this.round, position: this.position, songId: this.queue[this.position] as number }, 14_000);
    }
    return this;
  }

  /** Back: undo the last landing. */
  undo(): this {
    this.push({ kind: 'landing.undone', round: this.round, position: this.position, songId: this.queue[this.position] as number }, 3_000);
    this.position -= 1;
    return this;
  }

  confirmLine(): this {
    this.push({ kind: 'line.confirmed', round: this.round, fromPosition: this.position }, 2_000);
    return this;
  }

  /** A claim; returns its id. */
  claim(cardId: number, winKind: WinKind): string {
    this.claims += 1;
    const claimId = `cl-${this.claims}`;
    this.push({ kind: 'claim.opened', round: this.round, claimId, cardId, winKind, position: this.position }, 2_000);
    return claimId;
  }

  decide(claimId: string, verdict: 'valid' | 'invalid'): this {
    const winningSongId = verdict === 'valid' ? (this.queue[this.position] ?? null) : null;
    this.push({ kind: 'claim.decided', round: this.round, claimId, verdict, winningSongId, position: this.position }, 20_000);
    return this;
  }

  note(claimId: string, name: string | null, notes: string | null): this {
    this.push({ kind: 'winner.noted', claimId, name, notes }, 1_000);
    return this;
  }

  /** A whole Game: two rounds with a Back, a failed and a shared Line, a Bingo, and the Interval between. */
  static sampleGame(gameId = 'game-sample', nowMs?: number): JournalBuilder {
    const b = new JournalBuilder(gameId, nowMs);
    b.cards('1-180, 200-215').settings();
    b.startRound().land(6).undo().land(5);
    const wrong = b.claim(12, 'line');
    b.scene('check').decide(wrong, 'invalid').scene('play').land(4);
    const first = b.claim(33, 'line');
    const second = b.claim(77, 'line');
    b.scene('check').decide(first, 'valid').decide(second, 'valid').note(first, 'Àvia Rosa', 'table 4').confirmLine();
    b.scene('celebration').scene('play').land(9);
    const bingo = b.claim(150, 'bingo');
    b.scene('check').decide(bingo, 'valid').scene('celebration').scene('interval');
    b.startRound('special').land(3);
    return b;
  }
}
