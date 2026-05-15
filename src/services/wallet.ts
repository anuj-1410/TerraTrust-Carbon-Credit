import {Platform} from 'react-native';
import {ethers} from 'ethers';
import Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'terratrust_wallet';
const KEYCHAIN_USERNAME = 'wallet_private_key';

type WalletKeychainOptions = NonNullable<
  Parameters<typeof Keychain.setGenericPassword>[2]
>;

async function getWalletKeychainOptions(): Promise<WalletKeychainOptions> {
  const options: WalletKeychainOptions = {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  if (Platform.OS === 'android') {
    const deviceSecurityLevel =
      (await Keychain.getSecurityLevel()) ?? Keychain.SECURITY_LEVEL.ANY;

    options.securityLevel = deviceSecurityLevel;
  }

  return options;
}

async function storeWalletPrivateKey(privateKey: string): Promise<void> {
  const keychainOptions = await getWalletKeychainOptions();
  const credentialsSaved = await Keychain.setGenericPassword(
    KEYCHAIN_USERNAME,
    privateKey,
    keychainOptions,
  );

  if (!credentialsSaved) {
    throw new Error('WALLET_STORAGE_FAILED');
  }
}

export async function createFarmerWallet(): Promise<string> {
  const wallet = ethers.Wallet.createRandom();

  await storeWalletPrivateKey(wallet.privateKey);

  return wallet.address;
}

export async function getWalletAddress(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({
    service: KEYCHAIN_SERVICE,
  });

  if (!credentials) {
    return null;
  }

  const wallet = new ethers.Wallet(credentials.password);
  return wallet.address;
}

export async function ensureFarmerWallet(): Promise<string> {
  return (await getWalletAddress()) ?? createFarmerWallet();
}
