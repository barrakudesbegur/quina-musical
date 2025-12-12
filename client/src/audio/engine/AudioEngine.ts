import { VolumeChannel } from './types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private songGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private volumes = { song: 1, effects: 1 };

  async init(): Promise<void> {
    if (this.ctx) return;

    this.ctx = new AudioContext();
    this.songGain = this.ctx.createGain();
    this.effectsGain = this.ctx.createGain();

    this.songGain.connect(this.ctx.destination);
    this.effectsGain.connect(this.ctx.destination);

    // Don't await resume - it blocks until user interaction on most browsers
    // The context will auto-resume on first user interaction
    void this.ctx.resume();
  }

  get context() {
    if (!this.ctx) throw new Error('AudioEngine not initialized');
    return this.ctx;
  }

  get songGainNode() {
    if (!this.songGain) throw new Error('AudioEngine not initialized');
    return this.songGain;
  }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }

  getVolume(channel: VolumeChannel) {
    return this.volumes[channel];
  }

  setVolume(channel: VolumeChannel, volume: number, durationMs = 0) {
    const v = Math.max(0, Math.min(1, volume));
    this.volumes[channel] = v;

    const gain = channel === 'song' ? this.songGain : this.effectsGain;
    if (!gain || !this.ctx) return;

    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);

    if (durationMs <= 0) {
      gain.gain.setValueAtTime(v, now);
    } else {
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(v, now + durationMs / 1000);
    }
  }

  connectToSongGain(source: MediaElementAudioSourceNode) {
    source.connect(this.songGainNode);
  }

  createMediaSource(el: HTMLMediaElement) {
    return this.context.createMediaElementSource(el);
  }

  destroy() {
    this.songGain?.disconnect();
    this.effectsGain?.disconnect();
    this.ctx?.close();
    this.ctx = this.songGain = this.effectsGain = null;
  }
}
