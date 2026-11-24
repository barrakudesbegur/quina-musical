// The show flow's scene rules: which command each scene accepts (docs/protocol.md › Scenes). Pure, and shared:
// the show engine rejects any other command as `wrongScene`, and remotes (the console) grey out the same ones. The table is the agreed one, plus three rules that keep
// today's commands working:
//   - `before` (a fresh Game) accepts everything `play` does; the first Spin moves it to `play`.
//   - `newRound` stays the manual override it was: allowed anywhere but in a Check.
//   - `roundIntro` and `newRound` are allowed in `after`, so an `endGame` by mistake can be undone.
// During the technical pause only the commands allowed in every scene go through.
import type { CommandName } from './commands.ts';
import type { ShowScene, WinKind } from './vocabulary.ts';

/** What the rules look at. */
export interface SceneContext {
  scene: ShowScene;
  /** The Celebration's kind, in `celebration`. */
  celebrating: WinKind | null;
  /** In `roundStart`, a round is introduced and its Shuffle has not run yet. */
  introduced: boolean;
  paused: boolean;
  /**
   * The Interval playlist is playing (the state's `intervalMusic` is not null). Optional: without it the rules
   * assume it plays in `interval`, `roundStart` and `after`, the scenes that start it.
   */
  intervalMusic?: boolean;
}

type Rule = 'any' | readonly ShowScene[] | ((ctx: SceneContext) => boolean);

const PLAY: readonly ShowScene[] = ['before', 'play'];
/** The scenes that start the Interval playlist (it goes on in `play` until the round's first Spin). */
const INTERVAL_MUSIC: readonly ShowScene[] = ['interval', 'roundStart', 'after'];
const celebratingLine = (c: SceneContext) => c.scene === 'celebration' && c.celebrating === 'line';
const celebratingBingo = (c: SceneContext) => c.scene === 'celebration' && c.celebrating === 'bingo';

const RULES = {
  unlock: 'any',
  getState: 'any',
  getJournal: 'any',
  // Plan B on a show page with nothing going on (a fresh page is in `before`; also after an Interval or an end).
  resumeAt: ['before', 'interval', 'after'],
  setPace: 'any',
  setGame: 'any',
  setCardsInPlay: 'any',
  sfx: 'any',
  overrideNextRecipe: 'any',
  panic: 'any',
  pause: 'any',
  endGame: 'any',
  winnerInfo: 'any',
  // In roundStart, once the Shuffle has been drawn (it waits for the animation to end); in a Line's
  // Celebration, back to the round.
  next: (c) => PLAY.includes(c.scene) || (c.scene === 'roundStart' && !c.introduced) || celebratingLine(c),
  back: ['before', 'play', 'check'],
  // Not in a Check: releasing its Hold would bring the song back up mid-Check (Resume comes after the verdict).
  hold: (c) => PLAY.includes(c.scene) || celebratingLine(c),
  holdMusic: ['before', 'play', 'check'],
  suspense: PLAY,
  confirmLine: ['before', 'play', 'celebration'],
  newRound: (c) => c.scene !== 'check',
  roundIntro: (c) => c.scene === 'before' || c.scene === 'interval' || c.scene === 'after' || celebratingBingo(c),
  claim: ['play', 'check', 'celebration'],
  checkStart: ['check'],
  decide: ['check'],
  // In a Check it picks the music the Celebration will start with (`state.celebrationChoice`).
  celebrationMusic: ['celebration', 'check'],
  interval: celebratingBingo,
  // Whenever the Interval playlist plays: the Interval, a round's intro and Shuffle (until the first Spin), `after`.
  intervalSkip: (c) => c.intervalMusic ?? INTERVAL_MUSIC.includes(c.scene),
} satisfies Record<CommandName, Rule>;

export const SCENE_RULES: Readonly<Record<CommandName, Rule>> = Object.freeze(RULES);

/** Whether `cmd` may run now. */
export function sceneAllows(cmd: CommandName, ctx: SceneContext): boolean {
  const rule = SCENE_RULES[cmd];
  if (rule === 'any') return true;
  if (ctx.paused) return false;
  return typeof rule === 'function' ? rule(ctx) : rule.includes(ctx.scene);
}
