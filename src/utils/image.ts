const MAX_EDGE = 300;
const JPEG_QUALITY = 0.7;

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
export function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the selected file as an image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_EDGE) {
          height = Math.round((height * MAX_EDGE) / width);
          width = MAX_EDGE;
        } else if (height >= width && height > MAX_EDGE) {
          width = Math.round((width * MAX_EDGE) / height);
          height = MAX_EDGE;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported on this device.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
