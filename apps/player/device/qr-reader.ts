// Reading a QR from the camera's picture (D141). Where the browser reads QR codes itself (BarcodeDetector, as on
// Android's Chrome), that; else jsQR, loaded only now, the first time the camera opens (iPhones' Safari can't).
// Returns a function that reads one frame of the video: the QR's text, or null.
import { PLAYER_CONFIG } from '../config.ts';

export type FrameReader = (video: HTMLVideoElement) => Promise<string | null>;

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorClass {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

async function nativeReader(): Promise<FrameReader | null> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  try {
    if (!(await Detector.getSupportedFormats()).includes('qr_code')) return null;
    const detector = new Detector({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function jsqrReader(): Promise<FrameReader> {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) return null;
    const scale = Math.min(1, PLAYER_CONFIG.qrReadSize / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
    const found = jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'dontInvert' });
    return found?.data ?? null;
  };
}

export async function frameReader(): Promise<FrameReader> {
  return (await nativeReader()) ?? (await jsqrReader());
}
