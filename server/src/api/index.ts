import { router } from '../trpc.js';
import { cardRouter } from './card.js';
import { gameRouter } from './game.js';
import { healthRouter } from './health.js';
import { songRouter } from './song.js';

export const appRouter = router({
  card: cardRouter,
  game: gameRouter,
  song: songRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
