// The Heat garland's DOM (ANIMATIONS.md `heat` and "The garland's lights"): a wire in swags and its bulbs, drawn from
// the layout shared with the phones (packages/ui/motion/garland.ts). Each bulb's pieces sit in layers, bottom first:
// its flame, its glass, its lamp (the light and its halo, the only part that moves; in its third's group) and its ink
// outline with the cap, so a halo never covers ink. Each bulb's place in the pattern is set once as custom properties;
// `paint` only writes the Heat's colour mix and, when the level changes, the pattern: stage.css runs the keyframes.
import { garlandBulbs, garlandLayout, type GarlandShape } from '../../../packages/ui/motion/garland.ts';
import type { GarlandLook } from '../model/garland.ts';
import { h, setData, setVar } from './dom.ts';

const SVG = 'http://www.w3.org/2000/svg';

export class Garland {
  readonly root: HTMLDivElement;

  constructor(shape: GarlandShape & { height: number; flameEvery: number }, random: () => number) {
    const layout = garlandLayout(shape);
    const bulbs = garlandBulbs(shape.bulbs, shape.flameEvery, random);

    const wire = document.createElementNS(SVG, 'svg');
    wire.setAttribute('class', 'garland__wire');
    wire.setAttribute('viewBox', `0 0 ${shape.width} ${shape.height}`);
    wire.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', layout.wire);
    wire.append(path);

    const piece = (cls: string, i: number) => {
      const bulb = bulbs[i];
      const light = layout.lights[i];
      const el = h('span', { class: cls, data: { tone: String(bulb.step), party: bulb.party } });
      el.style.cssText = `--x:${light.x};--y:${light.y}px;--tilt:${light.angle}deg;--i:${i};--seed:${bulb.seed}`;
      return el;
    };
    const layer = (cls: string, pieces: HTMLElement[]) => h('div', cls, ...pieces);
    const all = bulbs.map((b) => b.index);
    const groups = ([0, 1, 2] as const).map((step) => {
      const group = layer(
        'garland__layer garland__group',
        all
          .filter((i) => bulbs[i].step === step)
          .map((i) => {
            const lamp = piece('garland__piece garland__lamp', i);
            // Cool and still (reduced motion): every 4th bulb rests dimmer, as on S2.
            if (i % 4 === 1) lamp.dataset.dim = '';
            return lamp;
          }),
      );
      group.style.setProperty('--step', String(step));
      return group;
    });

    this.root = h(
      'div',
      { class: 'garland', attrs: { 'aria-hidden': 'true' }, data: { pattern: 'breathe', palette: 'heat', fire: 'off' } },
      wire,
      layer('garland__layer', all.filter((i) => bulbs[i].flame).map((i) => piece('garland__flame', i))),
      layer('garland__layer', all.map((i) => piece('garland__piece garland__glass', i))),
      ...groups,
      layer('garland__layer', all.map((i) => piece('garland__piece garland__shell', i))),
    );
    this.root.style.setProperty('--n', String(bulbs.length));
  }

  paint(look: GarlandLook): void {
    setVar(this.root, '--heat-warm', String(look.warm));
    setVar(this.root, '--heat-hot', String(look.hot));
    setVar(this.root, '--heat-glow', String(look.glow));
    // Written only when they change (setData/setVar skip equal values): a new pattern restarts the keyframes.
    setVar(this.root, '--period', `${look.lights.periodMs}ms`);
    setData(this.root, 'pattern', look.lights.pattern);
    setData(this.root, 'palette', look.lights.palette);
    setData(this.root, 'fire', look.lights.fire ? 'on' : 'off');
  }
}
