// A sample Game plan for demos and tests. Prizes and sponsors are placeholders: the real ones come from the
// organizers' sheet through Admin's JSON import. Each Line and Quina has a bundle: one headline prize (two in
// the last Quina) and a few smaller ones.
import { defaultCardType } from '@quina/protocol';
import { DEFAULT_CARD_TYPES, type GamePlan, type Prize } from '../plan.ts';

const SPONSORS = ['patrocinador-1', 'patrocinador-2', null] as const;

/** The smaller prizes of a bundle: `count` of them, sponsors in turn. */
const smallPrizes = (label: string, count: number, offset: number): Prize[] =>
  Array.from({ length: count }, (_, k) => ({ title: `[Obsequi ${k + 1} ${label}]`, detail: null, sponsorId: SPONSORS[(k + offset) % SPONSORS.length], image: null, headline: false }));

export const SAMPLE_PLAN: GamePlan = {
  v: 2,
  edition: '26',
  title: 'Quina Quina 3',
  prizeReveal: 'perRound',
  sponsors: [
    { id: 'patrocinador-1', name: '[Patrocinador 1]', logo: null },
    { id: 'patrocinador-2', name: '[Patrocinador 2]', logo: null },
    { id: 'barrakudes', name: 'Barrakudes', logo: null },
  ],
  // Deprecated (card-types.json has the types now): kept only while plans still carry it.
  cardTypes: DEFAULT_CARD_TYPES.map((c) => ({ ...c, rounds: [...c.rounds] })),
  rounds: Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    kind: i === 6 ? ('special' as const) : ('normal' as const),
    cardType: defaultCardType(i === 6 ? 'special' : 'normal'),
    line: [
      { title: `[Premi de línia ${i + 1}]`, detail: null, sponsorId: i % 2 ? 'patrocinador-2' : 'patrocinador-1', image: null, headline: true },
      ...smallPrizes(`de la línia ${i + 1}`, 2 + (i % 3), i),
    ],
    bingo: [
      { title: `[Premi de quina ${i + 1}]`, detail: null, sponsorId: i === 7 ? 'barrakudes' : 'patrocinador-1', image: null, headline: true },
      ...(i === 7 ? [{ title: '[Gran premi final]', detail: null, sponsorId: 'patrocinador-2', image: null, headline: true }] : []),
      ...smallPrizes(`de la quina ${i + 1}`, 3 + (i % 2), i + 1),
    ],
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
