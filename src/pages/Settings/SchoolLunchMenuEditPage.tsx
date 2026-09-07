import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import {
  clampCycleWeeks,
  emptyMenu,
  getKids,
  getMenu,
  resizeCycleDays,
  saveMenu,
} from '@/services/schoolLunch/schoolLunchService';
import { ALL_KIDS, MAX_SCHOOL_LUNCH_CYCLE_WEEKS } from '@/models';
import type { SchoolLunchException, SchoolLunchMenu } from '@/models';
import { ROUTES } from '@/routes/paths';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function SchoolLunchMenuEditPage() {
  const { menuId } = useParams();
  const navigate = useNavigate();
  const isNew = !menuId || menuId === 'new';

  const kids = useLiveQuery(() => getKids(), []) ?? [];

  const [menu, setMenu] = useState<SchoolLunchMenu>(() => (isNew ? emptyMenu() : ({} as SchoolLunchMenu)));
  const [loaded, setLoaded] = useState(isNew);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteBreak, setConfirmDeleteBreak] = useState<string | null>(null);

  // Mirrors EditMealPage's pattern: for an existing menu, load it into
  // local state once via effect rather than during render.
  useEffect(() => {
    if (!isNew && menuId) {
      void getMenu(menuId).then((m) => {
        if (m) setMenu(m);
        setLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  if (!loaded) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      </Box>
    );
  }

  const handleCycleWeeksChange = (value: string) => {
    const parsed = clampCycleWeeks(Number(value));
    setMenu({ ...menu, cycleWeeks: parsed, days: resizeCycleDays(menu.days, parsed) });
  };

  const updateCell = (weekIndex: number, dayIndex: number, value: string) => {
    const nextDays = menu.days.map((week, w) =>
      w === weekIndex ? week.map((cell, d) => (d === dayIndex ? value : cell)) : week,
    );
    setMenu({ ...menu, days: nextDays });
  };

  const addException = () => {
    const next: SchoolLunchException = { id: crypto.randomUUID(), label: '' };
    setMenu({ ...menu, exceptions: [...menu.exceptions, next] });
  };
  const updateException = (id: string, patch: Partial<SchoolLunchException>) => {
    setMenu({
      ...menu,
      exceptions: menu.exceptions.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)),
    });
  };
  const removeException = (id: string) => {
    setMenu({ ...menu, exceptions: menu.exceptions.filter((ex) => ex.id !== id) });
    setConfirmDeleteBreak(null);
  };

  const handleSave = async () => {
    if (!menu.name.trim()) {
      setError('Give this menu a name (usually the school).');
      return;
    }
    if (!menu.kidId) {
      setError('Assign this menu to a kid, or "All kids".');
      return;
    }
    setError(null);
    await saveMenu(menu);
    navigate(ROUTES.settings);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(ROUTES.settings)} aria-label="Back to settings">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          {isNew ? 'Add School Lunch Menu' : 'Edit School Lunch Menu'}
        </Typography>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Menu name"
          placeholder="e.g. Lincoln Elementary"
          value={menu.name}
          onChange={(e) => setMenu({ ...menu, name: e.target.value })}
          fullWidth
        />
        <TextField
          select
          label="Assigned to"
          value={menu.kidId}
          onChange={(e) => setMenu({ ...menu, kidId: e.target.value })}
          fullWidth
        >
          <MenuItem value="" disabled>
            Choose a kid…
          </MenuItem>
          {kids.map((kid) => (
            <MenuItem key={kid.id} value={kid.id}>
              {kid.name}
            </MenuItem>
          ))}
          <MenuItem value={ALL_KIDS}>All kids (shared school/lunch)</MenuItem>
        </TextField>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Cycle length (weeks)"
            type="number"
            value={menu.cycleWeeks}
            onChange={(e) => handleCycleWeeksChange(e.target.value)}
            inputProps={{ min: 1, max: MAX_SCHOOL_LUNCH_CYCLE_WEEKS }}
            helperText={`1–${MAX_SCHOOL_LUNCH_CYCLE_WEEKS}`}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Cycle start date"
            type="date"
            value={menu.startDate}
            onChange={(e) => setMenu({ ...menu, startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            helperText="Anchors Week 1"
            sx={{ flex: 1 }}
          />
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
        Cycle
      </Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        {menu.days.map((week, weekIndex) => (
          <Box key={weekIndex}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Week {weekIndex + 1}
            </Typography>
            <Stack spacing={1} sx={{ mt: 0.5 }}>
              {WEEKDAY_LABELS.map((label, dayIndex) => (
                <Stack key={label} direction="row" alignItems="center" spacing={1}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ width: 34, flexShrink: 0 }}
                  >
                    {label}
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Menu item…"
                    value={week[dayIndex] ?? ''}
                    onChange={(e) => updateCell(weekIndex, dayIndex, e.target.value)}
                    fullWidth
                  />
                </Stack>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        Breaks for this menu
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Non-school date ranges specific to this school, e.g. half term. For breaks that affect
        every kid at once (like winter break), use Household-wide holidays back in Settings
        instead.
      </Typography>
      <Stack spacing={1} sx={{ mb: 1.5 }}>
        {menu.exceptions.map((ex) => (
          <Stack key={ex.id} direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="date"
              value={ex.startDate ?? ''}
              onChange={(e) => updateException(ex.id, { startDate: e.target.value, date: undefined })}
              sx={{ width: 140 }}
            />
            <Typography variant="caption" color="text.secondary">
              to
            </Typography>
            <TextField
              size="small"
              type="date"
              value={ex.endDate ?? ''}
              onChange={(e) => updateException(ex.id, { endDate: e.target.value, date: undefined })}
              sx={{ width: 140 }}
            />
            <TextField
              size="small"
              placeholder="Label"
              value={ex.label ?? ''}
              onChange={(e) => updateException(ex.id, { label: e.target.value })}
              sx={{ flex: 1, minWidth: 90 }}
            />
            <IconButton
              size="small"
              onClick={() => setConfirmDeleteBreak(ex.id)}
              aria-label="Remove break"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small" startIcon={<AddIcon />} onClick={addException} sx={{ mb: 3 }}>
        Add break
      </Button>

      <Stack direction="row" spacing={1.5}>
        <Button variant="outlined" size="large" onClick={() => navigate(ROUTES.settings)} sx={{ flex: 1 }}>
          Cancel
        </Button>
        <Button variant="contained" size="large" onClick={() => void handleSave()} sx={{ flex: 1 }}>
          Save Menu
        </Button>
      </Stack>

      <Dialog open={!!confirmDeleteBreak} onClose={() => setConfirmDeleteBreak(null)}>
        <DialogTitle>Remove this break?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Lunches will auto-fill again for these dates once removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteBreak(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmDeleteBreak && removeException(confirmDeleteBreak)}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
