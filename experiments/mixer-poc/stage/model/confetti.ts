// Confetti pieces for the Celebration (ANIMATIONS.md `celebrate`): where each piece starts, when, how it
// drifts and which palette tone it takes. The look and the fall are CSS; this only draws the numbers from an
// injected random source. Pure.

export interface ConfettiPiece {
  /** Burst number (0, 1…): a Bingo's second burst starts when the first has fallen. */
  burst: number;
  /** 0..1 across the box. */
  x: number;
  /** 0..1 of the burst's spread. */
  delay: number;
  /** -1..1 sideways drift. */
  drift: number;
  /** 0..1 of a turn, and the spin while falling. */
  turn: number;
  /** Palette tone index, 0..tones-1. */
  tone: number;
  /** 0..1 size variation. */
  size: number;
}

export function confettiPieces(bursts: readonly number[], tones: number, random: () => number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  const r = () => Math.min(0.999999, Math.max(0, random()));
  bursts.forEach((count, burst) => {
    for (let i = 0; i < count; i++) {
      pieces.push({
        burst,
        x: r(),
        delay: r(),
        drift: r() * 2 - 1,
        turn: r(),
        tone: Math.floor(r() * Math.max(1, tones)),
        size: r(),
      });
    }
  });
  return pieces;
}
