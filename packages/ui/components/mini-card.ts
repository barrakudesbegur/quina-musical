// D3 · MiniCard's DOM for the projector (plain TS): the same markup as MiniCard.svelte, so both share mini-card.css.
import './mini-card.css';

const SVG = 'http://www.w3.org/2000/svg';

/** The special card's star (the projector's own star, filled gold with an ink outline). */
export const MINI_CARD_STAR = 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z';

/** A mini card: `set(color, star)` paints it in a type's pastel, with the star on the special card. */
export function miniCardElement(className = ''): { root: HTMLElement; set(color: string, star: boolean): void } {
  const root = document.createElement('div');
  root.className = `mini-card ${className}`.trim();
  root.setAttribute('aria-hidden', 'true');
  const bar = document.createElement('div');
  bar.className = 'mini-card__bar';
  const grid = document.createElement('div');
  grid.className = 'mini-card__grid';
  for (let i = 0; i < 12; i++) {
    const cell = document.createElement('span');
    cell.className = 'mini-card__cell';
    grid.append(cell);
  }
  const star = document.createElementNS(SVG, 'svg');
  star.setAttribute('class', 'mini-card__star');
  star.setAttribute('viewBox', '0 0 24 24');
  star.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', MINI_CARD_STAR);
  star.append(path);
  root.append(bar, grid, star);
  return {
    root,
    set(color, withStar) {
      if (root.style.getPropertyValue('--type-color') !== color) root.style.setProperty('--type-color', color);
      if (withStar) root.dataset.star = 'true';
      else delete root.dataset.star;
    },
  };
}
