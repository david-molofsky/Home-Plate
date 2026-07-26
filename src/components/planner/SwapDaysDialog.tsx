import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { checkRepeatConflict, swapDinners } from '@/services/mealPlan/mealPlanService';
import type { Diner, PlannedMeal } from '@/models';

interface SwapDaysDialogProps {
  open: boolean;
  onClose: () => void;
  /** The day the swap was initiated from (e.g. from its kebab menu). */
  sourceDate: string;
  /** The set of dates the person can swap with — normally the current
   * visible week, excluding sourceDate. */
  weekDays: string[];
}

interface ConflictWarning {
  landingDate: string;
  mealName: string;
  conflictDate: string;
}

const DINERS: Diner[] = ['adult', 'kids'];

export function SwapDaysDialog({ open, onClose, sourceDate, weekDays }: SwapDaysDialogProps) {
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const otherDays = weekDays.filter((d) => d !== sourceDate);

  // Reset picked target whenever the dialog is reopened for a new day.
  useEffect(() => {
    if (open) {
      setTargetDate(null);
      setConflicts([]);
    }
  }, [open, sourceDate]);

  const sourceEntries = useLiveQuery(
    () =>
      db.plannedMeals
        .where('date')
        .equals(sourceDate)
        .and((p) => p.mealType === 'dinner')
        .toArray(),
    [sourceDate],
  );
  const targetEntries = useLiveQuery(
    () =>
      targetDate
        ? db.plannedMeals
            .where('date')
            .equals(targetDate)
            .and((p) => p.mealType === 'dinner')
            .toArray()
        : Promise.resolve([] as PlannedMeal[]),
    [targetDate],
  );

  const mealIds = useMemo(
    () => [...new Set([...(sourceEntries ?? []), ...(targetEntries ?? [])].map((p) => p.mealId))],
    [sourceEntries, targetEntries],
  );
  const meals = useLiveQuery(() => db.meals.bulkGet(mealIds), [mealIds.join(',')]);
  const mealById = new Map((meals ?? []).filter(Boolean).map((m) => [m!.id, m!]));

  const getEntry = (entries: PlannedMeal[] | undefined, diner: Diner) =>
    (entries ?? []).find((p) => p.diner === diner);

  // Re-check for repeat conflicts every time a target day is picked —
  // checks the *resulting* state (what each date would get) against the
  // rest of the plan, excluding the two rows being swapped so they
  // don't flag against each other.
  useEffect(() => {
    if (!targetDate) {
      setConflicts([]);
      return;
    }
    void (async () => {
      setChecking(true);
      const found: ConflictWarning[] = [];

      for (const diner of DINERS) {
        const srcEntry = getEntry(sourceEntries, diner);
        const tgtEntry = getEntry(targetEntries, diner);
        const excludeIds = [srcEntry?.id, tgtEntry?.id].filter((v): v is string => !!v);

        if (tgtEntry) {
          const conflictDate = await checkRepeatConflict(sourceDate, diner, tgtEntry.mealId, excludeIds);
          if (conflictDate) {
            const meal = await db.meals.get(tgtEntry.mealId);
            found.push({ landingDate: sourceDate, mealName: meal?.name ?? 'Meal', conflictDate });
          }
        }
        if (srcEntry) {
          const conflictDate = await checkRepeatConflict(targetDate, diner, srcEntry.mealId, excludeIds);
          if (conflictDate) {
            const meal = await db.meals.get(srcEntry.mealId);
            found.push({ landingDate: targetDate, mealName: meal?.name ?? 'Meal', conflictDate });
          }
        }
      }

      setConflicts(found);
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, sourceEntries, targetEntries, sourceDate]);

  const handleConfirm = async () => {
    if (!targetDate) return;
    setConfirming(true);
    await swapDinners(sourceDate, targetDate);
    setConfirming(false);
    onClose();
  };

  const renderPreviewLine = (label: string, entries: PlannedMeal[] | undefined) => {
    const adult = getEntry(entries, 'adult');
    const kids = getEntry(entries, 'kids');
    const adultName = adult ? mealById.get(adult.mealId)?.name ?? '—' : '—';
    const kidsName = kids ? mealById.get(kids.mealId)?.name ?? '—' : '—';
    return (
      <Typography variant="body2">
        <strong>{label}</strong> will get: {adultName} (Adult) / {kidsName} (Kids)
      </Typography>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Swap dinner with…</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary">
          Only dinner (adult + kids) moves. Breakfast and lunch stay where they are.
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 2 }}>
          {otherDays.map((d) => (
            <Chip
              key={d}
              label={dayjs(d).format('ddd D')}
              color={targetDate === d ? 'primary' : 'default'}
              onClick={() => setTargetDate(d)}
            />
          ))}
        </Stack>

        {targetDate && (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Preview
            </Typography>
            {renderPreviewLine(dayjs(sourceDate).format('dddd'), targetEntries)}
            {renderPreviewLine(dayjs(targetDate).format('dddd'), sourceEntries)}
          </Stack>
        )}

        {conflicts.map((c, i) => (
          <Alert severity="warning" key={i} sx={{ mb: 1, borderRadius: 3 }}>
            <strong>{c.mealName}</strong> would land within 7 days of{' '}
            {dayjs(c.conflictDate).format('ddd, MMM D')} on {dayjs(c.landingDate).format('dddd')}.
          </Alert>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!targetDate || checking || confirming}
          onClick={() => void handleConfirm()}
        >
          Confirm Swap
        </Button>
      </DialogActions>
    </Dialog>
  );
}
