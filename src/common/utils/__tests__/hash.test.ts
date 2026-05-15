jest.mock('react-native', () => ({
  NativeModules: {
    HashModule: {
      sha256Base64: async (input: string) =>
        require('crypto').createHash('sha256').update(input).digest('hex'),
    },
  },
}));

import {hashPhoto} from '../hash';

describe('hashPhoto', () => {
  it('returns a 64-character hex string', async () => {
    const testBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
    const result = await hashPhoto(testBase64);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces consistent SHA-256 output for the same input', async () => {
    const input = 'dGVzdCBpbWFnZSBkYXRh';
    await expect(hashPhoto(input)).resolves.toBe(await hashPhoto(input));
  });

  it('produces different output for different inputs', async () => {
    expect(await hashPhoto('aW1hZ2Ux')).not.toBe(await hashPhoto('aW1hZ2Uy'));
  });
});
