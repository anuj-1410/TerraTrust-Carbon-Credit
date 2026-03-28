import {calculateChaveAGB} from '../src/common/utils/chave';

describe('Chave allometric equation', () => {
  it('calculates AGB for a known teak-like input', () => {
    const agbKg = calculateChaveAGB(30, 15, 0.59);
    expect(agbKg).toBeCloseTo(401.793, 3);
  });

  it('returns 0 when DBH is zero', () => {
    expect(calculateChaveAGB(0, 15, 0.59)).toBe(0);
  });
});