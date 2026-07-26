import { useEffect, useState } from 'react';
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
import { AISLES } from '@/models';
import type { ShoppingListItem } from '@/models';
import { newId } from '@/utils/id';

export function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualAisle, setManualAisle] = useState<ShoppingListItem['aisle']>('produce');

  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
  const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

  const refresh = async () => {
    const list = await generateShoppingList(weekStart, weekEnd);
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
    if (!manualName.trim()) return;
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

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        Shopping List
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Auto-built from this week's planned meals.
      </Typography>

      {AISLES.map((aisle) => {
        const aisleItems = grouped[aisle];
        if (!aisleItems || aisleItems.length === 0) return null;
        return (
          <Box key={aisle} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" color="primary.light" fontWeight={700} sx={{ mb: 0.5 }}>
              {aisle[0].toUpperCase() + aisle.slice(1)}
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
          value={manualAisle}
          onChange={(e) => setManualAisle(e.target.value as ShoppingListItem['aisle'])}
          sx={{ flex: 1 }}
        >
          {AISLES.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={() => void addManualItem()}>Add</Button>
      </Stack>
    </Box>
  );
}
