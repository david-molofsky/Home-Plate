import { db } from '@/services/database/db';
import type { IngredientUnit } from '@/models';

/**
 * Shared by recipe URL import and recipe photo import (see
 * recipeImportService.ts and photoImportService.ts) — both end up with
 * a flat list of raw ingredient-line strings ("2 cups flour", "1/2 tsp
 * salt", scraped from JSON-LD or read via OCR) that need the same
 * best-effort quantity/unit split and aisle guessing.
 */

// Recognized ingredient-line unit words, mapped to the app's
// IngredientUnit values. Only used to split a leading quantity+unit
// off the front of an ingredient line on a best-effort basis —
// anything unrecognized is left as part of the ingredient name for
// the person to tidy up in the Set Aisles / review step.
const UNIT_SYNONYMS: Record<string, IngredientUnit> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  piece: 'pieces',
  pieces: 'pieces',
};

export interface ParsedIngredientLine {
  quantity: string;
  unit?: IngredientUnit;
  name: string;
}

export function parseIngredientLine(raw: string): ParsedIngredientLine {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  // Leading quantity: integer/decimal, simple fraction ("1/2"), or a
  // mixed number ("1 1/2"), optionally followed by a unit word.
  const match = trimmed.match(/^(\d+\s\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*([a-zA-Z]+)?\s+(.*)$/);
  if (!match) return { quantity: '', name: trimmed };
  const quantity = match[1] ?? '';
  const unitWord = match[2];
  const rest = match[3] ?? '';
  const unit = unitWord ? UNIT_SYNONYMS[unitWord.toLowerCase()] : undefined;
  // If the word after the quantity wasn't a recognized unit, keep it
  // as part of the name rather than silently discarding it.
  const name = (unit ? rest : [unitWord, rest].filter(Boolean).join(' ')).trim();
  return { quantity, unit, name: name || trimmed };
}

/** Looks at every existing meal's ingredients for a case-insensitive
 * exact name match and reuses that aisle as a best-effort guess. Read
 * only, so it's cheap to call outside a liveQuery. */
export async function guessAislesForIngredients(names: string[]): Promise<Map<string, string>> {
  const guesses = new Map<string, string>();
  const wanted = new Set(names.map((n) => n.toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return guesses;
  const meals = await db.meals.toArray();
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const key = ing.name.trim().toLowerCase();
      if (wanted.has(key) && !guesses.has(key)) {
        guesses.set(key, ing.aisle);
      }
    }
  }
  return guesses;
}
