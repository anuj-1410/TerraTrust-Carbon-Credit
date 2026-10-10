import { openExternalLink } from '../../../common/utils/openExternalLink';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import ScreenHeader from '../../../common/components/ScreenHeader';
import BottomSheet from '../../../common/components/BottomSheet';
import Button from '../../../common/components/Button';
import { useTheme } from '../../../common/theme/theme';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  fetchCreditsThunk,
  getAuditRecordKey,
  type AuditRecord,
} from '../store/creditsSlice';
import CreditYearChart from '../components/CreditYearChart';
import {
  annualCredits,
  filterCreditHistory,
  formatCTT,
  parseYearRange,
  type YearRange,
} from '../utils/creditHistory';
import type { RootStackParamList } from '../../../types/navigation';

const PRESETS = [
  { label: 'All years', years: 0 },
  { label: '1 year', years: 1 },
  { label: '3 years', years: 3 },
  { label: '5 years', years: 5 },
  { label: '10 years', years: 10 },
];
export default function CreditHistoryScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<RootStackParamList, 'CreditHistoryScreen'>>();
  const dispatch = useAppDispatch();
  const { horizontalPadding, bottomSpacing, contentMaxWidth } =
    useResponsiveScreen();
  const owner = useAppSelector(state => state.auth.user?.firebaseUid);
  const { history, historyHasMore, historyPage, lastFetchedAt } =
    useAppSelector(state => state.credits);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [range, setRange] = useState<YearRange | null>(null);
  const [preset, setPreset] = useState(0);
  const [showYears, setShowYears] = useState(false);
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [yearError, setYearError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const mounted = useRef(true);
  const pending = useRef<{ abort: () => void } | null>(null);
  const canGoBack =
    navigation.canGoBack() && (route.params?.source ?? 'history') !== 'history';

  const load = useCallback(
    async (resumePage = 1) => {
      pending.current?.abort?.();
      setLoading(true);
      setFailure(null);
      const request = dispatch(
        fetchCreditsThunk({
          allHistory: true,
          page: resumePage,
          append: resumePage > 1,
        }),
      );
      pending.current = request;
      try {
        await request.unwrap();
      } catch (error) {
        if (
          mounted.current &&
          pending.current === request &&
          (error as { name?: string }).name !== 'AbortError' &&
          (error as { message?: string }).message !==
            'CREDITS_REQUEST_SUPERSEDED'
        ) {
          setFailure(
            'Could not load all credit history. Check your connection and retry. Displayed totals may be incomplete.',
          );
        }
      } finally {
        if (mounted.current && pending.current === request) {
          setLoading(false);
          pending.current = null;
        }
      }
    },
    [dispatch],
  );

  useEffect(() => {
    mounted.current = true;
    if (owner) {
      void load();
    }
    return () => {
      mounted.current = false;
      pending.current?.abort?.();
    };
  }, [load, owner]);
  const filtered = useMemo(
    () => filterCreditHistory(history, range),
    [history, range],
  );
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => Date.parse(b.minted_at) - Date.parse(a.minted_at),
      ),
    [filtered],
  );
  const years = useMemo(() => annualCredits(history, range), [history, range]);
  const incomplete = loading || historyHasMore || Boolean(failure);
  const openYears = () => {
    const oldest = history.length
      ? Math.min(...history.map(record => record.audit_year))
      : currentYear;
    setFromYear(String(range?.from ?? oldest));
    setToYear(String(range?.to ?? currentYear));
    setYearError(null);
    setShowYears(true);
  };
  const applyYears = () => {
    const selected = parseYearRange(fromYear, toYear, currentYear);
    if (!selected) {
      setYearError(
        `Enter a valid year range between 1900 and ${currentYear}. The start must not follow the end.`,
      );
      return;
    }
    setRange(selected);
    setPreset(-1);
    setShowYears(false);
  };
  const renderItem = ({ item }: { item: AuditRecord }) => (
    <View
      style={{
        backgroundColor: colors.CARD_WHITE,
        borderRadius: 20,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Text
          style={{
            color: colors.DARK_SLATE,
            fontWeight: '700',
            fontSize: 17,
            flex: 1,
          }}
        >
          {item.land_name}
        </Text>
        <Text style={{ color: colors.DISABLED_GREY }}>{item.audit_year}</Text>
      </View>
      <Text
        style={{
          color: colors.FOREST_GREEN,
          fontWeight: '700',
          fontSize: 22,
          marginTop: 10,
        }}
      >
        +{formatCTT(Number(item.credits_issued))} CTT
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 12,
          gap: 16,
        }}
      >
        {item.ipfs_certificate_url ? (
          <TouchableOpacity
            accessibilityRole="link"
            style={{ minHeight: 48, justifyContent: 'center' }}
            onPress={() => void openExternalLink(item.ipfs_certificate_url)}
          >
            <Text style={{ color: colors.TEAL }}>View Certificate</Text>
          </TouchableOpacity>
        ) : null}
        {item.tx_hash ? (
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel="View blockchain transaction"
            style={{ minHeight: 48, justifyContent: 'center' }}
            onPress={() =>
              void openExternalLink(
                `https://amoy.polygonscan.com/tx/${item.tx_hash}`,
              )
            }
          >
            <Text style={{ color: colors.DISABLED_GREY }}>
              {item.tx_hash.slice(0, 8)}…{item.tx_hash.slice(-4)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.OFF_WHITE }}>
      <ScreenHeader
        title="Credit History"
        onBack={canGoBack ? () => navigation.goBack() : undefined}
      />
      <FlatList
        data={sorted}
        keyExtractor={getAuditRecordKey}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.FOREST_GREEN}
            colors={[colors.FOREST_GREEN]}
          />
        }
        contentContainerStyle={{
          width: '100%',
          alignSelf: 'center',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: bottomSpacing,
        }}
        ListHeaderComponent={
          <View>
            {lastFetchedAt ? (
              <Text
                style={{
                  color: colors.DISABLED_GREY,
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                Last updated{' '}
                {new Date(lastFetchedAt).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {PRESETS.map(option => (
                <TouchableOpacity
                  key={option.years}
                  accessibilityRole="button"
                  accessibilityState={{ selected: preset === option.years }}
                  onPress={() => {
                    setPreset(option.years);
                    setRange(
                      option.years
                        ? {
                            from: currentYear - option.years + 1,
                            to: currentYear,
                          }
                        : null,
                    );
                  }}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor:
                      preset === option.years
                        ? colors.FOREST_GREEN
                        : colors.BORDER,
                    backgroundColor:
                      preset === option.years
                        ? colors.SUCCESS_SURFACE
                        : colors.CARD_WHITE,
                  }}
                >
                  <Text
                    style={{
                      color:
                        preset === option.years
                          ? colors.FOREST_GREEN
                          : colors.DISABLED_GREY,
                      fontWeight: '600',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                accessibilityRole="button"
                onPress={openYears}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  justifyContent: 'center',
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: colors.BORDER,
                }}
              >
                <Text style={{ color: colors.FOREST_GREEN }}>Choose years</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: colors.DISABLED_GREY, marginBottom: 18 }}>
              {' '}
              {range
                ? `${range.from}–${range.to} · calendar years`
                : 'All recorded audit years'}
            </Text>
            {loading ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <ActivityIndicator color={colors.FOREST_GREEN} />
                <Text style={{ color: colors.DISABLED_GREY }}>
                  Loading complete history…
                </Text>
              </View>
            ) : null}
            {failure ? (
              <View style={{ marginBottom: 16 }}>
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.WARNING_ORANGE, lineHeight: 22 }}
                >
                  {failure}
                </Text>
                <Button
                  label="Retry history"
                  variant="secondary"
                  style={{ marginTop: 12 }}
                  onPress={() =>
                    void load(historyHasMore ? historyPage + 1 : 1)
                  }
                />
              </View>
            ) : null}
            <CreditYearChart
              data={years}
              auditCount={filtered.length}
              incomplete={incomplete}
            />
            <Text
              accessibilityRole="header"
              style={{
                color: colors.DARK_SLATE,
                fontSize: 20,
                fontWeight: '700',
                marginBottom: 14,
              }}
            >
              Audit History
            </Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: colors.DISABLED_GREY, lineHeight: 24 }}>
              {history.length
                ? 'No audits in the selected years. Choose a wider range.'
                : failure
                ? 'Your history is unavailable. Use Retry history above.'
                : 'No credit history yet. Complete your first audit to earn credits.'}
            </Text>
          ) : null
        }
      />
      <BottomSheet visible={showYears} onClose={() => setShowYears(false)}>
        <Text
          style={{ color: colors.DARK_SLATE, fontSize: 22, fontWeight: '700' }}
        >
          Choose audit years
        </Text>
        <Text
          style={{ color: colors.DISABLED_GREY, marginTop: 8, lineHeight: 22 }}
        >
          The chart and audit list use the same inclusive year range.
        </Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 20 }}>
          {[
            { label: 'From year', value: fromYear, set: setFromYear },
            { label: 'To year', value: toYear, set: setToYear },
          ].map(field => (
            <View key={field.label} style={{ flex: 1 }}>
              <Text style={{ color: colors.DARK_SLATE, marginBottom: 8 }}>
                {field.label}
              </Text>
              <TextInput
                accessibilityLabel={field.label}
                value={field.value}
                onChangeText={value => {
                  field.set(value.replace(/\D/g, ''));
                  setYearError(null);
                }}
                keyboardType="number-pad"
                keyboardAppearance={isDark ? 'dark' : 'light'}
                maxLength={4}
                style={{
                  backgroundColor: colors.INPUT_BACKGROUND,
                  color: colors.DARK_SLATE,
                  borderRadius: 14,
                  padding: 16,
                }}
              />
            </View>
          ))}
        </View>
        {yearError ? (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.ERROR_RED, marginTop: 12 }}
          >
            {yearError}
          </Text>
        ) : null}
        <Button
          label="Apply years"
          style={{ marginTop: 24 }}
          onPress={applyYears}
        />
      </BottomSheet>
    </View>
  );
}
