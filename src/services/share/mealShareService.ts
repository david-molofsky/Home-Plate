import { newId } from '@/utils/id';
import { toBase64Url, fromBase64Url } from '@/utils/base64Url';
import { db } from '@/services/database/db';
import type { DietaryTag, DinerCategory, EffortTag, Ingredient, Meal, MealType, RecipeStep, SizeTag } from '@/models';

/** Bumps only if the shape of what's shared changes in a way an older
 * build couldn't read — lets decodeSharedMeal reject payloads it
 * doesn't understand instead of misreading them. */
export const SHARE_PAYLOAD_VERSION = 1;

export interface SharedMealPayload {
  v: typeof SHARE_PAYLOAD_VERSION;
  meal: {
    name: string;
    mealType: MealType;
    effort?: EffortTag;
    size?: SizeTag;
    dietary: DietaryTag[];
    category: DinerCategory;
    ingredients: Ingredient[];
    steps: RecipeStep[];
    notes?: string;
    photo?: string;
  };
}

/** Strips the household-local fields (id, isQuickAdd, timestamps)
 * that only make sense inside the sender's own database. Everything
 * else that's actually part of the recipe is included as-is,
 * including the photo per product decision — a longer link in
 * exchange for a nicer preview on the recipient's end. */
function toSharePayload(meal: Meal): SharedMealPayload {
  return {
    v: SHARE_PAYLOAD_VERSION,
    meal: {
      name: meal.name,
      mealType: meal.mealType,
      effort: meal.effort,
      size: meal.size,
      dietary: meal.dietary,
      category: meal.category,
      ingredients: meal.ingredients,
      steps: meal.steps,
      notes: meal.notes,
      photo: meal.photo,
    },
  };
}

export function encodeMealForShare(meal: Meal): string {
  return toBase64Url(JSON.stringify(toSharePayload(meal)));
}

/** Returns null for anything that doesn't decode to a recognizable
 * payload — a corrupted link, a link from an unrelated app, or a
 * future payload version this build doesn't understand — so the
 * caller can show a clear "not a valid recipe" state instead of
 * crashing on malformed data. */
export function decodeSharedMeal(encoded: string): SharedMealPayload | null {
  try {
    const json = fromBase64Url(encoded);
    const parsed = JSON.parse(json) as Partial<SharedMealPayload>;
    if (parsed?.v !== SHARE_PAYLOAD_VERSION || !parsed.meal?.name) return null;
    return parsed as SharedMealPayload;
  } catch {
    return null;
  }
}

/** Builds the full shareable URL for a meal — self-contained (the
 * recipe is encoded right into the link), so it works whether or not
 * the recipient has ever opened Home Plate, with no server round-trip
 * needed to resolve it. */
export function buildShareUrl(meal: Meal): string {
  const encoded = encodeMealForShare(meal);
  return `${window.location.origin}${import.meta.env.BASE_URL}#/shared/${encoded}`;
}

/** Shares a meal via the native share sheet where available (mobile),
 * falling back to copying the link to the clipboard (desktop, or any
 * browser without Web Share support). Returns which path was taken so
 * the caller knows whether a confirmation toast is needed — the
 * native sheet is its own confirmation, but a clipboard copy isn't. */
export async function shareMeal(meal: Meal): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = buildShareUrl(meal);
  if (navigator.share) {
    try {
      await navigator.share({ title: meal.name, text: `${meal.name} — Home Plate recipe`, url });
      return 'shared';
    } catch (err) {
      // AbortError = the person backed out of the share sheet
      // themselves; not worth surfacing as an error. Anything else
      // falls through to the clipboard so the action still succeeds.
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

/** Saves a shared payload as a brand-new Library entry. Always
 * creates a fresh record (new id, fresh timestamps) rather than
 * deduping against existing meals — importing the same link twice
 * just makes two entries, which is the simplest correct behaviour for
 * v1 (dedupe-by-similarity is easy to get wrong and easy to add
 * later). */
export async function importSharedMeal(payload: SharedMealPayload): Promise<string> {
  const now = new Date().toISOString();
  const meal: Meal = {
    id: newId(),
    ...payload.meal,
    isQuickAdd: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.meals.put(meal);
  return meal.id;
}
