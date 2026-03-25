import QuickCrypto from 'react-native-quick-crypto';

export function sha256(data: string): string {
  const hash = QuickCrypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex').toString();
}

export function hashPhoto(base64: string): string {
  return sha256(base64);
}
