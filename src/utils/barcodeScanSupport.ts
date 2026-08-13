/**
 * Feature detection for grocery barcode scanning. Same no-polyfill
 * approach as Media Journal's isbnScanSupport.ts/upcScanSupport.ts: on
 * unsupported browsers (notably desktop and iOS Safari — this API is
 * Chrome/Chromium-only) the scan button simply doesn't render.
 */
export async function isBarcodeScanAvailable(): Promise<boolean> {
  if (!('BarcodeDetector' in window) || !window.BarcodeDetector) return false;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('ean_13') || formats.includes('upc_a') || formats.includes('ean_8');
  } catch {
    return false;
  }
}
