import QRCodeStyling from 'qr-code-styling';
import { JSDOM } from 'jsdom';
import nodeCanvas from 'canvas';
import { urlWithParams } from './urls';

const BASE_URL = 'https://quina.barrakidesbegur.org';
const PARAM_CARD_ID = 'c';

export async function generateQRCodeDataUri(
  cardId: string,
  size: number = 300
) {
  const qrCode = new QRCodeStyling({
    width: size,
    height: size,
    type: 'canvas',
    shape: 'square',
    jsdom: JSDOM,
    nodeCanvas,
    data: urlWithParams(BASE_URL, { [PARAM_CARD_ID]: cardId }),
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
      type: 'rounded',
      color: '#000000',
      roundSize: true,
    },
    backgroundOptions: {
      color: '#ffffff',
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
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
