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

  const meals = useLiveQuery(() => db.meals.where('mealType').equals(mealType).toArray(), [mealType]);

  // A meal fits this slot if it's the right mealType and, for dinner,
  // its category covers this diner ('both' fits either slot).
  const fitsSlot = (m: Meal) => {
    if (mealType !== 'dinner') return true;
    return diner === 'kids' ? m.category === 'kids' || m.category === 'both' : m.category === 'adult' || m.category === 'both';
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
  }, [meals, effort, size, mealType, diner]);

  const query = quickAddQuery.trim();
  const quickMatches = useMemo(() => {
    if (!query || !meals) return [];
    const q = query.toLowerCase();
    return meals.filter((m) => fitsSlot(m) && m.name.toLowerCase().includes(q)).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, query, mealType, diner]);

  const hasExactMatch = quickMatches.some((m) => m.name.toLowerCase() === query.toLowerCase());

  const finalizeAssign = async (meal: Meal) => {
    await db.plannedMeals.put({
      id: newId(),
      date,
      mealType,
      diner,
      mealId: meal.id,
    });
    setPendingAssign(null);
    setQuickAddQuery('');
    onClose();
  };

  const attemptAssign = async (meal: Meal) => {
    if (mealType === 'dinner') {
      const conflictDate = await checkRepeatConflict(date, diner, meal.id);
      if (conflictDate) {
        setPendingAssign({ meal, conflictDate });
        return;
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
      category: mealType === 'dinner' && diner === 'kids' ? 'kids' : 'adult',
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
        {mealType === 'dinner' ? ` — ${diner === 'kids' ? 'Kids' : 'Adult'}` : ''}
      </DialogTitle>
      <DialogContent>
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
