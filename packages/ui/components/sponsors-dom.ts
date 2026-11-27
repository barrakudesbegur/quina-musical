// G4 · LogoTile for the plain-TypeScript projector: the same markup as LogoTile.svelte (sponsors.css), built as DOM.
// Text goes in as text nodes, never markup.
import { imageSources } from '../data/media.ts';
import type { SponsorLogo } from './sponsor-types.ts';
import './sponsors.css';

export function logoTileElement(sponsor: SponsorLogo, tag: 'li' | 'span' = 'span'): HTMLElement {
  const tile = document.createElement(tag);
  tile.className = 'logo-tile';
  if (sponsor.logo) {
    const { jxl, src } = imageSources(sponsor.logo);
    const picture = document.createElement('picture');
    picture.className = 'logo-tile__picture';
    if (jxl) {
      const source = document.createElement('source');
      source.type = 'image/jxl';
      source.srcset = jxl;
      picture.append(source);
    }
    const img = document.createElement('img');
    img.className = 'logo-tile__img';
    img.src = src;
    img.alt = sponsor.name;
    img.decoding = 'async';
    img.draggable = false;
    picture.append(img);
    tile.append(picture);
  } else {
    const name = document.createElement('span');
    name.className = 'logo-tile__name';
    name.textContent = sponsor.name;
    tile.append(name);
  }
  return tile;
}
