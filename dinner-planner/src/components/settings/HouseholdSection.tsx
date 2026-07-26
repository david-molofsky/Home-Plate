import { useLiveQuery } from 'dexie-react-hooks';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { db } from '@/services/database/db';

const KEY = 'householdCode';

function generateCode(): string {
  const part = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${part()}-${part()}`;
}

/**
 * Household code is just a shared label households use to recognize
 * each other's Drive exports — there's no server-side account behind
 * it (per product decision: no individual logins, sync via Drive).
 */
export function HouseholdSection() {
  const code = useLiveQuery(async () => {
    const record = await db.appSettings.get(KEY);
    if (record) return record.value as string;
    const generated = generateCode();
    await db.appSettings.put({ key: KEY, value: generated });
    return generated;
  }, []);

  return (
    <CollapsibleSection title="Household" icon={GroupsOutlinedIcon}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Share this code with household members so everyone recognizes the same plan when
        exporting/importing via Drive.
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography fontWeight={700} sx={{ letterSpacing: 1 }}>
          {code ?? '…'}
        </Typography>
        <Button size="small" onClick={() => code && navigator.clipboard.writeText(code)}>
          Copy
        </Button>
      </Stack>
    </CollapsibleSection>
  );
}
