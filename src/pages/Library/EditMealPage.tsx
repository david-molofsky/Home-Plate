import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { db } from '@/services/database/db';
import { newId } from '@/utils/id';
import { AISLES } from '@/models';
import type { DietaryTag, EffortTag, Ingredient, Meal, MealType, RecipeStep, SizeTag } from '@/models';
import { ROUTES } from '@/routes/paths';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
const EFFORT: EffortTag[] = ['easy', 'time-consuming'];
const SIZE: SizeTag[] = ['small', 'big'];
const DIETARY: DietaryTag[] = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];

function emptyMeal(): Meal {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: '',
    mealType: 'dinner',
    dietary: [],
    isKidsMeal: false,
    ingredients: [],
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function EditMealPage() {
  const { mealId } = useParams();
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal>(emptyMeal());
  const isNew = !mealId;

  useEffect(() => {
    if (mealId) {
      void db.meals.get(mealId).then((m) => m && setMeal(m));
    }
  }, [mealId]);

  const save = async () => {
    if (!meal.name.trim()) return;
    await db.meals.put({ ...meal, updatedAt: new Date().toISOString() });
    navigate(ROUTES.library);
  };

  const addIngredient = () => {
    const ing: Ingredient = { id: newId(), name: '', quantity: '', aisle: 'produce' };
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
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        {isNew ? 'Add Meal' : 'Edit Meal'}
      </Typography>

      <Stack spacing={2}>
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
          <FormControlLabel
            control={
              <Switch
                checked={meal.isKidsMeal}
                onChange={(e) => setMeal({ ...meal, isKidsMeal: e.target.checked })}
              />
            }
            label="This is a kids' meal"
          />
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

        <FormControlLabel
          control={
            <Switch
              checked={!!meal.wouldMakeAgain}
              onChange={(e) => setMeal({ ...meal, wouldMakeAgain: e.target.checked })}
            />
          }
          label="Would make again"
        />

        <Divider />

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Ingredients</Typography>
            <Button size="small" onClick={addIngredient}>
              + Add ingredient
            </Button>
          </Stack>
          <Stack spacing={1}>
            {meal.ingredients.map((ing) => (
              <Stack direction="row" spacing={1} key={ing.id} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Ingredient"
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                  sx={{ flex: 2 }}
                />
                <TextField
                  size="small"
                  placeholder="Qty"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(ing.id, { quantity: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  select
                  size="small"
                  value={ing.aisle}
                  onChange={(e) => updateIngredient(ing.id, { aisle: e.target.value as Ingredient['aisle'] })}
                  sx={{ flex: 1.5 }}
                >
                  {AISLES.map((a) => (
                    <MenuItem key={a} value={a}>
                      {a}
                    </MenuItem>
                  ))}
                </TextField>
                <IconButton size="small" onClick={() => removeIngredient(ing.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
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

        <Button variant="contained" size="large" onClick={() => void save()}>
          Save Meal
        </Button>
      </Stack>
    </Box>
  );
}
