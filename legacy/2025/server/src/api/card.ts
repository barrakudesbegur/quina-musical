import cards from '../../db/default/cards.json' with { type: 'json' };
import { publicProcedure, router } from '../trpc.js';

export const cardRouter = router({
  getAll: publicProcedure.query(async () => {
    return cards.map((card) => ({
      id: card.id,
      type: card.type,
      lines: card.lines.map((line) => line.map((song) => song.id)),
    }));
  }),
});
