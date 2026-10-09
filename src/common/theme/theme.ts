import { createContext, useContext } from 'react';
import { LIGHT_COLORS, type ThemeColors } from '../constants/colors';

export type ThemeMode = 'light' | 'dark';
export interface AppTheme {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<AppTheme>({
  mode: 'light',
  isDark: false,
  colors: LIGHT_COLORS,
  setMode: () => undefined,
});
export function useTheme() {
  return useContext(ThemeContext);
}

export function themeVariables(colors: ThemeColors): Record<string, string> {
  const tokens = {
    background: colors.OFF_WHITE,
    surface: colors.CARD_WHITE,
    content: colors.DARK_SLATE,
    muted: colors.DISABLED_GREY,
    accent: colors.FOREST_GREEN,
    primary: colors.BUTTON_BACKGROUND,
    'on-primary': colors.ON_PRIMARY,
    line: colors.BORDER,
    input: colors.INPUT_BACKGROUND,
    danger: colors.ERROR_RED,
    'danger-soft': colors.ERROR_SURFACE,
    warning: colors.WARNING_ORANGE,
    'warning-soft': colors.WARNING_SURFACE,
    teal: colors.TEAL,
    'info-soft': colors.INFO_SURFACE,
    'success-soft': colors.SUCCESS_SURFACE,
    disabled: colors.DISABLED_BACKGROUND,
    hero: colors.HERO_BACKGROUND,
  };
  return Object.fromEntries(
    Object.entries(tokens).map(([name, hex]) => [
      `--color-${name}`,
      [1, 3, 5]
        .map(offset => parseInt(hex.slice(offset, offset + 2), 16))
        .join(' '),
    ]),
  );
}
