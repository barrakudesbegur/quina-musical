import playlist from '../../db/default/playlist.json' with { type: 'json' };
import { gameDb } from '../db/game.js';
import { publicProcedure, router } from '../trpc.js';

export const songRouter = router({
  getAll: publicProcedure.query(async () => {
    return gameDb.data.songs;
  }),
  getPlaylist: publicProcedure.query(async () => {
    return playlist;
  }),
});
