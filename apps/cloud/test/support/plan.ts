// A small, valid Game plan for edition 26 (protocol/plan.ts, v2), for the tests. Each round names its card type
// (a card-types.json id), so checkGamePlan gives the plan back unchanged. Round 2's prizes are the secret
// ones: with `perRound`, phones see them only once round 2 is revealed.
import type { GamePlan } from '@quina/protocol';

export const SECRET_PRIZE = 'Pernil de la ronda especial';

export const PLAN: GamePlan = {
  v: 2,
  edition: '26',
  title: 'Quina Musical',
  prizeReveal: 'perRound',
  rounds: [
    {
      number: 1,
      kind: 'normal',
      cardType: 'normal',
      line: [{ title: 'Sopar per a dos', detail: null, sponsorId: 'forn', image: null, headline: true }],
      bingo: [
        { title: 'Cistella de Nadal', detail: 'Productes locals', sponsorId: null, image: null, headline: true },
        { title: 'Samarreta', detail: null, sponsorId: null, image: null, headline: false },
      ],
    },
    { number: 2, kind: 'special', cardType: 'especial', line: [], bingo: [{ title: SECRET_PRIZE, detail: null, sponsorId: 'forn', image: null, headline: true }] },
  ],
  sponsors: [{ id: 'forn', name: 'Forn de la plaça', logo: null }],
  cardTypes: [],
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 10 },
  cheatSheet: { claimRules: ['El primer que canta guanya'], specialRoundRules: ['Només compten els cartons especials'] },
};
