import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { decodeSharedMeal, importSharedMeal } from '@/services/share/mealShareService';
import { CATEGORY_COLORS } from '@/theme/theme';
import { ROUTES, mealDetailPath } from '@/routes/paths';
import type { Ingredient } from '@/models';

const CATEGORY_LABEL = { adult: 'Adults', kids: 'Kids', both: 'Both' } as const;

/** Public, read-only view for a shared meal link — deliberately
 * outside AppLayout (no bottom nav / settings icon) since whoever
 * opens this link may never have used Home Plate before. Works purely
 * from the URL: the recipe is decoded client-side from the link
 * itself, so viewing it needs no household data and no network
 * request. The one write this page can do is "Add to my library",
 * which saves straight into whichever browser/device opened the
 * link. */
export function SharedMealPage() {
  const { payload } = useParams();
  const navigate = useNavigate();
  const decoded = payload ? decodeSharedMeal(payload) : null;

  const [importedMealId, setImportedMealId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!decoded) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', maxWidth: 420, mx: 'auto' }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          🍽️ Home Plate
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This link doesn't lead to a valid recipe — it may be broken, incomplete, or from a
          newer version of the app.
        </Typography>
        <Button variant="contained" onClick={() => navigate(ROUTES.planner)}>
          Open my Home Plate
        </Button>
      </Box>
    );
  }

  const meal = decoded.meal;
  const isSplit = (ing: Ingredient) => meal.category === 'both' && ing.shared === false;
  const formatAmount = (amount: string, unit?: string, customUnit?: string) => {
    if (!amount) return '';
    const label = unit === 'other' ? customUnit ?? '' : unit ?? '';
    return label ? `${amount} ${label}` : amount;
  };
  const tags = [meal.effort, meal.size, ...meal.dietary].filter(Boolean).join(' · ');

  const handleImport = async () => {
    setImporting(true);
    try {
      const id = await importSharedMeal(decoded);
      setImportedMealId(id);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          🍽️ Home Plate
        </Typography>
        <Button size="small" onClick={() => navigate(ROUTES.planner)}>
          Open my Home Plate →
        </Button>
      </Stack>

      {meal.photo ? (
        <Box
          component="img"
          src={meal.photo}
          alt={meal.name}
          sx={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Box
          sx={{
            height: 120,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RestaurantIcon sx={{ color: 'text.disabled' }} />
        </Box>
      )}

      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          {meal.name}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <Chip size="small" label={meal.mealType} />
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

        {importedMealId ? (
          <Button
            fullWidth
            variant="contained"
            size="large"
            color="success"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={() => navigate(mealDetailPath(importedMealId))}
            sx={{ mt: 1 }}
          >
            Added — View in Library
          </Button>
        ) : (
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={importing}
            onClick={() => void handleImport()}
            sx={{ mt: 1 }}
          >
            {importing ? 'Adding…' : '+ Add to my Home Plate library'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
