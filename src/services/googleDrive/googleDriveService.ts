import { db } from '@/services/database/db';
import { DEVICE_SETTINGS_KEYS, type SharedDriveFolder } from '@/models';

/**
 * Google Drive integration — adapted from Media Journal's
 * googleDriveService.ts. Uses Google Identity Services (GIS) for OAuth
 * and the `drive.file` scope, so this app can only see files it
 * creates itself — plus, once a household folder is connected via the
 * Picker below, that one folder too.
 *
 * SETUP REQUIRED before this works:
 *   1. Create a Google Cloud project, enable the Drive API.
 *   2. Create an OAuth 2.0 Client ID (Web application) and add your
 *      app's origin(s) to Authorized JavaScript origins.
 *   3. Put the client ID in .env as VITE_GOOGLE_CLIENT_ID.
 *   4. For the "connect a shared folder" feature: enable the Google
 *      Picker API in the same Cloud project, create an API key, and
 *      put it in .env as VITE_GOOGLE_PICKER_API_KEY.
 * See README.md for the full walkthrough.
 */

const TOKEN_KEY = 'googleDriveToken';
const FOLDER_NAME = 'Home Plate';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const PICKER_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY as string | undefined;
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
      picker?: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { FOLDERS: string };
        DocsView: new (viewId: string) => GoogleDocsView;
        Action: { PICKED: string; CANCEL: string };
      };
    };
    gapi?: {
      load(api: string, callback: () => void): void;
    };
  }
}

interface GoogleDocsView {
  setIncludeFolders(include: boolean): GoogleDocsView;
  setSelectFolderEnabled(enabled: boolean): GoogleDocsView;
  setMimeTypes(mimeTypes: string): GoogleDocsView;
}

interface GooglePickerDoc {
  id: string;
  name: string;
}

interface GooglePickerResponse {
  action: string;
  docs?: GooglePickerDoc[];
}

interface GooglePickerBuilder {
  addView(view: GoogleDocsView): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setOrigin(origin: string): GooglePickerBuilder;
  setCallback(callback: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
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

function loadPickerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) return resolve();
    const start = () => {
      if (!window.gapi) {
        reject(new Error('Could not load Google API loader.'));
        return;
      }
      window.gapi.load('picker', () => resolve());
    };
    if (window.gapi) {
      start();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.onload = start;
    script.onerror = () => reject(new Error('Could not load the Google Picker.'));
    document.head.appendChild(script);
  });
}

async function getToken(): Promise<string> {
  const record = await db.deviceSettings.get(TOKEN_KEY);
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
        await db.deviceSettings.put({ key: TOKEN_KEY, value: resp.access_token });
        resolve();
      },
    });
    client.requestAccessToken();
  });
}

export async function signOutOfDrive(): Promise<void> {
  await db.deviceSettings.delete(TOKEN_KEY);
}

async function findOrCreateOwnFolder(token: string): Promise<string> {
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

/** Resolves which Drive folder Export/Import/List should target on this
 * device: a shared folder connected via the Picker (see
 * openFolderPicker/setSharedFolder), if one is set, otherwise this
 * device's own "Home Plate" folder (created on first use). Checked
 * fresh on every call rather than cached, since the shared-folder
 * setting can change between calls (e.g. right after "Change folder"). */
async function resolveTargetFolder(token: string): Promise<string> {
  const shared = await getSharedFolder();
  if (shared) return shared.id;
  return findOrCreateOwnFolder(token);
}

/** Reads the currently-connected shared household folder, if this
 * device has one set. Returns null when using the default (own)
 * folder. */
export async function getSharedFolder(): Promise<SharedDriveFolder | null> {
  const record = await db.deviceSettings.get(DEVICE_SETTINGS_KEYS.sharedDriveFolder);
  return (record?.value as SharedDriveFolder | undefined) ?? null;
}

/** Points this device's Export/Import/List at a shared folder instead
 * of its own default one. Called after a successful Picker selection. */
export async function setSharedFolder(folder: SharedDriveFolder): Promise<void> {
  await db.deviceSettings.put({ key: DEVICE_SETTINGS_KEYS.sharedDriveFolder, value: folder });
}

/** Reverts this device to its own default "Home Plate" folder. */
export async function clearSharedFolder(): Promise<void> {
  await db.deviceSettings.delete(DEVICE_SETTINGS_KEYS.sharedDriveFolder);
}

/** Opens Google's native folder picker, scoped to folders shared with
 * the signed-in account (Drive handles the actual access control —
 * this just lets the person point the app at one of them). Requires
 * VITE_GOOGLE_PICKER_API_KEY; throws a clear error if it's missing
 * rather than silently failing. Resolves to the chosen folder, or null
 * if the person closed the picker without choosing one.
 *
 * setOrigin() is required, not optional — without it the Picker can
 * render its dimmed backdrop but fail to load the actual dialog iframe
 * on top of it (postMessage origin check fails), leaving the page
 * stuck on a grey overlay with nothing to interact with and no error.
 * A timeout guards the same failure mode for causes setOrigin doesn't
 * fix (e.g. third-party cookies/trackers blocked), so the promise
 * always settles instead of hanging forever. */
export async function openFolderPicker(): Promise<SharedDriveFolder | null> {
  if (!PICKER_API_KEY) {
    throw new Error(
      'The folder picker is not configured. Add VITE_GOOGLE_PICKER_API_KEY to your .env file — see README.md.',
    );
  }
  const token = await getToken();
  await loadPickerScript();

  return new Promise((resolve, reject) => {
    const picker = window.google!.picker!;
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          'The folder picker did not load. This is usually third-party cookies or trackers ' +
            'being blocked for accounts.google.com — try allowing them for this site, or a ' +
            'different browser, then try again.',
        ),
      );
    }, 10000);

    try {
      const view = new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');

      const instance = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(PICKER_API_KEY)
        .setOrigin(window.location.origin)
        .setTitle('Choose a household folder')
        .setCallback((data: GooglePickerResponse) => {
          if (settled) return;
          if (data.action === picker.Action.PICKED && data.docs?.[0]) {
            settled = true;
            window.clearTimeout(timeout);
            const doc = data.docs[0];
            resolve({ id: doc.id, name: doc.name });
          } else if (data.action === picker.Action.CANCEL) {
            settled = true;
            window.clearTimeout(timeout);
            resolve(null);
          }
        })
        .build();
      instance.setVisible(true);
    } catch (err) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(err instanceof Error ? err : new Error('Could not open the folder picker.'));
    }
  });
}

/** Exports the full local database (meals, planned meals, shopping
 * list, dietary defaults) as a single JSON file, named by today's
 * date, into this device's target folder — either its own "Home
 * Plate" folder, or a shared household folder if one is connected
 * (see resolveTargetFolder). Overwrites an export from today if one
 * already exists, so repeated exports in a day don't pile up. */
export async function exportToGoogleDrive(): Promise<string> {
  const token = await getToken();
  const folderId = await resolveTargetFolder(token);

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
  const folderId = await resolveTargetFolder(token);
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
