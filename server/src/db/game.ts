import lodash from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

interface PlayedSong {
  id: string;
  position: number;
  playedAt: string;
}

interface Round {
  name: string;
  position: number;
  playedSongs: PlayedSong[];
  startedAt: string | null;
  finishedAt: string | null;
}

interface GameData {
  startedAt: string | null;
  finishedAt: string | null;
  currentRound: Round | null;
  pastRounds: Round[];
}

class LowWithLodash<T> extends Low<T> {
  chain: lodash.ExpChain<this['data']> = lodash.chain(this).get('data');
}

const defaultData: GameData = {
  startedAt: null,
  finishedAt: null,
  currentRound: null,
  pastRounds: [],
};

const adapter = new JSONFile<GameData>(
  process.env.NODE_ENV === 'production'
    ? './db/local/game-prod.json'
    : './db/local/game-dev.json'
);

export const gameDb = new LowWithLodash(adapter, defaultData);
await gameDb.read();
await gameDb.write();
