import songs from '../../db/default/songs.json' with { type: 'json' };
import playlist from '../../db/default/playlist.json' with { type: 'json' };
import { publicProcedure, router } from '../trpc.js';

export const songRouter = router({
  getAll: publicProcedure.query(async () => {
    return songs.map((song) => ({
      ...song,
      // TODO: this is temporal until songs are saved in lowdb and already have timestamps
      timestamps: [
        {
          time: 60,
          tag: 'best',
          playEffect: {
            type: 'crossfade',
            durationSeconds: 1,
          },
        },
        {
          time: 90,
          tag: 'main',
          playEffect: {
            type: 'crossfade',
            durationSeconds: 1,
          },
        },
        {
          time: 0,
          tag: 'secondary',
          playEffect: {
            type: 'crossfade',
            durationSeconds: 1,
          },
        },
        {
          time: 150,
          tag: 'secondary',
          playEffect: {
            type: 'crossfade',
            durationSeconds: 1,
          },
        },
      ],
    }));
  }),
  getPlaylist: publicProcedure.query(async () => {
    return playlist;
  }),
});
