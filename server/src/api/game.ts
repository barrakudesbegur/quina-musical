import { z } from 'zod'
import { publicProcedure, router } from '../trpc.js'
import songs from '../../db/default/songs.json' with { type: 'json' }

interface PlayedSong {
  id: string
  position: number
  playedAt: number
}

// Store played songs with their position
const playedSongs: PlayedSong[] = []

export const gameRouter = router({
  getStatus: publicProcedure.query(async () => {
    return {
      status: 'ongoing' as 'not-started' | 'ongoing' | 'paused' | 'finished',
    }
  }),
  getState: publicProcedure.query(async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    // const count = Math.floor((nowSeconds / 2) % songs.length)
    const count = 50
    const playedSongs = songs
      .slice(0, count)
      .map((song, index) => ({
        ...song,
        position: index + 1,
      }))
      // Sort in descending order
      .sort((a, b) => b.position - a.position)

    return {
      round: {
        name: '12',
        position: 12,
      },
      playedSongs,
    }
  }),
  getAllSongs: publicProcedure.query(async () => {
    return songs
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((song) => {
        const played = playedSongs.find((p) => p.id === song.id)
        return {
          ...song,
          isPlayed: !!played,
          playedPosition: played?.position,
        }
      })
  }),
  playSong: publicProcedure
    .input(z.object({ songId: z.string() }))
    .mutation(async ({ input }) => {
      const alreadyPlayed = playedSongs.some((p) => p.id === input.songId)
      if (!alreadyPlayed) {
        playedSongs.push({
          id: input.songId,
          position: playedSongs.length + 1,
          playedAt: Date.now(),
        })
      }
    }),
  undoLastPlayed: publicProcedure.mutation(async () => {
    if (playedSongs.length > 0) {
      playedSongs.pop()
    }
  }),
})
