const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockAssertApiBaseUrlConfigured = jest.fn();
const mockGetFreshFirebaseIdToken = jest.fn();
const mockEnsureFarmerWallet = jest.fn();

jest.mock('../api', () => ({
  __esModule: true,
  assertApiBaseUrlConfigured: (...args: unknown[]) =>
    mockAssertApiBaseUrlConfigured(...args),
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

jest.mock('../firebase', () => ({
  getFreshFirebaseIdToken: (...args: unknown[]) =>
    mockGetFreshFirebaseIdToken(...args),
}));

jest.mock('../wallet', () => ({
  ensureFarmerWallet: (...args: unknown[]) => mockEnsureFarmerWallet(...args),
}));

import {bootstrapAuthenticatedProfile} from '../authBootstrap';

const baseProfile = {
  user_id: 'user-1',
  firebase_uid: 'firebase-user-1',
  phone_number: '+919000000004',
  full_name: null,
  kyc_completed: false,
  wallet_address: null,
  wallet_recovery_status: null,
  wallet_recovery_requested_at: null,
} as const;

describe('bootstrapAuthenticatedProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertApiBaseUrlConfigured.mockReturnValue(
      'https://terratrust-backend.onrender.com',
    );
    mockGetFreshFirebaseIdToken.mockResolvedValue('firebase-token');
  });

  it('returns the backend profile unchanged when a wallet is already registered', async () => {
    mockApiGet.mockResolvedValue({
      data: {...baseProfile, wallet_address: '0xabc'},
    });

    const result = await bootstrapAuthenticatedProfile();

    expect(result).toEqual({
      profile: {...baseProfile, wallet_address: '0xabc'},
    });
    expect(mockEnsureFarmerWallet).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('returns a non-blocking warning when wallet storage cannot be created locally', async () => {
    mockApiGet.mockResolvedValue({data: baseProfile});
    mockEnsureFarmerWallet.mockRejectedValue(new Error('WALLET_STORAGE_FAILED'));

    const result = await bootstrapAuthenticatedProfile();

    expect(result.profile).toEqual(baseProfile);
    expect(result.warning).toEqual({
      code: 'wallet-storage-pending',
      message:
        'Signed in, but secure wallet setup could not finish on this phone yet. Please reopen the app to retry.',
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('returns a retry warning when wallet registration fails after local wallet creation', async () => {
    mockApiGet.mockResolvedValue({data: baseProfile});
    mockEnsureFarmerWallet.mockResolvedValue('0xwallet');
    mockApiPost.mockRejectedValue({response: undefined});

    const result = await bootstrapAuthenticatedProfile();

    expect(result.profile).toEqual(baseProfile);
    expect(result.warning).toEqual({
      code: 'wallet-registration-pending',
      message:
        'Signed in, but wallet sync is still pending. TerraTrust will retry when your connection is stable.',
    });
  });

  it('returns an optimistic wallet profile when register succeeds but refresh fails', async () => {
    mockApiGet
      .mockResolvedValueOnce({data: baseProfile})
      .mockRejectedValueOnce(new Error('refresh failed'));
    mockEnsureFarmerWallet.mockResolvedValue('0xwallet');
    mockApiPost.mockResolvedValue({status: 200});

    const result = await bootstrapAuthenticatedProfile();

    expect(result).toEqual({
      profile: {...baseProfile, wallet_address: '0xwallet'},
    });
    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/auth/register-wallet', {
      wallet_address: '0xwallet',
    });
  });
});
