const mockSetGenericPassword = jest.fn();
const mockGetGenericPassword = jest.fn();
const mockGetSecurityLevel = jest.fn();
const mockCreateRandom = jest.fn();

const mockWalletConstructor = jest.fn(function (this: {address?: string}, privateKey: string) {
  this.address = `derived:${privateKey}`;
});

(mockWalletConstructor as jest.Mock & {createRandom?: jest.Mock}).createRandom =
  mockCreateRandom;

jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
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
  const Wallet = function (this: {address?: string}, privateKey: string) {
    mockWalletConstructor.call(this, privateKey);
  } as unknown as typeof mockWalletConstructor & {
    createRandom?: typeof mockCreateRandom;
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
  });

  it('stores a new wallet with the strongest device security level available', async () => {
    mockCreateRandom.mockReturnValue({
      privateKey: '0xprivate',
      address: '0xwallet',
    });
    mockGetSecurityLevel.mockResolvedValue('SECURE_SOFTWARE');
    mockSetGenericPassword.mockResolvedValue({service: 'terratrust_wallet'});

    const walletAddress = await createFarmerWallet();

    expect(walletAddress).toBe('0xwallet');
    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'wallet_private_key',
      '0xprivate',
      expect.objectContaining({
        service: 'terratrust_wallet',
        securityLevel: 'SECURE_SOFTWARE',
      }),
    );
  });

  it('reuses an existing stored wallet before creating a new one', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'wallet_private_key',
      password: '0xstored-private',
      service: 'terratrust_wallet',
    });

    const walletAddress = await ensureFarmerWallet();

    expect(walletAddress).toBe('derived:0xstored-private');
    expect(mockCreateRandom).not.toHaveBeenCalled();
  });

  it('derives the wallet address from stored credentials', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'wallet_private_key',
      password: '0xstored-private',
      service: 'terratrust_wallet',
    });

    const walletAddress = await getWalletAddress();

    expect(walletAddress).toBe('derived:0xstored-private');
  });
});
