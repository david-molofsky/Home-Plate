import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { theme } from '@/theme/theme';
import { AppLayout } from '@/components/layout/AppLayout';
import { WeeklyPlannerPage } from '@/pages/WeeklyPlanner/WeeklyPlannerPage';
import { CalendarPage } from '@/pages/Calendar/CalendarPage';
import { LibraryPage } from '@/pages/Library/LibraryPage';
import { EditMealPage } from '@/pages/Library/EditMealPage';
import { ShoppingListPage } from '@/pages/ShoppingList/ShoppingListPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<WeeklyPlannerPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/new" element={<EditMealPage />} />
            <Route path="/library/:mealId" element={<EditMealPage />} />
            <Route path="/shopping-list" element={<ShoppingListPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
