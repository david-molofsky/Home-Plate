import CalendarViewWeekOutlinedIcon from '@mui/icons-material/CalendarViewWeekOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { ROUTES } from '@/routes/paths';

export interface NavItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
}

/**
 * Primary bottom navigation: Plan, Calendar, Library, Shopping List.
 * Settings isn't here — reachable from the gear icon in AppHeader,
 * same pattern as Media Journal.
 */
export const navItems: NavItem[] = [
  { label: 'Plan', path: ROUTES.planner, icon: CalendarViewWeekOutlinedIcon },
  { label: 'Calendar', path: ROUTES.calendar, icon: CalendarMonthOutlinedIcon },
  { label: 'Library', path: ROUTES.library, icon: MenuBookOutlinedIcon },
  { label: 'List', path: ROUTES.shoppingList, icon: ShoppingCartOutlinedIcon },
];
