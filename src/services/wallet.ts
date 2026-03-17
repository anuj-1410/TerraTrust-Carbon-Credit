import {ethers} from 'ethers';
import Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'terratrust-wallet';

export async function createWallet(): Promise<string> {
  const wallet = ethers.Wallet.createRandom();

  await Keychain.setGenericPassword('wallet-private-key', wallet.privateKey, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

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
