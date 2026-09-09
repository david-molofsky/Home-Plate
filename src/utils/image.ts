const MAX_EDGE = 300;
const JPEG_QUALITY = 0.7;

// Cap used only when preparing a photo for on-device OCR (see
// prepareImageForOcr, used by photo recipe import) — much larger than
// the 300px meal-photo thumbnail above, since the text itself needs to
// stay legible. Still capped rather than left at full camera
// resolution (often 3000px+), which would slow the on-device OCR
// engine and risk running out of memory on lower-end phones.
const OCR_MAX_EDGE = 2000;

/**
 * Downscales an uploaded image client-side before it's ever written to
 * Dexie/IndexedDB. Thumbnails only render at ~60px, so storing
 * multi-MB camera photos bloats IndexedDB and slows Google Drive
 * export/import for no visible benefit — resizing the longest edge to
 * ~300px and re-encoding as JPEG at ~70% quality keeps photos in the
 * 20–30KB range instead. No full-resolution original is kept.
 *
 * Returns a data URL ready to store directly on Meal.photo.
 */
// Shared resize step, parameterized by max edge / output format so
// downscaleImage, downscaleImageFromUrl, and prepareImageForOcr can't
// drift out of sync on the actual resize math even though they target
// different sizes and formats.
function resizeToDataUrlWith(
  img: HTMLImageElement,
  maxEdge: number,
  mimeType: string,
  quality?: number,
): string {
  let { width, height } = img;
  if (width > height && width > maxEdge) {
    height = Math.round((height * maxEdge) / width);
    width = maxEdge;
  } else if (height >= width && height > maxEdge) {
    width = Math.round((width * maxEdge) / height);
    height = maxEdge;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas not supported on this device.');
  }
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(mimeType, quality);
}

function resizeToDataUrl(img: HTMLImageElement): string {
  return resizeToDataUrlWith(img, MAX_EDGE, 'image/jpeg', JPEG_QUALITY);
}

export function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the selected file as an image.'));
      img.onload = () => {
        try {
          resolve(resizeToDataUrl(img));
        } catch (err) {
          reject(err as Error);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Same downscale pipeline as downscaleImage, but starting from a URL
 * instead of an uploaded File \u2014 used by recipe URL import to shrink
 * the source page's photo before it's ever written to Dexie. The URL
 * must be served with a permissive CORS header or the canvas will be
 * tainted and toDataURL() will throw; see the recipe-import Cloudflare
 * Worker's /image route, which proxies the original image through
 * with Access-Control-Allow-Origin: * for exactly this reason.
 */
export function downscaleImageFromUrl(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('Could not load the recipe photo.'));
    img.onload = () => {
      try {
        resolve(resizeToDataUrl(img));
      } catch (err) {
        reject(err as Error);
      }
    };
    img.src = imageUrl;
  });
}

/**
 * Resizes an uploaded photo for on-device OCR (see
 * services/recipeImport/photoImportService) rather than for storage —
 * capped at OCR_MAX_EDGE (much larger than the ~300px meal-photo
 * thumbnail) so the recipe text itself stays legible, and encoded as
 * PNG rather than JPEG to avoid compression artefacts blurring
 * character edges. Only downscales if the source exceeds the cap;
 * never upscales a smaller photo. The resulting data URL is used only
 * to feed the OCR engine — it's discarded afterwards, not stored.
 */
export function prepareImageForOcr(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the selected file as an image.'));
      img.onload = () => {
        try {
          resolve(resizeToDataUrlWith(img, OCR_MAX_EDGE, 'image/png'));
        } catch (err) {
          reject(err as Error);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
