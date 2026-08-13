/**
 * Minimal ambient types for the Barcode Detection API
 * (https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API).
 * Not part of TypeScript's standard DOM lib since browser support is
 * Chrome/Chromium-only (Android + Android WebView, which covers this
 * app's TWA distribution). Feature-detected at runtime via
 * utils/barcodeScanSupport.ts regardless of what TypeScript thinks
 * exists — same approach as Media Journal, which this is adapted from.
 */

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
  static getSupportedFormats(): Promise<string[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
