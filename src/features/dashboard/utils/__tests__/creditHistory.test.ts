import {
  annualCredits,
  filterCreditHistory,
  parseYearRange,
} from '../creditHistory';
import type { AuditRecord } from '../../store/creditsSlice';
const record = (year: number, credits: number): AuditRecord => ({
  audit_year: year,
  credits_issued: credits,
  land_name: 'Farm',
  minted_at: '',
  tx_hash: '',
  ipfs_certificate_url: '',
});

it('sums multiple lands per year without floating point noise and sorts years', () => {
  expect(
    annualCredits(
      [record(2025, 0.1), record(2024, 21.38), record(2025, 0.2)],
      null,
    ),
  ).toEqual([
    { year: 2024, credits: 21.38 },
    { year: 2025, credits: 0.3 },
  ]);
});
it('filters the chart and list to an inclusive range and shows missing years as zero', () => {
  const data = [record(2023, 99), record(2024, 4), record(2026, 6)];
  const range = { from: 2024, to: 2026 };
  expect(filterCreditHistory(data, range).map(item => item.audit_year)).toEqual(
    [2024, 2026],
  );
  expect(annualCredits(data, range)).toEqual([
    { year: 2024, credits: 4 },
    { year: 2025, credits: 0 },
    { year: 2026, credits: 6 },
  ]);
});
it('rejects inverted, future, and incomplete custom ranges', () => {
  expect(parseYearRange('2024', '2026', 2026)).toEqual({
    from: 2024,
    to: 2026,
  });
  for (const [from, to] of [
    ['2026', '2024'],
    ['2024', '2027'],
    ['20', '2026'],
    ['1800', '2026'],
  ])
    expect(parseYearRange(from, to, 2026)).toBeNull();
});
