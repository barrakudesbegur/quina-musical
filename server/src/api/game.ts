import { z } from 'zod'
import { publicProcedure, router } from '../trpc.js'
import songs from '../../db/default/songs.json' with { type: 'json' }

interface PlayedSong {
  id: string
  position: number
  playedAt: number
}

interface Round {
  name: string
  position: number
  playedSongs: PlayedSong[]
  finishedAt?: number
}

// Store current and past rounds
const pastRounds: Round[] = []
let currentRound: Round | null = null

// Initialize first round
if (!currentRound) {
  currentRound = {
    name: '1',
    position: 1,
    playedSongs: [],
  }
}

export const gameRouter = router({
  getStatus: publicProcedure.query(async () => {
    return {
      status: 'ongoing' as 'not-started' | 'ongoing' | 'paused' | 'finished',
    }
  }),
  getState: publicProcedure.query(async () => {
    if (!currentRound) {
      return {
        round: null,
        playedSongs: [],
      }
    }

    const playedSongs = currentRound.playedSongs
      .map((played) => {
        const song = songs.find((s) => s.id === played.id)
        if (!song) return null
        return {
          ...song,
          position: played.position,
        }
      })
      .filter((song) => song !== null)
      // Sort in descending order (newest first)
      .sort((a, b) => b.position - a.position)

    return {
      round: {
        name: currentRound.name,
        position: currentRound.position,
      },
      playedSongs,
    }
  }),
  getAllSongs: publicProcedure.query(async () => {
    if (!currentRound) return []

    return songs
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((song) => {
        const played = currentRound?.playedSongs.find((p) => p.id === song.id)
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
      if (!currentRound) return

      const alreadyPlayed = currentRound.playedSongs.some(
        (p) => p.id === input.songId
      )
      if (!alreadyPlayed) {
        currentRound.playedSongs.push({
          id: input.songId,
          position: currentRound.playedSongs.length + 1,
          playedAt: Date.now(),
        })
      }
    }),
  undoLastPlayed: publicProcedure.mutation(async () => {
    if (!currentRound) return
    if (currentRound.playedSongs.length > 0) {
      currentRound.playedSongs.pop()
    }
  }),
  getCurrentRound: publicProcedure.query(async () => {
    return currentRound
  }),
  updateRoundName: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      if (!currentRound) return
      currentRound.name = input.name
    }),
  finishRound: publicProcedure
    .input(
      z.object({
        nextRoundName: z.string(),
        isLastRound: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      if (!currentRound) return

      // Store current round in past rounds
      pastRounds.push({
        ...currentRound,
        finishedAt: Date.now(),
      })

      // TODO: Implement later
      // if (input.isLastRound) {
      //   currentRound = null
      //   return
      // }

      currentRound = {
        name: input.nextRoundName,
        position: currentRound.position + 1,
        playedSongs: [],
      }
    }),
  getPastRounds: publicProcedure.query(async () => {
    return pastRounds
  }),
})
