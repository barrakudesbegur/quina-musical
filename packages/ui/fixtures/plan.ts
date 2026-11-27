// A sample Game plan for demos and tests, shaped like a real night's (docs/event.md "Prizes and sponsors"). The
// prizes are generic and the sponsors placeholders: the real ones come from the organizers' sheet through Admin's
// JSON import, and never live in this public repo.
// - Each Quina wins a hamper of 17–19 prizes: one headline prize (a ham or an appliance; the Quina Especial's is a
//   TV, and the last Quina has two), 12 Christmas staples the club buys, and 4–6 sponsors' vouchers or products.
// - Each Line wins something small: a bottle of white wine, a fuet, neules and a small sponsor's prize.
// - Round 5 is the Quina Desgraciada (one hamper, the last card standing's, and no Line); round 7 the Quina Especial.
// - The sides (D193, as Admin's defaults): the first five normal rounds (Quines 1–5: plan rounds 1–4 and 6) play the
//   normal card's side 1, Quina 6 (plan round 8) its side 2; the especial card's side 1 the Desgraciat, its side 2
//   the Especial (D226).
import { defaultCardType, type RoundKind } from '@quina/protocol';
import type { GamePlan, Prize, Sponsor } from '../plan.ts';

/** The rounds that aren't normal, by number. */
const KINDS: Readonly<Record<number, RoundKind>> = { 5: 'desgraciat', 7: 'special' };

/** Placeholder sponsors: the first two and Barrakudes give the headline prizes, [Patrocinador 3]–[Patrocinador 15] the
 * hampers' vouchers and products, three generic ones the Lines' small prizes, and [Patrocinador 16] money only. */
const SPONSORS: Sponsor[] = [
  { id: 'patrocinador-1', name: '[Patrocinador 1]', logo: null },
  { id: 'patrocinador-2', name: '[Patrocinador 2]', logo: null },
  { id: 'barrakudes', name: 'Barrakudes', logo: null },
  ...Array.from({ length: 13 }, (_, k) => ({ id: `patrocinador-${k + 3}`, name: `[Patrocinador ${k + 3}]`, logo: null })),
  { id: 'forn-del-poble', name: 'Forn del poble', logo: null },
  { id: 'botiga-esports', name: "Botiga d'esports", logo: null },
  { id: 'restaurant-port', name: 'Restaurant del port', logo: null },
  // A money donor: no prize names it, yet the presenters thank it too.
  { id: 'patrocinador-16', name: '[Patrocinador 16]', logo: null },
];

const item = (title: string, sponsorId: string | null = null, detail: string | null = null, headline = false): Prize => ({ title, detail, sponsorId, image: null, headline });

/** What the vouchers and products sponsors give look like: a title and, sometimes, a detail. */
const GIFTS: readonly (readonly [string, string | null])[] = [
  ['Val de 20 €', null],
  ['Pizza i refresc', null],
  ['Sopar per a dos', 'Menú de migdia o de vespre'],
  ['Gorra', null],
  ['Lot de productes', null],
  ['Joc de taula', null],
  ['Pilota de bàsquet', null],
  ['Dues entrades al spa', null],
  ['Tallat de cabell', null],
  ['Val de 30 €', null],
  ['Esmorzar per a dos', null],
  ['Jersei', null],
  ['Gots i gerra de ceràmica', null],
  ['Bossa de roba', null],
  ['Un mes de pàdel', null],
  ['Sabatilles', null],
  ['Val de 50 €', null],
  ['Trencaclosques', null],
  ['Colònia', null],
];

/** The sponsors who give vouchers and products, in turn across the night. */
const GIVERS = SPONSORS.slice(3, 16).map((s) => s.id);

/** `count` sponsors' gifts, starting at `from` in the turn: no two the same within a bundle. */
const gifts = (count: number, from: number): Prize[] =>
  Array.from({ length: count }, (_, k) => {
    const [title, detail] = GIFTS[(from + k) % GIFTS.length];
    return item(title, GIVERS[(from + k) % GIVERS.length], detail);
  });

