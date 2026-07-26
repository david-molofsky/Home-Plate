import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { DayCard } from '@/components/planner/DayCard';
import { getRepeatFlagsForRange } from '@/services/mealPlan/mealPlanService';

export function WeeklyPlannerPage() {
  const weekStart = dayjs().startOf('week');
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day').format('YYYY-MM-DD'));

  const [repeatFlags, setRepeatFlags] = useState<Set<string>>(new Set());
  const [repeatDetails, setRepeatDetails] = useState<{ name: string; dates: string[] }[]>([]);

  // Re-run the repeat check whenever planned meals change. useLiveQuery
  // just triggers the recompute here — the actual read happens inside
  // getRepeatFlagsForRange, which pads the range by 6 days each side.
  const plannedVersion = useLiveQuery(() => db.plannedMeals.count(), []);

  useEffect(() => {
    void (async () => {
      const flags = await getRepeatFlagsForRange(days[0], days[6]);
      setRepeatFlags(flags);

      if (flags.size > 0) {
        const flaggedEntries = await db.plannedMeals.bulkGet([...flags]);
        const byMeal = new Map<string, string[]>();
        for (const entry of flaggedEntries) {
          if (!entry) continue;
          const list = byMeal.get(entry.mealId) ?? [];
          list.push(entry.date);
          byMeal.set(entry.mealId, list);
        }
        const meals = await db.meals.bulkGet([...byMeal.keys()]);
        setRepeatDetails(
          meals
            .filter(Boolean)
            .map((m) => ({ name: m!.name, dates: byMeal.get(m!.id) ?? [] })),
        );
      } else {
        setRepeatDetails([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannedVersion, days[0], days[6]]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          This Week
        </Typography>
        <Button size="small" href="/shopping-list">
          Generate Shopping List
        </Button>
      </Stack>

      {repeatDetails.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }}>
          {repeatDetails.map((r) => (
            <div key={r.name}>
              <strong>{r.name}</strong> is planned twice within 7 days (
              {r.dates.map((d) => dayjs(d).format('ddd')).join(' & ')}). Consider swapping one.
            </div>
          ))}
        </Alert>
      )}

      {days.map((date) => (
        <DayCard key={date} date={date} repeatFlags={repeatFlags} />
      ))}
    </Box>
  );
}
