import React from 'react';
import { Animated, Modal, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import SheetModal from '../SheetModal';
let mockReduced = false;
jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReduced,
}));
beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('uses one native-driven animation for opening and waits to dismiss until the exit completes', () => {
  const timing = jest.spyOn(Animated, 'timing');
  const opened = jest.fn();
  const dismissed = jest.fn();
  const close = jest.fn();
  const props = {
    onRequestClose: close,
    onOpened: opened,
    onDismissed: dismissed,
  };
  const screen = render(
    <SheetModal visible {...props}>
      <Text>Sheet body</Text>
    </SheetModal>,
  );
  expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none');
  fireEvent(screen.UNSAFE_getByType(Modal), 'show');
  expect(timing).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      toValue: 1,
      useNativeDriver: true,
      duration: 280,
    }),
  );
  act(() => jest.advanceTimersByTime(300));
  expect(opened).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Close drawer'));
  expect(close).toHaveBeenCalledTimes(1);
  screen.rerender(
    <SheetModal visible={false} {...props}>
      <Text>Sheet body</Text>
    </SheetModal>,
  );
  expect(dismissed).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(220));
  expect(dismissed).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Sheet body')).toBeNull();
});
it('honours reduced motion and handles dismissal before the native modal shows', () => {
  mockReduced = true;
  const dismissed = jest.fn();
  const screen = render(
    <SheetModal visible onRequestClose={jest.fn()} onDismissed={dismissed}>
      <Text>Sheet body</Text>
    </SheetModal>,
  );
  screen.rerender(
    <SheetModal
      visible={false}
      onRequestClose={jest.fn()}
      onDismissed={dismissed}
    >
      <Text>Sheet body</Text>
    </SheetModal>,
  );
  act(() => jest.runOnlyPendingTimers());
  expect(dismissed).toHaveBeenCalledTimes(1);
});
