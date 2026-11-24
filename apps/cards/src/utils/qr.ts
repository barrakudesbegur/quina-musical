import QRCodeStyling from 'qr-code-styling';
import { JSDOM } from 'jsdom';
import nodeCanvas from 'canvas';
import { cardUrl } from '../config';

/** The card's QR (its year-tagged link, see config.ts) as a PNG data URI. */
export async function generateQRCodeDataUri(
  cardId: number,
  size: number = 300
) {
  const qrCode = new QRCodeStyling({
    width: size,
    height: size,
    type: 'canvas',
    shape: 'square',
    jsdom: JSDOM,
    nodeCanvas,
    data: cardUrl(cardId),
    margin: 0,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: 'L',
    },
    imageOptions: {
      saveAsBlob: true,
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 0,
    },
    dotsOptions: {
      type: 'square',
      color: '#000000',
      roundSize: true,
    },
    backgroundOptions: {
      color: '#ffffff',
    },
    cornersSquareOptions: {
      type: 'rounded',
      color: '#000000',
    },
    cornersDotOptions: {
      color: '#000000',
    },
  });

  const buffer = await qrCode.getRawData('png');
  if (!buffer || !(buffer instanceof Buffer)) {
    throw new Error('Failed to generate QR code');
  }

  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}` as const;
}
