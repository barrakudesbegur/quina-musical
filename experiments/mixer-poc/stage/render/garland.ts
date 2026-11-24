// The Heat garland's DOM: a string of lights, all always on. It only receives a look (colour mix, glow,
// twinkle) to paint as CSS custom properties; stage.css turns them into colours from the palette tokens.
import type { GarlandLook } from '../model/garland.ts';
import { h, setVar } from './dom.ts';

export class Garland {
  readonly root: HTMLUListElement;

  constructor(count: number, random: () => number) {
    const lights = Array.from({ length: count }, (_, i) => {
      const light = h('li', 'garland__light');
      light.style.setProperty('--light-i', String(count > 1 ? i / (count - 1) : 0));
      light.style.setProperty('--light-seed', random().toFixed(3));
      return light;
    });
    this.root = h('ul', { class: 'garland', attrs: { 'aria-hidden': 'true' } }, ...lights);
  }

  paint(look: GarlandLook): void {
    setVar(this.root, '--heat-warm', String(look.warm));
    setVar(this.root, '--heat-hot', String(look.hot));
    setVar(this.root, '--heat-glow', String(look.glow));
    setVar(this.root, '--twinkle-ms', `${look.twinkleMs}ms`);
    setVar(this.root, '--chase', String(look.chase));
  }
}
