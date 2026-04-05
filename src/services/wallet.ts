import {ethers} from 'ethers';
import Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'terratrust_wallet';

export async function createFarmerWallet(): Promise<string> {
  const wallet = ethers.Wallet.createRandom();

  await Keychain.setGenericPassword('wallet_private_key', wallet.privateKey, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
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
