export type SongId = number;
export type EffectId = string;
export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';
export type VolumeChannel = 'song' | 'effects';

export type Song = {
  id: SongId;
  title: string;
  artist: string;
  cover?: string;
  timestamps?: { main?: number[]; secondary?: number[] };
};

export type Resource<T> = { id: T; url: string };

export type SongPlayerState = {
  isPlaying: boolean;
  isSilence: boolean;
  currentTime: number;
  duration: number | null;
  currentSongId: SongId | null;
};

export type Listener<T> = (data: T) => void;

export class Emitter<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Set<Listener<unknown>>>();

  on<K extends keyof T>(event: K, fn: Listener<T[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as Listener<unknown>);
    return () => this.listeners.get(event)?.delete(fn as Listener<unknown>);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}
