import QuickCrypto from 'react-native-quick-crypto';

export async function sha256(data: string): Promise<string> {
  const hash = QuickCrypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex').toString();
}
