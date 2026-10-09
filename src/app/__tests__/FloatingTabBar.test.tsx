import React from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import FloatingTabBar from '../FloatingTabBar';
import { ThemeContext } from '../../common/theme/theme';
import { DARK_COLORS } from '../../common/constants/colors';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock('@react-native-community/blur', () => ({ BlurView: 'BlurView' }));

function setup() {
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  const routes = ['HomeTab', 'LandTab', 'HistoryTab', 'ProfileTab'].map(
    name => ({ key: name, name }),
  );
  const descriptors = Object.fromEntries(
    routes.map(route => [
      route.key,
      { options: { title: route.name.replace('Tab', '') } },
    ]),
  );
  const props = {
    state: { routes, index: 0 },
    descriptors,
    navigation,
  } as unknown as BottomTabBarProps;
  const screen = render(
    <ThemeContext.Provider
      value={{
        colors: DARK_COLORS,
        mode: 'dark',
        isDark: true,
        setMode: jest.fn(),
      }}
    >
      <FloatingTabBar {...props} />
    </ThemeContext.Provider>,
  );
  return { screen, navigation };
}

it('keeps Android controls sharp, uses dark colors, and navigates when a tab is pressed', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const { screen, navigation } = setup();
  expect(screen.UNSAFE_queryByType('BlurView' as never)).toBeNull();
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(StyleSheet.flatten(screen.getByText('Home').props.style).color).toBe(
    DARK_COLORS.FOREST_GREEN,
  );
  expect(StyleSheet.flatten(screen.getByText('Land').props.style).color).toBe(
    DARK_COLORS.DISABLED_GREY,
  );
  const frames = screen
    .UNSAFE_getAllByType(View)
    .map(view => StyleSheet.flatten(view.props.style));
  expect(frames).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        backgroundColor: DARK_COLORS.CARD_WHITE,
        borderRadius: 36,
      }),
    ]),
  );
  expect(
    frames.some(style => style?.elevation > 0 || style?.shadowOpacity > 0),
  ).toBe(false);
  fireEvent.press(screen.getByRole('tab', { name: 'Land' }));
  expect(navigation.navigate).toHaveBeenCalledWith('LandTab', undefined);
  jest.restoreAllMocks();
});

it('honors a prevented tab press and hides while the keyboard is open', () => {
  const handlers: Record<string, () => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
    handlers[event] = handler as () => void;
    return { remove: jest.fn() } as unknown as ReturnType<
      typeof Keyboard.addListener
    >;
  });
  const { screen, navigation } = setup();
  navigation.emit.mockReturnValue({ defaultPrevented: true });
  fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  expect(navigation.navigate).not.toHaveBeenCalled();
  act(() => handlers.keyboardDidShow());
  expect(screen.queryAllByRole('tab')).toHaveLength(0);
  act(() => handlers.keyboardDidHide());
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  jest.restoreAllMocks();
});
