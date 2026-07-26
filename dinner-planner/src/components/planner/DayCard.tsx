import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { MealPickerDialog } from '@/components/planner/MealPickerDialog';
import type { Diner, MealType, PlannedMeal } from '@/models';

interface DayCardProps {
  date: string; // YYYY-MM-DD
  repeatFlags: Set<string>;
}

interface Slot {
  mealType: MealType;
  diner: Diner;
}

export function DayCard({ date, repeatFlags }: DayCardProps) {
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null);
  const [showBreakfast, setShowBreakfast] = useState(false);
  const [showLunch, setShowLunch] = useState(false);

  const planned = useLiveQuery(
    () => db.plannedMeals.where('date').equals(date).toArray(),
    [date],
  );
  const mealIds = [...new Set((planned ?? []).map((p) => p.mealId))];
  const meals = useLiveQuery(() => db.meals.bulkGet(mealIds), [mealIds.join(',')]);
  const mealById = new Map((meals ?? []).filter(Boolean).map((m) => [m!.id, m!]));

  const findEntry = (mealType: MealType, diner: Diner): PlannedMeal | undefined =>
    (planned ?? []).find((p) => p.mealType === mealType && p.diner === diner);

  const breakfast = findEntry('breakfast', 'adult');
  const lunch = findEntry('lunch', 'adult');
  const dinnerAdult = findEntry('dinner', 'adult');
  const dinnerKids = findEntry('dinner', 'kids');

  const isToday = date === dayjs().format('YYYY-MM-DD');

  const renderSlotRow = (label: string, entry: PlannedMeal | undefined, mealType: MealType, diner: Diner) => {
    const meal = entry && mealById.get(entry.mealId);
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ width: 60, textTransform: 'uppercase', flexShrink: 0 }}>
          {label}
        </Typography>
        {meal ? (
          <>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {meal.name}
            </Typography>
            {entry && repeatFlags.has(entry.id) && (
              <Chip size="small" label="⚠ repeat" color="warning" variant="outlined" />
            )}
          </>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flex: 1, fontStyle: 'italic', cursor: 'pointer' }}
            onClick={() => setPickerSlot({ mealType, diner })}
          >
            tap to fill
          </Typography>
        )}
      </Stack>
    );
  };

  return (
    <Box
      sx={{
        borderRadius: '14px',
        bgcolor: isToday ? 'action.selected' : 'action.hover',
        border: isToday ? 1 : 0,
        borderColor: 'primary.main',
        p: 1.5,
        mb: 1,
      }}
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        {dayjs(date).format('dddd D MMM')}
      </Typography>

      {(breakfast || showBreakfast) && renderSlotRow('Breakfast', breakfast, 'breakfast', 'adult')}
      {(lunch || showLunch) && renderSlotRow('Lunch', lunch, 'lunch', 'adult')}

      <Stack direction="row" spacing={1} sx={{ py: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ width: 60, textTransform: 'uppercase', flexShrink: 0 }}>
          Dinner
        </Typography>
        <Stack sx={{ flex: 1 }} spacing={0.25}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 34, flexShrink: 0 }}>
              Adult
            </Typography>
            {dinnerAdult && mealById.get(dinnerAdult.mealId) ? (
              <>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {mealById.get(dinnerAdult.mealId)!.name}
                </Typography>
                {repeatFlags.has(dinnerAdult.id) && (
                  <Chip size="small" label="⚠ repeat" color="warning" variant="outlined" />
                )}
              </>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1, fontStyle: 'italic', cursor: 'pointer' }}
                onClick={() => setPickerSlot({ mealType: 'dinner', diner: 'adult' })}
              >
                tap to fill
              </Typography>
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 34, flexShrink: 0 }}>
              Kids
            </Typography>
            {dinnerKids && mealById.get(dinnerKids.mealId) ? (
              <Typography variant="body2" sx={{ flex: 1 }}>
                {mealById.get(dinnerKids.mealId)!.name}
              </Typography>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1, fontStyle: 'italic', cursor: 'pointer' }}
                onClick={() => setPickerSlot({ mealType: 'dinner', diner: 'kids' })}
              >
                tap to fill
              </Typography>
            )}
          </Stack>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
        {!breakfast && !showBreakfast && (
          <Button size="small" onClick={() => setShowBreakfast(true)} sx={{ px: 0, minWidth: 0 }}>
            + Add breakfast
          </Button>
        )}
        {!lunch && !showLunch && (
          <Button size="small" onClick={() => setShowLunch(true)} sx={{ px: 0, minWidth: 0 }}>
            + Add lunch
          </Button>
        )}
      </Stack>

      {pickerSlot && (
        <MealPickerDialog
          open
          onClose={() => setPickerSlot(null)}
          date={date}
          mealType={pickerSlot.mealType}
          diner={pickerSlot.diner}
        />
      )}
    </Box>
  );
}
