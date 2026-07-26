import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { HouseholdSection } from '@/components/settings/HouseholdSection';
import { GoogleDriveSection } from '@/components/settings/GoogleDriveSection';
import { DietaryDefaultsSection } from '@/components/settings/DietaryDefaultsSection';

export function SettingsPage() {
  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Settings
      </Typography>
      <HouseholdSection />
      <GoogleDriveSection />
      <DietaryDefaultsSection />
    </Box>
  );
}
