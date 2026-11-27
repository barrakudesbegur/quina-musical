// The words and constants every side of the show protocol shares (GLOSSARY.md names). Nothing here may
// import engine code: the player app and a Worker import this package too.

/** Every message carries `v`. Additive commands and events stay v1; only a breaking change bumps it. */
export const PROTOCOL_VERSION = 1;
export type ProtocolVersion = typeof PROTOCOL_VERSION;

/** The Phase: how close the round is to a winner. */
export const PHASE_NAMES = ['early', 'mid', 'late', 'final'] as const;
export type PhaseName = (typeof PHASE_NAMES)[number];

export const isPhaseName = (value: unknown): value is PhaseName =>
  typeof value === 'string' && (PHASE_NAMES as readonly string[]).includes(value);

/** The show engine's status. */
export type ShowStatus = 'locked' | 'idle' | 'playing' | 'transition' | 'hold';
/**
 * Why the round holds. `claim`: a Claim is being checked (also through the Celebration); `checkFailed`: every Claim of
 * the last Check failed (error Hold music until Next); `discarded`: a Review was discarded, so the music from before its
 * Check plays under Parlem (D122, D125); `pause`: Pausa ended, and what it saved plays again under Parlem (D128). Like
 * every Hold, it suspends auto-advance without touching its setting; Next ends it, and auto-advance goes on as set.
 */
export type HoldReason = 'hold' | 'back' | 'cancel' | 'end' | 'music' | 'claim' | 'checkFailed' | 'discarded' | 'pause';
/** A normal round, the special round, or the Desgraciat round (played in reverse: the last card standing wins). */
export type RoundKind = 'normal' | 'special' | 'desgraciat';
export const ROUND_KINDS = ['normal', 'special', 'desgraciat'] as const satisfies readonly RoundKind[];
export const isRoundKind = (value: unknown): value is RoundKind => typeof value === 'string' && (ROUND_KINDS as readonly string[]).includes(value);

/**
 * A printed card type's id, as in apps/cards' card-types.json and each card's `type` in cards.json ('normal',
 * 'especial'). Lowercase letters and digits only (no dashes), so a resume token can carry it.
 */
export const CARD_TYPE_ID_RE = /^[a-z][a-z0-9]{0,23}$/;
export const isCardTypeId = (value: unknown): value is string => typeof value === 'string' && CARD_TYPE_ID_RE.test(value);
/** The card type a round plays when nothing says otherwise: normal cards in normal rounds, especial in the special one and the Desgraciat (2025's special card played both, D70). */
export const DEFAULT_CARD_TYPE: Readonly<Record<RoundKind, string>> = Object.freeze({ normal: 'normal', special: 'especial', desgraciat: 'especial' });
/** The card type a round of this kind plays unless the plan picks another (an older journal or plan has none). */
export const defaultCardType = (kind: RoundKind): string => DEFAULT_CARD_TYPE[kind] ?? DEFAULT_CARD_TYPE.normal;
/**
 * A pool's id (D178): each set of songs a round plays and a card's side is printed from ("1", "2"), as songs.json's
 * per-song `pools` (D268: a song may be in several) and card-types.json's sides give it. A song without any is in
 * DEFAULT_POOL.
 */
export const POOL_ID_RE = /^[a-z0-9]{1,8}$/;
export const isPoolId = (value: unknown): value is string => typeof value === 'string' && POOL_ID_RE.test(value);
export const DEFAULT_POOL = '1';
/** A card's printed sides are 1, 2…; a round plays one (D101, D102, D193). */
export const SIDE_MAX = 9;
export const DEFAULT_SIDE = 1;
export const isSide = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= SIDE_MAX;

/**
 * One printed side of a card type (card-types.json's `sides`, D178): its number, the pool its 12 songs come from, and
 * how it's named (`label`, "1-5"; `mark`, the printed sign of its rounds).
 */
