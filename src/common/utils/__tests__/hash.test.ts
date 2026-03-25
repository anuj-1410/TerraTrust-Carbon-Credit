import {hashPhoto} from '../hash';

jest.mock('react-native-quick-crypto', () => {
  const crypto = require('crypto');
  return {
    createHash: (algorithm: string) => crypto.createHash(algorithm),
  };
});

describe('hashPhoto', () => {
  it('returns a 64-character hex string', () => {
    const testBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
    const result = hashPhoto(testBase64);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces consistent SHA-256 output for the same input', () => {
    const input = 'dGVzdCBpbWFnZSBkYXRh';
    expect(hashPhoto(input)).toBe(hashPhoto(input));
  });

  it('produces different output for different inputs', () => {
    expect(hashPhoto('aW1hZ2Ux')).not.toBe(hashPhoto('aW1hZ2Uy'));
  });
});
