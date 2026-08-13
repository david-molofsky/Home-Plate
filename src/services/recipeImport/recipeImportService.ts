import { db } from '@/services/database/db';
import { getAisleConfig } from '@/services/aisles/aislesService';
import { newId } from '@/utils/id';
import type { Aisle, IngredientUnit, RecipeStep } from '@/models';

/**
 * Recipe import via URL — scoped backlog item #6. Fetches the target
 * page through a Cloudflare Worker CORS proxy (browsers can't fetch
 * arbitrary cross-origin pages directly), parses any schema.org/Recipe
 * JSON-LD block found on the page, and returns a best-effort draft the
 * person reviews and edits before saving — nothing here writes to the
 * database directly. If no JSON-LD Recipe is found, this throws rather
 * than falling back to guesswork scraping (explicit v1 scope decision).
 *
 * Requires VITE_RECIPE_IMPORT_WORKER_URL to point at a deployed
 * instance of cloudflare-worker/recipe-import-worker.js. See that
 * file's header comment for deployment steps.
 */

const WORKER_URL = (import.meta.env.VITE_RECIPE_IMPORT_WORKER_URL as string | undefined)?.replace(
  /\/+$/,
  '',
);

export type RecipeImportErrorCode = 'not-configured' | 'invalid-url' | 'fetch-failed' | 'not-found';

export class RecipeImportError extends Error {
  code: RecipeImportErrorCode;
  constructor(code: RecipeImportErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ParsedRecipeIngredient {
  id: string;
  name: string;
  quantity: string;
  unit?: IngredientUnit;
  aisle: Aisle;
}

export interface ParsedRecipe {
  name: string;
  ingredients: ParsedRecipeIngredient[];
  steps: RecipeStep[];
  imageUrl?: string;
}

/** Builds the Worker's image-proxy URL for a given remote image, used
 * so the browser canvas can downscale it without being CORS-tainted
 * (see utils/image.ts's downscaleImageFromUrl). Falls back to the raw
 * URL if no Worker is configured — the caller's downscale attempt will
 * then simply fail and be treated as best-effort/non-fatal. */
export function buildImageProxyUrl(imageUrl: string): string {
  if (!WORKER_URL) return imageUrl;
  return `${WORKER_URL}/image?url=${encodeURIComponent(imageUrl)}`;
}

async function fetchPageHtml(pageUrl: string): Promise<string> {
  if (!WORKER_URL) {
    throw new RecipeImportError(
      'not-configured',
      'Recipe import isn\u2019t set up yet \u2014 the app is missing its import proxy URL.',
    );
  }
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/fetch?url=${encodeURIComponent(pageUrl)}`);
  } catch {
    throw new RecipeImportError('fetch-failed', 'Could not reach that page \u2014 check the URL and try again.');
  }
  if (!res.ok) {
    throw new RecipeImportError('fetch-failed', `Could not fetch that page (error ${res.status}).`);
  }
  return res.text();
}

type JsonLdNode = Record<string, unknown>;

function isRecipeType(type: unknown): boolean {
  if (typeof type === 'string') return type.toLowerCase() === 'recipe';
  if (Array.isArray(type)) return type.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
  return false;
}

function findRecipeNode(data: unknown, depth = 0): JsonLdNode | null {
  if (depth > 4 || data == null) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === 'object') {
    const obj = data as JsonLdNode;
    if (isRecipeType(obj['@type'])) return obj;
    if (obj['@graph'] != null) {
      const found = findRecipeNode(obj['@graph'], depth + 1);
      if (found) return found;
    }
    if (obj.mainEntity != null) {
      const found = findRecipeNode(obj.mainEntity, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function stripHtml(input: string): string {
  const div = document.createElement('div');
  div.innerHTML = input;
  return (div.textContent ?? '').trim();
}

function flattenInstructions(data: unknown, depth = 0): string[] {
  if (depth > 4 || data == null) return [];
  if (typeof data === 'string') {
    const text = stripHtml(data);
    return text ? [text] : [];
  }
  if (Array.isArray(data)) return data.flatMap((item) => flattenInstructions(item, depth + 1));
  if (typeof data === 'object') {
    const obj = data as JsonLdNode;
    if (Array.isArray(obj.itemListElement)) return flattenInstructions(obj.itemListElement, depth + 1);
    const rawText = typeof obj.text === 'string' ? obj.text : typeof obj.name === 'string' ? obj.name : undefined;
    if (rawText) {
      const text = stripHtml(rawText);
      return text ? [text] : [];
    }
  }
  return [];
}

function extractImageUrl(image: unknown, depth = 0): string | undefined {
  if (depth > 3 || image == null) return undefined;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    for (const item of image) {
      const url = extractImageUrl(item, depth + 1);
      if (url) return url;
    }
    return undefined;
  }
  if (typeof image === 'object') {
    const obj = image as JsonLdNode;
    if (typeof obj.url === 'string') return obj.url;
  }
  return undefined;
}

// Recognized ingredient-line unit words, mapped to the app's
// IngredientUnit values. Only used to split a leading quantity+unit
// off the front of a recipeIngredient string on a best-effort basis
// â€” anything unrecognized is left as part of the ingredient name for
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

interface ParsedIngredientLine {
  quantity: string;
  unit?: IngredientUnit;
  name: string;
}

function parseIngredientLine(raw: string): ParsedIngredientLine {
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
async function guessAislesForIngredients(names: string[]): Promise<Map<string, string>> {
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

export async function importRecipeFromUrl(rawUrl: string): Promise<ParsedRecipe> {
  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    throw new RecipeImportError('invalid-url', 'That doesn\u2019t look like a valid URL.');
  }
  if (!/^https?:$/.test(target.protocol)) {
    throw new RecipeImportError('invalid-url', 'Only http/https links are supported.');
  }

  const html = await fetchPageHtml(target.toString());
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));

  let recipeNode: JsonLdNode | null = null;
  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent ?? '');
      recipeNode = findRecipeNode(json);
      if (recipeNode) break;
    } catch {
      // Malformed JSON-LD block on the page \u2014 skip and keep looking.
    }
  }

  if (!recipeNode) {
    throw new RecipeImportError('not-found', 'Couldn\u2019t find a recipe on that page.');
  }

  const name = typeof recipeNode.name === 'string' ? recipeNode.name : '';

  const rawIngredients = Array.isArray(recipeNode.recipeIngredient)
    ? recipeNode.recipeIngredient.filter((i): i is string => typeof i === 'string')
    : [];
  const parsedLines = rawIngredients.map(parseIngredientLine);
  const aisleGuesses = await guessAislesForIngredients(parsedLines.map((p) => p.name));
  const defaultAisle = (await getAisleConfig()).find((a) => !a.hidden)?.id ?? 'other';

  const ingredients: ParsedRecipeIngredient[] = parsedLines.map((p) => ({
    id: newId(),
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
    aisle: aisleGuesses.get(p.name.toLowerCase()) ?? defaultAisle,
  }));

  const instructionLines = flattenInstructions(recipeNode.recipeInstructions);
  const steps: RecipeStep[] = instructionLines.map((content, idx) => ({
    id: newId(),
    title: `Step ${idx + 1}`,
    content,
  }));

  const imageUrl = extractImageUrl(recipeNode.image);

  return { name, ingredients, steps, imageUrl };
}
