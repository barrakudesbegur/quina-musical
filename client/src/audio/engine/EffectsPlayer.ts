import { AudioEngine } from './AudioEngine';
import { ResourceLoader } from './ResourceLoader';
import { EffectId, Resource } from './types';

export class EffectsPlayer {
  private engine: AudioEngine;
  private cache = new Map<EffectId, HTMLAudioElement>();

  private effects: Resource<EffectId>[] = [];
  loader = new ResourceLoader<EffectId>();

  setEffects(effects: Resource<EffectId>[]) {
    this.effects = effects;
  }

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  async init() {
    await this.engine.init();
  }

  async preloadAll() {
    await this.loader.loadAll(this.effects);
    this.effects.forEach(({ id }) => this.getAudio(id));
  }

  private getAudio(id: EffectId) {
    if (this.cache.has(id)) return this.cache.get(id)!;

    const src =
      this.loader.get(id) ?? this.effects.find((e) => e.id === id)?.url;
    if (!src) return null;

    const audio = new Audio(src);
    audio.preload = 'auto';
    this.cache.set(id, audio);
    return audio;
  }

  async play(id: EffectId) {
    const base = this.getAudio(id);
    if (!base) return;

    const audio = base.cloneNode(true) as HTMLAudioElement;
    audio.volume = this.engine.getVolume('effects');
    try {
      await audio.play();
    } catch {
      /* ignore */
    }
  }

  destroy() {
    this.cache.forEach((a) => a.pause());
    this.cache.clear();
    this.loader.destroy();
  }
}
