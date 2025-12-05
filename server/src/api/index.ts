import { router } from '../trpc.js';
import { gameRouter } from './game.js';
import { songRouter } from './song.js';

export const appRouter = router({
  game: gameRouter,
  song: songRouter,
});

export type AppRouter = typeof appRouter;
