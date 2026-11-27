// E1 · Ring for the plain-TypeScript projector: the same markup as Ring.svelte (ring.css) for what the stage draws, the
// framed countdown with a number face (the Break's, P8). Every write is skipped when nothing changed, so a 60 fps loop
// stays cheap; text goes in as text nodes.
import type { RingColor } from './types.ts';
import './ring.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

function circle(className: string, r: number): SVGCircleElement {
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('class', className);
  c.setAttribute('cx', '56');
  c.setAttribute('cy', '56');
  c.setAttribute('r', String(r));
  return c;
}

export class RingElement {
  readonly root: HTMLElement;
  /** The face (number and unit): the stage plays its tick (`interval-rotate`) on it. */
  readonly face: HTMLElement;
  private readonly fill: SVGCircleElement;
  private readonly value: HTMLElement;
  private readonly number: Text;
  private readonly unit: HTMLElement;
  private offset = '';

  constructor(color: RingColor, extraClass = '') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ring__svg');
    svg.setAttribute('viewBox', '0 0 112 112');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    this.fill = circle('ring__fill', 40);
    this.fill.setAttribute('pathLength', '100');
    this.fill.setAttribute('stroke-dasharray', '100');
    this.fill.setAttribute('transform', 'rotate(-90 56 56)');
    svg.append(circle('ring__plate', 51.5), circle('ring__track', 40), this.fill, circle('ring__hub', 31.5));
    this.number = document.createTextNode('');
    this.unit = document.createElement('span');
    this.unit.className = 'ring__unit';
    this.value = document.createElement('span');
    this.value.className = 'ring__value';
    this.value.append(this.number, this.unit);
    this.face = document.createElement('span');
    this.face.className = 'ring__centre';
    this.face.append(this.value);
    this.root = document.createElement('div');
    this.root.className = `ring ${extraClass}`.trim();
    Object.assign(this.root.dataset, { color, arc: 'progress', face: 'number', framed: '' });
    this.root.append(svg, this.face);
  }

  /** The share left (0–1): the arc empties as time passes. */
  setProgress(left: number): void {
    const offset = (100 - Math.min(1, Math.max(0, left)) * 100).toFixed(2);
    if (offset === this.offset) return;
    this.offset = offset;
    this.fill.setAttribute('stroke-dashoffset', offset);
  }

  setValue(value: string, unit: string): void {
    if (this.number.data !== value) this.number.data = value;
    if (this.unit.textContent !== unit) this.unit.textContent = unit;
    this.unit.hidden = unit === '';
    const long = value.length > 2;
    if (long !== ('long' in this.value.dataset)) {
      if (long) this.value.dataset.long = '';
      else delete this.value.dataset.long;
    }
  }
}
