import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { DayCard } from '@/components/planner/DayCard';
import { getRepeatFlagsForRange } from '@/services/mealPlan/mealPlanService';

/** This week + this many weeks ahead, all in one continuous scroll (no
 * paging/swiping between weeks). Always opens scrolled to the top —
 * i.e. today's rolling week — same as before; it never restores a
 * previous scroll position. */
const WEEKS_AHEAD = 2;

export function WeeklyPlannerPage() {
  // Rolling, today-anchored groupings rather than fixed calendar weeks
  // (Sun–Sat) — "week 1" is always today through +6 days, "week 2" is
  // the following 7 days, and so on. This re-derives on every render,
  // so the grouping itself rolls forward a day at a time with no
  // separate migration step; it just always starts from "now".
  const today = dayjs();

  // One 7-day array per rolling week, so each DayCard's swap-target
  // list (weekDays) stays scoped to its own rolling week exactly as
  // before — only the rendering below flattens them into a single
  // continuous scroll.
  const weeks = Array.from({ length: WEEKS_AHEAD + 1 }, (_, w) => {
    const weekStart = today.add(w * 7, 'day');
    return Array.from({ length: 7 }, (_, d) => weekStart.add(d, 'day').format('YYYY-MM-DD'));
  });
  const allDays = weeks.flat();

  const [repeatFlags, setRepeatFlags] = useState<Set<string>>(new Set());

  // Re-run the repeat check whenever planned meals change. useLiveQuery
  // just triggers the recompute here — the actual read happens inside
  // getRepeatFlagsForRange, which pads the range by 6 days each side.
  // repeatFlags feeds the per-entry "⚠ repeat" chip rendered inside
  // DayCard; there's no separate top-of-page banner anymore.
  const plannedVersion = useLiveQuery(() => db.plannedMeals.count(), []);

  useEffect(() => {
    void (async () => {
      const flags = await getRepeatFlagsForRange(allDays[0], allDays[allDays.length - 1]);
      setRepeatFlags(flags);
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
              {isCurrentWeek
                ? 'Next 7 days'
                : `${dayjs(weekDays[0]).format('D MMM')} – ${dayjs(weekDays[6]).format('D MMM')}`}
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
