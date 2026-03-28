jest.mock('react-native-quick-crypto', () => {
  const crypto = require('crypto');
  return {
    createHash: (algorithm: string) => crypto.createHash(algorithm),
  };
});

import {hashPhoto} from '../src/common/utils/hash';

describe('hashPhoto', () => {
  it('returns a 64-character hex SHA-256 hash', () => {
    const hash = hashPhoto('SGVsbG8gV29ybGQ=');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashPhoto('dGVzdGRhdGE=')).toBe(hashPhoto('dGVzdGRhdGE='));
  });
});