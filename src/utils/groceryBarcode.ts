/**
 * Normalises a detected barcode to a digit string suitable for the Open
 * Food Facts lookup (which indexes by GTIN — UPC-A, EAN-13, or EAN-8).
 * Adapted from Media Journal's upcBarcode.ts — see that file's comment
 * for why this validates by digit shape rather than trusting
 * `barcode.format` (real-world BarcodeDetector implementations report
 * that field inconsistently across Android OEMs/WebView vendors).
 *
 * Unlike Media Journal's version, EAN-13 codes are NOT un-padded back
 * to 12 digits here — Open Food Facts indexes grocery products by
 * their full barcode as printed on the package (UK/European products
 * are near-universally EAN-13, not padded UPC-A), so passing the
 * digits through unchanged is the correct behaviour for this lookup.
 */
export function normalizeGroceryBarcode(barcode: { rawValue: string; format: string }): string | null {
  const raw = barcode.rawValue;
  if (/^\d{8}$/.test(raw)) return raw; // EAN-8
  if (/^\d{12}$/.test(raw)) return raw; // UPC-A
  if (/^\d{13}$/.test(raw)) return raw; // EAN-13
  return null;
}
