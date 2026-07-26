import Dexie, { type EntityTable } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';
import type { Meal, PlannedMeal, ShoppingListItem, AppSettingsRecord } from '@/models';

/**
 * Local IndexedDB store via Dexie, synced live between household members
 * via Dexie Cloud (see services/householdSync). Google Drive export/
 * import (services/googleDrive) remains available as a manual/automatic
 * backup on top of that — not the primary sync path anymore.
 */
class HomePlateDB extends Dexie {
  meals!: EntityTable<Meal, 'id'>;
  plannedMeals!: EntityTable<PlannedMeal, 'id'>;
  shoppingListItems!: EntityTable<ShoppingListItem, 'id'>;
  appSettings!: EntityTable<AppSettingsRecord, 'key'>;
  /** Device-local settings that must never sync (Drive OAuth token, this
   * device's auto-backup preference/timestamp). Excluded from Dexie
   * Cloud sync via `unsyncedTables` below. */
  deviceSettings!: EntityTable<AppSettingsRecord, 'key'>;

  constructor() {
    super('homePlateDB', { addons: [dexieCloud] });
    this.version(1).stores({
      meals: 'id, mealType, isKidsMeal, name',
      plannedMeals: 'id, date, mealType, diner, mealId',
      shoppingListItems: 'id, aisle, checked',
      appSettings: 'key',
    });
    // v2: index isQuickAdd so the Library "Quick add" filter (and the
    // quick-add-to-day creation flow in MealPickerDialog) can query it
    // directly. Additive only — no upgrade() needed, existing rows just
    // read as isQuickAdd: undefined (= not a quick add).
    this.version(2).stores({
      meals: 'id, mealType, isKidsMeal, name, isQuickAdd',
      plannedMeals: 'id, date, mealType, diner, mealId',
      shoppingListItems: 'id, aisle, checked',
      appSettings: 'key',
    });
    // v3: Dexie Cloud migration. Index realmId on every table that
    // should be shareable with household members (Dexie Cloud uses this
    // to scope sync), and add a device-local deviceSettings table for
    // the handful of settings that must stay per-device (Drive token,
    // auto-backup toggle/timestamp — moved out of appSettings, see
    // services/googleDrive and hooks/useAutoBackup). Additive only.
    this.version(3).stores({
      meals: 'id, mealType, isKidsMeal, name, isQuickAdd, realmId',
      plannedMeals: 'id, date, mealType, diner, mealId, realmId',
      shoppingListItems: 'id, aisle, checked, realmId',
      appSettings: 'key, realmId',
      deviceSettings: 'key',
    });
  }
}

export const db = new HomePlateDB();

const databaseUrl = import.meta.env.VITE_DEXIE_CLOUD_URL as string | undefined;

/** Whether this build has a Dexie Cloud database configured at all.
 * Mirrors the Google Drive CLIENT_ID check — the app works fully
 * offline/local without either configured. */
export const isCloudConfigured = Boolean(databaseUrl);

if (databaseUrl) {
  db.cloud.configure({
    databaseUrl,
    requireAuth: false,
    unsyncedTables: ['deviceSettings'],
  });
}

// --- Household realm cache -------------------------------------------
// New rows in the tables below get auto-stamped with the household
// realm id (once one exists — see services/householdSync), so the rest
// of the app never has to think about realms when creating meals,
// planned meals, etc. The cache lives here (rather than in
// householdSyncService) purely to avoid a circular import between this
// file and that service, which both need each other's exports.

let cachedHouseholdRealmId: string | null = null;

export function setCachedHouseholdRealmId(realmId: string | null): void {
  cachedHouseholdRealmId = realmId;
}

export function getCachedHouseholdRealmId(): string | null {
  return cachedHouseholdRealmId;
}

const sharedTables = [db.meals, db.plannedMeals, db.shoppingListItems, db.appSettings];
for (const table of sharedTables) {
  table.hook('creating', (_primKey, obj: { realmId?: string }) => {
    if (!obj.realmId && cachedHouseholdRealmId) {
      obj.realmId = cachedHouseholdRealmId;
    }
  });
}
