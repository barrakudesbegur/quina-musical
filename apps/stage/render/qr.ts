// The player app's QR, before the Game only (never in play, nor in the Interval). No text around it, so the
// code is as large as possible (the user's review); the short link is its accessible label. The code is drawn
// as one SVG path built from the `qrcode` package's module matrix; no markup is parsed. If the code can't be
// made, the short link shows instead, as the fallback.
import QRCode from 'qrcode';
import { qrPathData } from '../model/qr.ts';
import type { LinkView } from '../view.ts';
import { STAGE_TEXT } from '../strings.ts';
import { h, setHidden, setText } from './dom.ts';
import '../../../packages/ui/components/qr-block.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

function qrSvg(href: string): SVGSVGElement | null {
  try {
    const { modules } = QRCode.create(href, { errorCorrectionLevel: 'M' });
    const { viewBox, d } = qrPathData({ size: modules.size, isDark: (r, c) => modules.get(r, c) === 1 }, 2);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'qr__code');
    svg.setAttribute('viewBox', `0 0 ${viewBox} ${viewBox}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('class', 'qr__paper');
    bg.setAttribute('width', String(viewBox));
    bg.setAttribute('height', String(viewBox));
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'qr__ink');
    path.setAttribute('d', d);
    svg.append(bg, path);
    return svg;
  } catch (error) {
    console.warn('[stage] QR not drawn; the short link stays', error);
    return null;
  }
}

export class QrBlock {
  readonly root: HTMLElement;
  private readonly code: HTMLElement;
  private readonly label: HTMLElement;
  private href = '';

  constructor(extraClass = '') {
    this.code = h('div', 'qr__frame');
    this.label = h('p', { class: 'qr__url', hidden: true });
    this.root = h('figure', { class: `qr qr-block ${extraClass}`.trim(), attrs: { role: 'img' } }, this.code, this.label);
  }

  set(link: LinkView): void {
    setText(this.label, link.label);
    this.root.setAttribute('aria-label', `${STAGE_TEXT.scanYourCard}: ${link.label}`);
    if (link.href === this.href) return;
    this.href = link.href;
    const svg = qrSvg(link.href);
    this.code.replaceChildren(...(svg ? [svg] : []));
    setHidden(this.code, svg === null);
    setHidden(this.label, svg !== null);
  }
}
