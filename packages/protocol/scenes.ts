// The show flow's scene rules: which command each scene accepts (docs/protocol.md › Scenes). Pure, and shared:
// the show engine rejects any other command as `wrongScene`, and remotes (the console) grey out the same ones. The table is the agreed one, plus three rules that keep
// today's commands working:
//   - `before` (a fresh Game) accepts everything `play` does; the first Spin moves it to `play`.
//   - `newRound` stays the manual override it was: allowed anywhere but in a Check.
//   - `roundIntro` and `newRound` are allowed in `after`, so an `endGame` by mistake can be undone.
// During Pausa only the commands allowed in every scene go through, plus Next (it ends Pausa with that song's
// transition, D128) and intervalSkip (the Pausa music's next track), each where its own rule allows it.
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
   * A music set is playing (the state's `intervalMusic` is not null: the breaks', Pausa's or the end's). Optional:
   * without it the rules assume one plays in `interval` and `after`, the scenes that start one, and during Pausa.
   */
  intervalMusic?: boolean;
  /** The night's last round is the one in play (the state's `lastRound`): the corn-seed storm's button shows in it
   * (D155). Optional: without it the storm is only allowed after the Game. */
  lastRound?: boolean;
  /** The Check on screen is under review (the state's `check.reviewing`): its screen offers Parlem (D118). */
  reviewing?: boolean;
}

type Rule = 'any' | readonly ShowScene[] | ((ctx: SceneContext) => boolean);

const PLAY: readonly ShowScene[] = ['before', 'play'];
/** The scenes that start a music set (a round's intro plays its intro track instead, D129). */
const INTERVAL_MUSIC: readonly ShowScene[] = ['interval', 'after'];
/** What goes through during Pausa besides the 'any' commands, where its own rule allows it. */
const PAUSED_OK: readonly CommandName[] = ['next', 'intervalSkip'];
const celebratingLine = (c: SceneContext) => c.scene === 'celebration' && c.celebrating === 'line';
/** The round's end is celebrated: its Bingo, or the Desgraciat round's last card standing. */
const celebratingBingo = (c: SceneContext) => c.scene === 'celebration' && (c.celebrating === 'bingo' || c.celebrating === 'standing');

const RULES = {
  unlock: 'any',
  getState: 'any',
  getJournal: 'any',
  getUpcoming: 'any',
  // Plan B on a show page with nothing going on (a fresh page is in `before`; also after an Interval or an end).
  resumeAt: ['before', 'interval', 'after'],
  setPace: 'any',
  setGame: 'any',
  setAutoSound: 'any',
  setVolume: 'any',
  setCardsInPlay: 'any',
  addCardsInPlay: 'any',
  sfx: 'any',
  overrideNextRecipe: 'any',
  panic: 'any',
  pause: 'any',
  endGame: 'any',
  winnerInfo: 'any',
  revealPrizes: 'any',
  // In roundStart, once the Shuffle has been drawn (it waits for the animation to end); in a Line's
  // Celebration, back to the round.
  next: (c) => PLAY.includes(c.scene) || (c.scene === 'roundStart' && !c.introduced) || celebratingLine(c),
  back: ['before', 'play', 'check'],
  // In any Celebration Parlem ducks its music (D117). In a Check only during a review (D118): there it switches the
  // duck in place and never leaves the Check's Hold; during the reveals the −/+ hold means "Revisió manual".
  hold: (c) => PLAY.includes(c.scene) || c.scene === 'celebration' || (c.scene === 'check' && c.reviewing === true),
  holdMusic: ['before', 'play', 'check'],
  suspense: PLAY,
  confirmLine: ['before', 'play', 'celebration'],
  newRound: (c) => c.scene !== 'check',
  roundIntro: (c) => c.scene === 'before' || c.scene === 'interval' || c.scene === 'after' || celebratingBingo(c),
  claim: ['play', 'check', 'celebration'],
  checkStart: ['check'],
  // The presenter-paced Check (D107–D110). A Claim under review waits in its Check scene with whatever was playing
  // (D118–D121), until reviewEnd; a Pausa there is only by hand, as anywhere.
  checkNext: ['check'],
  checkBack: ['check'],
  checkAuto: ['check'],
  checkReview: ['check'],
  reviewEnd: ['check'],
  // In a Check it picks the music the Celebration will start with (`state.celebrationChoice`).
  celebrationMusic: ['celebration', 'check'],
  interval: celebratingBingo,
  // Whenever a music set plays: the Interval, `after`, Pausa.
  intervalSkip: (c) => c.intervalMusic ?? (c.paused || INTERVAL_MUSIC.includes(c.scene)),
  intervalSet: ['interval'],
  soundTest: ['before'],
  // Between rounds (D138): at the doors, in a break; not on the end screen (D194), where the storm is.
  throw: ['before', 'interval'],
  // A voice cue can be stopped whenever one plays (D204).
  voiceSkip: 'any',
  // Held effects (D203): in any scene, never during Pausa (not 'any', so the paused rule applies).
  padHold: () => true,
  // The lock mirror (D234): a press's release may come in any scene, Pausa included (Parlem's press escalates to it).
  twoLevelHold: 'any',
  // The Desgraciat's finale, in its round (D167); the engine refuses it in another kind of round.
  finale: ['play'],
  finaleCue: ['play'],
  // The night's last round, its normal screen and its Check, and after it, on the end screen (D155).
  storm: (c) => c.scene === 'after' || (c.lastRound === true && (c.scene === 'play' || c.scene === 'check')),
} satisfies Record<CommandName, Rule>;

export const SCENE_RULES: Readonly<Record<CommandName, Rule>> = Object.freeze(RULES);

/** Whether `cmd` may run now. */
export function sceneAllows(cmd: CommandName, ctx: SceneContext): boolean {
  const rule = SCENE_RULES[cmd];
  if (rule === 'any') return true;
  if (ctx.paused && !PAUSED_OK.includes(cmd)) return false;
  return typeof rule === 'function' ? rule(ctx) : rule.includes(ctx.scene);
}