export interface CardTypeSide {
  side: number;
  pool: string;
  label?: string;
  mark?: string;
  /** What the Check shows for a card of this type and side (D266): «Normal 1–5», «Normal 6–10», «Desgraciat»,
   * «Especial». Written by apps/cards; absent in an older card-types.json (screens then join the name and label). */
  checkLabel?: string;
  /** The side's printed heading (apps/cards). Absent in an older card-types.json. */
  heading?: string;
}
/** A card type as card-types.json gives it, as far as sides go (it has more fields: colour, title, price). */
export interface CardTypeSides {
  type: string;
  name?: string;
  sides?: readonly CardTypeSide[];
}
/** A card type's sides: card-types.json's, else one side 1 on DEFAULT_POOL (a type from before sides). */
export const cardTypeSides = (t: CardTypeSides | null | undefined): readonly CardTypeSide[] =>
  t?.sides?.length ? t.sides : [{ side: DEFAULT_SIDE, pool: DEFAULT_POOL }];
/** The pool a round of this card type and side plays; null when the type is unknown or has no such side. */
export function sidePool(types: readonly CardTypeSides[], cardType: string, side: number = DEFAULT_SIDE): string | null {
  const type = types.find((t) => t.type === cardType);
  if (!type) return types.length ? null : side === DEFAULT_SIDE ? DEFAULT_POOL : null;
  return cardTypeSides(type).find((s) => s.side === side)?.pool ?? null;
}
/**
 * The card type and side in one label (D163): "Normal 1-5", "Normal 6-10", or just "Especial" for a type with one
 * side. The type's `name` when it has one, else its id.
 */
export function sideLabel(types: readonly CardTypeSides[], cardType: string, side: number = DEFAULT_SIDE): string {
  const type = types.find((t) => t.type === cardType);
  const name = type?.name ?? cardType;
  const sides = cardTypeSides(type);
  const label = sides.length > 1 ? sides.find((s) => s.side === side)?.label ?? String(side) : null;
  return label ? `${name} ${label}` : name;
}

/** What the round's Phase is climbing towards: the Line, then the Bingo; in the Desgraciat round, the last card standing. */
export type ClimbTarget = 'line' | 'bingo' | 'standing';
/** What a Claim is for, and what a Winner won: a Line, the Bingo, or (Desgraciat round) being the last card standing. */
export type WinKind = ClimbTarget;
export const WIN_KINDS = ['line', 'bingo', 'standing'] as const satisfies readonly WinKind[];
/** The kinds a round of this kind can be won by: a Desgraciat round only by the last card standing. */
export const winKindsOf = (round: RoundKind): readonly WinKind[] => (round === 'desgraciat' ? ['standing'] : ['line', 'bingo']);

/**
 * Where the show is in the Game (the show flow), on top of the audio `ShowStatus`. A Hold while talking is
 * `play` with status `hold`, so the projector shows no change. The technical pause is an overlay (`pause`)
 * that keeps the scene underneath.
 */
export const SHOW_SCENES = ['before', 'roundStart', 'play', 'check', 'celebration', 'interval', 'after'] as const;
export type ShowScene = (typeof SHOW_SCENES)[number];
export const isShowScene = (value: unknown): value is ShowScene =>
  typeof value === 'string' && (SHOW_SCENES as readonly string[]).includes(value);

/**
 * Where a Claim is: `queued` (waiting for its Check), `checking` (its Check on screen, paced by the presenters,
 * D107), `reviewing` (the Review, "En revisió": put under review before its cue with `checkReview`; whatever was
 * playing goes on), then `valid` or `invalid` (its cue, or a Review won or lost by hand) or `discarded` (a Review set
 * aside without a verdict or a sound, D124).
 */
export type ClaimStatus = 'queued' | 'checking' | 'reviewing' | 'valid' | 'invalid' | 'discarded';
/** How a Review ends (D121): its Check goes on from where it was; won or lost by hand, skipping the reveals left
 * (the journal marks the verdict `manual`); or discarded, with no fanfare and no failure music. */
