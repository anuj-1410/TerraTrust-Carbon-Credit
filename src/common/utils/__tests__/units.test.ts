import {hectaresToAcres, sqmToHectares} from '../units';

describe('hectaresToAcres', () => {
  it('converts 1 hectare to 2.471 acres', () => {
    expect(hectaresToAcres(1)).toBeCloseTo(2.471, 3);
  });

  it('converts 0 hectares to 0 acres', () => {
    expect(hectaresToAcres(0)).toBe(0);
  });

  it('converts 0.49 hectares correctly', () => {
    expect(hectaresToAcres(0.49)).toBeCloseTo(1.21079, 3);
  });
});

describe('sqmToHectares', () => {
  it('converts 10000 sqm to 1 hectare', () => {
    expect(sqmToHectares(10000)).toBe(1);
  });

  it('converts 0 sqm to 0 hectares', () => {
    expect(sqmToHectares(0)).toBe(0);
  });

  it('converts 4856.2 sqm correctly', () => {
    expect(sqmToHectares(4856.2)).toBeCloseTo(0.48562, 5);
  });
});
