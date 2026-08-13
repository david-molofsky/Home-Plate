export type ColorMode = 'light' | 'dark';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

/** Only dinner is split into separate adult/kids meals — breakfast and
 * lunch are single (per product decision: "only some meals need the
 * kids/adult split; breakfast/lunch stay single"). */
export type Diner = 'adult' | 'kids';

export type EffortTag = 'easy' | 'time-consuming';
export type SizeTag = 'small' | 'big';
export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'none';

/** Replaces the old boolean isKidsMeal flag. Only meaningful when
 * mealType === 'dinner' — breakfast/lunch always behave as a single
 * shared meal regardless of this value. */
export type DinerCategory = 'adult' | 'kids' | 'both';

/** Standard unit options for ingredient amounts. 'other' triggers a
 * free-text custom unit (see Ingredient.customUnit /
 * .adultCustomUnit / .kidCustomUnit) — custom units are excluded from
 * shopping-list auto-consolidation matching since they can't be
 * reliably compared. */
export type IngredientUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'oz'
  | 'lb'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'pieces'
  | 'other';

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
  aisle: Aisle;
  /** Free-text amount, e.g. "2", "1/2" — kept simple deliberately.
   * Used directly when the owning meal's category isn't 'both', or
   * when it is 'both' but `shared` isn't explicitly false. Existing
   * ingredients created before units existed keep working unchanged:
   * `unit` stays undefined/blank until that meal is next edited — no
   * forced migration. */
  quantity: string;
  unit?: IngredientUnit;
  /** Only populated when unit === 'other'. */
  customUnit?: string;
  /** Only meaningful when the owning meal's category is 'both'.
   * true/undefined (default) = one amount (quantity/unit above) used
   * regardless of which dinner slot(s) the meal is planned into.
   * false = separate adult/kid amounts below, summed only when the
   * meal is planned into both the Adult and Kids dinner slot on the
   * same day; otherwise only the relevant diner's amount is used. */
  shared?: boolean;
  adultQuantity?: string;
  adultUnit?: IngredientUnit;
  adultCustomUnit?: string;
  kidQuantity?: string;
  kidUnit?: IngredientUnit;
  kidCustomUnit?: string;
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
  /** Only meaningful when mealType === 'dinner' — see DinerCategory. */
  category: DinerCategory;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  notes?: string;
  /** Downscaled photo as a data URL (~300px longest edge, ~70%
   * quality JPEG — see utils/image.ts). No full-resolution original is
   * kept; the resize happens client-side at upload time. Optional and
   * purely additive, so no Dexie schema bump was needed for it. */
  photo?: string;
  /** True when this meal was created via the "quick add to day" flow
   * (typed straight into a planner slot) rather than the full Add Meal
   * form. Surfaced as a filter in the Library so it can be found and
   * finished later; cleared by the person from the Edit Meal page once
   * they're happy with it. */
  isQuickAdd?: boolean;
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

/** One contributing meal's amount for an ingredient that couldn't be
 * safely summed with the others (mismatched or custom units). Shown
 * as an always-expanded sub-bullet under the grouped ingredient line,
 * with mealName as a tappable link to that meal's Library entry. */
export interface ShoppingListItemSource {
  mealId: string;
  mealName: string;
  /** Formatted "amount unit" string for this specific source, e.g.
   * "2 cup" — may be blank if the ingredient had no amount set. */
  amount: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  aisle: Aisle;
  checked: boolean;
  manual: boolean; // true if added manually rather than derived from planned meals
  /** Combined "amount unit" display string, e.g. "4 cloves" — set
   * when every contributing source shares the same standard unit (or
   * there's only one source). Mutually exclusive with `sources`. */
  quantity?: string;
  /** Set only when multiple sources exist with mismatched or custom
   * units that couldn't be safely summed — one entry per contributing
   * meal, always rendered expanded rather than collapsed/tap-to-reveal.
   * Mutually exclusive with `quantity`. */
  sources?: ShoppingListItemSource[];
}

/** Shared household settings — stored in appSettings, which is included
 * in Google Drive export/import (see services/googleDrive), so these
 * travel with the rest of the household's plan. */
/** A currently-running cooking-mode timer. Stored device-locally (see
 * DEVICE_SETTINGS_KEYS.activeCookingTimer) keyed off a target
 * end-timestamp rather than a countdown value, so elapsed time is
 * still correct after the tab is backgrounded/resumed — a plain
 * setInterval countdown can't be trusted to fire on schedule if
 * suspended. */
export interface ActiveCookingTimer {
  mealId: string;
  mealName: string;
  stepId: string;
  stepTitle: string;
  targetEndsAt: string; // ISO
}

export const SETTINGS_KEYS = {
  colorMode: 'colorMode',
  dietaryDefaults: 'dietaryDefaults',
  aisles: 'aislesConfig',
} as const;

/** Device-local settings — stored in deviceSettings, which is
 * deliberately excluded from Drive export/import (see
 * services/googleDrive's exportToGoogleDrive). These are inherently
 * per-device: a Drive OAuth token belongs to whichever Google account
 * this device connected, and auto-backup is meant to run on one device
 * only, so neither should ever end up inside an exported file. */
export const DEVICE_SETTINGS_KEYS = {
  googleDriveToken: 'googleDriveToken',
  autoBackupEnabled: 'autoBackupEnabled',
  lastAutoBackupAt: 'lastAutoBackupAt',
  /** Currently-running cooking-mode timer, if any (see
   * hooks/useCookingTimer). Device-local and excluded from Drive
   * export/import like the rest of this table — a timer belongs to
   * whichever device is actually in the kitchen. */
  activeCookingTimer: 'activeCookingTimer',
  /** Optional override pointing this device's Export/Import at a Drive
   * folder shared by another household member, instead of the default
   * folder this device's own account creates for itself (see
   * services/googleDrive's resolveTargetFolder). Value shape: see
   * SharedDriveFolder. Device-local like the rest of this table — each
   * device picks its own target folder independently. */
  sharedDriveFolder: 'sharedDriveFolder',
} as const;

/** A Drive folder another household member shared, that this device has
 * pointed its Export/Import at via the Google Picker (see
 * services/googleDrive's openFolderPicker). Stored under
 * DEVICE_SETTINGS_KEYS.sharedDriveFolder. `owner` is best-effort (the
 * Picker doesn't always return it) and purely for display — it's never
 * used to decide access, Drive's own sharing permissions handle that. */
export interface SharedDriveFolder {
  id: string;
  name: string;
  owner?: string;
}

export interface AppSettingsRecord {
  key: string;
  value: unknown;
}
