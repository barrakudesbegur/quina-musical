// A small, valid Game plan for edition 26 (protocol/plan.ts), for the tests.
import type { GamePlan } from '@quina/protocol';

export const PLAN: GamePlan = {
  v: 1,
  edition: '26',
  title: 'Quina Musical',
  rounds: [
    { number: 1, kind: 'normal', line: { title: 'Sopar per a dos', detail: null, sponsorId: 'forn', image: null }, bingo: { title: 'Cistella de Nadal', detail: 'Productes locals', sponsorId: null, image: null } },
    { number: 2, kind: 'special', line: null, bingo: { title: 'Pernil', detail: null, sponsorId: 'forn', image: null } },
  ],
  sponsors: [{ id: 'forn', name: 'Forn de la plaça', logo: null }],
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 10 },
  cheatSheet: { claimRules: ['El primer que canta guanya'], specialRoundRules: ['Només compten els cartons especials'] },
};
