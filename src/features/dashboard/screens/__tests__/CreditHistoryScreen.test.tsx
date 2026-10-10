import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { authInitialState } from '../../../auth/store/authSlice';
import creditsReducer from '../../store/creditsSlice';
import CreditHistoryScreen from '../CreditHistoryScreen';
const mockGet = jest.fn();
jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => false, goBack: jest.fn() }),
  useRoute: () => ({ params: { source: 'history' } }),
}));
jest.mock('../../../../common/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));
const record = (id: string, year: number, credits: number) => ({
  audit_id: id,
  audit_year: year,
  credits_issued: credits,
  land_name: `Farm ${year}`,
  minted_at: `${year}-11-01T00:00:00Z`,
  tx_hash: '',
  ipfs_certificate_url: '',
});
function setup() {
  const store = configureStore({
    reducer: { auth: authReducer, credits: creditsReducer },
    preloadedState: {
      auth: {
        ...authInitialState,
        sessionReady: true,
        isAuthenticated: true,
        user: {
          id: 'user-1',
          firebaseUid: 'farmer-1',
          name: 'Farmer',
          phone: '+919999999999',
        },
      },
    },
  });
  return render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, bottom: 0, left: 0, right: 0 }}
    >
      <Provider store={store}>
        <CreditHistoryScreen />
      </Provider>
    </SafeAreaInsetsContext.Provider>,
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  mockGet.mockReset();
  mockGet.mockImplementation((_url, { params }) =>
    Promise.resolve({
      data: {
        history: [
          params.page === 1
            ? record('old', 2024, 21.38)
            : record('new', 2026, 10),
        ],
        page: params.page,
        total: 2,
        has_more: params.page === 1,
      },
    }),
  );
});
afterEach(() => jest.useRealTimers());
it('includes later pages in annual totals and applies the same calendar-year filter to the list', async () => {
  const screen = setup();
  await waitFor(() => expect(screen.getByText('31.38 CTT')).toBeTruthy());
  expect(screen.getByText('Farm 2024')).toBeTruthy();
  fireEvent.press(screen.getByText('1 year'));
  expect(screen.queryByText('Farm 2024')).toBeNull();
  expect(screen.getByText('Farm 2026')).toBeTruthy();
  expect(screen.getByLabelText('2026: 10.00 CTT issued')).toBeTruthy();
});
it('validates custom year ranges and shows no-audit years without borrowing other years data', async () => {
  const screen = setup();
  await waitFor(() => expect(screen.getByText('31.38 CTT')).toBeTruthy());
  fireEvent.press(screen.getByText('Choose years'));
  fireEvent.changeText(screen.getByLabelText('From year'), '2026');
  fireEvent.changeText(screen.getByLabelText('To year'), '2024');
  fireEvent.press(screen.getByText('Apply years'));
  expect(screen.getByText(/Enter a valid year range/)).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('From year'), '2025');
  fireEvent.changeText(screen.getByLabelText('To year'), '2025');
  await act(async () => fireEvent.press(screen.getByText('Apply years')));
  expect(
    screen.getByText('No audits in the selected years. Choose a wider range.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('2025: 0.00 CTT issued')).toBeTruthy();
  expect(screen.queryByText('Farm 2024')).toBeNull();
});
it('keeps loaded data marked incomplete and offers retry when an older history page fails', async () => {
  mockGet.mockImplementation((_url, { params }) =>
    params.page === 1
      ? Promise.resolve({
          data: {
            history: [record('old', 2024, 21.38)],
            page: 1,
            has_more: true,
          },
        })
      : Promise.reject(new Error('Network Error')),
  );
  const screen = setup();
  await waitFor(() => expect(screen.getByText('Retry history')).toBeTruthy());
  expect(
    screen.getByLabelText('2024: 21.38 CTT issued, incomplete total'),
  ).toBeTruthy();
  expect(screen.getByText('Farm 2024')).toBeTruthy();
});
