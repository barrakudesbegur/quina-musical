// The add-card QR scan (D141; board Mobil-Afegir-QR): what a scanned QR means. A card's QR is its link
// (`…/<edition>/<number>`, read by router.ts parseRoute): this year's card gives its number; anything else (another
// edition's card, last year's link, any other QR) is "not one of this year's cards", and the camera keeps looking.
// Pure.
import { parseRoute } from './router.ts';

export type ScannedQr = { kind: 'card'; cardId: number } | { kind: 'other' };

export function readCardQr(text: string, edition: string): ScannedQr {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { kind: 'other' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { kind: 'other' };
  // A printed card's link has no dev base: read it as the cloud serves it.
  const route = parseRoute({ pathname: url.pathname, search: url.search, hash: url.hash }, { edition, base: '/' });
  return route.kind === 'card' ? { kind: 'card', cardId: route.cardId } : { kind: 'other' };
}
