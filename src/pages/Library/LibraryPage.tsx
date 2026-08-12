import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { useNavigate } from 'react-router-dom';
import { db } from '@/services/database/db';
import { ROUTES, editMealPath } from '@/routes/paths';
import { CATEGORY_COLORS } from '@/theme/theme';
import type { MealType } from '@/models';

const TYPE_FILTERS: (MealType | 'all')[] = ['all', 'breakfast', 'lunch', 'dinner'];

export function LibraryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<MealType | 'all'>('all');
  const [quickOnly, setQuickOnly] = useState(false);

  const meals = useLiveQuery(() => db.meals.orderBy('name').toArray(), []);
  const quickAddCount = (meals ?? []).filter((m) => m.isQuickAdd).length;
  const filtered = (meals ?? []).filter(
    (m) => (filter === 'all' || m.mealType === filter) && (!quickOnly || m.isQuickAdd),
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Meal Library
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {TYPE_FILTERS.map((t) => (
          <Chip
            key={t}
            label={t}
            color={filter === t ? 'primary' : 'default'}
            onClick={() => setFilter(t)}
          />
        ))}
        {quickAddCount > 0 && (
          <Chip
            label={`Quick add (${quickAddCount})`}
            color={quickOnly ? 'secondary' : 'default'}
            onClick={() => setQuickOnly((v) => !v)}
          />
        )}
      </Stack>

      <Button variant="contained" onClick={() => navigate(ROUTES.addMeal)} sx={{ mb: 2 }}>
        + Add Meal
      </Button>

      {filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No meals yet — add your first one above.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((meal) => (
            <Card key={meal.id}>
              <CardActionArea onClick={() => navigate(editMealPath(meal.id))} sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={600}>{meal.name}</Typography>
                  <Chip size="small" label={meal.mealType} />
                </Stack>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {meal.isQuickAdd && <Chip size="small" color="secondary" label="quick add" />}
                  {meal.mealType === 'dinner' && (
                    <Chip
                      size="small"
                      label={meal.category === 'both' ? 'Both' : meal.category === 'kids' ? 'Kids' : 'Adults'}
                      sx={{
                        bgcolor: `${CATEGORY_COLORS[meal.category]}26`,
                        color: CATEGORY_COLORS[meal.category],
                        fontWeight: 700,
                      }}
                    />
                  )}
                  {meal.effort && <Chip size="small" label={meal.effort} />}
                  {meal.size && <Chip size="small" label={meal.size} />}
                  {meal.dietary.map((d) => (
                    <Chip key={d} size="small" color="secondary" variant="outlined" label={d} />
                  ))}
                </Stack>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
