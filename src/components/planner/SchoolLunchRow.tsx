import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { SchoolLunchOverrideDialog } from '@/components/planner/SchoolLunchOverrideDialog';
import type { KidLunchDisplay } from '@/services/schoolLunch/schoolLunchService';

interface SchoolLunchRowProps {
  date: string;
  display: KidLunchDisplay;
}

/** One kid's auto-filled school lunch row on the Planner day view.
 * Independent of the normal Lunch slot (which stays a single shared
 * meal for breakfast/lunch) — this is purely a read-only display of
 * the resolved cycle/override text, with a single "Edit" action that
 * covers both "swap this one day" and "clear back to the cycle". */
export function SchoolLunchRow({ date, display }: SchoolLunchRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const hasText = !!display.text;

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ width: 60, textTransform: 'uppercase', flexShrink: 0 }}
      >
        {display.kidName}
      </Typography>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          bgcolor: hasText ? 'rgba(77, 208, 200, 0.16)' : 'transparent',
          borderRadius: '8px',
          px: hasText ? 1 : 0,
          py: hasText ? 0.5 : 0,
        }}
      >
        {hasText && <SchoolOutlinedIcon fontSize="small" sx={{ color: 'secondary.main' }} />}
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            color: hasText ? 'secondary.main' : 'text.secondary',
            fontStyle: hasText ? 'normal' : 'italic',
          }}
        >
          {hasText ? display.text : display.exceptionLabel ?? 'No school lunch'}
        </Typography>
      </Box>
      <Button size="small" onClick={() => setEditOpen(true)} sx={{ minWidth: 0, px: 1 }}>
        Edit
      </Button>

      {editOpen && (
        <SchoolLunchOverrideDialog
          open
          onClose={() => setEditOpen(false)}
          date={date}
          kidId={display.kidId}
          kidName={display.kidName}
          currentText={display.text}
          isOverride={display.isOverride}
        />
      )}
    </Stack>
  );
}
