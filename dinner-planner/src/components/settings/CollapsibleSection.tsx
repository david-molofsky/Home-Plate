import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Card from '@mui/material/Card';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SvgIconComponent } from '@mui/icons-material';

interface CollapsibleSectionProps {
  title: string;
  icon: SvgIconComponent;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card sx={{ mb: 2, p: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Icon fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
        </Stack>
        <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Box sx={{ pt: 2 }}>{children}</Box>
      </Collapse>
    </Card>
  );
}
