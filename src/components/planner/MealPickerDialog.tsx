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
import { db } from '@/services/database/db';
import { newId } from '@/utils/id';
import type { Diner, EffortTag, Meal, MealType, SizeTag } from '@/models';

interface MealPickerDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  mealType: MealType;
  diner: Diner;
}

const EFFORT_OPTIONS: EffortTag[] = ['easy', 'time-consuming'];
const SIZE_OPTIONS: SizeTag[] = ['small', 'big'];

export function MealPickerDialog({ open, onClose, date, mealType, diner }: MealPickerDialogProps) {
  const [effort, setEffort] = useState<EffortTag | null>(null);
  const [size, setSize] = useState<SizeTag | null>(null);

  const meals = useLiveQuery(() => db.meals.where('mealType').equals(mealType).toArray(), [mealType]);

  const filtered = useMemo(() => {
    if (!meals) return [];
    return meals.filter((m) => {
      if (mealType === 'dinner' && m.isKidsMeal !== (diner === 'kids')) return false;
      if (effort && m.effort !== effort) return false;
      if (size && m.size !== size) return false;
      return true;
    });
  }, [meals, effort, size, mealType, diner]);

  const handleAssign = async (meal: Meal) => {
    await db.plannedMeals.put({
      id: newId(),
      date,
      mealType,
      diner,
      mealId: meal.id,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {mealType[0].toUpperCase() + mealType.slice(1)}
        {mealType === 'dinner' ? ` — ${diner === 'kids' ? 'Kids' : 'Adult'}` : ''}
      </DialogTitle>
      <DialogContent>
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

        {filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No meals match these filters yet — add one from the Library.
          </Typography>
        ) : (
          <List disablePadding>
            {filtered.map((meal) => (
              <ListItemButton key={meal.id} onClick={() => void handleAssign(meal)} divider>
                <ListItemText
                  primary={meal.name}
                  secondary={[meal.effort, meal.size, ...meal.dietary].filter(Boolean).join(' · ')}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
