import React from 'react';
import { Appearance, Text, TouchableOpacity } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DARK_COLORS, LIGHT_COLORS } from '../../constants/colors';
import ThemeProvider from '../ThemeProvider';
import { themeVariables, useTheme } from '../theme';
import {
  clearPersistedAppStatePreserveOnboarding,
  mmkv,
} from '../../../store/mmkvStorage';

jest.mock('nativewind', () => ({ vars: (value: unknown) => value }));
jest.mock('react-native-mmkv', () => ({
  MMKV: class {
    values = new Map<string, unknown>();
    getString(key: string) {
      return this.values.get(key);
    }
    getBoolean(key: string) {
      return this.values.get(key);
    }
    set(key: string, value: unknown) {
      this.values.set(key, value);
    }
    delete(key: string) {
      this.values.delete(key);
    }
    clearAll() {
      this.values.clear();
    }
  },
}));

function Preferences() {
  const { mode, colors, setMode } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => setMode(mode === 'light' ? 'dark' : 'light')}
    >
      <Text style={{ color: colors.DARK_SLATE }}>{mode}</Text>
    </TouchableOpacity>
  );
}

beforeEach(() => mmkv.clearAll());

it('changes colors immediately, persists on relaunch, and preserves appearance on logout', () => {
  const nativeMode = jest.spyOn(Appearance, 'setColorScheme');
  const screen = render(
    <ThemeProvider>
      <Preferences />
    </ThemeProvider>,
  );
  expect(screen.getByText('light').props.style.color).toBe(
    LIGHT_COLORS.DARK_SLATE,
  );
  fireEvent.press(screen.getByText('light'));
  expect(screen.getByText('dark').props.style.color).toBe(
    DARK_COLORS.DARK_SLATE,
  );
  expect(nativeMode).toHaveBeenLastCalledWith('dark');
  mmkv.set('persist:root', 'old account');
  clearPersistedAppStatePreserveOnboarding();
  expect(mmkv.getString('persist:root')).toBeUndefined();
  screen.unmount();
  const reopened = render(
    <ThemeProvider>
      <Preferences />
    </ThemeProvider>,
  );
  expect(reopened.getByText('dark')).toBeTruthy();
  fireEvent.press(reopened.getByText('dark'));
  expect(mmkv.getString('appearance_mode')).toBe('light');
  nativeMode.mockRestore();
});

function luminance(hex: string) {
  const rgb = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

it.each([
  ['light', LIGHT_COLORS],
  ['dark', DARK_COLORS],
] as const)(
  '%s theme keeps normal text and status labels at WCAG AA contrast',
  (_mode, c) => {
    const pairs = [
      [c.DARK_SLATE, c.OFF_WHITE],
      [c.DARK_SLATE, c.CARD_WHITE],
      [c.DISABLED_GREY, c.CARD_WHITE],
      [c.DISABLED_GREY, c.INPUT_BACKGROUND],
      [c.ON_PRIMARY, c.BUTTON_BACKGROUND],
      [c.FOREST_GREEN, c.SUCCESS_SURFACE],
      [c.WARNING_ORANGE, c.WARNING_SURFACE],
      [c.ERROR_RED, c.ERROR_SURFACE],
      [c.TEAL, c.INFO_SURFACE],
      [c.INVERSE_TEXT, c.BANNER_ERROR],
      [c.INVERSE_TEXT, c.BANNER_WARNING],
      [c.INVERSE_TEXT, c.BANNER_INFO],
    ];
    for (const [foreground, background] of pairs) {
      const values = [luminance(foreground), luminance(background)].sort(
        (a, b) => a - b,
      );
      expect((values[1] + 0.05) / (values[0] + 0.05)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    expect(themeVariables(c)['--color-background']).toMatch(/^\d+ \d+ \d+$/);
    expect(Object.keys(themeVariables(c))).toEqual(
      Object.keys(themeVariables(LIGHT_COLORS)),
    );
  },
);
