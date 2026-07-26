import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { getAisleConfig, addAisle, toggleAisleHidden, reorderAisles } from '@/services/aisles/aislesService';

export function GroceryAislesSection() {
  const config = useLiveQuery(() => getAisleConfig(), []);
  const list = config ?? [];

  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleToggle = async (id: string) => {
    setError(null);
    const result = await toggleAisleHidden(id);
    if (!result.ok) setError('Keep at least one aisle visible.');
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    await addAisle(name);
    setNewName('');
  };

  const handleDrop = async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...list];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    await reorderAisles(next);
  };

  return (
    <CollapsibleSection title="Grocery Aisles" icon={ShoppingCartOutlinedIcon}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Drag to reorder — this order drives the aisle picker on ingredients and the group order
        in the shopping list. Hiding an aisle removes it from new picks; ingredients already using
        it are unaffected.
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <List disablePadding sx={{ mb: 1.5 }}>
        {list.map((aisle, index) => (
          <ListItem
            key={aisle.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => void handleDrop(index)}
            divider
            sx={{ px: 0, opacity: aisle.hidden ? 0.5 : 1, cursor: 'grab' }}
            secondaryAction={<Switch checked={!aisle.hidden} onChange={() => void handleToggle(aisle.id)} />}
          >
            <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', mr: 1 }} />
            <Typography variant="body2">{aisle.name}</Typography>
          </ListItem>
        ))}
      </List>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          placeholder="New aisle name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAdd();
          }}
          fullWidth
        />
        <Button variant="contained" onClick={() => void handleAdd()}>
          Add
        </Button>
      </Stack>
    </CollapsibleSection>
  );
}
