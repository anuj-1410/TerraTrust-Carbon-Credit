// Unit test: ManualMeasureScreen DBH formula
// DBH = circumference / π, rounded to 1 decimal place

describe('ManualMeasureScreen DBH formula', () => {
  const computeDbh = (circumference: number) =>
    Math.round((circumference / Math.PI) * 10) / 10;

  it('computes 20.0 cm from 62.8 cm circumference', () => {
    expect(computeDbh(62.8)).toBe(20.0);
  });

  it('computes correct diameter for 31.4 cm', () => {
    expect(computeDbh(31.4)).toBe(10.0);
  });

  it('handles small circumference', () => {
    expect(computeDbh(15.7)).toBe(5.0);
  });

  it('rounds to 1 decimal place', () => {
    const result = computeDbh(100);
    expect(result).toBe(31.8);
  });
});
