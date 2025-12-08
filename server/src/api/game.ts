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

    return songs
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

  playSong: publicProcedure
    .input(z.object({ songId: z.number().min(1).optional() }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;

      const songId = input.songId ?? gameDb.data.currentRound.songsQueue[0]?.id;
      if (!songId) return;

      const songInfo = songs.find((s) => s.id === songId);
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
      const newPlayedSong = {
        id: songId,
        position: gameDb.data.currentRound.playedSongs.length + 1,
        playedAt: new Date().toISOString(),
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

  changePositionInQueue: publicProcedure
    .input(z.object({ songId: z.number().min(1), position: z.number().min(1) }))
    .mutation(async ({ input }) => {
      if (!gameDb.data.currentRound) return;

      const indexInQueue = gameDb.data.currentRound.songsQueue.findIndex(
        (s) => s.id === input.songId
      );
      if (indexInQueue === -1) {
        throw new Error(`Song ${input.songId} is not in queue`);
      }
      const song = gameDb.data.currentRound.songsQueue.splice(
        indexInQueue,
        1
      )[0];
      if (!song) {
        throw new Error(`Song ${input.songId} is not in queue`);
      }

      gameDb.data.currentRound.songsQueue.splice(input.position - 1, 0, {
        id: song.id,
        position: input.position,
        overallPosition:
          (gameDb.data.currentRound?.playedSongs.length ?? 0) + input.position,
      });
      gameDb.data.currentRound.songsQueue =
        gameDb.data.currentRound.songsQueue.map((song, index) => ({
          ...song,
          position: index + 1,
          overallPosition:
            (gameDb.data.currentRound?.playedSongs.length ?? 0) + index + 1,
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

        const shuffledSongs = shuffleSongs(now);

        gameDb.data.currentRound = {
          name: input.nextRoundName,
          position,
          startedAt: now,
          finishedAt: null,
          shuffledSongs,
          songsQueue: shuffledSongs.map((song) => ({
            ...song,
            overallPosition: song.position,
          })),
          playedSongs: [],
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

    const shuffledSongs = shuffleSongs(now);

    gameDb.data.finishedAt = null;

    gameDb.data.currentRound = {
      name: `${position}`,
      position,
      startedAt: now,
      finishedAt: null,
      shuffledSongs,
      songsQueue: shuffledSongs.map((song) => ({
        ...song,
        overallPosition: song.position,
      })),
      playedSongs: [],
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
      startedAt: now,
      finishedAt: null,
      shuffledSongs,
      songsQueue: shuffledSongs.map((song) => ({
        ...song,
        overallPosition: song.position,
      })),
      playedSongs: [],
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
