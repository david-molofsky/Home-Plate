import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import dayjs, { type Dayjs } from 'dayjs';
import { db } from '@/services/database/db';
import { getRepeatFlagsForRange } from '@/services/mealPlan/mealPlanService';
import { MealPickerDialog } from '@/components/planner/MealPickerDialog';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarPage() {
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const gridStart = month.startOf('week');
  const gridEnd = month.endOf('month').endOf('week');
  const cells: Dayjs[] = [];
  for (let d = gridStart; d.isBefore(gridEnd) || d.isSame(gridEnd, 'day'); d = d.add(1, 'day')) {
    cells.push(d);
  }

  const rangeStart = gridStart.format('YYYY-MM-DD');
  const rangeEnd = gridEnd.format('YYYY-MM-DD');

  const planned = useLiveQuery(
    () => db.plannedMeals.where('date').between(rangeStart, rangeEnd, true, true).toArray(),
    [rangeStart, rangeEnd],
  );
  const mealIds = [...new Set((planned ?? []).map((p) => p.mealId))];
  const meals = useLiveQuery(() => db.meals.bulkGet(mealIds), [mealIds.join(',')]);
  const mealById = new Map((meals ?? []).filter(Boolean).map((m) => [m!.id, m!]));

  const [repeatFlags, setRepeatFlags] = useState<Set<string>>(new Set());
  useMemo(() => {
    void getRepeatFlagsForRange(rangeStart, rangeEnd).then(setRepeatFlags);
  }, [rangeStart, rangeEnd, planned?.length]);

  const plannedByDate = new Map<string, typeof planned>();
  (planned ?? []).forEach((p) => {
    const list = plannedByDate.get(p.date) ?? [];
    list.push(p);
    plannedByDate.set(p.date, list as NonNullable<typeof planned>);
  });

  const today = dayjs().format('YYYY-MM-DD');

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        Calendar
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Showing dinner only. History kept for the last 6 weeks; plan ahead up to 3 months. Tap any
        day, past or future, to edit.
      </Typography>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <IconButton onClick={() => setMonth(month.subtract(1, 'month'))} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="subtitle2" fontWeight={600}>
          {month.format('MMMM YYYY')}
        </Typography>
        <IconButton onClick={() => setMonth(month.add(1, 'month'))} size="small">
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {DOW.map((d, i) => (
          <Typography key={i} variant="caption" color="text.secondary" align="center">
            {d}
          </Typography>
        ))}
        {cells.map((cell) => {
          const dateStr = cell.format('YYYY-MM-DD');
          const inMonth = cell.isSame(month, 'month');
          const entries = plannedByDate.get(dateStr) ?? [];
          const dinnerAdult = entries.find((e) => e.mealType === 'dinner' && e.diner === 'adult');
          const hasWarn = entries.some((e) => repeatFlags.has(e.id));
          return (
            <Box
              key={dateStr}
              onClick={() => setPickerDate(dateStr)}
              sx={{
                aspectRatio: '1 / 1',
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                opacity: inMonth ? 1 : 0.35,
                border: dateStr === today ? 1 : 0,
                borderColor: 'primary.main',
                p: 0.5,
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: 10 }}>
                {cell.date()}
              </Typography>
              {dinnerAdult && mealById.get(dinnerAdult.mealId) && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontSize: 8,
                    color: 'primary.light',
                    bgcolor: 'action.selected',
                    borderRadius: 0.5,
                    px: 0.3,
                    mt: 0.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {mealById.get(dinnerAdult.mealId)!.name}
                </Typography>
              )}
              {hasWarn && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: 'warning.main',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {pickerDate && (
        <MealPickerDialog
          open
          onClose={() => setPickerDate(null)}
          date={pickerDate}
          mealType="dinner"
          diner="adult"
        />
      )}
    </Box>
  );
}
