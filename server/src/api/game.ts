import { EventEmitter, on } from 'events';
import { z } from 'zod';
import songs from '../../db/default/songs.json' with { type: 'json' };
import cards from '../../db/default/cards.json' with { type: 'json' };
import { gameDb, Round } from '../db/game.js';
import { publicProcedure, router } from '../trpc.js';
import { shuffleArrayWithSeed } from '../utils/arrays.js';

const gameEventEmitter = new EventEmitter();
gameEventEmitter.setMaxListeners(Infinity);

export const gameRouter = router({
  getStatus: publicProcedure.subscription(async function* ({ signal }) {
    const getStatus = () => ({
      status: gameDb.chain.get('finishedAt').value()
        ? ('finished' as const)
        : !gameDb.chain.get('currentRound').value()
          ? ('not-started' as const)
          : ('ongoing' as const),
    });

    yield getStatus();

    for await (const [_] of on(gameEventEmitter, 'update', { signal })) {
      yield getStatus();
    }
  }),

  getState: publicProcedure.query(async () => {
    if (!gameDb.data.currentRound) {
      return {
        round: null,
        playedSongs: [],
      };
    }

    const playedSongs = gameDb.chain
      .get('currentRound.playedSongs')
      .map((played) => {
        const song = songs.find((s) => s.id === played.id);
        if (!song) return null;
        return {
          ...song,
          position: played.position,
        };
      })
      .filter((song) => song !== null)
      .orderBy(['position'], ['desc'])
      .value();

    return {
      round: {
        name: gameDb.data.currentRound.name,
        position: gameDb.data.currentRound.position,
      },
      playedSongs,
    };
  }),

  getAllSongs: publicProcedure.query(async () => {
    if (!gameDb.data.currentRound) return [];

    const shuffledSongsWithoutPlayed = gameDb.data.currentRound.shuffledSongs
      .toSorted((a, b) => a.position - b.position)
      .filter(
        (song) =>
          !gameDb.data.currentRound ||
          !gameDb.data.currentRound.playedSongs.some((p) => p.id === song.id)
      )
      .map((song, index) => ({
        ...song,
        expectedPlayedPosition:
          index + 1 + (gameDb.data.currentRound?.playedSongs.length ?? 0),
      }));

    return songs
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((song) => {
        const played = gameDb.data.currentRound?.playedSongs.find(
          (p) => p.id === song.id
        );
        return {
          ...song,
          isPlayed: !!played,
          playedPosition: played?.position,
          expectedPlayedPosition:
            played?.position ??
            shuffledSongsWithoutPlayed.find((p) => p.id === song.id)
              ?.expectedPlayedPosition,
        };
      });
  }),

  getCardsPlaying: publicProcedure.query(async () => {
    return gameDb.data.cardsPlaying;
  }),

  updateCardsPlaying: publicProcedure
    .input(z.object({ cardIds: z.array(z.number().positive()) }))
    .mutation(async ({ input }) => {
      gameDb.data.cardsPlaying = input.cardIds.filter((id) =>
        cards.some((c) => c.id === id)
      );
      await gameDb.write();
    }),

  playSong: publicProcedure
    .input(z.object({ songId: z.number().min(1).optional() }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;

      const songId =
        input.songId ??
        gameDb.data.currentRound.shuffledSongs
          .toSorted((a, b) => a.position - b.position)
          .find(
            (song) =>
              !gameDb.data.currentRound?.playedSongs.some(
                (p) => p.id === song.id
              )
          )?.id;
      if (!songId) return;

      const alreadyPlayed = gameDb.data.currentRound.playedSongs.some(
        (p) => p.id === songId
      );
      if (alreadyPlayed) return;

      gameDb.data.currentRound.playedSongs.push({
        id: songId,
        position: gameDb.data.currentRound.playedSongs.length + 1,
        playedAt: new Date().toISOString(),
      });
      await gameDb.write();
      emitUpdate();
    }),

  undoLastPlayed: publicProcedure.mutation(async () => {
    if (!gameDb.data.currentRound) return;
    if (gameDb.data.currentRound.playedSongs.length > 0) {
      gameDb.data.currentRound.playedSongs.pop();
      await gameDb.write();
      emitUpdate();
    }
  }),

  getCurrentRound: publicProcedure.query(async () => {
    return gameDb.data.currentRound;
  }),

  updateRoundName: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;
      gameDb.data.currentRound.name = input.name;
      await gameDb.write();
      emitUpdate();
    }),

  updatePlaybackMode: publicProcedure
    .input(z.object({ playbackMode: z.enum(['manual', 'auto']) }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;
      gameDb.data.currentRound.playbackMode = input.playbackMode;
      await gameDb.write();
      emitUpdate();
    }),

  finishRound: publicProcedure
    .input(
      z.object({
        nextRoundName: z.string(),
        isLastRound: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;

      const now = new Date().toISOString();

      gameDb.data.pastRounds.push({
        ...gameDb.data.currentRound,
        finishedAt: now,
      });

      if (input.isLastRound) {
        gameDb.data.finishedAt = now;
        gameDb.data.currentRound = null;
      } else {
        const position = gameDb.data.currentRound.position + 1;

        gameDb.data.currentRound = {
          name: input.nextRoundName,
          position,
          startedAt: now,
          finishedAt: null,
          shuffledSongs: shuffleSongs(now),
          playedSongs: [],
          playbackMode: 'auto',
        };
      }

      await gameDb.write();
      emitUpdate();
    }),

  resumeGame: publicProcedure.mutation(async () => {
    if (gameDb.data.currentRound) {
      throw new Error('Game is already in progress');
    }

    const now = new Date().toISOString();
    const position = gameDb.data.pastRounds.length + 1;

    gameDb.data.finishedAt = null;

    gameDb.data.currentRound = {
      name: `${position}`,
      position,
      startedAt: now,
      finishedAt: null,
      shuffledSongs: shuffleSongs(now),
      playedSongs: [],
      playbackMode: 'auto',
    };

    await gameDb.write();
    emitUpdate();
  }),

  getPastRounds: publicProcedure.query(async () => {
    return gameDb.data.pastRounds;
  }),

  startGame: publicProcedure.mutation(async () => {
    if (gameDb.data.currentRound) return;

    const now = new Date().toISOString();

    if (!gameDb.data.startedAt) {
      gameDb.data.startedAt = now;
    }

    const position = gameDb.data.pastRounds.length + 1;

    gameDb.data.finishedAt = null;
    gameDb.data.currentRound = {
      name: `${position}`,
      position,
      startedAt: now,
      finishedAt: null,
      shuffledSongs: shuffleSongs(now),
      playedSongs: [],
      playbackMode: 'auto',
    };

    await gameDb.write();
    emitUpdate();
  }),

  onStateChange: publicProcedure.subscription(async function* ({ signal }) {
    const getState = () => {
      return !gameDb.data.currentRound
        ? { round: null, playedSongs: [] }
        : {
            round: {
              name: gameDb.data.currentRound.name,
              position: gameDb.data.currentRound.position,
            },
            playedSongs: gameDb.chain
              .get('currentRound.playedSongs')
              .map((played) => {
                const song = songs.find((s) => s.id === played.id);
                if (!song) return null;
                return { ...song, position: played.position };
              })
              .filter((song) => song !== null)
              .orderBy(['position'], ['desc'])
              .value(),
          };
    };

    // Emit initial state
    yield getState();

    // Listen for updates
    for await (const [_] of on(gameEventEmitter, 'update', { signal })) {
      yield getState();
    }
  }),
});

const emitUpdate = () => gameEventEmitter.emit('update');

function shuffleSongs(seed: string) {
  return shuffleArrayWithSeed(
    songs.map((song) => song.id),
    seed
  ).map((id, index) => ({
    id,
    position: index + 1,
  })) satisfies Round['shuffledSongs'];
}
