// D2 · CardCell, the part every surface shares (components-v2.md § 5): a card's song as a cover with its title, and
// what is drawn on the cover. Its look is generic, named by what it draws (D205): how the cover shows, a ring round
// it, a centred badge, a tag on its bottom edge. Which game state looks like what is CardGrid's looks table
// (card-looks.ts). The phone and the console draw it with CardCell.svelte; the projector (plain TS) builds the same
// parts here and sets the same data attributes, so all three share card-cell.css.
import { LINE_ICONS, partClass, pathOf, type LineIconName } from '../icons/line.ts';
import '../icons/icons.css';
import './card-cell.css';

/** How the cover shows. `played`: a little faded, so the songs still to come stand out (#70); `upcoming`: desaturated
 * and dimmed but recognisable (#78); `faded`: a row that doesn't count; `grey`: greyscale and darker (a ✗). */
export type CellCover = 'plain' | 'played' | 'upcoming' | 'faded' | 'grey';
/** The ring just outside the cover: a palette colour. */
export type CellRingColor = 'green' | 'red' | 'orange' | 'grey';
/** `running`: dashed and moving round (ANIMATIONS.md › cell-playing); still under reduced motion. */
export type CellRingStyle = 'solid' | 'dashed' | 'running';
/** The centred badge's drawing (#75, #76): a disc with a check, a cross or a play icon. */
export type CellBadge = 'check' | 'close' | 'play';
export type CellBadgeColor = 'green' | 'red' | 'orange';
/** `solid`: the room has seen it; `dashed`: only the presenters know it yet (D108). */
export type CellBadgeStyle = 'solid' | 'dashed';

/** A cell's look: every field optional, so a looks-table entry names only what it draws. */
export interface CellLook {
  cover?: CellCover;
  ring?: CellRingColor | null;
  ringStyle?: CellRingStyle;
  /** A soft glow in the ring's colour (the next cell to reveal). */
  glow?: boolean;
  badge?: CellBadge | null;
  badgeColor?: CellBadgeColor;
  badgeStyle?: CellBadgeStyle;
  /** A short tag on the cover's bottom edge: «SEGÜENT», «+2». */
  tag?: string | null;
  tagColor?: 'orange' | 'grey';
  /** The card's own colour washed over the cell (the phone's near-win, R2-Q32). */
  tint?: boolean;
}

/** The data attributes a look sets on the cell's root (CardCell.svelte renders the same). */
export function cellData(look: CellLook): Record<string, string | undefined> {
  return {
    cover: look.cover && look.cover !== 'plain' ? look.cover : undefined,
    ringStyle: look.ring ? (look.ringStyle ?? 'solid') : undefined,
    glow: look.ring && look.glow ? 'true' : undefined,
    tint: look.tint ? 'true' : undefined,
  };
}

const SVG = 'http://www.w3.org/2000/svg';

/** One icon of the family (line.ts) as an SVG element, for the projector's DOM (Icon.svelte's markup, `alone`). */
export function iconElement(name: LineIconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'icon icon--alone');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const p of LINE_ICONS[name]) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', pathOf(p));
    const cls = partClass(p);
    if (cls) path.setAttribute('class', cls);
    svg.append(path);
  }
  return svg;
}

/** The ring round the cover: one rect, `pathLength` 100 so its dashes divide it evenly at any size. */
export function ringElement(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'card-cell__ring');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const rect = document.createElementNS(SVG, 'rect');
  for (const [k, v] of Object.entries(RING_RECT)) rect.setAttribute(k, v);
  svg.append(rect);
  return svg;
}

/** The ring's rect, in the svg's own box (card-cell.css sizes the box round the cover). */
export const RING_RECT = { x: '0', y: '0', width: '100%', height: '100%', rx: '16%', pathLength: '100' } as const;

/**
 * The projector's cell parts, kept in place and restyled by `set`: the ring (outside the cover), the badge (centred)
 * and the tag (bottom edge), appended to the cover's frame (`.card-cell__art`).
 */
export class CellParts {
  readonly ring = ringElement();
  readonly badge: HTMLElement;
  readonly tag: HTMLElement;
  private shownBadge: string | null = null;

  constructor(art: HTMLElement) {
    art.classList.add('card-cell__art');
    this.badge = document.createElement('span');
    this.badge.className = 'card-cell__badge';
    this.badge.setAttribute('aria-hidden', 'true');
    this.tag = document.createElement('span');
    this.tag.className = 'card-cell__tag';
    this.tag.setAttribute('aria-hidden', 'true');
    art.append(this.ring, this.badge, this.tag);
  }

  /** Apply a look to the cell `root` (its data attributes) and to the parts. */
  set(root: HTMLElement, look: CellLook): void {
    root.classList.add('card-cell');
    for (const [k, v] of Object.entries(cellData(look))) {
      if (v === undefined) delete root.dataset[k];
      else root.dataset[k] = v;
    }
    if (look.ring) this.ring.dataset.color = look.ring;
    else delete this.ring.dataset.color;
    const badge = look.badge ? `${look.badge}:${look.badgeColor ?? ''}:${look.badgeStyle ?? 'solid'}` : null;
    if (badge !== this.shownBadge) {
      this.shownBadge = badge;
      this.badge.replaceChildren(...(look.badge ? [iconElement(look.badge)] : []));
      this.badge.dataset.color = look.badgeColor ?? 'green';
      this.badge.dataset.style = look.badgeStyle ?? 'solid';
      this.badge.dataset.icon = look.badge ?? '';
    }
    this.badge.hidden = !look.badge;
    this.tag.textContent = look.tag ?? '';
    this.tag.dataset.color = look.tagColor ?? 'orange';
    this.tag.hidden = !look.tag;
  }
}
