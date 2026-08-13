import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { useCookingTimer, formatSeconds } from '@/hooks/useCookingTimer';
import { cookingModePath } from '@/routes/paths';

export function AppLayout() {
  useAutoBackup();
  const { timer, remainingSeconds, isComplete } = useCookingTimer();
  const navigate = useNavigate();
  const location = useLocation();

  // Cooking Mode renders its own full-screen sticky timer — no need to
  // double it up with this mini banner while already on that screen.
  const showTimerBanner = !!timer && !location.pathname.endsWith('/cook');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <AppHeader />
      <Box component="main" sx={{ flex: 1, p: 2, pb: 3, maxWidth: 720, mx: 'auto', width: '100%' }}>
        <Outlet />
      </Box>
      {showTimerBanner && (
        <ButtonBase
          onClick={() => navigate(cookingModePath(timer!.mealId))}
          sx={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            bgcolor: isComplete ? 'warning.main' : 'primary.dark',
            color: isComplete ? '#1a0f17' : '#fff',
            px: 2,
            py: 1,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" fontWeight={700}>
              {isComplete ? `⏰ ${timer!.stepTitle} — time's up!` : `🍳 ${timer!.stepTitle}`}
            </Typography>
            <Typography variant="caption" fontWeight={700}>
              {isComplete ? 'Tap to return' : formatSeconds(remainingSeconds)}
            </Typography>
          </Stack>
        </ButtonBase>
      )}
      <Box
        component="footer"
        sx={{
          px: 2,
          py: 0.75,
          textAlign: 'center',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Home Plate — plan meals, dodge repeats, build your shopping list automatically.{' '}
          <Typography
            component="a"
            href={`${import.meta.env.BASE_URL}privacy.html`}
            variant="caption"
            color="primary"
            sx={{ textDecoration: 'none' }}
          >
            Privacy Policy
          </Typography>
        </Typography>
      </Box>
      <BottomNav />
    </Box>
  );
}
