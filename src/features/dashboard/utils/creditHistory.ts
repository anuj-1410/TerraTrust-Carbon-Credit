import type { AuditRecord } from '../store/creditsSlice';

export interface YearRange {
  from: number;
  to: number;
}
export const CHART_YEARS_PER_PAGE = 5;
export const formatCTT = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—';

export function filterCreditHistory(
  records: AuditRecord[],
  range: YearRange | null,
): AuditRecord[] {
  return records.filter(
    record =>
      !range ||
      (record.audit_year >= range.from && record.audit_year <= range.to),
  );
}

export function annualCredits(records: AuditRecord[], range: YearRange | null) {
  const totals = new Map<number, number>();
  filterCreditHistory(records, range).forEach(record => {
    const year = Number(record.audit_year);
    const amount = Number(record.credits_issued);
    if (
      Number.isInteger(year) &&
      year >= 1900 &&
      year <= 9999 &&
      Number.isFinite(amount) &&
      amount >= 0
    ) {
      totals.set(year, (totals.get(year) ?? 0) + Math.round(amount * 100));
    }
  });
  if (range) {
    for (let year = range.from; year <= range.to; year++) {
      if (!totals.has(year)) {
        totals.set(year, 0);
      }
    }
  }
  return [...totals.entries()]
    .sort(([first], [second]) => first - second)
    .map(([year, hundredths]) => ({ year, credits: hundredths / 100 }));
}

export function parseYearRange(
  from: string,
  to: string,
  currentYear: number,
): YearRange | null {
  if (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to)) {
    return null;
  }
  const first = Number(from);
  const last = Number(to);
  return first >= 1900 && last <= currentYear && first <= last
    ? { from: first, to: last }
    : null;
}
