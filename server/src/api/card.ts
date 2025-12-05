import cards from '../../db/default/cards.json' with { type: 'json' };
import { publicProcedure, router } from '../trpc.js';

export const cardRouter = router({
  getAll: publicProcedure.query(async () => {
    return cards;
  }),
});
