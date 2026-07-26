import { useLiveQuery } from 'dexie-react-hooks';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { db } from '@/services/database/db';
import { SETTINGS_KEYS } from '@/models';
import type { DietaryTag } from '@/models';

const OPTIONS: DietaryTag[] = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];

export function DietaryDefaultsSection() {
  const selected = useLiveQuery(async () => {
    const record = await db.appSettings.get(SETTINGS_KEYS.dietaryDefaults);
    return (record?.value as DietaryTag[]) ?? [];
  }, []);

  const toggle = async (tag: DietaryTag) => {
    const current = selected ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    await db.appSettings.put({ key: SETTINGS_KEYS.dietaryDefaults, value: next });
  };

  return (
    <CollapsibleSection title="Dietary defaults" icon={RestaurantOutlinedIcon}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Which dietary filters are relevant to your household — shown first when filtering meals.
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {OPTIONS.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            color={(selected ?? []).includes(tag) ? 'secondary' : 'default'}
            onClick={() => void toggle(tag)}
          />
        ))}
      </Stack>
    </CollapsibleSection>
  );
}
