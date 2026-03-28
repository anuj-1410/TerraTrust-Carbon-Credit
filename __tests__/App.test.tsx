/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../src/app/App', () => {
  const {Text} = require('react-native');

  return function MockAppShell() {
    return <Text>TerraTrust App Shell</Text>;
  };
});

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
