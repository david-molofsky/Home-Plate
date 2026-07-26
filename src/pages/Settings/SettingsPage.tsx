import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { HouseholdSyncSection } from '@/components/settings/HouseholdSyncSection';
import { GoogleDriveSection } from '@/components/settings/GoogleDriveSection';
import { DietaryDefaultsSection } from '@/components/settings/DietaryDefaultsSection';
import { GroceryAislesSection } from '@/components/settings/GroceryAislesSection';

export function SettingsPage() {
  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Settings
      </Typography>
      <HouseholdSyncSection />
      <GoogleDriveSection />
      <DietaryDefaultsSection />
      <GroceryAislesSection />
    </Box>
  );
}
