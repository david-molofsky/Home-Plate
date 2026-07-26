import Box from '@mui/material/Box';
import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAutoBackup } from '@/hooks/useAutoBackup';

export function AppLayout() {
  useAutoBackup();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <AppHeader />
      <Box component="main" sx={{ flex: 1, p: 2, pb: 3, maxWidth: 720, mx: 'auto', width: '100%' }}>
        <Outlet />
      </Box>
      <BottomNav />
    </Box>
  );
}
