import { db } from '@/services/database/db';

/**
 * Google Drive integration — adapted from Media Journal's
 * googleDriveService.ts. Uses Google Identity Services (GIS) for OAuth
 * and the `drive.file` scope, so this app can only see files it
 * creates itself — never anything else in the user's Drive.
 *
 * SETUP REQUIRED before this works:
 *   1. Create a Google Cloud project, enable the Drive API.
 *   2. Create an OAuth 2.0 Client ID (Web application) and add your
 *      app's origin(s) to Authorized JavaScript origins.
 *   3. Put the client ID in .env as VITE_GOOGLE_CLIENT_ID.
 * See README.md for the full walkthrough.
 */

const TOKEN_KEY = 'googleDriveToken';
const FOLDER_NAME = 'Home Plate';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface DriveExportFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: () => void };
        };
      };
    };
  }
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google Identity Services.'));
    document.head.appendChild(script);
  });
}

async function getToken(): Promise<string> {
  const record = await db.appSettings.get(TOKEN_KEY);
  if (!record) throw new Error('Not connected to Google Drive.');
  return record.value as string;
}

export async function signInToDrive(): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error(
      'Google Drive is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file — see README.md.',
    );
  }
  await loadGisScript();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Sign-in failed.'));
          return;
        }
        await db.appSettings.put({ key: TOKEN_KEY, value: resp.access_token });
        resolve();
      },
    });
    client.requestAccessToken();
  });
}

export async function signOutOfDrive(): Promise<void> {
  await db.appSettings.delete(TOKEN_KEY);
}

async function findOrCreateFolder(token: string): Promise<string> {
  const query = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const created = await createRes.json();
  return created.id;
}

/** Exports the full local database (meals, planned meals, shopping
 * list, dietary defaults) as a single JSON file in the "Dinner
 * Planner" Drive folder, named by today's date. Overwrites an export
 * from today if one already exists, so repeated exports in a day
 * don't pile up. */
export async function exportToGoogleDrive(): Promise<string> {
  const token = await getToken();
  const folderId = await findOrCreateFolder(token);

  const [meals, plannedMeals, shoppingListItems, appSettings] = await Promise.all([
    db.meals.toArray(),
    db.plannedMeals.toArray(),
    db.shoppingListItems.toArray(),
    db.appSettings.toArray(),
  ]);
  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), meals, plannedMeals, shoppingListItems, appSettings },
    null,
    2,
  );

  const fileName = `home-plate-${new Date().toISOString().slice(0, 10)}.json`;

  // Overwrite today's export if it already exists.
  const query = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
  const existingRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const existing = await existingRes.json();
  const existingId = existing.files?.[0]?.id as string | undefined;

  const metadata = { name: fileName, parents: existingId ? undefined : [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([payload], { type: 'application/json' }));

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  return fileName;
}

export async function listDriveExports(): Promise<DriveExportFile[]> {
  const token = await getToken();
  const folderId = await findOrCreateFolder(token);
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  return (data.files ?? []) as DriveExportFile[];
}

/** Imports a Drive export, adding meals/planned entries that don't
 * already exist locally (matched by id) rather than overwriting
 * everything — safer for merging between household members. */
export async function importFromDriveFile(
  fileId: string,
): Promise<{ imported: number; skipped: number }> {
  const token = await getToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  let imported = 0;
  let skipped = 0;

  for (const meal of data.meals ?? []) {
    const exists = await db.meals.get(meal.id);
    if (exists) skipped++;
    else {
      await db.meals.put(meal);
      imported++;
    }
  }
  for (const planned of data.plannedMeals ?? []) {
    const exists = await db.plannedMeals.get(planned.id);
    if (exists) skipped++;
    else {
      await db.plannedMeals.put(planned);
      imported++;
    }
  }

  return { imported, skipped };
}
