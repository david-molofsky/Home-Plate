/**
 * Looks up a grocery product name by barcode via Open Food Facts
 * (https://world.openfoodfacts.org) — a free, open, crowdsourced
 * database of grocery products. No API key required.
 *
 * Coverage is uneven for smaller/regional/generic items (it's
 * crowdsourced), so a 'not-found' outcome is expected and normal, not
 * an error state — the calling UI should offer manual entry as the
 * fallback, same as Media Journal's UPC/ISBN scan dialogs do.
 */

export type BarcodeLookupOutcome =
  | { status: 'found'; name: string }
  | { status: 'not-found' }
  | { status: 'service-error' };

export async function lookupGroceryProductByBarcode(barcode: string): Promise<BarcodeLookupOutcome> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name`,
    );
    if (!res.ok) return { status: 'service-error' };

    const data = await res.json();
    const name: string | undefined = data?.product?.product_name;
    if (data?.status === 1 && name && name.trim()) {
      return { status: 'found', name: name.trim() };
    }
    return { status: 'not-found' };
  } catch {
    return { status: 'service-error' };
  }
}
