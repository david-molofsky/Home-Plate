import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import BarcodeScannerIcon from '@mui/icons-material/BarcodeReader';
import { db } from '@/services/database/db';
import { newId } from '@/utils/id';
import { downscaleImage } from '@/utils/image';
import { getAisleConfig } from '@/services/aisles/aislesService';
import { isBarcodeScanAvailable } from '@/utils/barcodeScanSupport';
import { BarcodeScanDialog } from '@/components/common/BarcodeScanDialog';
import { CATEGORY_COLORS } from '@/theme/theme';
import dayjs from 'dayjs';
import type {
  DietaryTag,
  DinerCategory,
  EffortTag,
  Ingredient,
  IngredientUnit,
  Meal,
  MealType,
  RecipeStep,
  SizeTag,
} from '@/models';
import { ROUTES } from '@/routes/paths';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
const EFFORT: EffortTag[] = ['easy', 'time-consuming'];
const SIZE: SizeTag[] = ['small', 'big'];
const DIETARY: DietaryTag[] = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];
const CATEGORIES: DinerCategory[] = ['adult', 'kids', 'both'];
const CATEGORY_LABEL: Record<DinerCategory, string> = { adult: 'Adults', kids: 'Kids', both: 'Both' };
const UNIT_OPTIONS: IngredientUnit[] = ['g', 'kg', 'ml', 'l', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'pieces', 'other'];

