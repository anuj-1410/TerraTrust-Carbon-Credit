import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Appearance, StatusBar, View } from 'react-native';
import { vars } from 'nativewind';
import { mmkv } from '../../store/mmkvStorage';
import { DARK_COLORS, LIGHT_COLORS } from '../constants/colors';
import { ThemeContext, themeVariables, type ThemeMode } from './theme';

export const APPEARANCE_STORAGE_KEY = 'appearance_mode';

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, updateMode] = useState<ThemeMode>(() =>
    mmkv.getString(APPEARANCE_STORAGE_KEY) === 'dark' ? 'dark' : 'light',
  );
  const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const setMode = useCallback((next: ThemeMode) => {
    mmkv.set(APPEARANCE_STORAGE_KEY, next);
    updateMode(next);
  }, []);
  useEffect(() => {
    Appearance.setColorScheme(mode);
  }, [mode]);
  const theme = useMemo(
    () => ({ mode, isDark: mode === 'dark', colors, setMode }),
    [colors, mode, setMode],
  );

  return (
    <ThemeContext.Provider value={theme}>
      <View
        style={[
          { flex: 1, backgroundColor: colors.OFF_WHITE },
          vars(themeVariables(colors)),
        ]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
