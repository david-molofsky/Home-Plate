import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';

/**
 * Application header — adapted directly from Media Journal's
 * AppHeader.tsx. Houses the app title and a settings shortcut;
 * page-specific titles live in each page body instead of here.
 */
export function AppHeader() {
  const navigate = useNavigate();

  return (
    <AppBar position="sticky" color="default" sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Home Plate
        </Typography>
        <IconButton aria-label="Open settings" onClick={() => navigate(ROUTES.settings)}>
          <SettingsOutlinedIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
