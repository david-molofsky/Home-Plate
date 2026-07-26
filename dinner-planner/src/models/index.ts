export type ColorMode = 'light' | 'dark';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

/** Only dinner is split into separate adult/kids meals — breakfast and
 * lunch are single (per product decision: "only some meals need the
 * kids/adult split; breakfast/lunch stay single"). */
export type Diner = 'adult' | 'kids';

export type EffortTag = 'easy' | 'time-consuming';
export type SizeTag = 'small' | 'big';
export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'none';

export const AISLES = [
  'produce',
  'dairy',
  'meat',
  'bakery',
  'pantry',
  'frozen',
  'other',
] as const;
export type Aisle = (typeof AISLES)[number];

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
  createdAt: string; // ISO
  updatedAt: string; // ISO
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
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: string;
  aisle: Aisle;
  checked: boolean;
  manual: boolean; // true if added manually rather than derived from planned meals
}

export const SETTINGS_KEYS = {
  householdCode: 'householdCode',
  colorMode: 'colorMode',
  dietaryDefaults: 'dietaryDefaults',
  autoBackupEnabled: 'autoBackupEnabled',
  lastAutoBackupAt: 'lastAutoBackupAt',
} as const;

export interface AppSettingsRecord {
  key: string;
  value: unknown;
}
