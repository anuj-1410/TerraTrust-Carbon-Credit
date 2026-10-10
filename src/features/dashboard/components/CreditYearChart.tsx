import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../common/theme/theme';
import { CHART_YEARS_PER_PAGE, formatCTT } from '../utils/creditHistory';

interface Props {
  data: Array<{ year: number; credits: number }>;
  auditCount: number;
  incomplete: boolean;
}

export default function CreditYearChart({
  data,
  auditCount,
  incomplete,
}: Props) {
  const { colors } = useTheme();
  const lastPage = Math.max(
    0,
    Math.ceil(data.length / CHART_YEARS_PER_PAGE) - 1,
  );
  const [page, setPage] = useState(lastPage);
  const years = data.map(row => row.year).join(',');
  useEffect(() => {
    setPage(lastPage);
  }, [lastPage, years]);
  const currentPage = Math.min(page, lastPage);
  const rows = data.slice(
    currentPage * CHART_YEARS_PER_PAGE,
    (currentPage + 1) * CHART_YEARS_PER_PAGE,
  );
  const max = Math.max(1, ...data.map(row => row.credits));
  const total =
    data.reduce((sum, row) => sum + Math.round(row.credits * 100), 0) / 100;
  return (
    <View
      style={{
        backgroundColor: colors.CARD_WHITE,
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: colors.DARK_SLATE, fontSize: 18, fontWeight: '700' }}
      >
        Credits issued by year
      </Text>
      <Text
        style={{ color: colors.DISABLED_GREY, marginTop: 6, lineHeight: 20 }}
      >
        Annual totals across all your lands · CTT
      </Text>
      <Text
        style={{
          color: colors.FOREST_GREEN,
          fontSize: 28,
          fontWeight: '700',
          marginTop: 18,
        }}
      >
        {formatCTT(total)} CTT
      </Text>
      <Text
        style={{ color: colors.DISABLED_GREY, marginTop: 4, marginBottom: 20 }}
      >
        {incomplete ? 'Loaded so far' : 'Issued in selected years'} ·{' '}
        {auditCount} {auditCount === 1 ? 'audit' : 'audits'}
      </Text>
      {rows.map(row => (
        <View
          key={row.year}
          accessible
          accessibilityLabel={`${row.year}: ${formatCTT(
            row.credits,
          )} CTT issued${incomplete ? ', incomplete total' : ''}`}
          style={{ marginBottom: 18 }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: colors.DARK_SLATE, fontWeight: '600' }}>
              {row.year}
            </Text>
            <Text
              style={{
                color: colors.DARK_SLATE,
                fontWeight: '700',
                flexShrink: 1,
              }}
            >
              {formatCTT(row.credits)} CTT
            </Text>
          </View>
          <View
            style={{
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.INPUT_BACKGROUND,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${(row.credits / max) * 100}%`,
                backgroundColor: colors.FOREST_GREEN,
                borderRadius: 8,
              }}
            />
          </View>
        </View>
      ))}
      {!rows.length ? (
        <Text style={{ color: colors.DISABLED_GREY }}>
          No credits issued in these years.
        </Text>
      ) : null}
      {lastPage > 0 ? (
        <View>
          <Text
            style={{
              color: colors.DISABLED_GREY,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {rows[0]?.year}–{rows[rows.length - 1]?.year} · page{' '}
            {currentPage + 1} of {lastPage + 1}
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            {(['Older years', 'Newer years'] as const).map((label, index) => {
              const disabled =
                index === 0 ? currentPage === 0 : currentPage === lastPage;
              return (
                <TouchableOpacity
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => setPage(currentPage + (index === 0 ? -1 : 1))}
                  style={{
                    minHeight: 48,
                    justifyContent: 'center',
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      color: disabled
                        ? colors.DISABLED_GREY
                        : colors.FOREST_GREEN,
                      fontWeight: '600',
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      <Text
        style={{ color: colors.DISABLED_GREY, fontSize: 12, lineHeight: 18 }}
      >
        Up to 5 years per page. Bar lengths compare yearly credit totals.
      </Text>
    </View>
  );
}
