import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import LottieView from 'lottie-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { fetchCreditsThunk } from '../store/creditsSlice';
import type { AuditRecord } from '../store/creditsSlice';
import type { RootStackParamList } from '../../../types/navigation';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';

const truncateHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-4)}`;

function isOfflineError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && !('response' in error));
}

const CreditHistoryScreen = () => {
  const { colors: COLORS } = useTheme();
  const chartConfig = {
    backgroundColor: COLORS.CARD_WHITE,
    backgroundGradientFrom: COLORS.CARD_WHITE,
    backgroundGradientTo: COLORS.CARD_WHITE,
    decimalPlaces: 1,
    color: () => COLORS.FOREST_GREEN,
    labelColor: () => COLORS.DARK_SLATE,
    style: { borderRadius: 12 },
    barPercentage: 0.6,
    propsForLabels: { fontFamily: 'RobotoMono-Regular' },
  };

  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<RootStackParamList, 'CreditHistoryScreen'>>();
  const dispatch = useAppDispatch();
  const { width, horizontalPadding, bottomSpacing, contentMaxWidth } =
    useResponsiveScreen();
  const canGoBack =
    navigation.canGoBack() && (route.params?.source ?? 'history') !== 'history';
  const chartWidth = Math.max(
    220,
    Math.min(width, contentMaxWidth) - horizontalPadding * 2 - 32,
  );

  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const { history, historyHasMore, historyPage, lastFetchedAt } =
    useAppSelector(s => s.credits);
  const historyLengthRef = useRef(history.length);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    historyLengthRef.current = history.length;
  }, [history.length]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      dispatch(fetchCreditsThunk({ page: 1, limit: 20 }))
        .unwrap()
        .then(() => setIsOffline(false))
        .catch(error => {
          if (isOfflineError(error) && historyLengthRef.current > 0) {
            setIsOffline(true);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [dispatch, isAuthenticated]);

  const loadMoreHistory = () => {
    if (!isAuthenticated || isLoading || isLoadingMore || !historyHasMore) {
      return;
    }

    setIsLoadingMore(true);
    dispatch(
      fetchCreditsThunk({
        page: historyPage + 1,
        limit: 20,
        append: true,
      }),
    )
      .unwrap()
      .then(() => setIsOffline(false))
      .catch(error => {
        if (isOfflineError(error) && historyLengthRef.current > 0) {
          setIsOffline(true);
        }
      })
      .finally(() => setIsLoadingMore(false));
  };

  // Bar chart data
  const chartData = useMemo(() => {
    const byYear = history.reduce<Record<number, number>>((acc, r) => {
      acc[r.audit_year] = (acc[r.audit_year] ?? 0) + r.credits_issued;
      return acc;
    }, {});
    const years = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => a - b);
    if (years.length === 0) {
      return null;
    }
    return {
      labels: years.map(String),
      datasets: [{ data: years.map(y => byYear[y]) }],
    };
  }, [history]);

  // Sorted history desc
  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(b.minted_at).getTime() - new Date(a.minted_at).getTime(),
      ),
    [history],
  );

  // Loading state
  if (isLoading && history.length === 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: COLORS.OFF_WHITE }}>
        <ScreenHeader
          title="Credit History"
          onBack={canGoBack ? () => navigation.goBack() : undefined}
        />
        <View className="flex-1 items-center justify-center">
          <LottieView
            source={require('../../../assets/lottie/spinning_leaf.json')}
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
          />
        </View>
      </View>
    );
  }

  // Empty state
  if (!isLoading && history.length === 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: COLORS.OFF_WHITE }}>
        <ScreenHeader
          title="Credit History"
          onBack={canGoBack ? () => navigation.goBack() : undefined}
        />
        <View className="flex-1 items-center justify-center px-8">
          <Text
            className="text-center text-base font-[Roboto]"
            style={{ color: COLORS.DISABLED_GREY }}
          >
            No credit history yet. Complete your first audit to earn credits.
          </Text>
        </View>
      </View>
    );
  }

  const renderHistoryItem = ({
    item,
    index,
  }: {
    item: AuditRecord;
    index: number;
  }) => (
    <View
      key={`${item.audit_year}-${item.minted_at ?? index}`}
      className="mb-3 rounded-xl p-4 "
      style={{ backgroundColor: COLORS.CARD_WHITE }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className="text-base font-bold font-[Roboto]"
          style={{ color: COLORS.DARK_SLATE }}
        >
          {item.land_name}
        </Text>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: COLORS.OFF_WHITE }}
        >
          <Text
            className="text-xs font-[RobotoMono-Regular]"
            style={{ color: COLORS.DISABLED_GREY }}
          >
            {item.audit_year}
          </Text>
        </View>
      </View>

      <Text
        className="mb-3 text-xl font-bold font-[RobotoMono-Bold]"
        style={{ color: COLORS.FOREST_GREEN }}
      >
        +{item.credits_issued} CTT
      </Text>

      <View className="flex-row items-center">
        {item.ipfs_certificate_url ? (
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center mr-4"
            onPress={() => void Linking.openURL(item.ipfs_certificate_url)}
          >
            <Text
              className="text-sm font-[Roboto]"
              style={{ color: COLORS.TEAL }}
            >
              View Certificate
            </Text>
          </TouchableOpacity>
        ) : null}
        {item.tx_hash ? (
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center"
            onPress={() =>
              void Linking.openURL(
                `https://amoy.polygonscan.com/tx/${item.tx_hash}`,
              )
            }
          >
            <Text
              className="text-xs font-[RobotoMono-Regular]"
              style={{ color: COLORS.DISABLED_GREY }}
            >
              {truncateHash(item.tx_hash)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderListHeader = () => (
    <View>
      {isOffline && history.length > 0 ? (
        <View
          className="mb-4 rounded-xl px-4 py-3"
          style={{ backgroundColor: COLORS.WARNING_SURFACE }}
        >
          <Text style={{ color: COLORS.WARNING_ORANGE }}>
            Offline mode. Showing cached history
            {lastFetchedAt
              ? ` from ${new Date(lastFetchedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })} ${new Date(lastFetchedAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : '.'}
          </Text>
        </View>
      ) : null}

      {lastFetchedAt && !isLoading && (
        <Text
          className="mb-4 text-xs font-[Roboto]"
          style={{ color: COLORS.DISABLED_GREY }}
        >
          Last updated{' '}
          {new Date(lastFetchedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
          {new Date(lastFetchedAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      )}

      {chartData && (
        <View
          className="mb-6 rounded-xl p-4 "
          style={{ backgroundColor: COLORS.CARD_WHITE }}
        >
          <Text
            className="mb-3 text-sm font-[Roboto]"
            style={{ color: COLORS.DISABLED_GREY }}
          >
            Year-over-Year Growth
          </Text>
          <BarChart
            data={chartData}
            width={chartWidth}
            height={200}
            chartConfig={chartConfig}
            fromZero
            showBarTops
            yAxisLabel=""
            yAxisSuffix=""
            style={{ borderRadius: 12 }}
          />
        </View>
      )}

      <Text
        className="mb-3 text-lg font-bold font-[Roboto]"
        style={{ color: COLORS.DARK_SLATE }}
      >
        Audit History
      </Text>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <ScreenHeader
        title="Credit History"
        onBack={canGoBack ? () => navigation.goBack() : undefined}
      />
      <FlatList
        data={sortedHistory}
        keyExtractor={(item, index) =>
          `${item.audit_year}-${item.minted_at ?? index}`
        }
        renderItem={renderHistoryItem}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={
          isLoadingMore ? (
            <View className="pb-8 pt-2">
              <ActivityIndicator color={COLORS.FOREST_GREEN} />
            </View>
          ) : null
        }
        onEndReached={loadMoreHistory}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          alignSelf: 'center',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: bottomSpacing,
        }}
      />
    </View>
  );
};

export default CreditHistoryScreen;
