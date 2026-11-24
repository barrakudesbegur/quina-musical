// Tiny DOM helpers for the stage's renderers. Text always goes in as text nodes (`textContent`), never as
// markup, and every write is skipped when nothing changed, so a 60 fps loop stays cheap.
import { coverUrl } from '../../ui/data/catalog.ts';
import type { AnimName } from '../model/moments.ts';

type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  data?: Record<string, string>;
  attrs?: Record<string, string>;
  hidden?: boolean;
}

/** Create an element with classes, data attributes, attributes and children (strings become text nodes). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | string = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const p: Props = typeof props === 'string' ? { class: props } : props;
  if (p.class) el.className = p.class;
  for (const [k, v] of Object.entries(p.data ?? {})) el.dataset[k] = v;
  for (const [k, v] of Object.entries(p.attrs ?? {})) el.setAttribute(k, v);
  if (p.hidden) el.hidden = true;
  for (const child of children) if (child !== null && child !== undefined && child !== false) el.append(child);
  return el;
}

export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

/** Set or remove a data attribute (`null` removes). */
export function setData(el: HTMLElement, key: string, value: string | null): void {
  if (value === null) {
    if (key in el.dataset) delete el.dataset[key];
  } else if (el.dataset[key] !== value) el.dataset[key] = value;
}

export function setVar(el: HTMLElement, name: string, value: string): void {
  if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
}

/**
 * (Re)start an animation hook: `data-anim` names it, and `is-entering` holds the element in its "from"
 * state for one frame, so the basic theme's CSS transition runs (a richer theme can key keyframes on the
 * same attribute). Calling it again restarts it.
 */
export function playAnim(el: HTMLElement, name: AnimName): void {
  el.classList.remove('is-entering');
  delete el.dataset.anim;
  void el.offsetWidth; // commit the reset, so keyframes and transitions start again
  el.dataset.anim = name;
  el.classList.add('is-entering');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-entering')));
}

/**
 * A song's cover. A missing file (or no song) leaves the box empty with `is-missing`, so titles still show
 * without covers (the defined failure behaviour).
 */
export class CoverArt {
  readonly root: HTMLElement;
  private readonly img: HTMLImageElement;
  private songId: number | null = null;

  constructor(extraClass = '') {
    this.img = h('img', { class: 'cover-art__img', attrs: { alt: '', decoding: 'async', draggable: 'false' } });
    this.root = h('div', { class: `cover-art ${extraClass}`.trim(), data: { state: 'empty' } }, this.img);
    this.img.addEventListener('load', () => setData(this.root, 'state', 'loaded'));
    this.img.addEventListener('error', () => setData(this.root, 'state', 'missing'));
  }

  set(songId: number | null): void {
    if (songId === this.songId) return;
    this.songId = songId;
    if (songId === null) {
      this.img.removeAttribute('src');
      setData(this.root, 'state', 'empty');
      return;
    }
    setData(this.root, 'state', 'loading');
    this.img.src = coverUrl(songId);
  }
}
