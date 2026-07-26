import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import type { Aisle, Meal, PlannedMeal, ShoppingListItem } from '@/models';

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

/** Builds the shopping list from all planned meals in a date range,
 * aggregating ingredients by name+aisle (case-insensitive) and summing
 * simple numeric quantities where possible; otherwise concatenates
 * quantity text. Manual items already in the list are preserved. */
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
      const key = `${ing.name.trim().toLowerCase()}__${ing.aisle}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity = combineQuantities(existing.quantity, ing.quantity);
      } else {
        aggregated.set(key, {
          id: key,
          name: ing.name,
          quantity: ing.quantity,
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

  return [...aggregated.values()].sort((a, b) => a.aisle.localeCompare(b.aisle));
}

function combineQuantities(a: string, b: string): string {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return String(numA + numB);
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
