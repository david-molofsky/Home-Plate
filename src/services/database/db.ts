import Dexie, { type EntityTable } from 'dexie';
import type { Meal, PlannedMeal, ShoppingListItem, AppSettingsRecord } from '@/models';

/**
 * Local IndexedDB store via Dexie — same approach as Media Journal.
 * Data syncs between household members via the Google Drive
 * export/import flow (see services/googleDrive), not a live backend.
 */
class DinnerPlannerDB extends Dexie {
  meals!: EntityTable<Meal, 'id'>;
  plannedMeals!: EntityTable<PlannedMeal, 'id'>;
  shoppingListItems!: EntityTable<ShoppingListItem, 'id'>;
  appSettings!: EntityTable<AppSettingsRecord, 'key'>;

  constructor() {
    super('dinnerPlannerDB');
    this.version(1).stores({
      meals: 'id, mealType, isKidsMeal, name',
      plannedMeals: 'id, date, mealType, diner, mealId',
      shoppingListItems: 'id, aisle, checked',
      appSettings: 'key',
    });
  }
}

export const db = new DinnerPlannerDB();
