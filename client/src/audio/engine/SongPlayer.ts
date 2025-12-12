import { AudioEngine } from './AudioEngine';
import { ResourceLoader } from './ResourceLoader';
import {
  Emitter,
  Resource,
  Song,
  SongId,
  SongPlayerState,
  SongTimestampCategory,
} from './types';

type Events = {
  statechange: SongPlayerState;
  loadstart: void;
  loadend: void;
};

export class SongPlayer extends Emitter<Events> {
  private engine: AudioEngine;
  private audio: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;

  private songs: Song[] = [];
  private resources: Resource<SongId>[] = [];
  loader = new ResourceLoader<SongId>();

  private _isPlaying = false;
  private _isSilence = false;
  private _currentSongId: SongId | null = null;

  constructor(engine: AudioEngine) {
    super();
    this.engine = engine;
  }

  setSongs(songs: Song[]) {
    this.songs = songs;
  }

  setSongResources(resources: Resource<SongId>[]) {
    this.resources = resources;
  }

  async init() {
    await this.engine.init();
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.mediaSource = this.engine.createMediaSource(this.audio);
    this.engine.connectToSongGain(this.mediaSource);

    this.audio.addEventListener('timeupdate', () => this.emitState());
    this.audio.addEventListener('durationchange', () => this.emitState());
    this.audio.addEventListener('loadedmetadata', () => this.emitState());
    this.audio.addEventListener('play', () => {
      this._isPlaying = true;
      this.emitState();
    });
    this.audio.addEventListener('pause', () => {
      if (!this._isSilence) {
        this._isPlaying = false;
        this.emitState();
      }
    });
  }

  get state(): SongPlayerState {
    const dur = this.audio?.duration;
    return {
      isPlaying: this._isPlaying,
      isSilence: this._isSilence,
      currentTime: this.audio?.currentTime ?? 0,
      duration: dur && Number.isFinite(dur) ? dur : null,
      currentSongId: this._currentSongId,
    };
  }

  private emitState() {
    this.emit('statechange', this.state);
  }

  private getSrc(id: SongId) {
    const preloaded = this.loader.get(id);
    if (preloaded) return preloaded;
    const resource = this.resources.find((r) => r.id === id);
    return resource?.url ?? `/songs/${id}.mp3`;
  }

  private pickTime(id: SongId, cat: SongTimestampCategory | number): number {
    if (typeof cat === 'number') return Math.max(0, cat);

    const ts = this.songs.find((s) => s.id === id)?.timestamps;
    if (!ts) return 0;

    const list =
      cat === 'any'
        ? [...(ts.main ?? []), ...(ts.secondary ?? [])]
        : cat === 'constant'
          ? (ts.main ?? []).slice(0, 1)
          : (ts[cat] ?? []);

    return list.length ? list[Math.floor(Math.random() * list.length)] : 0;
  }

  async load(
    songId: SongId,
    timestamp: SongTimestampCategory | number = 'constant',
    opts?: { autoplay?: boolean }
  ) {
    const autoplay = opts?.autoplay ?? false;
    if (!this.audio) throw new Error('SongPlayer not initialized');

    this._isSilence = false;
    this._currentSongId = songId;
    this.emit('loadstart', undefined);

    const src = this.getSrc(songId);
    const needsLoad = this.audio.src !== src;

    if (needsLoad) {
      this.audio.src = src;
    }

    const start = this.pickTime(songId, timestamp);

    // Always wait for metadata if we need it
    if (needsLoad || this.audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Failed to load audio'));
        };
        const cleanup = () => {
          this.audio!.removeEventListener('loadedmetadata', onLoaded);
          this.audio!.removeEventListener('error', onError);
        };
        this.audio!.addEventListener('loadedmetadata', onLoaded, {
          once: true,
        });
        this.audio!.addEventListener('error', onError, { once: true });
      });
    }

    try {
      this.audio.currentTime = start;
    } catch {
      // Ignore seek errors
    }

    this.emit('loadend', undefined);
    this.emitState();

    if (autoplay) {
      await this.play();
    }
  }

  async play() {
    if (this._isSilence) {
      this._isPlaying = true;
      this.emitState();
      return;
    }
    if (!this.audio?.src) return;

    await this.engine.resume();

    try {
      await this.audio.play();
      this._isPlaying = true;
      this.emitState();
    } catch (err) {
      console.error('Play failed:', err);
      throw err;
    }
  }

  pause() {
    if (this._isSilence) {
      this._isPlaying = false;
      this.emitState();
      return;
    }
    this.audio?.pause();
  }

  async toggle() {
    this._isPlaying ? this.pause() : await this.play();
  }

  async togglePlayState() {
    await this.toggle();
  }

  seek(time: number) {
    if (!this.audio) return;
    const max = this.audio.duration || Infinity;
    this.audio.currentTime = Math.max(0, Math.min(max, time));
    this.emitState();
  }

  playSilence() {
    this.audio?.pause();
    this._isSilence = true;
    this._isPlaying = true;
    this._currentSongId = null;
    this.emitState();
  }

  preloadAll() {
    // Run in background to not block current playback
    void this.loader.loadAll(this.resources);
  }

  destroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.mediaSource?.disconnect();
    this.loader.destroy();
  }
}
