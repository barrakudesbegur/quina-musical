// F1 · Nino for the plain-TypeScript projector: the same <img> as Nino.svelte (nino.css), built as DOM. The stage
// drives its own motion hooks (`data-anim`), so the default motion here is none.
import { ninoUrl, type NinoPose } from '../ninos.ts';
import './nino.css';

export interface NinoLook {
  pose: NinoPose;
  hue?: number | null;
  faded?: boolean;
  flip?: boolean;
  motion?: 'sway' | 'breathe' | 'none';
}

/** A nino sticker; `extraClass` places it in its scene. */
export function ninoElement(look: NinoLook, extraClass = ''): HTMLImageElement {
  const img = document.createElement('img');
  img.className = `nino ${extraClass}`.trim();
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  setNino(img, look);
  return img;
}

/** Change a nino in place (a new pose, a fall); a write is skipped when nothing changed. */
export function setNino(img: HTMLImageElement, look: NinoLook): void {
  const src = ninoUrl(look.pose);
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  if (img.dataset.pose !== look.pose) img.dataset.pose = look.pose;
  const motion = look.motion ?? 'none';
  if (img.dataset.motion !== motion) img.dataset.motion = motion;
  toggle(img, 'faded', look.faded === true);
  toggle(img, 'flip', look.flip === true);
  const hue = look.hue ? `${look.hue}deg` : '';
  if (img.style.getPropertyValue('--nino-hue') !== hue) {
    if (hue) img.style.setProperty('--nino-hue', hue);
    else img.style.removeProperty('--nino-hue');
  }
}

function toggle(el: HTMLElement, key: string, on: boolean): void {
  if (on && el.dataset[key] === undefined) el.dataset[key] = '';
  if (!on && el.dataset[key] !== undefined) delete el.dataset[key];
}
