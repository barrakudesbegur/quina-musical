import songs from '../../db/default/songs.json' with { type: 'json' };
import playlist from '../../db/default/playlist.json' with { type: 'json' };
import { publicProcedure, router } from '../trpc.js';

export const songRouter = router({
  getAll: publicProcedure.query(async () => {
    return songs;
  }),
  getPlaylist: publicProcedure.query(async () => {
    return playlist;
  }),
});
