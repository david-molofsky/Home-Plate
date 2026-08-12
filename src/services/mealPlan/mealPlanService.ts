import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import type { Aisle, Diner, Ingredient, IngredientUnit, Meal, PlannedMeal, ShoppingListItem } from '@/models';

/**
 * Flags dinners that repeat within any rolling 7-day window — not
 * calendar-week-bound. For each dinner PlannedMeal, we look at the 6
 * days before and after it (a 13-day window centered on it) and check
 * whether the same mealId + diner appears again within 7 days either
 * direction. Only dinner is checked (per product decision — breakfast
 * and lunch are skipped).
 *
 * Returns a Set of PlannedMeal ids that should show the repeat warning.
 */
export function findRepeatedDinners(plannedMeals: PlannedMeal[]): Set<string> {
  const dinners = plannedMeals.filter((p) => p.mealType === 'dinner');
  const flagged = new Set<string>();

  for (let i = 0; i < dinners.length; i++) {
    for (let j = i + 1; j < dinners.length; j++) {
      const a = dinners[i];
      const b = dinners[j];
      if (a.mealId !== b.mealId || a.diner !== b.diner) continue;
      const dayGap = Math.abs(dayjs(a.date).diff(dayjs(b.date), 'day'));
      if (dayGap > 0 && dayGap < 7) {
        flagged.add(a.id);
        flagged.add(b.id);
      }
    }
  }
  return flagged;
}

/** Loads planned dinners in a window wide enough to catch repeats that
 * straddle the edges of whatever range the UI is currently showing
 * (e.g. a Friday repeat that only shows up when you also look a few
 * days into the next week). Callers should pass their visible range;
 * this pads it by 6 days on each side before querying. */
export async function getRepeatFlagsForRange(
  rangeStart: string,
  rangeEnd: string,
): Promise<Set<string>> {
  const paddedStart = dayjs(rangeStart).subtract(6, 'day').format('YYYY-MM-DD');
  const paddedEnd = dayjs(rangeEnd).add(6, 'day').format('YYYY-MM-DD');
  const planned = await db.plannedMeals
    .where('date')
    .between(paddedStart, paddedEnd, true, true)
    .toArray();
  return findRepeatedDinners(planned);
}

/** Resolves which amount/unit to use for an ingredient given the diner
 * of the specific PlannedMeal entry it's being pulled in for. Only
 * dinner meals with category 'both' and a non-shared ingredient
 * actually split between adult/kid amounts; everything else always
 * uses the base quantity/unit/customUnit fields. */
function resolveIngredientAmount(
  meal: Meal,
  ing: Ingredient,
  diner: Diner,
): { amount: string; unit?: IngredientUnit; customUnit?: string } {
  const isSplit = meal.mealType === 'dinner' && meal.category === 'both' && ing.shared === false;
  if (!isSplit) {
    return { amount: ing.quantity, unit: ing.unit, customUnit: ing.customUnit };
  }
  return diner === 'kids'
    ? { amount: ing.kidQuantity ?? '', unit: ing.kidUnit, customUnit: ing.kidCustomUnit }
    : { amount: ing.adultQuantity ?? '', unit: ing.adultUnit, customUnit: ing.adultCustomUnit };
}

function formatAmount(amount: string, unit: IngredientUnit | undefined, customUnit: string | undefined): string {
  if (!amount) return '';
  const label = unit === 'other' ? customUnit ?? '' : unit ?? '';
  return label ? `${amount} ${label}` : amount;
}

/** Builds the shopping list from all planned meals in a date range,
 * aggregating ingredients by name+aisle (case-insensitive). Amounts
 * are resolved per-diner first (see resolveIngredientAmount) so split
 * "Both" ingredients pull the right adult/kid amount before summing.
 * Same-unit amounts are summed numerically; mismatched units fall back
 * to concatenated text — full consolidation with expandable per-source
 * sub-bullets is a separate, not-yet-built backlog item. Manual items
 * already in the list are preserved. */
