// The drum's solver (a Spin that lands on a chosen card at a chosen time, and the brakes, glides, coasts and hovers). It
// lives in packages/rules/drum-solver.ts (27 Nov, §8 Y1), shared with the phones, so a phone replays the projector's
// very Spin from its public spinSeed (D237); engine modules keep importing it from here.
export * from '../../../../../packages/rules/drum-solver.ts';
