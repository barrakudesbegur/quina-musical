import { z } from 'zod'
import { publicProcedure, router } from '../trpc.js'
import songs from '../../db/default/songs.json' with { type: 'json' }
import { gameDb } from '../db/game.js'

export const gameRouter = router({
  getStatus: publicProcedure.query(async () => {
    return {
      status: gameDb.chain.get('finishedAt').value()
        ? ('finished' as const)
        : !gameDb.chain.get('currentRound').value()
          ? ('not-started' as const)
          : ('ongoing' as const),
    }
  }),

  getState: publicProcedure.query(async () => {
    if (!gameDb.data.currentRound) {
      return {
        round: null,
        playedSongs: [],
      }
    }

    const playedSongs = gameDb.chain
      .get('currentRound.playedSongs')
      .map((played) => {
        const song = songs.find((s) => s.id === played.id)
        if (!song) return null
        return {
          ...song,
          position: played.position,
        }
      })
      .filter((song) => song !== null)
      .orderBy(['position'], ['desc'])
      .value()

    return {
      round: {
        name: gameDb.data.currentRound.name,
        position: gameDb.data.currentRound.position,
      },
      playedSongs,
    }
  }),

  getAllSongs: publicProcedure.query(async () => {
    if (!gameDb.data.currentRound) return []

    return songs
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((song) => {
        const played = gameDb.data.currentRound?.playedSongs.find(
          (p) => p.id === song.id
        )
        return {
          ...song,
          isPlayed: !!played,
          playedPosition: played?.position,
        }
      })
  }),

  playSong: publicProcedure
    .input(z.object({ songId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return

      const alreadyPlayed = gameDb.data.currentRound.playedSongs.some(
        (p) => p.id === input.songId
      )
      if (!alreadyPlayed) {
        gameDb.data.currentRound.playedSongs.push({
          id: input.songId,
          position: gameDb.data.currentRound.playedSongs.length + 1,
          playedAt: Date.now(),
        })
        await gameDb.write()
      }
    }),

  undoLastPlayed: publicProcedure.mutation(async () => {
    if (!gameDb.data.currentRound) return
    if (gameDb.data.currentRound.playedSongs.length > 0) {
      gameDb.data.currentRound.playedSongs.pop()
      await gameDb.write()
    }
  }),

  getCurrentRound: publicProcedure.query(async () => {
    return gameDb.data.currentRound
  }),

  updateRoundName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return
      gameDb.data.currentRound.name = input.name
      await gameDb.write()
    }),

  finishRound: publicProcedure
    .input(
      z.object({
        nextRoundName: z.string().optional(),
        isLastRound: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return

      const now = Date.now()

      gameDb.data.pastRounds.push({
        ...gameDb.data.currentRound,
        finishedAt: now,
      })

      if (input.isLastRound) {
        gameDb.data.finishedAt = now
        gameDb.data.currentRound = null
      } else {
        const position = gameDb.data.currentRound.position + 1

        gameDb.data.currentRound = {
          name: input.nextRoundName || `${position}`,
          position,
          startedAt: now,
          playedSongs: [],
        }
      }

      await gameDb.write()
    }),

  resumeGame: publicProcedure.mutation(async () => {
    if (gameDb.data.currentRound) {
      throw new Error('Game is already in progress')
    }

    const now = Date.now()
    const position = gameDb.data.pastRounds.length + 1

    gameDb.data.finishedAt = null

    gameDb.data.currentRound = {
      name: `${position}`,
      position,
      startedAt: now,
      playedSongs: [],
    }

    await gameDb.write()
  }),

  getPastRounds: publicProcedure.query(async () => {
    return gameDb.data.pastRounds
  }),

  startGame: publicProcedure.mutation(async ({ input }) => {
    if (gameDb.data.currentRound) return

    const now = Date.now()

    if (!gameDb.data.startedAt) {
      gameDb.data.startedAt = now
    }

    const position = gameDb.data.pastRounds.length + 1

    gameDb.data.finishedAt = null
    gameDb.data.currentRound = {
      name: `${position}`,
      position,
      startedAt: now,
      playedSongs: [],
    }

    await gameDb.write()
  }),
})
