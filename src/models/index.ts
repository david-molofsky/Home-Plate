export type ColorMode = 'light' | 'dark';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

/** Only dinner is split into separate adult/kids meals — breakfast and
 * lunch are single (per product decision: "only some meals need the
 * kids/adult split; breakfast/lunch stay single"). */
export type Diner = 'adult' | 'kids';

export type EffortTag = 'easy' | 'time-consuming';
export type SizeTag = 'small' | 'big';
export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'none';

/**
 * Aisles used to be a fixed union type. They're now a household-editable,
 * ordered list (see services/aisles/aislesService) so people can hide
 * ones they don't use and add their own (e.g. "Household"). `Aisle` is
 * just the id of an AisleConfig entry — kept as its own type alias so
 * existing call sites (Ingredient.aisle, ShoppingListItem.aisle) don't
 * need to change shape, only what populates them.
 */
export type Aisle = string;

export interface AisleConfig {
  id: string;
  name: string;
  hidden: boolean;
}

/** Seed list — ids intentionally match the previous fixed union values
 * so ingredients/shopping items created before this change keep
 * resolving correctly. Only used the first time a household has no
 * aisles saved yet; after that, the household's own list in appSettings
 * is the source of truth. */
export const DEFAULT_AISLES: AisleConfig[] = [
  { id: 'produce', name: 'Produce', hidden: false },
  { id: 'dairy', name: 'Dairy', hidden: false },
  { id: 'meat', name: 'Meat', hidden: false },
  { id: 'bakery', name: 'Bakery', hidden: false },
  { id: 'pantry', name: 'Pantry', hidden: false },
  { id: 'frozen', name: 'Frozen', hidden: false },
  { id: 'other', name: 'Other', hidden: false },
];

export interface Ingredient {
  id: string;
  name: string;
  quantity: string; // free text, e.g. "2", "400g" — kept simple deliberately
  aisle: Aisle;
}

export interface RecipeStep {
  id: string;
  title: string;
  content: string;
  timerSeconds?: number;
}

export interface Meal {
  id: string;
  name: string;
  mealType: MealType;
  effort?: EffortTag;
  size?: SizeTag;
  dietary: DietaryTag[];
  isKidsMeal: boolean; // only meaningful when mealType === 'dinner'
  ingredients: Ingredient[];
  steps: RecipeStep[];
  notes?: string;
  wouldMakeAgain?: boolean;
  /** True when this meal was created via the "quick add to day" flow
   * (typed straight into a planner slot) rather than the full Add Meal
   * form. Surfaced as a filter in the Library so it can be found and
   * finished later; cleared by the person from the Edit Meal page once
   * they're happy with it. */
  isQuickAdd?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Present once household sync is set up — see services/householdSync. */
  realmId?: string;
}

/** A single meal assigned to a specific date. For dinner, two entries
 * can exist for the same date — one per Diner. Breakfast/lunch always
 * use diner: 'adult' (single meal for everyone). */
export interface PlannedMeal {
  id: string;
  date: string; // ISO date, YYYY-MM-DD
  mealType: MealType;
  diner: Diner;
  mealId: string;
  isLeftovers?: boolean; // e.g. "Leftover Tacos" sourced from a prior day
  madeAt?: string; // ISO — set when marked as actually made, feeds "last made" stats
  /** Present once household sync is set up — see services/householdSync. */
  realmId?: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: string;
  aisle: Aisle;
  checked: boolean;
  manual: boolean; // true if added manually rather than derived from planned meals
  /** Present once household sync is set up — see services/householdSync. */
  realmId?: string;
}

/** Shared household settings — stored in appSettings, which syncs via
 * the household's Dexie Cloud realm once sync is set up (see
 * services/householdSync). */
export const SETTINGS_KEYS = {
  colorMode: 'colorMode',
  dietaryDefaults: 'dietaryDefaults',
  aisles: 'aislesConfig',
} as const;

/** Device-local settings — stored in deviceSettings, which is excluded
 * from Dexie Cloud sync (see db.ts's `unsyncedTables`). These are
 * inherently per-device: a Drive OAuth token belongs to whichever
 * Google account this device connected, and auto-backup is deliberately
 * meant to run on one device only. */
export const DEVICE_SETTINGS_KEYS = {
  googleDriveToken: 'googleDriveToken',
  autoBackupEnabled: 'autoBackupEnabled',
  lastAutoBackupAt: 'lastAutoBackupAt',
} as const;

export interface AppSettingsRecord {
  key: string;
  value: unknown;
  /** Present once household sync is set up — see services/householdSync.
   * Absent (or the user's private realm) means this row is local-only. */
  realmId?: string;
}