export const REVIEW_OUTCOMES = ['continue', 'win', 'lose', 'discard'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
/**
 * What the engine found. The Check's result decides (docs/event.md): presenters may reject a card that passed, never
 * accept one that failed (isPassingOutcome). A 'standing' claim (the Desgraciat round) is `complete` while no counted
 * landing took the card out (a landing that would take out every card left counts for none of them, D180), and
 * `fallen` once one did. `fellLast` (sat down with the latest landing, a shared win) is only in journals from before
 * D180: the engine no longer gives it.
 */
export type CheckOutcome = 'complete' | 'incomplete' | 'fellLast' | 'fallen' | 'unknownCard' | 'wrongType';
export const CHECK_OUTCOMES = ['complete', 'incomplete', 'fellLast', 'fallen', 'unknownCard', 'wrongType'] as const satisfies readonly CheckOutcome[];
/** Whether a card with this Check result may be accepted: `complete`, or `fellLast` for a 'standing' claim. */
export const isPassingOutcome = (outcome: CheckOutcome | null | undefined, kind: WinKind): boolean =>
  outcome === 'complete' || (outcome === 'fellLast' && kind === 'standing');
/** Only a warning: the card is not among the cards in play. */
/** PRIVATE notes on a Claim: its card isn't in the cards in play (`notSold`); a Review won by hand on a card that
 * doesn't pass (`notPassing`), or lost by hand on one that does (`wouldPass`) (D121). */
export type ClaimWarning = 'notSold' | 'notPassing' | 'wouldPass';
/** The Celebration's music, which the presenters may change: the Winning song's hook looped, the victory
 * track, or Hold music. */
export const CELEBRATION_MUSIC = ['winningSong', 'victory', 'holdMusic'] as const;
export type CelebrationMusic = (typeof CELEBRATION_MUSIC)[number];
/** Where the Phase comes from. */
export type PhaseSource = 'cards' | 'placeholder' | 'override';

/**
 * Transition vocabulary, as it appears in `transition.scheduled` and the state's `history`. R*: the first
 * recipes; D*: the DJ techniques of docs/dj-techniques.md (D1 gate, D2 stop-time hits, D3 spiral, D6 fake drop,
 * D7 pitch-up rush, D8 stem peel, D10 drum swap, D11 vocal-chop build, D15 instrumental braker, D16 acapella-in
 * mashup, D19 scratch-in).
 */
export type RecipeId =
  | 'R1' | 'R2' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R10' | 'D1' | 'D2' | 'D3' | 'D6' | 'D7' | 'D8' | 'D10' | 'D11' | 'D15' | 'D16'
  | 'D19' | 'D20' | 'FADE' | 'SUSPENSE';
/** Rotation never plays one family three times in a row. */
export type RecipeFamily =
  | 'cut' | 'echo' | 'roll' | 'stop' | 'wash' | 'build' | 'blend' | 'powerdown' | 'gate' | 'hits' | 'spiral' | 'strip' | 'swap' | 'chop'
  | 'fake' | 'pitch' | 'scratch' | 'count';
/** How the outgoing song leaves. */
export type ExitName = 'echo' | 'roll' | 'brake' | 'spinback' | 'wash' | 'gate' | 'spiral';
/** Timeline shape: S1 rides A and lands on one of its downbeats, S2 exits A then bridges on B's grid,
 * S3 is the layered Blend, S0 the fallback when A has no usable downbeat. */
export type RecipeShape = 'S0' | 'S1' | 'S2' | 'S3';
export const RECIPE_IDS = [
  'R1', 'R2', 'R4', 'R5', 'R6', 'R7', 'R8', 'R10', 'D1', 'D2', 'D3', 'D6', 'D7', 'D8', 'D10', 'D11', 'D15', 'D16', 'D19', 'D20', 'FADE', 'SUSPENSE',
] as const satisfies readonly RecipeId[];

/** Pace: seconds from one Landing to the next. */
export const PACE_LIMITS_SEC = [8, 60] as const;
/** Pace buttons on the remotes. Last year's medians were about 22 s in the first round and 14 s after. */
export const PACE_PRESETS_SEC = [11, 14, 18, 22, 30] as const;
/** The remotes' −/+ step. */
export const PACE_FINE_STEP_SEC = 1;
/**
 * The Pace is a repeat's slot: a song already played in this Game's earlier rounds. A song's first play in the Game, in
 * any round, gets `firstPlay / repeat` times it (D174, D175), and lands on its best hook. `repeat` is the Pace each round
 * starts with, unless the presenters locked theirs.
 */
export const PACE_DEFAULT_SEC = Object.freeze({ firstPlay: 22, repeat: 14 });
/** A first play's slot from the Pace: the Pace × 22/14, so changing or locking the Pace scales both. */
export const firstPlaySec = (pace: number): number => (pace * PACE_DEFAULT_SEC.firstPlay) / PACE_DEFAULT_SEC.repeat;

/** Per Phase, the [low, high] range of the Heat (0..1) the engine draws for it: a Phase starts where its band does. */
export const HEAT_BANDS: Readonly<Record<PhaseName, readonly [number, number]>> = Object.freeze({
  early: Object.freeze([0.05, 0.3] as const),
  mid: Object.freeze([0.3, 0.55] as const),
  late: Object.freeze([0.55, 0.8] as const),
  final: Object.freeze([0.8, 1] as const),
});

/** One-shot fanfares (data/media/stingers). */
export const STINGER_NAMES = ['mkwii-final-lap', 'mkwii-mission-clear', 'mkwii-mission-failure', 'mkwii-low-place-fanfare'] as const;
/** Sound effects (data/media/fx). */
export const SFX_NAMES = [
  'among-us', 'anime-wow', 'boom', 'bum-bum-buaaa', 'buzzer', 'correct', 'duck-quack', 'fear-melody', 'heaven',
  'horn', 'metal-gear-alert', 'orchestra-hit', 'sad-trombone', 'spongebob-boowomp', 'spongebob-fail', 'tada',
] as const;
export type StingerName = (typeof STINGER_NAMES)[number];
export type SfxName = (typeof SFX_NAMES)[number];
/** Anything the `sfx` command may play. */
export type SoundName = StingerName | SfxName;
export const SOUND_NAMES: readonly SoundName[] = [...STINGER_NAMES, ...SFX_NAMES];
export const isStingerName = (value: unknown): value is StingerName =>
  typeof value === 'string' && (STINGER_NAMES as readonly string[]).includes(value);
export const isSoundName = (value: unknown): value is SoundName =>
  typeof value === 'string' && (SOUND_NAMES as readonly string[]).includes(value);

/** Reasons a command may be rejected (`command.rejected.reason`). */
export const REJECT_REASONS = [
  'invalid', 'locked', 'busy', 'endOfQueue', 'nothingToUndo', 'notHolding', 'notReady', 'decodeFailed', 'planFailed',
  'unknownSfx', 'unknownCommand', 'noSuspense', 'wrongScene', 'unknownClaim', 'cannotResume',
  // A Claim under review keeps the round in its Check until the Review ends (D118–D121).
  'claimOpen',
  // A claim naming a card number that isn't printed (D126): refused privately, so the presenter retypes it.
  'unknownCard',
  // Next while Aguanta (Stay) or a Suspense is on (D133): nothing lands; let go of B (or Aguanta) first.
  'nextBlocked',
  // Next once the Desgraciat's finale has its winners: the presenters' cue (`finaleCue`) comes first (D169).
  'finaleDecided',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Who is connected to the relay. `cloud` is the laptop's cloud link (a Node sidecar next to the relay, cloud/laptop/):
 * a remote that keeps a copy of the Game journal and uploads it to the cloud. */
export const ROLES = ['show', 'admin', 'tablet', 'drum', 'cloud'] as const;
export type Role = (typeof ROLES)[number];

// ---- music and volumes (D129, D138, D139) ---------------------------------------------------------------
/**
 * The playlists the engine plays between songs (tools/prep/interval.py, one folder each): `breaks` between rounds
 * (the Interval; pop, shuffled), `pausa` during Pausa (lofi and silly-core, shuffled), `end` after the Game (for now
 * the breaks' tracks in their playlist order, U97). The code keeps the word "interval" for a break (D136).
 */
export const MUSIC_SETS = ['breaks', 'pausa', 'end'] as const;
export type MusicSet = (typeof MUSIC_SETS)[number];
/**
 * The sounds the engine plays by itself, each on or off from the console (D237): the drum's border clicks, the DJ
 * moves' risers, impacts and whooshes, the final-lap stinger, the Celebration's fanfare and impact, a failed Check's
 * fanfare, and the automatic voice cues (D204; a round's name keeps its fanfare music, U181). Music sets stay out.
 */
export const AUTO_SOUNDS = ['drumTicks', 'djFx', 'finalLap', 'winFanfare', 'failFanfare', 'voices'] as const;
export type AutoSound = (typeof AUTO_SOUNDS)[number];
export type AutoSounds = Record<AutoSound, boolean>;
export const isAutoSound = (value: unknown): value is AutoSound =>
  typeof value === 'string' && (AUTO_SOUNDS as readonly string[]).includes(value);
/** All on. */
export const AUTO_SOUNDS_DEFAULT: Readonly<AutoSounds> = Object.freeze(Object.fromEntries(AUTO_SOUNDS.map((k) => [k, true])) as AutoSounds);
/**
 * A settings object's sounds as a journal may carry them: `autoSounds` since D237; a journal from before has, instead,
 * the two switches the engine wrote then (it no longer writes or takes them).
 */
export interface SoundSettings {
  autoSounds?: Partial<AutoSounds> | null;
  /** Before D237: the final-lap stinger on or off. */
  finalLapStinger?: boolean;
  /** Before D237: the automatic voice cues on or off (D204). */
  voicesOn?: boolean;
}
/**
 * A settings object's sounds: its own `autoSounds`, else (a journal from before them) its `finalLapStinger` and
 * `voicesOn`. Always a fresh object with every key.
 */
export function autoSoundsOf(settings: SoundSettings): AutoSounds {
  const own = settings.autoSounds ?? { finalLap: settings.finalLapStinger !== false, voices: settings.voicesOn !== false };
  return { ...AUTO_SOUNDS_DEFAULT, ...Object.fromEntries(Object.entries(own).filter(([k, v]) => isAutoSound(k) && typeof v === 'boolean')) };
}

/**
 * The sound test's kinds (D229): one per volume slider that has a sound of its own, played in turn at that slider's
 * level so the tech sets the PA on the day. `master` scales them all and `doors` has no sound yet, so neither is a kind.
 */
export const SOUND_TEST_KINDS = [
  'songs', 'songsParlem', 'djFx', 'padFx', 'ticks', 'check', 'holdMusic', 'win', 'fail', 'finalLap', 'intros', 'breaks',
  'pausa', 'throws', 'end', 'voices',
] as const satisfies readonly VolumeKey[];
export type SoundTestKind = (typeof SOUND_TEST_KINDS)[number];

/** The sets a break can play (D228: in the Descans the presenters pick the breaks' or Pausa's); each break starts on the first. */
export const BREAK_SETS = ['breaks', 'pausa'] as const satisfies readonly MusicSet[];
export type BreakSet = (typeof BREAK_SETS)[number];

/**
 * The songs played by hand for things thrown to and by the crowd: `throw` for a planned Throw (D138, "Llançament"),
 * `storm` for the corn-seed storm after the last round (D151). Each is the engine's setting (config.ts THROW.songs):
 * a track and the hook it starts from.
 */
export const THROW_SONGS = ['throw', 'storm'] as const;
export type ThrowSong = (typeof THROW_SONGS)[number];

/**
 * The volume sliders (D130, D139), each a percent from 0 to its VOLUME_MAX (`setVolume`). 100% is the level the
 * engine is tuned to for that sound, so a fresh Game sounds as before; above 100% is louder, with the room the engine
 * keeps inside (D157: it plays the whole show lower, by its headroom trim, so the limiter stays clean). `songsParlem`
 * is the song under Parlem as a share of its full level (its default is the Parlem duck). `master` scales everything. `djFx`: the DJ moves' risers, impacts and
 * whooshes; `padFx`: the presenters' effects pad; `check`: the Check's snippets and broken record; `win`: the Clear
 * fanfare, the victory track and the winning song's loop; `fail`: the Failure fanfare and the error Hold music;
 * `finalLap`: the stinger; `intros`, `breaks`, `pausa`, `throws`, `doors`, `end`: those moments' music; `voices`: the
 * automatic voice cues ("Veus", D204).
 */
export const VOLUME_KEYS = [
  'master', 'songs', 'songsParlem', 'djFx', 'padFx', 'ticks', 'check', 'holdMusic', 'win', 'fail', 'finalLap',
  'intros', 'breaks', 'pausa', 'throws', 'doors', 'end', 'voices',
] as const;
export type VolumeKey = (typeof VOLUME_KEYS)[number];
export type Volumes = Record<VolumeKey, number>;
export const isVolumeKey = (value: unknown): value is VolumeKey =>
  typeof value === 'string' && (VOLUME_KEYS as readonly string[]).includes(value);

/** Every slider's starting percent. `songsParlem` is today's Parlem duck (−14 dB) on the curve below; `throws` (the
 * throws and the corn-seed storm, one slider: D159) starts noticeably louder than the songs, +6 dB (D158, by ear). */
export const VOLUME_DEFAULTS: Readonly<Volumes> = Object.freeze({
  master: 100, songs: 100, songsParlem: 45, djFx: 100, padFx: 100, ticks: 100, check: 100, holdMusic: 100, win: 100,
  fail: 100, finalLap: 100, intros: 100, breaks: 100, pausa: 100, throws: 141, doors: 100, end: 100, voices: 100,
});

/**
 * The automatic voice cues (D198, D202–D204): a lead sound (a chime; a fanfare for a round's start), then a voice line,
 * with the music dipping under it. One file each, data/media/voice/<cue> (placeholders until the user's recordings).
 * - `round-1`…`round-10`, `round-desgraciat`, `round-especial`: a round's start, on `roundIntro` (a normal round by its
 *   Quina number), before its intro music;
 * - `doors-60` … `doors-3`: minutes before the plan's start, while the doors are open (U176: `doors-3` may go);
 * - `start`: the night's start (U173); `descans-2min`: "Tornem en dos minuts", 2 minutes before a Descans ends;
 * - `goodbye`: on ending the night, before the end set.
 */
export const VOICE_CUES = [
  'round-1', 'round-2', 'round-3', 'round-4', 'round-5', 'round-6', 'round-7', 'round-8', 'round-9', 'round-10',
  'round-desgraciat', 'round-especial', 'doors-60', 'doors-45', 'doors-30', 'doors-15', 'doors-5', 'doors-3', 'start',
  'descans-2min', 'goodbye',
] as const;
export type VoiceCue = (typeof VOICE_CUES)[number];
export const isVoiceCue = (value: unknown): value is VoiceCue => typeof value === 'string' && (VOICE_CUES as readonly string[]).includes(value);
/** What plays before a cue's voice: the chime (D204), or a fanfare for a round's start (D198). */
export type VoiceLead = 'chime' | 'fanfare';

/** A held drum roll lands with a hit when let go after this long, else it fades out (D203; tuned by ear, U13). */
export const DRUMROLL_LAND_AFTER_SEC = 2;
/** The effects the presenters hold on the remote's D-pad (`padHold`, D203): the drum roll; U178 may add more. */
export const PAD_HOLD_EFFECTS = ['drumroll'] as const;
export type PadHoldEffect = (typeof PAD_HOLD_EFFECTS)[number];

/** The two-level buttons a console holds (`twoLevelHold`, D234): Parlem's press that escalates to Pausa (`hold`) and
 * Aguanta's that escalates to Suspens (`stay`). */
export const TWO_LEVEL_BUTTONS = ['hold', 'stay'] as const;
export type TwoLevelButton = (typeof TWO_LEVEL_BUTTONS)[number];

/** Each slider's highest percent (D157: every one to about 150%, +7 dB; the engine's headroom keeps it clean). */
export const VOLUME_MAX: Readonly<Volumes> = Object.freeze(
  Object.fromEntries(VOLUME_KEYS.map((key) => [key, 150])) as Volumes,
);

/**
 * A slider's percent as decibels against its 100%: an audio taper, gain = (percent / 100)², so 50% is −12 dB,
 * 25% −24 dB, 10% −40 dB, 119% +3 dB, 141% +6 dB, 150% +7 dB; 0% is silence (−Infinity).
 */
export const volumeDb = (percent: number): number => (percent <= 0 ? -Infinity : 40 * Math.log10(percent / 100));
