import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { newId } from '@/utils/id';
import { checkRepeatConflict } from '@/services/mealPlan/mealPlanService';
import type { Diner, EffortTag, Meal, MealType, SizeTag } from '@/models';

interface MealPickerDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  mealType: MealType;
  diner: Diner;
}

interface PendingAssign {
  meal: Meal;
  conflictDate: string;
}

const EFFORT_OPTIONS: EffortTag[] = ['easy', 'time-consuming'];
const SIZE_OPTIONS: SizeTag[] = ['small', 'big'];

export function MealPickerDialog({ open, onClose, date, mealType, diner }: MealPickerDialogProps) {
  const [effort, setEffort] = useState<EffortTag | null>(null);
  const [size, setSize] = useState<SizeTag | null>(null);
  const [quickAddQuery, setQuickAddQuery] = useState('');
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null);
  // "Who's eating" — defaults to whichever slot was tapped, but only
  // dinner exposes the toggle (breakfast/lunch stay single-serve).
  // Picking "both" assigns the same meal to the adult and kids dinner
  // slots for this day in one action.
  const [selectedDiner, setSelectedDiner] = useState<Diner | 'both'>(diner);

  const meals = useLiveQuery(() => db.meals.where('mealType').equals(mealType).toArray(), [mealType]);

  // Which PlannedMeal rows this assignment will actually write.
  const targetDiners: Diner[] =
    mealType === 'dinner' ? (selectedDiner === 'both' ? ['adult', 'kids'] : [selectedDiner]) : [diner];

  // A meal fits this slot if it's the right mealType and, for dinner,
  // its category covers the selected diner(s) — "both" shows every
  // dinner meal, since the user is explicitly choosing to serve it to
  // both groups regardless of the meal's own tag.
  const fitsSlot = (m: Meal) => {
    if (mealType !== 'dinner') return true;
    if (selectedDiner === 'both') return true;
    return selectedDiner === 'kids' ? m.category === 'kids' || m.category === 'both' : m.category === 'adult' || m.category === 'both';
  };

  const filtered = useMemo(() => {
    if (!meals) return [];
    return meals.filter((m) => {
      if (!fitsSlot(m)) return false;
      if (effort && m.effort !== effort) return false;
      if (size && m.size !== size) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, effort, size, mealType, selectedDiner]);

  const query = quickAddQuery.trim();
  const quickMatches = useMemo(() => {
    if (!query || !meals) return [];
    const q = query.toLowerCase();
    return meals.filter((m) => fitsSlot(m) && m.name.toLowerCase().includes(q)).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, query, mealType, selectedDiner]);

  const hasExactMatch = quickMatches.some((m) => m.name.toLowerCase() === query.toLowerCase());

  const finalizeAssign = async (meal: Meal) => {
    for (const d of targetDiners) {
      // Replace anything already in that slot rather than stacking a
      // second row on top of it — matters when "both" is chosen and one
      // of the two slots was already filled from elsewhere.
      const existing = await db.plannedMeals
        .where('date')
        .equals(date)
        .and((p) => p.mealType === mealType && p.diner === d)
        .toArray();
      for (const e of existing) {
        await db.plannedMeals.delete(e.id);
      }
      await db.plannedMeals.put({
        id: newId(),
        date,
        mealType,
        diner: d,
        mealId: meal.id,
      });
    }
    setPendingAssign(null);
    setQuickAddQuery('');
    onClose();
  };

  const attemptAssign = async (meal: Meal) => {
    if (mealType === 'dinner') {
      for (const d of targetDiners) {
        const conflictDate = await checkRepeatConflict(date, d, meal.id);
        if (conflictDate) {
          setPendingAssign({ meal, conflictDate });
          return;
        }
      }
    }
    await finalizeAssign(meal);
  };

  const handleCreateNew = async () => {
    if (!query) return;
    const now = new Date().toISOString();
    const meal: Meal = {
      id: newId(),
      name: query,
      mealType,
      dietary: [],
      category: mealType === 'dinner' ? (selectedDiner === 'both' ? 'both' : selectedDiner) : 'adult',
      ingredients: [],
      steps: [],
      isQuickAdd: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.meals.put(meal);
    // Brand new meal — it can't already exist elsewhere in the plan, so
    // no repeat-conflict check needed here.
    await finalizeAssign(meal);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {mealType[0].toUpperCase() + mealType.slice(1)}
        {mealType === 'dinner'
          ? ` — ${selectedDiner === 'both' ? 'Both' : selectedDiner === 'kids' ? 'Kids' : 'Adult'}`
          : ''}
      </DialogTitle>
      <DialogContent>
        {mealType === 'dinner' && (
          <Stack sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
              Who's eating
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={selectedDiner}
              onChange={(_, val) => val && setSelectedDiner(val)}
            >
              <ToggleButton value="adult">Adults</ToggleButton>
              <ToggleButton value="kids">Kids</ToggleButton>
              <ToggleButton value="both">Both</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )}

        <TextField
          label="Quick add"
          placeholder="Type a meal name to search or create…"
          value={quickAddQuery}
          onChange={(e) => setQuickAddQuery(e.target.value)}
          fullWidth
          autoFocus
          sx={{ mb: 2 }}
        />

        {pendingAssign && (
          <Alert
            severity="warning"
            sx={{ mb: 2, borderRadius: 3 }}
            action={
              <Stack direction="row" spacing={0.5}>
                <Button size="small" onClick={() => setPendingAssign(null)}>
                  Cancel
                </Button>
                <Button size="small" onClick={() => void finalizeAssign(pendingAssign.meal)}>
                  Add anyway
                </Button>
              </Stack>
            }
          >
            <strong>{pendingAssign.meal.name}</strong> is already planned on{' '}
            {dayjs(pendingAssign.conflictDate).format('ddd, MMM D')} — within 7 days.
          </Alert>
        )}

        {query ? (
          <>
            {quickMatches.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary">
                  Matches in Library
                </Typography>
                <List disablePadding sx={{ mb: 1 }}>
                  {quickMatches.map((meal) => (
                    <ListItemButton key={meal.id} onClick={() => void attemptAssign(meal)} divider>
                      <ListItemText
                        primary={meal.name}
                        secondary={[meal.effort, meal.size, ...meal.dietary].filter(Boolean).join(' · ')}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}

            {!hasExactMatch && (
              <ListItemButton
                onClick={() => void handleCreateNew()}
                sx={{
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'primary.main',
                }}
              >
                <ListItemText primary={`+ Create new: "${query}"`} />
              </ListItemButton>
            )}
          </>
        ) : (
          <>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {EFFORT_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  color={effort === opt ? 'primary' : 'default'}
                  onClick={() => setEffort(effort === opt ? null : opt)}
                />
              ))}
              {SIZE_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  color={size === opt ? 'primary' : 'default'}
                  onClick={() => setSize(size === opt ? null : opt)}
                />
              ))}
            </Stack>

            <Divider sx={{ mb: 1 }} />

            {filtered.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No meals match these filters yet — add one from the Library, or type above to
                quick add.
              </Typography>
            ) : (
              <List disablePadding>
                {filtered.map((meal) => (
                  <ListItemButton key={meal.id} onClick={() => void attemptAssign(meal)} divider>
                    <ListItemText
                      primary={meal.name}
                      secondary={[meal.effort, meal.size, ...meal.dietary].filter(Boolean).join(' · ')}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