export async function generateShoppingList(
  rangeStart: string,
  rangeEnd: string,
): Promise<ShoppingListItem[]> {
  const planned = await db.plannedMeals
    .where('date')
    .between(rangeStart, rangeEnd, true, true)
    .toArray();

  const mealIds = [...new Set(planned.map((p) => p.mealId))];
  const meals = await db.meals.bulkGet(mealIds);
  const mealById = new Map<string, Meal>();
  meals.forEach((m) => m && mealById.set(m.id, m));

  const aggregated = new Map<string, ShoppingListItem>();

  for (const p of planned) {
    const meal = mealById.get(p.mealId);
    if (!meal) continue;
    for (const ing of meal.ingredients) {
      const resolved = resolveIngredientAmount(meal, ing, p.diner);
      const formatted = formatAmount(resolved.amount, resolved.unit, resolved.customUnit);
      const key = `${ing.name.trim().toLowerCase()}__${ing.aisle}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity = combineQuantities(existing.quantity, formatted);
      } else {
        aggregated.set(key, {
          id: key,
          name: ing.name,
          quantity: formatted,
          aisle: ing.aisle,
          checked: false,
          manual: false,
        });
      }
    }
  }

  // Preserve any manually-added items already saved for this range.
  const existingManual = await db.shoppingListItems.filter((i) => i.manual).toArray();
  for (const item of existingManual) {
    aggregated.set(item.id, item);
  }

  return [...aggregated.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Sums two formatted amount strings (e.g. "2 cup", "400 g", "3") when
 * their units match; otherwise concatenates them as text so nothing is
 * silently dropped. Unit-aware so "2 cup" + "3 tbsp" no longer gets
 * wrongly summed as if both were bare numbers. */
function combineQuantities(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  const [numA, ...unitPartsA] = a.split(' ');
  const [numB, ...unitPartsB] = b.split(' ');
  const unitA = unitPartsA.join(' ');
  const unitB = unitPartsB.join(' ');
  const parsedA = Number(numA);
  const parsedB = Number(numB);
  if (!Number.isNaN(parsedA) && !Number.isNaN(parsedB) && unitA === unitB) {
    const sum = parsedA + parsedB;
    return unitA ? `${sum} ${unitA}` : String(sum);
  }
  return `${a} + ${b}`;
}

export function groupByAisle(items: ShoppingListItem[]): Record<Aisle, ShoppingListItem[]> {
  const grouped = {} as Record<Aisle, ShoppingListItem[]>;
  for (const item of items) {
    if (!grouped[item.aisle]) grouped[item.aisle] = [];
    grouped[item.aisle].push(item);
  }
  return grouped;
}

/** Checks whether assigning `mealId` to `diner` on `date` would land
 * within 7 days of another dinner planning of the same meal+diner —
 * used by the quick-add flow (to warn before assigning an existing
 * Library meal) and by the day-swap preview (to warn before committing
 * a swap). `excludeEntryIds` lets callers exclude specific PlannedMeal
 * rows from the check — e.g. the two rows involved in a swap, so they
 * don't conflict against their own old value. Returns the nearest
 * conflicting date, or null if there's no conflict. */
export async function checkRepeatConflict(
  date: string,
  diner: Diner,
  mealId: string,
  excludeEntryIds: string[] = [],
): Promise<string | null> {
  const start = dayjs(date).subtract(6, 'day').format('YYYY-MM-DD');
  const end = dayjs(date).add(6, 'day').format('YYYY-MM-DD');
  const nearby = await db.plannedMeals
    .where('date')
    .between(start, end, true, true)
    .and(
      (p) =>
        p.mealType === 'dinner' &&
        p.diner === diner &&
        p.mealId === mealId &&
        p.date !== date &&
        !excludeEntryIds.includes(p.id),
    )
    .toArray();

  if (nearby.length === 0) return null;

  nearby.sort(
    (a, b) =>
      Math.abs(dayjs(a.date).diff(dayjs(date), 'day')) -
      Math.abs(dayjs(b.date).diff(dayjs(date), 'day')),
  );
  return nearby[0].date;
}

async function findDinnerEntry(date: string, diner: Diner): Promise<PlannedMeal | undefined> {
  const rows = await db.plannedMeals.where('date').equals(date).toArray();
  return rows.find((p) => p.mealType === 'dinner' && p.diner === diner);
}

/** Swaps dinner between two dates — adult and kids independently.
 * Breakfast/lunch are untouched (per product decision: swap is
 * dinner-only). Handles the case where only one side has a dinner
 * planned by moving that entry to the other date rather than leaving
 * a stray empty row behind. */
export async function swapDinners(dateA: string, dateB: string): Promise<void> {
  await db.transaction('rw', db.plannedMeals, async () => {
    const diners: Diner[] = ['adult', 'kids'];
    for (const diner of diners) {
      const entryA = await findDinnerEntry(dateA, diner);
      const entryB = await findDinnerEntry(dateB, diner);

      if (entryA && entryB) {
        await db.plannedMeals.update(entryA.id, {
          mealId: entryB.mealId,
          isLeftovers: entryB.isLeftovers ?? false,
        });
        await db.plannedMeals.update(entryB.id, {
          mealId: entryA.mealId,
          isLeftovers: entryA.isLeftovers ?? false,
        });
      } else if (entryA && !entryB) {
        await db.plannedMeals.update(entryA.id, { date: dateB });
      } else if (!entryA && entryB) {
        await db.plannedMeals.update(entryB.id, { date: dateA });
      }
      // neither exists — nothing to swap for this diner
    }
  });
}

/** "Last made" + frequency stats for a meal, based on PlannedMeal rows
 * with a madeAt timestamp (set when a household member marks a planned
 * meal as actually made). */
export async function getMealStats(mealId: string) {
  const entries = await db.plannedMeals
    .where('mealId')
    .equals(mealId)
    .and((p) => !!p.madeAt)
    .toArray();
  if (entries.length === 0) return { lastMadeAt: null, timesMade: 0 };
  const sorted = entries.sort((a, b) => dayjs(b.madeAt).diff(dayjs(a.madeAt)));
  return { lastMadeAt: sorted[0].madeAt ?? null, timesMade: entries.length };
}
