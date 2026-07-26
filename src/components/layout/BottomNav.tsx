import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import { useLocation, useNavigate } from 'react-router-dom';
import { navItems } from '@/components/layout/navItems';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeIndex = navItems.findIndex((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );

  return (
    <Paper
      elevation={0}
      sx={{ position: 'sticky', bottom: 0, borderTop: 1, borderColor: 'divider' }}
      square
    >
      <BottomNavigation
        showLabels
        value={activeIndex === -1 ? false : activeIndex}
        onChange={(_, newIndex: number) => navigate(navItems[newIndex].path)}
      >
        {navItems.map((item) => (
          <BottomNavigationAction key={item.path} label={item.label} icon={<item.icon />} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
