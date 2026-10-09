import React from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeContext } from '../../../../common/theme/theme';
import { DARK_COLORS } from '../../../../common/constants/colors';
import SettingsScreen from '../SettingsScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));
jest.mock('react-native-device-info', () => ({
  getVersion: () => '1.0.0',
  getBuildNumber: () => '1',
}));
jest.mock('../../../../store/hooks', () => ({
  useAppDispatch: () => jest.fn(),
  useAppSelector: (select: (state: unknown) => unknown) =>
    select({
      profile: {
        settingsNotificationsEnabled: true,
        settingsHighAccuracyGPS: false,
      },
    }),
}));

it('offers a dark-mode switch and keeps navigation outside scrolling content', () => {
  const setMode = jest.fn();
  const screen = render(
    <ThemeContext.Provider
      value={{ mode: 'dark', isDark: true, colors: DARK_COLORS, setMode }}
    >
      <SettingsScreen />
    </ThemeContext.Provider>,
  );
  const toggle = screen.getByLabelText('Dark mode');
  expect(toggle.props.value).toBe(true);
  fireEvent(toggle, 'valueChange', false);
  expect(setMode).toHaveBeenCalledWith('light');
  const header = screen.getByTestId('screen-header');
  const scroll = screen.UNSAFE_getByType(ScrollView);
  expect(scroll.findAll(node => node === header)).toHaveLength(0);
  expect(screen.getByText('Dark Mode').props.style.color).toBe(
    DARK_COLORS.DARK_SLATE,
  );
});