function emptyMeal(): Meal {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: '',
    mealType: 'dinner',
    dietary: [],
    category: 'adult',
    ingredients: [],
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function EditMealPage() {
  const { mealId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Set once, via router state, by ImportRecipePage after the person
  // confirms Set Aisles \u2014 lets this screen double as the "review
  // imported recipe" step without duplicating the whole form. Only
  // read on first render (useState initializer), so it can't clobber
  // in-progress edits if location.state sticks around across renders.
  const importedMeal = (location.state as { importedMeal?: Meal } | null)?.importedMeal;
  const [meal, setMeal] = useState<Meal>(() => importedMeal ?? emptyMeal());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isNew = !mealId;

  // Barcode scanning — feature-detected once on mount rather than per
  // row, since support depends only on the browser/device, not on
  // anything about a specific ingredient. scanningIngredientId tracks
  // which row's scan button was tapped, so the shared dialog knows
  // which row to fill when a match comes back.
  const [barcodeScanAvailable, setBarcodeScanAvailable] = useState(false);
  const [scanningIngredientId, setScanningIngredientId] = useState<string | null>(null);
  useEffect(() => {
    void isBarcodeScanAvailable().then(setBarcodeScanAvailable);
  }, []);

  const aisleConfig = useLiveQuery(() => getAisleConfig(), []);
  const visibleAisleOptions = (aisleConfig ?? []).filter((a) => !a.hidden);
  const defaultAisleId = visibleAisleOptions[0]?.id ?? 'other';

  // Count of this meal's appearances on today or later, shown as a
  // heads-up in the delete confirmation (deleting the meal does not
  // touch already-planned days — see handleDelete).
  const upcomingUsageCount = useLiveQuery(async () => {
    if (!mealId) return 0;
    const today = dayjs().format('YYYY-MM-DD');
    return db.plannedMeals.where('mealId').equals(mealId).and((p) => p.date >= today).count();
  }, [mealId]);

  useEffect(() => {
    if (mealId) {
      void db.meals.get(mealId).then((m) => m && setMeal(m));
    }
  }, [mealId]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await downscaleImage(file);
      setMeal((m) => ({ ...m, photo: dataUrl }));
    } catch {
      setPhotoError("Couldn't process that photo — try a different file.");
    }
  };

  const save = async () => {
    if (!meal.name.trim()) return;
    await db.meals.put({ ...meal, updatedAt: new Date().toISOString() });
    navigate(ROUTES.library);
  };

  const handleDelete = async () => {
    if (!mealId) return;
    // plannedMeals stores only mealId, not a name snapshot, so once the
    // meal is gone any day that had it will render as an empty
    // ("tap to fill") slot rather than a stale name — the orphaned
    // plannedMeals row is left in place but is effectively invisible.
    // The confirm dialog warns about this before it happens.
    await db.meals.delete(mealId);
    setConfirmDeleteOpen(false);
    navigate(ROUTES.library);
  };

  const addIngredient = () => {
    const ing: Ingredient = {
      id: newId(),
      name: '',
      quantity: '',
      aisle: defaultAisleId,
      shared: true,
    };
    setMeal({ ...meal, ingredients: [...meal.ingredients, ing] });
  };
  const updateIngredient = (id: string, patch: Partial<Ingredient>) => {
    setMeal({
      ...meal,
      ingredients: meal.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  };
  const removeIngredient = (id: string) => {
    setMeal({ ...meal, ingredients: meal.ingredients.filter((i) => i.id !== id) });
  };

  // Renders one amount + unit dropdown (+ custom unit fallback when
  // "Other" is picked). Reused for the shared/single amount and for
  // each of the adult/kid split amounts on "Both" meals.
  const renderAmountRow = (
    amount: string,
    unit: IngredientUnit | undefined,
    customUnit: string | undefined,
    onChange: (patch: { amount?: string; unit?: IngredientUnit; customUnit?: string }) => void,
  ) => (
    <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
      <TextField
        size="small"
        placeholder="Amount"
        value={amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        sx={{ flex: 1 }}
      />
      <TextField
        select
        size="small"
        value={unit ?? ''}
        onChange={(e) => onChange({ unit: (e.target.value || undefined) as IngredientUnit | undefined })}
        sx={{ flex: 1.2 }}
        SelectProps={{ displayEmpty: true }}
      >
        <MenuItem value="">
          <em>Unit</em>
        </MenuItem>
        {UNIT_OPTIONS.map((u) => (
          <MenuItem key={u} value={u}>
            {u === 'other' ? 'Other…' : u}
          </MenuItem>
        ))}
      </TextField>
      {unit === 'other' && (
        <TextField
          size="small"
          placeholder="e.g. bunch"
          value={customUnit ?? ''}
          onChange={(e) => onChange({ customUnit: e.target.value })}
          sx={{ flex: 1.2 }}
        />
      )}
    </Stack>
  );

  const addStep = () => {
    const step: RecipeStep = { id: newId(), title: '', content: '' };
    setMeal({ ...meal, steps: [...meal.steps, step] });
  };
  const updateStep = (id: string, patch: Partial<RecipeStep>) => {
    setMeal({ ...meal, steps: meal.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };
  const removeStep = (id: string) => {
    setMeal({ ...meal, steps: meal.steps.filter((s) => s.id !== id) });
  };

  const toggleDietary = (tag: DietaryTag) => {
    setMeal({
      ...meal,
      dietary: meal.dietary.includes(tag)
        ? meal.dietary.filter((d) => d !== tag)
        : [...meal.dietary, tag],
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          {isNew ? 'Add Meal' : 'Edit Meal'}
        </Typography>
        {meal.isQuickAdd && (
          <Chip
            size="small"
            color="secondary"
            label="Quick add — tap to clear"
            onClick={() => setMeal({ ...meal, isQuickAdd: false })}
          />
        )}
      </Stack>

      <Stack spacing={2}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Photo (optional)
          </Typography>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handlePhotoSelect(e)}
          />
          {meal.photo ? (
            <Box sx={{ position: 'relative', mt: 0.5 }}>
              <Box
                component="img"
                src={meal.photo}
                alt=""
                sx={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 2, display: 'block' }}
              />
              <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, right: 8 }}>
                <Chip
                  size="small"
                  label="Replace"
                  onClick={() => photoInputRef.current?.click()}
                  sx={{ bgcolor: 'rgba(18,18,18,0.72)', color: '#fff' }}
                />
                <Chip
                  size="small"
                  label="Remove"
                  onClick={() => setMeal({ ...meal, photo: undefined })}
                  sx={{ bgcolor: 'rgba(18,18,18,0.72)', color: '#FF9E93' }}
                />
              </Stack>
            </Box>
          ) : (
            <Box
              onClick={() => photoInputRef.current?.click()}
              sx={{
                mt: 0.5,
                height: 110,
                border: '1.5px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                cursor: 'pointer',
                color: 'text.secondary',
              }}
            >
              <PhotoCameraOutlinedIcon fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                + Add Photo
              </Typography>
            </Box>
          )}
          {photoError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {photoError}
            </Typography>
          )}
        </Box>

        <TextField
          label="Name"
          value={meal.name}
          onChange={(e) => setMeal({ ...meal, name: e.target.value })}
          fullWidth
        />

        <TextField
          select
          label="Meal type"
          value={meal.mealType}
          onChange={(e) => setMeal({ ...meal, mealType: e.target.value as MealType })}
        >
          {MEAL_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>

        {meal.mealType === 'dinner' && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Who&apos;s this for?
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={CATEGORY_LABEL[c]}
                  onClick={() => setMeal({ ...meal, category: c })}
                  sx={{
                    fontWeight: 700,
                    bgcolor: meal.category === c ? CATEGORY_COLORS[c] : 'action.hover',
                    color: meal.category === c ? '#fff' : 'text.secondary',
                    '&:hover': { bgcolor: meal.category === c ? CATEGORY_COLORS[c] : 'action.selected' },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary">
            Effort
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            {EFFORT.map((e) => (
              <Chip
                key={e}
                label={e}
                color={meal.effort === e ? 'primary' : 'default'}
                onClick={() => setMeal({ ...meal, effort: meal.effort === e ? undefined : e })}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Size
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            {SIZE.map((s) => (
              <Chip
                key={s}
                label={s}
                color={meal.size === s ? 'primary' : 'default'}
                onClick={() => setMeal({ ...meal, size: meal.size === s ? undefined : s })}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Dietary
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {DIETARY.map((d) => (
              <Chip
                key={d}
                label={d}
                color={meal.dietary.includes(d) ? 'secondary' : 'default'}
                onClick={() => toggleDietary(d)}
              />
            ))}
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Ingredients</Typography>
            <Button size="small" onClick={addIngredient}>
              + Add ingredient
            </Button>
          </Stack>
          {meal.category === 'both' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              <b>Both</b> is selected — mark an ingredient Shared if the amount doesn&apos;t change
              based on adults vs. kids. Leave unchecked to set separate adult and kid amounts.
            </Typography>
          )}
          <Stack spacing={1.25}>
            {meal.ingredients.map((ing) => {
              const isSplit = meal.category === 'both' && ing.shared === false;
              return (
                <Stack
                  key={ing.id}
                  spacing={1}
                  sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 2 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      placeholder="Ingredient"
                      value={ing.name}
                      onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      select
                      size="small"
                      value={ing.aisle}
                      onChange={(e) => updateIngredient(ing.id, { aisle: e.target.value })}
                      sx={{ flex: 1.5 }}
                    >
                      {(aisleConfig ?? [])
                        .filter((a) => !a.hidden || a.id === ing.aisle)
                        .map((a) => (
                          <MenuItem key={a.id} value={a.id}>
                            {a.name}
                            {a.hidden ? ' (hidden)' : ''}
                          </MenuItem>
                        ))}
                    </TextField>
                    <IconButton size="small" onClick={() => removeIngredient(ing.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                    {barcodeScanAvailable && (
                      <IconButton
                        size="small"
                        aria-label="Scan barcode"
                        onClick={() => setScanningIngredientId(ing.id)}
                      >
                        <BarcodeScannerIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  {meal.category === 'both' && (
                    <FormControlLabel
                      sx={{ ml: 0 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={ing.shared !== false}
                          onChange={(e) => updateIngredient(ing.id, { shared: e.target.checked })}
                        />
                      }
                      label={
                        <Typography variant="caption" color="text.secondary">
                          Shared amount (same regardless of who&apos;s eating)
                        </Typography>
                      }
                    />
                  )}

                  {!isSplit ? (
                    renderAmountRow(ing.quantity, ing.unit, ing.customUnit, (patch) =>
                      updateIngredient(ing.id, {
                        ...(patch.amount !== undefined ? { quantity: patch.amount } : {}),
                        ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
                        ...(patch.customUnit !== undefined ? { customUnit: patch.customUnit } : {}),
                      }),
                    )
                  ) : (
                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="caption"
                          sx={{ width: 44, flexShrink: 0, fontWeight: 700, color: CATEGORY_COLORS.adult }}
                        >
                          ADULT
                        </Typography>
                        {renderAmountRow(ing.adultQuantity ?? '', ing.adultUnit, ing.adultCustomUnit, (patch) =>
                          updateIngredient(ing.id, {
                            ...(patch.amount !== undefined ? { adultQuantity: patch.amount } : {}),
                            ...(patch.unit !== undefined ? { adultUnit: patch.unit } : {}),
                            ...(patch.customUnit !== undefined ? { adultCustomUnit: patch.customUnit } : {}),
                          }),
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="caption"
                          sx={{ width: 44, flexShrink: 0, fontWeight: 700, color: CATEGORY_COLORS.kids }}
                        >
                          KID
                        </Typography>
                        {renderAmountRow(ing.kidQuantity ?? '', ing.kidUnit, ing.kidCustomUnit, (patch) =>
                          updateIngredient(ing.id, {
                            ...(patch.amount !== undefined ? { kidQuantity: patch.amount } : {}),
                            ...(patch.unit !== undefined ? { kidUnit: patch.unit } : {}),
                            ...(patch.customUnit !== undefined ? { kidCustomUnit: patch.customUnit } : {}),
                          }),
                        )}
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Recipe steps</Typography>
            <Button size="small" onClick={addStep}>
              + Add step
            </Button>
          </Stack>
          <Stack spacing={1.5}>
            {meal.steps.map((step, idx) => (
              <Stack key={step.id} spacing={1} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Step {idx + 1}
                  </Typography>
                  <IconButton size="small" onClick={() => removeStep(step.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  size="small"
                  placeholder="Title (e.g. Boil pasta)"
                  value={step.title}
                  onChange={(e) => updateStep(step.id, { title: e.target.value })}
                />
                <TextField
                  size="small"
                  placeholder="Instructions"
                  multiline
                  minRows={2}
                  value={step.content}
                  onChange={(e) => updateStep(step.id, { content: e.target.value })}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Timer (seconds, optional)"
                  value={step.timerSeconds ?? ''}
                  onChange={(e) =>
                    updateStep(step.id, {
                      timerSeconds: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  sx={{ maxWidth: 220 }}
                />
              </Stack>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1}>
          {!isNew && (
            <Button
              variant="outlined"
              color="error"
              size="large"
              onClick={() => setConfirmDeleteOpen(true)}
              sx={{ flex: 0.25, minWidth: 0, px: 1 }}
            >
              Delete
            </Button>
          )}
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate(ROUTES.library)}
            sx={{ flex: isNew ? 0.5 : 0.25, minWidth: 0, px: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="large"
            onClick={() => void save()}
            sx={{ flex: 0.5, minWidth: 0 }}
          >
            Save Meal
          </Button>
        </Stack>
      </Stack>

      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Delete &ldquo;{meal.name || 'this meal'}&rdquo;?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This removes it from your Library permanently. Any days already planned with this
            meal will show as unfilled slots — this won&apos;t delete those days themselves.
          </Typography>
          {!!upcomingUsageCount && (
            <Typography variant="body2" color="warning.main" sx={{ mt: 1.5 }}>
              ⚠ Planned on {upcomingUsageCount} upcoming day{upcomingUsageCount === 1 ? '' : 's'} —
              you&apos;ll need to refill {upcomingUsageCount === 1 ? 'it' : 'them'} with a
              different meal.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <BarcodeScanDialog
        open={scanningIngredientId !== null}
        onClose={() => setScanningIngredientId(null)}
        onFill={(name) => {
          if (scanningIngredientId) updateIngredient(scanningIngredientId, { name });
        }}
      />
    </Box>
  );
}
