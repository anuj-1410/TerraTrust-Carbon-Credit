import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CreditYearChart from '../CreditYearChart';

it('keeps a single year legible with exact CTT values and honest incomplete totals', () => {
  const screen = render(
    <CreditYearChart
      data={[{ year: 2024, credits: 21.38 }]}
      auditCount={1}
      incomplete
    />,
  );
  expect(
    screen.getByLabelText('2024: 21.38 CTT issued, incomplete total'),
  ).toBeTruthy();
  expect(screen.getByText('Loaded so far · 1 audit')).toBeTruthy();
});
it('shows at most five years per page and offers older/newer pages for a long history', () => {
  const data = Array.from({ length: 12 }, (_, index) => ({
    year: 2015 + index,
    credits: index + 1,
  }));
  const screen = render(
    <CreditYearChart data={data} auditCount={12} incomplete={false} />,
  );
  expect(screen.getByLabelText('2026: 12.00 CTT issued')).toBeTruthy();
  expect(screen.queryByLabelText('2015: 1.00 CTT issued')).toBeNull();
  fireEvent.press(screen.getByText('Older years'));
  expect(screen.getAllByLabelText(/CTT issued$/)).toHaveLength(5);
  fireEvent.press(screen.getByText('Older years'));
  expect(screen.getByLabelText('2015: 1.00 CTT issued')).toBeTruthy();
  fireEvent.press(screen.getByText('Newer years'));
  expect(screen.getByLabelText('2020: 6.00 CTT issued')).toBeTruthy();
});
