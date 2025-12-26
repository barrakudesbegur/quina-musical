import lodash from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import songsJson from '../../db/default/songs.json' with { type: 'json' };

type SongId = number;
type CardId = number;

export type PlayEffect =
  | { type: 'none' }
  | { type: 'crossfade'; durationSeconds: number }
  | {
      type: 'fade-out-in';
      fadeOutSeconds: number;
      fadeInOffset: number;
      fadeInSeconds: number;
    };

export type SongTimestamp = {
  time: number;
  tag: 'best' | 'main' | 'secondary';
  playEffect: PlayEffect;
};

export interface Song {
  id: number;
  title: string;
  artist: string;
  cover: string;
  spotifyId: string;
  timestamps: SongTimestamp[];
  volume?: number;
  duration?: number;
}

export interface PlayedSong {
  id: SongId;
  position: number;
  playedAt: string;
}

export interface Round {
  name: string;
  position: number;
  shuffledSongs: { id: SongId; position: number }[];
  songsQueue: { id: SongId; position: number; overallPosition: number }[];
  playedSongs: PlayedSong[];
  startedAt: string | null;
  finishedAt: string | null;
  imageId: string | null;
  winnerCardIds: CardId[];
}

export interface FxOptions {
  volume?: number;
  startTime?: number;
}

export interface GameData {
  startedAt: string | null;
  finishedAt: string | null;
  currentRound: Round | null;
  pastRounds: Round[];
  cardsPlaying: CardId[];
  displayedImageId: string | null;
  songs: Song[];
  fxOptions: Record<string, FxOptions>;
}

class LowWithLodash<T> extends Low<T> {
  chain: lodash.ExpChain<this['data']> = lodash.chain(this).get('data');
}

const makeDefaultData = (): GameData => ({
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
