import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
const mockDispatch = jest.fn();
const mockResetNavigation = jest.fn();
const mockSignOut = jest.fn();
const mockToken = jest.fn();
const mockClearStorage = jest.fn();
let mockUid: string | null = 'farmer-1';
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { API_BASE_URL: 'https://example.test' },
}));
jest.mock('../firebase', () => ({
  getCurrentFirebaseUser: () => (mockUid ? { uid: mockUid } : null),
  getFreshFirebaseIdToken: (refresh?: boolean) => mockToken(refresh),
  signOutFirebase: () => mockSignOut(),
}));
jest.mock('../../store', () => ({
  store: { dispatch: (...args: unknown[]) => mockDispatch(...args) },
  resetAppState: () => ({ type: 'app/resetState' }),
}));
jest.mock('../navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    reset: (...args: unknown[]) => mockResetNavigation(...args),
  },
}));
jest.mock('../../store/mmkvStorage', () => ({
  clearPersistedAppStatePreserveOnboarding: () => mockClearStorage(),
  mmkv: { getString: jest.fn(), delete: jest.fn(), set: jest.fn() },
}));
import api from '../api';
const mockAdapter = jest.fn();
function unauthorized(config: InternalAxiosRequestConfig) {
  throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    data: {},
    config,
  });
}
function success(config: InternalAxiosRequestConfig) {
  return Promise.resolve({
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { ok: true },
    config,
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockUid = 'farmer-1';
  mockToken
    .mockReset()
    .mockImplementation(async refresh =>
      refresh ? 'fresh-token' : 'cached-token',
    );
  mockSignOut.mockImplementation(async () => {
    mockUid = null;
  });
  mockAdapter.mockReset();
  api.defaults.adapter = mockAdapter;
});
it('refreshes an expired token once and retries without logging out', async () => {
  mockAdapter
    .mockImplementationOnce(unauthorized)
    .mockImplementationOnce(success);
  await expect(api.get('/api/v1/auth/me')).resolves.toMatchObject({
    status: 200,
  });
  expect(mockAdapter).toHaveBeenCalledTimes(2);
  expect(mockToken).toHaveBeenCalledWith(true);
  expect(mockSignOut).not.toHaveBeenCalled();
});
it('keeps the session if refreshing the token fails because of connectivity', async () => {
  mockAdapter.mockImplementation(unauthorized);
  mockToken.mockImplementation(async refresh => {
    if (refresh) {
      throw { code: 'auth/network-request-failed' };
    }
    return 'cached-token';
  });
  await expect(api.get('/api/v1/auth/me')).rejects.toMatchObject({
    code: 'auth/network-request-failed',
  });
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(mockClearStorage).not.toHaveBeenCalled();
});
it('invalidates a genuinely unauthorized session after exactly one retry', async () => {
  mockAdapter.mockImplementation(unauthorized);
  await expect(api.get('/api/v1/auth/me')).rejects.toMatchObject({
    response: { status: 401 },
  });
  expect(mockAdapter).toHaveBeenCalledTimes(2);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockClearStorage).toHaveBeenCalledTimes(1);
  expect(mockResetNavigation).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'LoginScreen' }],
  });
});
it('shares a token refresh between concurrent unauthorized requests', async () => {
  let finish!: (token: string) => void;
  const refresh = new Promise<string>(resolve => {
    finish = resolve;
  });
  mockToken.mockImplementation(async forced =>
    forced ? refresh : 'cached-token',
  );
  mockAdapter.mockImplementation(config =>
    config.terraAuthRetried ? success(config) : unauthorized(config),
  );
  const requests = [api.get('/first'), api.get('/second')];
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
  finish('fresh-token');
  await Promise.all(requests);
  expect(
    mockToken.mock.calls.filter(([forced]) => forced === true),
  ).toHaveLength(1);
  expect(mockSignOut).not.toHaveBeenCalled();
});
it('discards a late 401 from the previous account without signing out the new account', async () => {
  mockAdapter.mockImplementation(config => {
    mockUid = 'farmer-2';
    return unauthorized(config);
  });
  await expect(api.get('/api/v1/land/list')).rejects.toMatchObject({
    code: 'ERR_CANCELED',
  });
  expect(mockSignOut).not.toHaveBeenCalled();
});
it('discards a late successful response from the previous account', async () => {
  mockAdapter.mockImplementation(config => {
    mockUid = 'farmer-2';
    return success(config);
  });
  await expect(api.get('/api/v1/land/list')).rejects.toMatchObject({
    code: 'ERR_CANCELED',
  });
});
