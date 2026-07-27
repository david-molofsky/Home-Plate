import Dexie, { type EntityTable } from 'dexie';
import type { Meal, PlannedMeal, ShoppingListItem, AppSettingsRecord } from '@/models';

/**
 * Local IndexedDB store via Dexie. No live backend — household members
 * stay in sync by exporting/importing the same file via Google Drive
 * (see services/googleDrive), same pattern as Media Journal.
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
    super('homePlateDB');
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
    // v3: added a device-local deviceSettings table for the handful of
    // settings that must stay per-device and out of Drive exports (Drive
    // token, auto-backup toggle/timestamp — see services/googleDrive and
    // hooks/useAutoBackup). The realmId indexes below are unused leftovers
    // from a since-reverted household-sync experiment; harmless to leave
    // as-is rather than bump the schema again just to remove them.
    // Additive only.
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
