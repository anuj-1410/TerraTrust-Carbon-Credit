import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AppErrorBoundary from '../AppErrorBoundary';
it('shows a recovery screen after a render failure and remounts on Retry', () => {
  let failing = true;
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  function Screen() {
    if (failing) {
      throw new Error('Render failure');
    }
    return <Text>Restored session</Text>;
  }
  try {
    const screen = render(
      <AppErrorBoundary>
        <Screen />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Unable to display this screen')).toBeTruthy();
    failing = false;
    fireEvent.press(screen.getByText('Retry'));
    expect(screen.getByText('Restored session')).toBeTruthy();
  } finally {
    consoleError.mockRestore();
  }
});
