import { assertSecureRandomAvailable } from '../common/utils/secureRandom';
import { Platform } from 'react-native';
import { ethers } from 'ethers';
import Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'terratrust_wallet';
const KEYCHAIN_USERNAME = 'wallet_private_key';

function walletService(ownerUid: string): string {
  if (!ownerUid?.trim()) {
    throw new Error('WALLET_OWNER_MISSING');
  }
  return `${KEYCHAIN_SERVICE}:${ownerUid}`;
}

type WalletKeychainOptions = NonNullable<
  Parameters<typeof Keychain.setGenericPassword>[2]
>;

async function getWalletKeychainOptions(
  ownerUid: string,
): Promise<WalletKeychainOptions> {
  const options: WalletKeychainOptions = {
    service: walletService(ownerUid),
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  if (Platform.OS === 'android') {
    const deviceSecurityLevel =
      (await Keychain.getSecurityLevel()) ?? Keychain.SECURITY_LEVEL.ANY;

    options.securityLevel = deviceSecurityLevel;
  }

  return options;
}

async function storeWalletPrivateKey(
  privateKey: string,
  ownerUid: string,
): Promise<void> {
  const keychainOptions = await getWalletKeychainOptions(ownerUid);
  const credentialsSaved = await Keychain.setGenericPassword(
    KEYCHAIN_USERNAME,
    privateKey,
    keychainOptions,
  );

  if (!credentialsSaved) {
    throw new Error('WALLET_STORAGE_FAILED');
  }
}

export async function createFarmerWallet(ownerUid: string): Promise<string> {
  walletService(ownerUid);
  assertSecureRandomAvailable();
  const wallet = ethers.Wallet.createRandom();

  await storeWalletPrivateKey(wallet.privateKey, ownerUid);

  return wallet.address;
}

export async function getWalletAddress(
  ownerUid: string,
): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({
    service: walletService(ownerUid),
  });

  if (!credentials) {
    return null;
  }

  const wallet = new ethers.Wallet(credentials.password);
  return wallet.address;
}

const pendingWalletSetup = new Map<string, Promise<string>>();

export function ensureFarmerWallet(ownerUid: string): Promise<string> {
  const current = pendingWalletSetup.get(ownerUid);
  if (current) {
    return current;
  }
  const pending = (async () =>
    (await getWalletAddress(ownerUid)) ??
    createFarmerWallet(ownerUid))().finally(() => {
    if (pendingWalletSetup.get(ownerUid) === pending) {
      pendingWalletSetup.delete(ownerUid);
    }
  });
  pendingWalletSetup.set(ownerUid, pending);
  return pending;
}
