const mockAssertSecureRandomAvailable = jest.fn();
jest.mock('../../common/utils/secureRandom', () => ({
  assertSecureRandomAvailable: () => mockAssertSecureRandomAvailable(),
}));
const mockSetGenericPassword = jest.fn();
const mockGetGenericPassword = jest.fn();
const mockGetSecurityLevel = jest.fn();
const mockCreateRandom = jest.fn();

const mockWalletConstructor = jest.fn(function (
  this: { address?: string },
  privateKey: string,
) {
  this.address = `derived:${privateKey}`;
});

(
  mockWalletConstructor as jest.Mock & { createRandom?: jest.Mock }
).createRandom = mockCreateRandom;

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('react-native-keychain', () => ({
  __esModule: true,
  default: {
    setGenericPassword: (...args: unknown[]) => mockSetGenericPassword(...args),
    getGenericPassword: (...args: unknown[]) => mockGetGenericPassword(...args),
    getSecurityLevel: (...args: unknown[]) => mockGetSecurityLevel(...args),
    ACCESSIBLE: {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
    },
    SECURITY_LEVEL: {
      SECURE_HARDWARE: 'SECURE_HARDWARE',
      SECURE_SOFTWARE: 'SECURE_SOFTWARE',
      ANY: 'ANY',
    },
  },
}));

jest.mock('ethers', () => {
  const Wallet = function (this: { address?: string }, privateKey: string) {
    mockWalletConstructor.call(this, privateKey);
  } as unknown as typeof mockWalletConstructor & {
    createRandom?: (...args: unknown[]) => unknown;
  };

  Wallet.createRandom = (...args: unknown[]) => mockCreateRandom(...args);

  return {
    __esModule: true,
    ethers: {
      Wallet,
    },
    Wallet,
  };
});

import {
  createFarmerWallet,
  ensureFarmerWallet,
  getWalletAddress,
} from '../wallet';

describe('wallet service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertSecureRandomAvailable.mockReset();
  });

  it('stores a new wallet with the strongest device security level available', async () => {
    mockCreateRandom.mockReturnValue({
      privateKey: '0xprivate',
      address: '0xwallet',
    });
    mockGetSecurityLevel.mockResolvedValue('SECURE_SOFTWARE');
    mockSetGenericPassword.mockResolvedValue({
      service: 'terratrust_wallet:farmer-1',
    });

    const walletAddress = await createFarmerWallet('farmer-1');

    expect(walletAddress).toBe('0xwallet');
    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'wallet_private_key',
      '0xprivate',
      expect.objectContaining({
        service: 'terratrust_wallet:farmer-1',
        securityLevel: 'SECURE_SOFTWARE',
      }),
    );
  });

  it('reuses an existing stored wallet before creating a new one', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'wallet_private_key',
      password: '0xstored-private',
      service: 'terratrust_wallet:farmer-1',
    });

    const walletAddress = await ensureFarmerWallet('farmer-1');

    expect(walletAddress).toBe('derived:0xstored-private');
    expect(mockCreateRandom).not.toHaveBeenCalled();
  });

  it('derives the wallet address from stored credentials', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'wallet_private_key',
      password: '0xstored-private',
      service: 'terratrust_wallet:farmer-1',
    });

    const walletAddress = await getWalletAddress('farmer-1');

    expect(walletAddress).toBe('derived:0xstored-private');
  });
  it('shares wallet creation so concurrent background setup cannot save two different keys', async () => {
    mockGetGenericPassword.mockResolvedValue(false);
    mockCreateRandom.mockReturnValue({
      privateKey: '0xprivate',
      address: '0xwallet',
    });
    mockSetGenericPassword.mockResolvedValue({
      service: 'terratrust_wallet:farmer-1',
    });
    mockGetSecurityLevel.mockResolvedValue('SECURE_SOFTWARE');
    const [first, second] = await Promise.all([
      ensureFarmerWallet('farmer-1'),
      ensureFarmerWallet('farmer-1'),
    ]);
    expect(first).toBe('0xwallet');
    expect(second).toBe(first);
    expect(mockCreateRandom).toHaveBeenCalledTimes(1);
    expect(mockSetGenericPassword).toHaveBeenCalledTimes(1);
  });
});

it('keeps private keys separated when accounts create wallets concurrently', async () => {
  mockGetGenericPassword.mockResolvedValue(false);
  mockGetSecurityLevel.mockResolvedValue('SECURE_SOFTWARE');
  mockCreateRandom
    .mockReturnValueOnce({ privateKey: 'key-one', address: 'address-one' })
    .mockReturnValueOnce({ privateKey: 'key-two', address: 'address-two' });
  mockSetGenericPassword.mockResolvedValue({ service: 'saved' });
  const results = await Promise.all([
    ensureFarmerWallet('owner-one'),
    ensureFarmerWallet('owner-two'),
  ]);
  expect(results).toEqual(['address-one', 'address-two']);
  expect(mockGetGenericPassword).toHaveBeenCalledWith({
    service: 'terratrust_wallet:owner-one',
  });
  expect(mockGetGenericPassword).toHaveBeenCalledWith({
    service: 'terratrust_wallet:owner-two',
  });
  expect(mockSetGenericPassword).toHaveBeenCalledWith(
    'wallet_private_key',
    'key-one',
    expect.objectContaining({ service: 'terratrust_wallet:owner-one' }),
  );
  expect(mockSetGenericPassword).toHaveBeenCalledWith(
    'wallet_private_key',
    'key-two',
    expect.objectContaining({ service: 'terratrust_wallet:owner-two' }),
  );
});

it('does not create or store a wallet when secure randomness is unavailable', async () => {
  mockAssertSecureRandomAvailable.mockImplementationOnce(() => {
    throw new Error('WALLET_RANDOM_SOURCE_UNAVAILABLE');
  });
  const calls = mockSetGenericPassword.mock.calls.length;
  await expect(createFarmerWallet('farmer-1')).rejects.toThrow(
    'WALLET_RANDOM_SOURCE_UNAVAILABLE',
  );
  expect(mockSetGenericPassword).toHaveBeenCalledTimes(calls);
});
