import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import BarcodeScannerIcon from '@mui/icons-material/BarcodeReader';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { generateShoppingList, groupByAisle } from '@/services/mealPlan/mealPlanService';
import { getAisleConfig } from '@/services/aisles/aislesService';
import { editMealPath } from '@/routes/paths';
import type { ShoppingListItem } from '@/models';
import { newId } from '@/utils/id';
import { isBarcodeScanAvailable } from '@/utils/barcodeScanSupport';
import { BarcodeScanDialog } from '@/components/common/BarcodeScanDialog';
import { ShoppingListItemRow } from './ShoppingListItemRow';

/** Key used for the collapse-state map for the "Done" section, kept
 * distinct from any real aisle id. */
const DONE_SECTION_KEY = '__done__';

export function ShoppingListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualAisle, setManualAisle] = useState<string | null>(null);
  const [barcodeScanAvailable, setBarcodeScanAvailable] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  // Collapse state is per-section (aisle id, or DONE_SECTION_KEY) and
  // lives only in component state — it intentionally resets to fully
  // expanded each time the page is opened rather than persisting, to
  // keep this change scoped to display/interaction only.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void isBarcodeScanAvailable().then(setBarcodeScanAvailable);
  }, []);

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

  // Shopping list is always a rolling 7-day window: today through 6
  // days out, recalculated live on every load — not tied to a fixed
  // calendar week. generateShoppingList sums ingredient quantities
  // across whatever range it's given, so narrowing the start to today
  // does two things automatically: an ingredient only needed on an
  // already-passed day drops off the list entirely, and one needed on
  // both a passed day and a later day keeps only the later day's
  // quantity. This re-runs (and re-anchors) every time the page loads,
  // so it rolls forward on its own each day — no separate "clear
  // checked items" logic needed, since the whole list regenerates from
  // this range regardless of checked state.
  const listStart = dayjs().format('YYYY-MM-DD');
  const listEnd = dayjs().add(6, 'day').format('YYYY-MM-DD');

  const refresh = async () => {
    const list = await generateShoppingList(listStart, listEnd);
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

  // Removing an item deletes any persisted row for it (manual items
  // live in the table permanently; generated items only end up there
  // if they were ever checked, since toggleChecked persists on write)
  // and drops it from local state either way, so a generated item
  // that was never checked is removed just as cleanly.
  const deleteItem = async (item: ShoppingListItem) => {
    await db.shoppingListItems.delete(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
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

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeItems = items.filter((i) => !i.checked);
  const doneItems = items.filter((i) => i.checked);
  const grouped = groupByAisle(activeItems);

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

  const sectionHeader = (key: string, label: string, count: number, muted = false) => {
    const collapsed = !!collapsedSections[key];
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={() => toggleSection(key)}
        sx={{ cursor: 'pointer', userSelect: 'none', mb: 0.5 }}
      >
        {collapsed ? (
          <ChevronRightIcon fontSize="small" sx={{ color: muted ? 'text.secondary' : 'primary.light' }} />
        ) : (
          <ExpandMoreIcon fontSize="small" sx={{ color: muted ? 'text.secondary' : 'primary.light' }} />
        )}
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ color: muted ? 'text.secondary' : 'primary.light' }}
        >
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count}
        </Typography>
      </Stack>
    );
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        Shopping List
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Built from today through the next 7 days of planned meals — items for days that have
        passed drop off automatically as the window rolls forward.
      </Typography>

      {orderedAisleIds.map((aisleId) => {
        const aisleItems = grouped[aisleId];
        if (!aisleItems || aisleItems.length === 0) return null;
        const collapsed = !!collapsedSections[aisleId];
        return (
          <Box key={aisleId} sx={{ mb: 1.5 }}>
            {sectionHeader(aisleId, aisleLabel(aisleId), aisleItems.length)}
            {!collapsed && (
              <Stack spacing={0.25}>
                {aisleItems.map((item) => (
                  <ShoppingListItemRow
                    key={item.id}
                    item={item}
                    onToggleChecked={(i) => void toggleChecked(i)}
                    onDelete={(i) => void deleteItem(i)}
                    onSourceClick={(mealId) => navigate(editMealPath(mealId))}
                  />
                ))}
              </Stack>
            )}
          </Box>
        );
      })}

      {doneItems.length > 0 && (
        <Box sx={{ mb: 1.5, mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          {sectionHeader(DONE_SECTION_KEY, 'Done', doneItems.length, true)}
          {!collapsedSections[DONE_SECTION_KEY] && (
            <Stack spacing={0.25}>
              {doneItems.map((item) => (
                <ShoppingListItemRow
                  key={item.id}
                  item={item}
                  onToggleChecked={(i) => void toggleChecked(i)}
                  onDelete={(i) => void deleteItem(i)}
                  onSourceClick={(mealId) => navigate(editMealPath(mealId))}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

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
        {barcodeScanAvailable && (
          <IconButton aria-label="Scan barcode" size="small" onClick={() => setScanDialogOpen(true)}>
            <BarcodeScannerIcon fontSize="small" />
          </IconButton>
        )}
        <Button onClick={() => void addManualItem()}>Add</Button>
      </Stack>

      <BarcodeScanDialog
        open={scanDialogOpen}
        onClose={() => setScanDialogOpen(false)}
        onFill={(name) => setManualName(name)}
      />
    </Box>
  );
}
