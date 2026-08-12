import { createTheme, type ThemeOptions } from '@mui/material/styles';
import type { ColorMode } from '@/models';

/**
 * Shared structural options (shape, typography, component overrides)
 * that don't vary between light and dark mode. Adapted from Media
 * Journal's theme.ts — same shape language (16px base radius, 20px
 * cards, pill buttons), different palette.
 */
const baseOptions: ThemeOptions = {
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: ['Roboto', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'].join(','),
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 20 },
        containedPrimary: { backgroundColor: '#9575CD', '&:hover': { backgroundColor: '#7E57C2' } },
        outlinedPrimary: { borderColor: '#9575CD', color: '#9575CD' },
        textPrimary: { color: '#9575CD' },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': { color: '#9575CD' },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: '#9575CD' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none' },
      },
    },
  },
};

/**
 * Creates the app theme for the given colour mode.
 *
 * Primary is a pinky-purple (per design confirmation), buttons/toggles
 * use a distinct violet accent so interactive controls read separately
 * from the pink used for tags/highlights. Secondary (teal) is used for
 * dietary and kids-meal tags so they don't blend into primary.
 *
 *   Primary   — Light: #C2478E   Dark: #E06BC7
 *   Accent    — Light: #7E57C2   Dark: #9575CD   (buttons, toggles)
 *   Secondary — #4DD0C8 (teal, dietary/kids tags)
 */
export function createAppTheme(mode: ColorMode) {
  return createTheme({
    ...baseOptions,
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#E06BC7' : '#C2478E',
        dark: mode === 'dark' ? '#B347A3' : '#8E2F6E',
        light: mode === 'dark' ? '#F3A6E5' : '#E06BC7',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#4DD0C8',
      },
      warning: {
        main: '#FFB74D',
      },
      background:
        mode === 'dark'
          ? { default: '#121212', paper: '#1E1E1E' }
          : { default: '#FFFBFE', paper: '#FFFFFF' },
    },
  });
}

/** Accent used specifically for buttons and toggles (violet), kept
 * distinct from the primary pink used for tags/highlights/nav. Not
 * part of the MUI palette since it's a narrower, intentional carve-out
 * rather than a semantic palette role. */
export const BUTTON_ACCENT = {
  main: '#9575CD',
  dark: '#7E57C2',
};

/** Color coding for the Adults/Kids/Both dinner category. Kids and
 * Both reuse the app-wide teal/violet accents; Adult uses a distinct
 * salmon deliberately kept apart from the primary pink so it doesn't
 * read as "the app's default color" for one specific category. */
export const CATEGORY_COLORS: Record<'adult' | 'kids' | 'both', string> = {
  adult: '#FF7566',
  kids: '#4DD0C8',
  both: '#9575CD',
};

export const theme = createAppTheme('dark');
