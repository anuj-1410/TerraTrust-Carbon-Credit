import {hashPhoto} from '../src/common/utils/hash';

describe('hashPhoto', () => {
  it('returns a 64-character hex SHA-256 hash', async () => {
    const hash = await hashPhoto('SGVsbG8gV29ybGQ=');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    await expect(hashPhoto('dGVzdGRhdGE=')).resolves.toBe(
      await hashPhoto('dGVzdGRhdGE='),
    );
  });
});