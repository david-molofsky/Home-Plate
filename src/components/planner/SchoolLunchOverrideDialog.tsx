import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { clearOverride, setOverride } from '@/services/schoolLunch/schoolLunchService';

interface SchoolLunchOverrideDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  kidId: string;
  kidName: string;
  /** Current display text (cycle-resolved or already-overridden) to
   * prefill the field with. */
  currentText: string;
  isOverride: boolean;
}

/** Lets a person edit a single day's school lunch without touching
 * the underlying cycle — used for both "Swap" (replace just this day)
 * and "Edit" (same action; there's no separate deep-link into the
 * cycle grid for a single cell, which keeps this to one small dialog
 * instead of two overlapping flows). */
export function SchoolLunchOverrideDialog({
  open,
  onClose,
  date,
  kidId,
  kidName,
  currentText,
  isOverride,
}: SchoolLunchOverrideDialogProps) {
  const [text, setText] = useState(currentText);

  const handleSave = async () => {
    await setOverride(date, kidId, text.trim());
    onClose();
  };

  const handleResetToMenu = async () => {
    await clearOverride(date, kidId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {kidName}'s lunch — {dayjs(date).format('ddd D MMM')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          This only changes this one day — the menu's regular cycle is untouched.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          placeholder="e.g. Pizza day, or leave blank for no lunch"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {isOverride && (
          <Button color="inherit" onClick={() => void handleResetToMenu()} sx={{ mr: 'auto' }}>
            Reset to menu
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSave()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
