import lodash from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { z } from 'zod';
import songsJson from '../../db/default/songs.json' with { type: 'json' };

export const PlayEffectSchema = z.discriminatedUnion('type', [
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
]);

export const SongTimestampSchema = z.object({
  time: z.number().nonnegative(),
  tag: z.enum(['best', 'main', 'secondary']),
  playEffect: PlayEffectSchema,
});

export const SongSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  artist: z.string(),
  cover: z.string(),
  spotifyId: z.string(),
  timestamps: z.array(SongTimestampSchema),
  volume: z.number().min(0).max(2).optional(),
  duration: z.number().positive().optional(),
});

export const PlayedSongSchema = z.object({
  id: z.number().int().positive(),
  position: z.number().int().positive(),
  playedAt: z.string(),
});

export const RoundSchema = z.object({
  name: z.string(),
  position: z.number().int().positive(),
  shuffledSongs: z.array(
    z.object({
      id: z.number().int().positive(),
      position: z.number().int().positive(),
    })
  ),
  songsQueue: z.array(
    z.object({
      id: z.number().int().positive(),
      position: z.number().int().positive(),
      overallPosition: z.number().int().positive(),
    })
  ),
  playedSongs: z.array(PlayedSongSchema),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  imageId: z.string().nullable(),
  winnerCardIds: z.array(z.number().int().nonnegative()),
});

export const FxOptionsSchema = z.object({
  volume: z.number().min(0).max(2).optional(),
  startTime: z.number().nonnegative().optional(),
});

export const GameDataSchema = z.object({
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  currentRound: RoundSchema.nullable(),
  pastRounds: z.array(RoundSchema),
  cardsPlaying: z.array(z.number().int().nonnegative()),
  displayedImageId: z.string().nullable(),
  songs: z.array(SongSchema),
  fxOptions: z.record(z.string(), FxOptionsSchema),
});

export type PlayEffect = z.infer<typeof PlayEffectSchema>;
export type SongTimestamp = z.infer<typeof SongTimestampSchema>;
export type Song = z.infer<typeof SongSchema>;
export type PlayedSong = z.infer<typeof PlayedSongSchema>;
export type Round = z.infer<typeof RoundSchema>;
export type FxOptions = z.infer<typeof FxOptionsSchema>;
export type GameData = z.infer<typeof GameDataSchema>;

class LowWithLodash<T> extends Low<T> {
  chain: lodash.ExpChain<this['data']> = lodash.chain(this).get('data');
}

export const makeDefaultData = (): GameData => ({
  startedAt: null,
  finishedAt: null,
  currentRound: null,
  pastRounds: [],
  cardsPlaying: [],
  displayedImageId: null,
  songs: songsJson.map((song) => ({
    ...song,
    timestamps: [],
  })),
  fxOptions: {},
});

const adapter = new JSONFile<GameData>(
  process.env.NODE_ENV === 'production'
    ? './db/local/game-prod.json'
    : './db/local/game-dev.json'
);

export const gameDb = new LowWithLodash(adapter, makeDefaultData());
await gameDb.read();
await gameDb.write();
