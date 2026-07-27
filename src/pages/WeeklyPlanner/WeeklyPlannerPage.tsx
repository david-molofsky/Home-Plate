import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { DayCard } from '@/components/planner/DayCard';
import { getRepeatFlagsForRange } from '@/services/mealPlan/mealPlanService';

/** This week + this many weeks ahead, all in one continuous scroll (no
 * paging/swiping between weeks). Always opens scrolled to the top —
 * i.e. today's week — same as before; it never restores a previous
 * scroll position. */
const WEEKS_AHEAD = 2;

export function WeeklyPlannerPage() {
  const currentWeekStart = dayjs().startOf('week');

  // One 7-day array per week, so each DayCard's swap-target list
  // (weekDays) stays scoped to its own calendar week exactly as
  // before — only the rendering below flattens them into a single
  // continuous scroll.
  const weeks = Array.from({ length: WEEKS_AHEAD + 1 }, (_, w) => {
    const weekStart = currentWeekStart.add(w, 'week');
    return Array.from({ length: 7 }, (_, d) => weekStart.add(d, 'day').format('YYYY-MM-DD'));
  });
  const allDays = weeks.flat();

  const [repeatFlags, setRepeatFlags] = useState<Set<string>>(new Set());
  const [repeatDetails, setRepeatDetails] = useState<{ name: string; dates: string[] }[]>([]);

  // Re-run the repeat check whenever planned meals change. useLiveQuery
  // just triggers the recompute here — the actual read happens inside
  // getRepeatFlagsForRange, which pads the range by 6 days each side.
  const plannedVersion = useLiveQuery(() => db.plannedMeals.count(), []);

  useEffect(() => {
    void (async () => {
      const flags = await getRepeatFlagsForRange(allDays[0], allDays[allDays.length - 1]);
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
  }, [plannedVersion, allDays[0], allDays[allDays.length - 1]]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Plan
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

      {weeks.map((weekDays, weekIndex) => {
        const isCurrentWeek = weekIndex === 0;
        return (
          <Box key={weekDays[0]}>
            <Divider
              sx={{
                mt: isCurrentWeek ? 0 : 3,
                mb: 1.5,
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: isCurrentWeek ? 'primary.light' : 'text.secondary',
                '&::before, &::after': {
                  borderColor: isCurrentWeek ? 'primary.main' : 'divider',
                },
              }}
            >
              {isCurrentWeek ? 'This week' : `Week of ${dayjs(weekDays[0]).format('D MMM')}`}
            </Divider>
            {weekDays.map((date) => (
              <DayCard key={date} date={date} repeatFlags={repeatFlags} weekDays={weekDays} />
            ))}
          </Box>
        );
      })}

      <Typography
        variant="caption"
        color="text.secondary"
        align="center"
        sx={{ display: 'block', mt: 2, mb: 1 }}
      >
        End of planning range — need to go further out? Use Calendar.
      </Typography>
    </Box>
  );
}
