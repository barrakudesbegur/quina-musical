// A sample Game plan for demos and tests. Prizes and sponsors are placeholders: the real ones come from the
// organizers' sheet through Admin's JSON import.
import type { GamePlan } from '../plan.ts';

export const SAMPLE_PLAN: GamePlan = {
  v: 1,
  edition: '26',
  title: 'Quina Musical',
  sponsors: [
    { id: 'patrocinador-1', name: '[Patrocinador 1]', logo: null },
    { id: 'patrocinador-2', name: '[Patrocinador 2]', logo: null },
    { id: 'barrakudes', name: 'Barrakudes', logo: null },
  ],
  rounds: Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    kind: i === 6 ? ('special' as const) : ('normal' as const),
    line: { title: `[Premi de línia ${i + 1}]`, detail: null, sponsorId: i % 2 ? 'patrocinador-2' : 'patrocinador-1', image: null },
    bingo: { title: `[Premi de quina ${i + 1}]`, detail: null, sponsorId: i === 7 ? 'barrakudes' : 'patrocinador-1', image: null },
  })),
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 },
  cheatSheet: {
    claimRules: [
      'Guanya el primer que canta. Si dos canten amb la mateixa cançó, es reparteixen el premi.',
      'Si algú canta tard i ningú més ha cantat, guanya igualment.',
      "Un premi que ningú canta es perd.",
    ],
    specialRoundRules: ['Només compten els cartrons especials.'],
  },
};
