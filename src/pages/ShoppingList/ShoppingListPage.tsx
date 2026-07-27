import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { generateShoppingList, groupByAisle } from '@/services/mealPlan/mealPlanService';
import { getAisleConfig } from '@/services/aisles/aislesService';
import type { ShoppingListItem } from '@/models';
import { newId } from '@/utils/id';

export function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualAisle, setManualAisle] = useState<string | null>(null);

  const aisleConfig = useLiveQuery(() => getAisleConfig(), []);
  const visibleAisleOptions = (aisleConfig ?? []).filter((a) => !a.hidden);

  // Default the manual-add aisle to the first visible one once config
  // has loaded (can't know it synchronously on first render).
  useEffect(() => {
    if (manualAisle === null && visibleAisleOptions.length > 0) {
      setManualAisle(visibleAisleOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aisleConfig]);

  // Shopping list runs from today through the end of the week, not
  // from the start of the week. generateShoppingList sums ingredient
  // quantities across whatever range it's given, so narrowing the
  // start to today does two things automatically: an ingredient only
  // needed on an already-passed day drops off the list entirely, and
  // one needed on both a passed day and a later day keeps only the
  // later day's quantity. This re-runs (and reshrinks) every time the
  // page loads, so it rolls forward on its own each day — no separate
  // "clear checked items" logic needed, since the whole list
  // regenerates from this range regardless of checked state.
  const listStart = dayjs().format('YYYY-MM-DD');
  const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

  const refresh = async () => {
    const list = await generateShoppingList(listStart, weekEnd);
    setItems(list);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleChecked = async (item: ShoppingListItem) => {
    const updated = { ...item, checked: !item.checked };
    await db.shoppingListItems.put(updated);
    setItems(items.map((i) => (i.id === item.id ? updated : i)));
  };

  const addManualItem = async () => {
    if (!manualName.trim() || !manualAisle) return;
    const item: ShoppingListItem = {
      id: newId(),
      name: manualName,
      quantity: '',
      aisle: manualAisle,
      checked: false,
      manual: true,
    };
    await db.shoppingListItems.put(item);
    setItems([...items, item]);
    setManualName('');
  };

  const grouped = groupByAisle(items);

  // Display order follows the household's configured aisle order (drag
  // order in Settings), not alphabetical. Any aisle id present on an
  // item but no longer in the config (shouldn't normally happen, since
  // hiding never deletes) is appended at the end rather than dropped,
  // so nothing silently disappears from the list.
  const orderedAisleIds = [
    ...(aisleConfig ?? []).map((a) => a.id),
    ...Object.keys(grouped).filter((id) => !(aisleConfig ?? []).some((a) => a.id === id)),
  ];

  const aisleLabel = (id: string) => (aisleConfig ?? []).find((a) => a.id === id)?.name ?? id;

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        Shopping List
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Built from today through the rest of this week's planned meals — items only needed
        earlier in the week drop off automatically.
      </Typography>

      {orderedAisleIds.map((aisleId) => {
        const aisleItems = grouped[aisleId];
        if (!aisleItems || aisleItems.length === 0) return null;
        return (
          <Box key={aisleId} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" color="primary.light" fontWeight={700} sx={{ mb: 0.5 }}>
              {aisleLabel(aisleId)}
            </Typography>
            <Stack>
              {aisleItems.map((item) => (
                <Stack direction="row" alignItems="center" key={item.id}>
                  <Checkbox
                    size="small"
                    checked={item.checked}
                    onChange={() => void toggleChecked(item)}
                  />
                  <Typography
                    variant="body2"
                    sx={{ textDecoration: item.checked ? 'line-through' : 'none' }}
                  >
                    {item.name}
                    {item.quantity ? ` × ${item.quantity}` : ''}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        );
      })}

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <TextField
          size="small"
          placeholder="Add item"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          sx={{ flex: 2 }}
        />
        <TextField
          select
          size="small"
          value={manualAisle ?? ''}
          onChange={(e) => setManualAisle(e.target.value)}
          sx={{ flex: 1 }}
        >
          {visibleAisleOptions.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={() => void addManualItem()}>Add</Button>
      </Stack>
    </Box>
  );
}
