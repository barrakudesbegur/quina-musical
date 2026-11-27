// The console's ring looks table (components-v2.md E1 and § 11; D210): each show state of logic/now-ring.ts as the
// generic Ring's props. The ring says what the show is doing about the next song; the concepts' colours come from
// packages/ui/concepts.ts (the Hold cyan, the Stay purple, the Suspense gold, Següent orange, a Check green). Pure.
import { CONCEPTS } from '../../packages/ui/concepts.ts';
import type { RingBadgeLook, RingColor, RingLook } from '../../packages/ui/components/types.ts';
import type { RingBadge, RingState } from './logic/now-ring.ts';
import { S } from './strings.ts';

const next = CONCEPTS.next.color as RingColor;

export const RING_LOOKS = {
  auto: { arc: 'progress', color: next, face: 'number' },
  autoLast: { arc: 'progress', color: 'red', face: 'number', halo: true, tick: true },
  spinning: { arc: 'segments', color: next, face: 'record' },
  suspense: { arc: 'progress', color: CONCEPTS.suspense.color as RingColor, face: 'icon', icon: 'drum', bold: true },
  manual: { arc: 'none', color: next, face: 'disc', icon: 'skip', pulse: true },
  manualFinal: { arc: 'none', color: next, face: 'disc', icon: 'skip', pulse: true },
  lastStanding: { arc: 'none', color: next, face: 'disc', icon: 'rosette', pulse: true },
  finaleWinner: { arc: 'none', color: next, face: 'disc', icon: 'star', pulse: true },
  talk: { arc: 'full', color: CONCEPTS.hold.color as RingColor, face: 'bars' },
  stay: { arc: 'full', color: CONCEPTS.stay.color as RingColor, face: 'bars' },
  checking: { arc: 'none', color: CONCEPTS.claim.color as RingColor, face: 'disc', icon: 'rosette', iconLarge: true },
  checkFailed: { arc: 'none', color: 'red', face: 'disc', icon: 'close' },
  paused: { arc: 'full', color: 'gold', face: 'bars', pattern: 'hazard' },
  waiting: { arc: 'none', color: next, face: 'number' },
} as const satisfies Record<RingState, RingLook>;

/** The corner badge: the auto-advance mode, or the kind of wait. */
export const RING_BADGES = {
  auto: { icon: 'cycle', color: 'green', label: S.nowPlaying.ring.badge.auto },
  autoOff: { icon: 'cycle-off', color: 'periwinkle', label: S.nowPlaying.ring.badge.autoOff },
  final: { icon: 'flag', color: 'red', label: S.nowPlaying.ring.badge.final },
  talk: { icon: 'mic', color: 'cyan', label: S.nowPlaying.ring.badge.talk },
  stay: { icon: 'hand', color: 'purple', label: S.nowPlaying.ring.badge.stay },
  held: { icon: 'pause', color: 'ink', label: S.nowPlaying.ring.badge.held },
} as const satisfies Record<NonNullable<RingBadge>, RingBadgeLook>;
