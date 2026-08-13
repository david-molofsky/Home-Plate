import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { getAisleConfig } from '@/services/aisles/aislesService';
import {
  importRecipeFromUrl,
  buildImageProxyUrl,
  RecipeImportError,
  type ParsedRecipe,
} from '@/services/recipeImport/recipeImportService';
import { downscaleImageFromUrl } from '@/utils/image';
import { newId } from '@/utils/id';
import { ROUTES } from '@/routes/paths';
import type { Meal } from '@/models';

type Status = 'idle' | 'loading' | 'error';

/**
 * Recipe import via URL \u2014 scoped backlog item #6. Paste a link, parse
 * it (see services/recipeImport), review/adjust ingredient aisles in
 * the Set Aisles dialog, then continue into the normal Add Meal form
 * (EditMealPage) pre-filled with the parsed name/ingredients/steps/
 * photo. Nothing is written to the database from this page \u2014 saving
 * only happens once the person hits Save on the pre-filled form, same
 * as any other meal.
 */
export function ImportRecipePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [aislesOpen, setAislesOpen] = useState(false);
  const [ingredientAisles, setIngredientAisles] = useState<Record<string, string>>({});

  const aisleConfig = useLiveQuery(() => getAisleConfig(), []);
  const visibleAisleOptions = (aisleConfig ?? []).filter((a) => !a.hidden);

  const handleImport = async () => {
    if (!url.trim()) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const result = await importRecipeFromUrl(url);
      setParsed(result);
      setIngredientAisles(Object.fromEntries(result.ingredients.map((ing) => [ing.id, ing.aisle])));

      if (result.imageUrl) {
        try {
          setPhoto(await downscaleImageFromUrl(buildImageProxyUrl(result.imageUrl)));
        } catch {
          // Photo import is best-effort \u2014 proceed without it rather
          // than failing the whole import over a broken/blocked image.
          setPhoto(undefined);
        }
      } else {
        setPhoto(undefined);
      }

      setStatus('idle');
      setAislesOpen(true);
    } catch (err) {
      setErrorMessage(
        err instanceof RecipeImportError
          ? err.message
          : "Couldn't import that page \u2014 check the URL and try again.",
      );
      setStatus('error');
    }
  };

  const handleContinue = () => {
    if (!parsed) return;
    const now = new Date().toISOString();
    const draft: Meal = {
      id: newId(),
      name: parsed.name,
      mealType: 'dinner',
      dietary: [],
      category: 'adult',
      ingredients: parsed.ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        aisle: ingredientAisles[ing.id] ?? ing.aisle,
        quantity: ing.quantity,
        unit: ing.unit,
        shared: true,
      })),
      steps: parsed.steps,
      photo,
      createdAt: now,
      updatedAt: now,
    };
    setAislesOpen(false);
    navigate(ROUTES.addMeal, { state: { importedMeal: draft } });
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Import from URL
      </Typography>

      <Stack spacing={2}>
        <TextField
          label="Recipe page URL"
          placeholder="https://example.com/recipes/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          fullWidth
          disabled={status === 'loading'}
        />
        <Typography variant="caption" color="text.secondary">
          Paste a link to any recipe page. Works best on sites that publish structured recipe
          data \u2014 most major recipe blogs and food sites do. You&apos;ll review and edit
          everything before saving.
        </Typography>

        {status === 'error' && (
          <Alert severity="error" onClose={() => setStatus('idle')}>
            {errorMessage}
          </Alert>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="large"
            disabled={!url.trim() || status === 'loading'}
            onClick={() => void handleImport()}
            startIcon={status === 'loading' ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ flex: 1 }}
          >
            {status === 'loading' ? 'Fetching recipe\u2026' : 'Import Recipe'}
          </Button>
          {status === 'error' && (
            <Button variant="outlined" size="large" onClick={() => navigate(ROUTES.addMeal)}>
              Add Manually
            </Button>
          )}
        </Stack>
      </Stack>

      <Dialog open={aislesOpen} onClose={() => setAislesOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Set Aisles</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            We matched some ingredients to your existing aisles. Review or change any before
            continuing.
          </Typography>
          <Stack spacing={1.5}>
            {(parsed?.ingredients ?? []).map((ing) => (
              <Stack key={ing.id} direction="row" spacing={1} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {ing.name || '(unnamed ingredient)'}
                  </Typography>
                  {(ing.quantity || ing.unit) && (
                    <Typography variant="caption" color="text.secondary">
                      {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                    </Typography>
                  )}
                </Box>
                <TextField
                  select
                  size="small"
                  value={ingredientAisles[ing.id] ?? ing.aisle}
                  onChange={(e) =>
                    setIngredientAisles((prev) => ({ ...prev, [ing.id]: e.target.value }))
                  }
                  sx={{ minWidth: 130, flexShrink: 0 }}
                >
                  {visibleAisleOptions.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            ))}
            {(parsed?.ingredients ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No ingredients were found on that page \u2014 you can add them manually next.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAislesOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleContinue}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
