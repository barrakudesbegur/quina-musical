import { EventEmitter, on } from 'events';
import { z } from 'zod';
import cards from '../../db/default/cards.json' with { type: 'json' };
import { gameDb, Round, SongTimestamp } from '../db/game.js';
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

  getStatusNow: publicProcedure.query(async () => {
    return {
      status: gameDb.chain.get('finishedAt').value()
        ? ('finished' as const)
        : !gameDb.chain.get('currentRound').value()
          ? ('not-started' as const)
          : ('ongoing' as const),
    };
  }),

  getAllSongs: publicProcedure.query(async () => {
    if (!gameDb.data.currentRound) return [];

    return gameDb.data.songs
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((song) => {
        const played = gameDb.data.currentRound?.playedSongs.find(
          (p) => p.id === song.id
        );
        const songInQueue = gameDb.data.currentRound?.songsQueue?.find(
          (p) => p.id === song.id
        );
        if (!played && !songInQueue) {
          console.error(`Song ${song.id} is not played not in queue.`);
        }
        return {
          ...song,
          timestamps: song.timestamps,
          playedAt: played?.playedAt ?? null,
          isPlayed: !!played,
          isLastPlayed:
            !!played &&
            gameDb.data.currentRound &&
            song.id === gameDb.data.currentRound.playedSongs.at(-1)?.id,
          position: played?.position ?? songInQueue?.overallPosition ?? 999999,
          positionInQueue: songInQueue?.position ?? null,
        };
      });
  }),

  getCardsPlaying: publicProcedure.query(async () => {
    return gameDb.data.cardsPlaying;
  }),

  updateCardsPlaying: publicProcedure
    .input(z.object({ cardIds: z.array(z.number().nonnegative()) }))
    .mutation(async ({ input }) => {
      gameDb.data.cardsPlaying = input.cardIds.filter((id) =>
        cards.some((c) => c.id === id)
      );
      await gameDb.write();
    }),

  showImage: publicProcedure
    .input(z.object({ imageId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      gameDb.data.displayedImageId = input.imageId;
      await gameDb.write();
      emitUpdate();
    }),

  setRoundImage: publicProcedure
    .input(z.object({ imageId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;
      gameDb.data.currentRound.imageId = input.imageId;
      await gameDb.write();
      emitUpdate();
    }),

  playSong: publicProcedure
    .input(z.object({ songId: z.number().min(1).optional() }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;

      const songId = input.songId ?? gameDb.data.currentRound.songsQueue[0]?.id;
      if (!songId) return;

      const songInfo = gameDb.data.songs.find((s) => s.id === songId);
      if (!songInfo) {
        throw new Error(
          `Song ${songId} cannot play because it is not a valid song id.`
        );
      }

      const alreadyPlayed = gameDb.data.currentRound.playedSongs.some(
        (p) => p.id === songId
      );
      if (alreadyPlayed) {
        throw new Error(
          `Song ${songId} cannot play because it has already been played.`
        );
      }

      const now = new Date().toISOString();

      if (gameDb.data.currentRound.playedSongs.length === 0) {
        gameDb.data.currentRound.startedAt = now;
      }

      const newPlayedSong = {
        id: songId,
        position: gameDb.data.currentRound.playedSongs.length + 1,
        playedAt: now,
      } satisfies (typeof gameDb.data.currentRound.playedSongs)[number];

      gameDb.data.currentRound.playedSongs.push(newPlayedSong);

      const indexInQueue = gameDb.data.currentRound.songsQueue.findIndex(
        (s) => s.id === songId
      );
      if (indexInQueue !== -1) {
        gameDb.data.currentRound.songsQueue =
          gameDb.data.currentRound.songsQueue
            .toSpliced(indexInQueue, 1)
            .map((song, index) => ({
              ...song,
              position: index + 1,
              overallPosition: newPlayedSong.position + index + 1,
            }));
      }

      await gameDb.write();
      emitUpdate();
    }),

  undoLastPlayed: publicProcedure.mutation(async () => {
    if (!gameDb.data.currentRound) return;
    if (gameDb.data.currentRound.playedSongs.length > 0) {
      const lastPlayedSong = gameDb.data.currentRound.playedSongs.pop();
      if (!lastPlayedSong) return;

      if (gameDb.data.currentRound.playedSongs.length === 0) {
        gameDb.data.currentRound.startedAt = null;
      }

      gameDb.data.currentRound.songsQueue.unshift({
        id: lastPlayedSong.id,
        position: 1,
        overallPosition: lastPlayedSong.position,
      });
      gameDb.data.currentRound.songsQueue =
        gameDb.data.currentRound.songsQueue.map((song, index) => ({
          ...song,
          position: index + 1,
          overallPosition: lastPlayedSong.position + index,
        }));

      await gameDb.write();
      emitUpdate();
    }
  }),

  setQueueOrder: publicProcedure
    .input(z.object({ songIds: z.array(z.number().min(1)).min(1) }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;

      const existingIds = gameDb.data.currentRound.songsQueue.map((s) => s.id);
      const incomingIds = input.songIds;

      if (
        existingIds.length !== incomingIds.length ||
        !incomingIds.every((id) => existingIds.includes(id))
      ) {
        throw new Error('Queue order is invalid or missing songs');
      }

      const playedCount = gameDb.data.currentRound.playedSongs.length;

      gameDb.data.currentRound.songsQueue = incomingIds.map((id, index) => ({
        id,
        position: index + 1,
        overallPosition: playedCount + index + 1,
      }));

      await gameDb.write();
      emitUpdate();
    }),

  getCurrentRound: publicProcedure.query(async () => {
    return gameDb.data.currentRound;
  }),

  getStartedAt: publicProcedure.query(async () => {
    return gameDb.data.startedAt;
  }),

  updateRoundName: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;
      gameDb.data.currentRound.name = input.name;
      await gameDb.write();
      emitUpdate();
    }),

  finishRound: publicProcedure
    .input(
      z.object({
        name: z.string(),
        isLastRound: z.boolean(),
        imageId: z.string().nullable(),
        winnerCardIds: z.array(z.int().nonnegative()),
      })
    )
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;

      const now = new Date().toISOString();

      gameDb.data.pastRounds.push({
        ...gameDb.data.currentRound,
        finishedAt: now,
        winnerCardIds: input.winnerCardIds,
      });

      if (input.isLastRound) {
        gameDb.data.finishedAt = now;
        gameDb.data.currentRound = null;
      } else {
        const position = gameDb.data.currentRound.position + 1;

        const shuffledSongs = shuffleSongs(now);

        gameDb.data.currentRound = {
          name: input.name,
          position,
          startedAt: null,
          finishedAt: null,
          shuffledSongs,
          songsQueue: shuffledSongs.map((song) => ({
            ...song,
            overallPosition: song.position,
          })),
          playedSongs: [],
          imageId: input.imageId,
          winnerCardIds: [],
        };

        if (input.imageId) {
          gameDb.data.displayedImageId = input.imageId;
        }
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

    const shuffledSongs = shuffleSongs(now);

    gameDb.data.finishedAt = null;

    gameDb.data.currentRound = {
      name: `${position}`,
      position,
      startedAt: null,
      finishedAt: null,
      shuffledSongs,
      songsQueue: shuffledSongs.map((song) => ({
        ...song,
        overallPosition: song.position,
      })),
      playedSongs: [],
      imageId: null,
      winnerCardIds: [],
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

    const shuffledSongs = shuffleSongs(now);

    gameDb.data.finishedAt = null;
    gameDb.data.currentRound = {
      name: `${position}`,
      position,
      startedAt: null,
      finishedAt: null,
      shuffledSongs,
      songsQueue: shuffledSongs.map((song) => ({
        ...song,
        overallPosition: song.position,
      })),
      playedSongs: [],
      imageId: null,
      winnerCardIds: [],
    };

    await gameDb.write();
    emitUpdate();
  }),

  onStateChange: publicProcedure.subscription(async function* ({ signal }) {
    const getState = () => {
      return {
        ...(!gameDb.data.currentRound
          ? { round: null, playedSongs: [], roundImageId: null }
          : {
              round: {
                name: gameDb.data.currentRound.name,
                position: gameDb.data.currentRound.position,
              },
              playedSongs: gameDb.chain
                .get('currentRound.playedSongs')
                .map((played) => {
                  const song = gameDb.data.songs.find(
                    (s) => s.id === played.id
                  );
                  if (!song) return null;
                  return { ...song, position: played.position };
                })
                .filter((song) => song !== null)
                .orderBy(['position'], ['desc'])
                .value(),
              roundImageId: gameDb.data.currentRound.imageId,
            }),
        displayedImageId: gameDb.data.displayedImageId,
      };
    };

    // Emit initial state
    yield getState();

    // Listen for updates
    for await (const [_] of on(gameEventEmitter, 'update', { signal })) {
      yield getState();
    }
  }),

  updateSong: publicProcedure
    .input(
      z.object({
        songId: z.number().int().positive(),
        timestamps: z
          .array(
            z.object({
              time: z.number().nonnegative(),
              tag: z.enum(['best', 'main', 'secondary']),
              playEffect: z.discriminatedUnion('type', [
                z.object({ type: z.literal('none') }),
                z.object({
                  type: z.literal('crossfade'),
                  durationSeconds: z.number().nonnegative(),
                }),
                z.object({
                  type: z.literal('fade-out-in'),
                  fadeOutSeconds: z.number().nonnegative(),
                  fadeInOffset: z.number().nonnegative(),
                  fadeInSeconds: z.number().nonnegative(),
                }),
              ]),
            })
          )
          .optional(),
        volume: z.number().min(0).max(2).optional(),
        duration: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const song = gameDb.chain.get('songs').find({ id: input.songId }).value();
      if (!song) throw new Error(`Song ${input.songId} not found`);

      if (input.timestamps !== undefined) song.timestamps = input.timestamps;
      if (input.volume !== undefined) song.volume = input.volume;
      if (input.duration !== undefined) song.duration = input.duration;
      await gameDb.write();
    }),

  updateFxOptions: publicProcedure
    .input(
      z.object({
        fxId: z.string(),
        options: z.object({
          volume: z.number().min(0).max(2).optional(),
          startTime: z.number().nonnegative().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      gameDb.data.fxOptions[input.fxId] = input.options;
      await gameDb.write();
    }),

  getFxOptions: publicProcedure.query(async () => {
    return gameDb.data.fxOptions;
  }),
});

const emitUpdate = () => gameEventEmitter.emit('update');

function shuffleSongs(seed: string) {
  return shuffleArrayWithSeed(
    gameDb.data.songs.map((song) => song.id),
    seed
  ).map((id, index) => ({
    id,
    position: index + 1,
  })) satisfies Round['shuffledSongs'];
}
