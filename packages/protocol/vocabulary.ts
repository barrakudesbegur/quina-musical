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
/** Why the show is in a Hold. `claim`: a Claim is being checked (also through the Celebration);
 * `checkFailed`: every claim of the last Check was invalid (error Hold music until Resume). */
export type HoldReason = 'hold' | 'back' | 'cancel' | 'end' | 'music' | 'claim' | 'checkFailed';
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
/** The card type a round plays when nothing says otherwise: normal cards in normal rounds, especial in the special one. */
export const DEFAULT_CARD_TYPE: Readonly<Record<RoundKind, string>> = Object.freeze({ normal: 'normal', special: 'especial', desgraciat: 'normal' });
/** The card type a round of this kind plays unless the plan picks another (an older journal or plan has none). */
export const defaultCardType = (kind: RoundKind): string => DEFAULT_CARD_TYPE[kind] ?? DEFAULT_CARD_TYPE.normal;
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

/** A Claim's progress: waiting, its Check running, checked (awaiting the presenters), then their verdict. */
export type ClaimStatus = 'queued' | 'checking' | 'checked' | 'valid' | 'invalid';
/**
 * What the engine found. The Check's result decides (docs/event.md): presenters may reject a card that passed, never
 * accept one that failed (isPassingOutcome). A 'standing' claim (the Desgraciat round) is `complete` while none of
 * the card's songs counted, `fellLast` when its first landed song is the latest landing (it sat down with the song
 * that just landed: it passes, so the last players standing who all sit on the same song can share the win), and
 * `fallen` when it fell on an earlier song.
 */
export type CheckOutcome = 'complete' | 'incomplete' | 'fellLast' | 'fallen' | 'unknownCard' | 'wrongType';
export const CHECK_OUTCOMES = ['complete', 'incomplete', 'fellLast', 'fallen', 'unknownCard', 'wrongType'] as const satisfies readonly CheckOutcome[];
/** Whether a card with this Check result may be accepted: `complete`, or `fellLast` for a 'standing' claim. */
export const isPassingOutcome = (outcome: CheckOutcome | null | undefined, kind: WinKind): boolean =>
  outcome === 'complete' || (outcome === 'fellLast' && kind === 'standing');
/** Only a warning: the card is not among the cards in play. */
export type ClaimWarning = 'notSold';
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
/** The Pace a round starts with, unless the presenters locked theirs: last year's medians. */
export const PACE_DEFAULT_SEC = Object.freeze({ firstRound: 22, laterRounds: 14 });
/** The Pace a round starts with (1-based round number). */
export const defaultPaceSec = (round: number): number => (round <= 1 ? PACE_DEFAULT_SEC.firstRound : PACE_DEFAULT_SEC.laterRounds);

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
  'unknownSfx', 'unknownCommand', 'noSuspense', 'wrongScene', 'unknownClaim', 'cannotResume', 'failedCheck',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Who is connected to the relay. `cloud` is the laptop's cloud link (a Node sidecar next to the relay, cloud/laptop/):
 * a remote that keeps a copy of the Game journal and uploads it to the cloud. */
export const ROLES = ['show', 'admin', 'tablet', 'drum', 'cloud'] as const;
export type Role = (typeof ROLES)[number];
