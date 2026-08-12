import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { db } from '@/services/database/db';
import { CATEGORY_COLORS } from '@/theme/theme';
import { ROUTES, editMealPath } from '@/routes/paths';
import type { Ingredient } from '@/models';

const CATEGORY_LABEL = { adult: 'Adults', kids: 'Kids', both: 'Both' } as const;

export function MealDetailPage() {
  const { mealId } = useParams();
  const navigate = useNavigate();
  const meal = useLiveQuery(() => (mealId ? db.meals.get(mealId) : undefined), [mealId]);

  if (meal === undefined) {
    return null; // still loading
  }
  if (meal === null) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          This meal no longer exists.
        </Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate(ROUTES.library)}>
          Back to Library
        </Button>
      </Box>
    );
  }

  const isSplit = (ing: Ingredient) => meal.category === 'both' && ing.shared === false;

  const formatAmount = (amount: string, unit?: string, customUnit?: string) => {
    if (!amount) return '';
    const label = unit === 'other' ? customUnit ?? '' : unit ?? '';
    return label ? `${amount} ${label}` : amount;
  };

  const tags = [meal.effort, meal.size, ...meal.dietary].filter(Boolean).join(' · ');
  const canStartCooking = meal.steps.length > 0;

  return (
    <Box sx={{ mx: -2, mt: -2 }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <IconButton onClick={() => navigate(ROUTES.library)} aria-label="Back to Library">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }} noWrap>
          {meal.name || 'Meal Detail'}
        </Typography>
        <IconButton onClick={() => navigate(editMealPath(meal.id))} aria-label="Edit meal">
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>

      {meal.photo ? (
        <Box
          component="img"
          src={meal.photo}
          alt={meal.name}
          sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Box
          sx={{
            height: 120,
            bgcolor: 'action.hover',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
          }}
        >
          <RestaurantIcon sx={{ color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled">
            No photo yet
          </Typography>
        </Box>
      )}

      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {meal.mealType === 'dinner' && (
            <Chip
              size="small"
              label={CATEGORY_LABEL[meal.category]}
              sx={{
                bgcolor: `${CATEGORY_COLORS[meal.category]}26`,
                color: CATEGORY_COLORS[meal.category],
                fontWeight: 700,
              }}
            />
          )}
          {meal.isQuickAdd && <Chip size="small" color="secondary" label="quick add" />}
        </Stack>

        {tags && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tags}
          </Typography>
        )}

        {meal.ingredients.length > 0 && (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Ingredients
            </Typography>
            <Stack sx={{ mt: 0.5, mb: 2 }}>
              {meal.ingredients.map((ing) =>
                isSplit(ing) ? (
                  <Box key={ing.id} sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="body2">{ing.name}</Typography>
                    <Stack direction="row" justifyContent="space-between" sx={{ pl: 1 }}>
                      <Typography variant="caption" sx={{ color: CATEGORY_COLORS.adult, fontWeight: 700 }}>
                        ADULT
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatAmount(ing.adultQuantity ?? '', ing.adultUnit, ing.adultCustomUnit) || '—'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" sx={{ pl: 1 }}>
                      <Typography variant="caption" sx={{ color: CATEGORY_COLORS.kids, fontWeight: 700 }}>
                        KID
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatAmount(ing.kidQuantity ?? '', ing.kidUnit, ing.kidCustomUnit) || '—'}
                      </Typography>
                    </Stack>
                  </Box>
                ) : (
                  <Stack
                    key={ing.id}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Typography variant="body2">{ing.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatAmount(ing.quantity, ing.unit, ing.customUnit)}
                    </Typography>
                  </Stack>
                ),
              )}
            </Stack>
          </>
        )}

        {meal.steps.length > 0 && (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Steps
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5, mb: 2 }}>
              {meal.steps.map((step, idx) => (
                <Typography key={step.id} variant="body2" color="text.secondary">
                  {idx + 1}. {step.title || step.content}
                </Typography>
              ))}
            </Stack>
          </>
        )}

        {meal.notes && (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Notes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
              {meal.notes}
            </Typography>
          </>
        )}

        <Divider sx={{ my: 1 }} />

        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<PlayArrowIcon />}
          disabled={!canStartCooking}
          sx={{ mt: 1 }}
          // Cooking Mode itself (the full-screen step-by-step timer UI)
          // is a separate, not-yet-built backlog item — this button is
          // wired up to be enabled/disabled correctly ahead of that, but
          // doesn't navigate anywhere yet.
        >
          {canStartCooking ? 'Start Cooking' : 'Add steps to enable cooking mode'}
        </Button>
        <Button fullWidth variant="outlined" size="large" sx={{ mt: 1 }} onClick={() => navigate(editMealPath(meal.id))}>
          Edit Meal
        </Button>
      </Box>
    </Box>
  );
}
