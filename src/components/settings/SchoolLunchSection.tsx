import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import dayjs from 'dayjs';
import {
  addKid,
  deleteKid,
  deleteMenu,
  getHouseholdHolidays,
  getKids,
  getMenus,
  saveHouseholdHolidays,
} from '@/services/schoolLunch/schoolLunchService';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { schoolLunchMenuPath } from '@/routes/paths';
import { ALL_KIDS } from '@/models';
import type { SchoolLunchException } from '@/models';

export function SchoolLunchSection() {
  const navigate = useNavigate();
  const kids = useLiveQuery(() => getKids(), []) ?? [];
  const menus = useLiveQuery(() => getMenus(), []) ?? [];
  const holidays = useLiveQuery(() => getHouseholdHolidays(), []) ?? [];

  const [newKidName, setNewKidName] = useState('');
  const [confirmDeleteKid, setConfirmDeleteKid] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteMenu, setConfirmDeleteMenu] = useState<{ id: string; name: string } | null>(null);

  const kidName = (kidId: string) =>
    kidId === ALL_KIDS ? 'All kids' : kids.find((k) => k.id === kidId)?.name ?? 'Unassigned';

  const handleAddKid = async () => {
    const trimmed = newKidName.trim();
    if (!trimmed) return;
    await addKid(trimmed);
    setNewKidName('');
  };

  const handleConfirmDeleteKid = async () => {
    if (!confirmDeleteKid) return;
    await deleteKid(confirmDeleteKid.id);
    setConfirmDeleteKid(null);
  };

  const handleConfirmDeleteMenu = async () => {
    if (!confirmDeleteMenu) return;
    await deleteMenu(confirmDeleteMenu.id);
    setConfirmDeleteMenu(null);
  };

  const addHoliday = async () => {
    const next: SchoolLunchException = { id: crypto.randomUUID(), label: '' };
    await saveHouseholdHolidays([...holidays, next]);
  };
  const updateHoliday = async (id: string, patch: Partial<SchoolLunchException>) => {
    await saveHouseholdHolidays(holidays.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };
  const removeHoliday = async (id: string) => {
    await saveHouseholdHolidays(holidays.filter((h) => h.id !== id));
  };

  return (
    <CollapsibleSection title="School Lunch Menus" icon={SchoolOutlinedIcon}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter a repeating menu per school and it'll auto-fill each kid's Mon–Fri lunch on the
        Planner. Swap or edit any single day without touching the cycle itself.
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Kids
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {kids.map((kid) => (
          <Chip
            key={kid.id}
            label={kid.name}
            color="secondary"
            onDelete={() => setConfirmDeleteKid({ id: kid.id, name: kid.name })}
          />
        ))}
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Kid's name…"
            value={newKidName}
            onChange={(e) => setNewKidName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAddKid();
            }}
            sx={{ width: 140 }}
          />
          <IconButton size="small" onClick={() => void handleAddKid()} aria-label="Add kid">
            <AddIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Menus
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate(schoolLunchMenuPath('new'))}
        >
          Add menu
        </Button>
      </Stack>

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {menus.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No school lunch menus yet.
          </Typography>
        )}
        {menus.map((menu) => (
          <Box
            key={menu.id}
            sx={{ bgcolor: 'action.hover', borderRadius: '12px', p: 1.5 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <SchoolOutlinedIcon fontSize="small" color="secondary" />
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                {menu.name || 'Untitled menu'}
              </Typography>
              <Chip size="small" color="secondary" variant="outlined" label={kidName(menu.kidId)} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {menu.cycleWeeks}-week cycle · started {dayjs(menu.startDate).format('D MMM YYYY')}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
              {menu.exceptions.length === 0
                ? 'No breaks scheduled'
                : `${menu.exceptions.length} break${menu.exceptions.length === 1 ? '' : 's'} scheduled`}
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<EditOutlinedIcon fontSize="small" />}
                onClick={() => navigate(schoolLunchMenuPath(menu.id))}
                sx={{ flex: 1 }}
              >
                Edit
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                onClick={() => setConfirmDeleteMenu({ id: menu.id, name: menu.name || 'this menu' })}
                sx={{ flex: 1 }}
              >
                Delete
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        Household-wide holidays
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Applies to every menu at once — use this for things like winter break rather than adding
        the same range to each school separately.
      </Typography>

      <Stack spacing={1} sx={{ mb: 1.5 }}>
        {holidays.map((h) => (
          <Stack key={h.id} direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="date"
              value={h.startDate ?? ''}
              onChange={(e) => void updateHoliday(h.id, { startDate: e.target.value, date: undefined })}
              sx={{ width: 140 }}
            />
            <Typography variant="caption" color="text.secondary">
              to
            </Typography>
            <TextField
              size="small"
              type="date"
              value={h.endDate ?? ''}
              onChange={(e) => void updateHoliday(h.id, { endDate: e.target.value, date: undefined })}
              sx={{ width: 140 }}
            />
            <TextField
              size="small"
              placeholder="Label"
              value={h.label ?? ''}
              onChange={(e) => void updateHoliday(h.id, { label: e.target.value })}
              sx={{ flex: 1, minWidth: 90 }}
            />
            <IconButton size="small" onClick={() => void removeHoliday(h.id)} aria-label="Remove holiday">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small" startIcon={<AddIcon />} onClick={() => void addHoliday()}>
        Add household holiday
      </Button>

      <Dialog open={!!confirmDeleteKid} onClose={() => setConfirmDeleteKid(null)}>
        <DialogTitle>Remove {confirmDeleteKid?.name}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This also deletes any school lunch menu assigned specifically to {confirmDeleteKid?.name},
            along with any single-day edits made for them. Menus assigned to "All kids" aren't
            affected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteKid(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleConfirmDeleteKid()}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDeleteMenu} onClose={() => setConfirmDeleteMenu(null)}>
        <DialogTitle>Delete "{confirmDeleteMenu?.name}"?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This removes the cycle permanently. Auto-filled lunches from this menu will disappear
            from the Planner going forward.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteMenu(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleConfirmDeleteMenu()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </CollapsibleSection>
  );
}
