import { useRef, useState } from 'react';
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
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { getAisleConfig } from '@/services/aisles/aislesService';
import { importRecipeFromPhoto, PhotoImportError } from '@/services/recipeImport/photoImportService';
import type { ParsedRecipe } from '@/services/recipeImport/recipeImportService';
import { downscaleImage } from '@/utils/image';
import { newId } from '@/utils/id';
import { ROUTES } from '@/routes/paths';
import type { Meal } from '@/models';

type Status = 'idle' | 'loading' | 'error';

/**
 * Recipe import via photo — backlog item, built alongside recipe URL
 * import (see ImportRecipePage, which this deliberately mirrors).
 * Choosing a photo runs on-device OCR (services/recipeImport/
 * photoImportService), then reuses the exact same "Set Aisles" review
 * dialog and Continue-into-EditMealPage flow as URL import. Nothing is
 * written to the database from this page — saving only happens once
 * the person hits Save on the pre-filled form.
 */
export function ImportPhotoPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [aislesOpen, setAislesOpen] = useState(false);
  const [ingredientAisles, setIngredientAisles] = useState<Record<string, string>>({});

  const aisleConfig = useLiveQuery(() => getAisleConfig(), []);
  const visibleAisleOptions = (aisleConfig ?? []).filter((a) => !a.hidden);

  const handleFileSelected = async (file: File) => {
    setStatus('loading');
    setErrorMessage('');
    try {
      // Run OCR (needs a larger, undownscaled-ish image to keep text
      // legible) and build the meal's stored thumbnail (the normal
      // ~300px pipeline) in parallel — the thumbnail is best-effort,
      // so a failure there shouldn't sink an otherwise-successful
      // import.
      const [result, thumbnail] = await Promise.all([
        importRecipeFromPhoto(file),
        downscaleImage(file).catch(() => undefined),
      ]);
      setParsed(result);
      setPhoto(thumbnail);
      setIngredientAisles(Object.fromEntries(result.ingredients.map((ing) => [ing.id, ing.aisle])));
      setStatus('idle');
      setAislesOpen(true);
    } catch (err) {
      setErrorMessage(
        err instanceof PhotoImportError
          ? err.message
          : "Couldn't read that photo — try a clearer or brighter shot.",
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

  const hasIngredients = (parsed?.ingredients.length ?? 0) > 0;

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Import from Photo
      </Typography>

      <Stack spacing={2}>
        <Typography variant="caption" color="text.secondary">
          Take a photo of a recipe card, cookbook page, or handwritten note — or choose one from
          your photo library. Text is read entirely on this device; the photo is never uploaded
          anywhere. You&apos;ll review and edit everything before saving.
        </Typography>

        {status === 'error' && (
          <Alert severity="error" onClose={() => setStatus('idle')}>
            {errorMessage}
          </Alert>
        )}

        {/* No `capture` attribute on purpose — that would force the
            camera and hide the "choose existing photo" option. Leaving
            it off lets the OS offer both, per confirmed decision. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleFileSelected(file);
          }}
        />

        <Button
          variant="contained"
          size="large"
          disabled={status === 'loading'}
          onClick={() => fileInputRef.current?.click()}
          startIcon={
            status === 'loading' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PhotoCameraOutlinedIcon />
            )
          }
        >
          {status === 'loading' ? 'Reading photo…' : 'Choose Photo'}
        </Button>

        {status === 'error' && (
          <Button variant="outlined" size="large" onClick={() => navigate(ROUTES.addMeal)}>
            Add Manually
          </Button>
        )}
      </Stack>

      <Dialog open={aislesOpen} onClose={() => setAislesOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Set Aisles</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {hasIngredients
              ? 'We matched some ingredients to your existing aisles. Review or change any before continuing.'
              : "We couldn't confidently separate ingredients from steps in this photo, so everything's been placed under Steps — you can promote lines to Ingredients on the next screen."}
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
            {!hasIngredients && (
              <Typography variant="body2" color="text.secondary">
                No ingredients were separated out from this photo.
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
