// G1 · StickerTitle and G2 · Plate for the plain-TypeScript projector: the same markup as StickerTitle.svelte and
// Plate.svelte (sticker.css), built as DOM; the label is a text node.
import type { PlateColor, StickerTitleSize } from './types.ts';
import './sticker.css';

export function stickerTitleElement(text: string, size: StickerTitleSize, tag: 'h1' | 'h2' | 'p' | 'span' = 'h2'): HTMLElement {
  const el = document.createElement(tag);
  el.className = 'sticker-title';
  el.dataset.size = size;
  el.dataset.color = 'white';
  el.textContent = text;
  return el;
}

/** A plate; `label` is its title element (keep it to change the words). */
export function plateElement(color: PlateColor, size: StickerTitleSize, tag: 'p' | 'div' | 'h1' = 'div'): { root: HTMLElement; label: HTMLElement } {
  const root = document.createElement(tag);
  root.className = 'plate';
  root.dataset.color = color;
  const label = stickerTitleElement('', size, 'span');
  root.append(label);
  return { root, label };
}