/** The 12 staples in every hamper (two wines): what the club buys, plus its own T-shirt. Odd rounds' hampers have
 * panettone and oranges, even ones chocolates and a pineapple, as in real hampers. */
const staples = (odd: boolean): Prize[] => [
  item('Xocolata'),
  item(odd ? 'Panettone' : 'Bombons'),
  item('Torró'),
  item('Neules'),
  item('Vi negre'),
  item('Vi blanc'),
  item('Cava'),
  item(odd ? 'Taronges' : 'Pinya'),
  item("Paquet d'arròs"),
  item('Tomàquet'),
  item('Fuet'),
  item('Samarreta de Barrakudes', 'barrakudes'),
];

/** Each Quina's headline prizes, by round number. */
const HEADLINES: Readonly<Record<number, Prize[]>> = {
  1: [item('Pernil', 'patrocinador-1', null, true)],
  2: [item('Cafetera', 'patrocinador-2', null, true)],
  3: [item('Pernil', 'patrocinador-1', null, true)],
  4: [item("Fregidora d'aire", 'patrocinador-2', null, true)],
  5: [item('Pernil', 'patrocinador-2', null, true)],
  6: [item('Auriculars sense fil', 'patrocinador-1', null, true)],
  7: [item('Televisor', 'patrocinador-2', '50 polzades', true)],
  8: [item('Pernil', 'barrakudes', null, true), item('Planxa de cuina', 'patrocinador-2', null, true)],
};

/** How many sponsors' gifts each hamper holds (4–6), by round number. */
const GIFT_COUNTS: Readonly<Record<number, number>> = { 1: 5, 2: 6, 3: 4, 4: 5, 5: 6, 6: 4, 7: 6, 8: 4 };

/** A Line's prize: small, the same staples each time, and a different small sponsor's prize. */
const LINE_GIFTS: readonly (readonly [string, string])[] = [
  ['Pa de pessic', 'forn-del-poble'],
  ['Val de 10 €', 'botiga-esports'],
  ['Coca de vidre', 'forn-del-poble'],
  ['Tassa', 'restaurant-port'],
];
const line = (i: number): Prize[] => [
  item('Ampolla de vi blanc', i % 2 ? 'patrocinador-2' : 'patrocinador-1', null, true),
  item('Fuet'),
  item('Neules'),
  item(...LINE_GIFTS[i % LINE_GIFTS.length]),
];

/** Where each round's gifts start in the turn, so every sponsor and gift comes up across the night. */
const giftsFrom = (number: number): number => Array.from({ length: number - 1 }, (_, k) => GIFT_COUNTS[k + 1]).reduce((a, b) => a + b, 0);

export const SAMPLE_PLAN: GamePlan = {
  v: 3,
  edition: '26',
  title: 'Quina Quina 3',
  prizeReveal: 'perRound',
  sponsors: SPONSORS,
  rounds: Array.from({ length: 8 }, (_, i) => {
    const number = i + 1;
    const kind = KINDS[number] ?? 'normal';
    const hamper = [...HEADLINES[number], ...staples(number % 2 === 1), ...gifts(GIFT_COUNTS[number], giftsFrom(number))];
    // The Desgraciat round has no Line: its one bundle (`bingo`) is the last card standing's prize.
    // Its Quina number: the normal rounds count on their own (the specials have none).
    const quina = Array.from({ length: number }, (_, j) => KINDS[j + 1] ?? 'normal').filter((k) => k === 'normal').length;
    const side = kind === 'special' || (kind === 'normal' && quina > 5) ? 2 : 1;
    return { number, kind, cardType: defaultCardType(kind), side, line: kind === 'desgraciat' ? [] : line(i), bingo: hamper };
  }),
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
