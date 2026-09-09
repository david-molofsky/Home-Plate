import { getAisleConfig } from '@/services/aisles/aislesService';
import { newId } from '@/utils/id';
import { prepareImageForOcr } from '@/utils/image';
import { parseIngredientLine, guessAislesForIngredients } from './ingredientLineParser';
import type { ParsedRecipe, ParsedRecipeIngredient } from './recipeImportService';
import type { RecipeStep } from '@/models';

/**
 * Recipe import via photo (backlog item: "Recipe import: Photo/OCR ...
 * still unscoped"). Runs entirely on-device via Tesseract.js — the
 * WASM engine and English language data are lazy-loaded from a CDN the
 * first time this is used (a few MB, one-time, then cached by the
 * browser) and text recognition itself happens locally; the photo is
 * never uploaded anywhere. Confirmed product decision: on-device
 * rather than a cloud OCR API, trading some accuracy for zero ongoing
 * cost and no photo ever leaving the device.
 *
 * The recognized text is split into title/ingredients/steps with the
 * same heuristics as recipe URL import and handed back in the exact
 * same ParsedRecipe shape, so ImportPhotoPage can reuse
 * ImportRecipePage's "Set Aisles" review dialog and Continue-into-
 * EditMealPage flow rather than building a second one. Nothing here
 * writes to the database — saving only happens once the person hits
 * Save on the pre-filled Add Meal form, same as every other import
 * path.
 *
 * Accuracy tradeoff (explicit v1 scope decision): unlike URL import's
 * structured JSON-LD parsing, there's no cleanup step here — messy
 * photos (poor lighting, handwriting, multi-column layouts) often need
 * real editing afterwards. If the OCR text doesn't contain a clearly
 * recognizable "Ingredients" heading followed by an "Instructions" /
 * "Directions" / "Steps" heading, everything is dumped into Steps for
 * the person to re-sort by hand rather than guessing at a split.
 */

export class PhotoImportError extends Error {}

type TesseractWorker = Awaited<ReturnType<typeof loadWorker>>;

async function loadWorker() {
  const { createWorker } = await import('tesseract.js');
  return createWorker('eng');
}

// Created lazily on first use and reused for the rest of the tab's
// life (rather than per-photo) since spinning one up loads several MB
// of engine/language assets — worth keeping warm across multiple
// imports in the same session.
let workerPromise: Promise<TesseractWorker> | null = null;

async function recognizeText(imageDataUrl: string): Promise<string> {
  if (!workerPromise) workerPromise = loadWorker();
  let worker: TesseractWorker;
  try {
    worker = await workerPromise;
  } catch {
    workerPromise = null; // let the next attempt retry instead of staying stuck on a failed load
    throw new PhotoImportError(
      "Couldn't load the on-device text reader — check your connection and try again.",
    );
  }
  const { data } = await worker.recognize(imageDataUrl);
  return data.text ?? '';
}

const INGREDIENTS_HEADING = /^ingredients?:?$/i;
const INSTRUCTIONS_HEADING = /^(instructions?|directions?|steps?|method)\s*:?$/i;

interface SplitSections {
  titleGuess: string;
  ingredientLines: string[];
  instructionLines: string[];
}

/** Splits raw OCR text into a title guess plus ingredient/instruction
 * blocks. Only splits ingredients out when BOTH a recognizable
 * "Ingredients" heading and a recognizable "Instructions"/"Directions"/
 * "Steps" heading are found, in that order — per the confirmed
 * fallback, anything less confident than that dumps everything into
 * instructionLines rather than guessing. */
function splitSections(rawText: string): SplitSections {
  const nonEmpty = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const titleGuess = nonEmpty[0] ?? '';
  const body = nonEmpty.slice(1);

  const ingredientsIdx = body.findIndex((line) => INGREDIENTS_HEADING.test(line));
  const instructionsIdx = body.findIndex((line) => INSTRUCTIONS_HEADING.test(line));

  if (ingredientsIdx !== -1 && instructionsIdx !== -1 && instructionsIdx > ingredientsIdx) {
    return {
      titleGuess,
      ingredientLines: body.slice(ingredientsIdx + 1, instructionsIdx),
      instructionLines: body.slice(instructionsIdx + 1),
    };
  }
  return { titleGuess, ingredientLines: [], instructionLines: body };
}

/** Full pipeline: photo File -> on-device OCR -> heuristic parse ->
 * ParsedRecipe. Throws PhotoImportError if no usable text was found at
 * all (a blank/blurred photo), rather than handing back an empty
 * recipe with nothing for the person to review. */
export async function importRecipeFromPhoto(file: File): Promise<ParsedRecipe> {
  const ocrImage = await prepareImageForOcr(file);
  const rawText = await recognizeText(ocrImage);
  const { titleGuess, ingredientLines, instructionLines } = splitSections(rawText);

  const parsedLines = ingredientLines.map(parseIngredientLine).filter((p) => p.name);
  const aisleGuesses = await guessAislesForIngredients(parsedLines.map((p) => p.name));
  const defaultAisle = (await getAisleConfig()).find((a) => !a.hidden)?.id ?? 'other';

  const ingredients: ParsedRecipeIngredient[] = parsedLines.map((p) => ({
    id: newId(),
    name: p.name,
    quantity: p.quantity,
    unit: p.unit,
    aisle: aisleGuesses.get(p.name.toLowerCase()) ?? defaultAisle,
  }));

  const steps: RecipeStep[] = instructionLines.map((content, idx) => ({
    id: newId(),
    title: `Step ${idx + 1}`,
    content,
  }));

  if (!titleGuess && ingredients.length === 0 && steps.length === 0) {
    throw new PhotoImportError(
      "Couldn't read any text in that photo — try a clearer, brighter, or closer shot.",
    );
  }

  return { name: titleGuess, ingredients, steps };
}
