import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ShoppingListItem } from '@/models';

/** Swipe distance (px) past which releasing the row commits a delete.
 * Matches the wireframe's feel — far enough to avoid accidental
 * triggers during a vertical scroll, short enough to reach in one
 * thumb swipe. */
const DELETE_THRESHOLD = 64;
/** Hard cap on how far the row can be dragged, so the red backing
 * never overshoots the row's own bounds. */
const MAX_DRAG = 96;

interface ShoppingListItemRowProps {
  item: ShoppingListItem;
  onToggleChecked: (item: ShoppingListItem) => void;
  onDelete: (item: ShoppingListItem) => void;
  onSourceClick?: (mealId: string) => void;
}

/** One shopping list row with swipe-left-to-delete, built on pointer
 * events so it works for touch and mouse alike (no extra dependency).
 * Dragging the front content left reveals a red delete backing;
 * releasing past DELETE_THRESHOLD slides the row fully off and calls
 * onDelete, releasing short of it springs back to rest. */
export function ShoppingListItemRow({
  item,
  onToggleChecked,
  onDelete,
  onSourceClick,
}: ShoppingListItemRowProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore drags starting on the checkbox so tapping it never gets
    // mistaken for the beginning of a swipe.
    if ((e.target as HTMLElement).closest('[data-no-swipe]')) return;
    startXRef.current = e.clientX;
    draggingRef.current = true;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const delta = Math.min(0, Math.max(-MAX_DRAG, e.clientX - startXRef.current));
    setDragX(delta);
  };

  const commitOrReset = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (dragX <= -DELETE_THRESHOLD) {
      setRemoving(true);
      setDragX(-400);
      // Let the slide-out transition play before removing the row
      // from the list, so the delete doesn't feel abrupt.
      setTimeout(() => onDelete(item), 150);
    } else {
      setDragX(0);
    }
  };

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 1, mb: 0.5 }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: 'error.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          pr: 2,
        }}
      >
        <DeleteIcon sx={{ color: 'error.contrastText' }} fontSize="small" />
      </Box>
      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitOrReset}
        onPointerLeave={() => {
          if (draggingRef.current && !removing) commitOrReset();
        }}
        sx={{
          position: 'relative',
          bgcolor: 'background.default',
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 0.15s ease',
          touchAction: 'pan-y',
        }}
      >
        <Stack direction="row" alignItems="center">
          <Box data-no-swipe>
            <Checkbox
              size="small"
              checked={item.checked}
              onChange={() => onToggleChecked(item)}
            />
          </Box>
          <Typography
            variant="body2"
            sx={{ textDecoration: item.checked ? 'line-through' : 'none' }}
          >
            {item.name}
            {item.quantity ? ` × ${item.quantity}` : ''}
          </Typography>
        </Stack>
        {item.sources && item.sources.length > 0 && (
          <Stack sx={{ pl: 5.5, pb: 0.5 }} spacing={0.25}>
            {item.sources.map((source, idx) => (
              <Typography
                key={`${item.id}-${idx}`}
                variant="caption"
                color="text.secondary"
                sx={{ textDecoration: item.checked ? 'line-through' : 'none' }}
              >
                {source.amount ? `${source.amount} — ` : ''}
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  data-no-swipe
                  onClick={(e) => {
                    e.stopPropagation();
                    onSourceClick?.(source.mealId);
                  }}
                >
                  {source.mealName}
                </Link>
              </Typography>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
