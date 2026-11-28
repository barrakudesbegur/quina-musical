// A small, valid Game plan for edition 26 (protocol/plan.ts, v3), for the tests. Each round names its card type
// (a card-types.json id), so checkGamePlan gives the plan back unchanged. Round 2's prizes are the secret
// ones: with `perRound`, phones see them only once round 2 is revealed.
import type { GamePlan } from '@quina/protocol';

export const SECRET_PRIZE = 'Pernil de la ronda especial';

export const PLAN: GamePlan = {
  v: 3,
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
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 10 },
  cheatSheet: { claimRules: ['El primer que canta guanya'], specialRoundRules: ['Només compten els cartons especials'] },
};

/**
 * Save a plan as Admin does: read the version there now (GET /api/plan), then PUT based on it
 * (`x-quina-plan-base`). The response, as fetch gives it.
 */
export async function savePlan(origin: string, plan: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const got = (await (await fetch(`${origin}/api/plan`, { headers })).json()) as { savedAtMs: number | null };
  const base = got.savedAtMs === null ? 'none' : String(got.savedAtMs);
  return fetch(`${origin}/api/plan`, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json', 'x-quina-plan-base': base }, body: JSON.stringify(plan) });
}
