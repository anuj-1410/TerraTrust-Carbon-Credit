import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import {BarChart} from 'react-native-chart-kit';
import LottieView from 'lottie-react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '../../../store/hooks';
import {fetchCreditsThunk} from '../store/creditsSlice';
import type {AuditRecord} from '../store/creditsSlice';
import {COLORS} from '../../../common/constants/colors';
import type {RootStackParamList} from '../../../types/navigation';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundColor: COLORS.CARD_WHITE,
  backgroundGradientFrom: COLORS.CARD_WHITE,
  backgroundGradientTo: COLORS.CARD_WHITE,
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(47, 133, 90, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(45, 55, 72, ${opacity})`,
  style: {borderRadius: 12},
  barPercentage: 0.6,
  propsForLabels: {fontFamily: 'RobotoMono-Regular'},
};

const truncateHash = (hash: string) =>
  `${hash.slice(0, 8)}…${hash.slice(-4)}`;

function isOfflineError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && !('response' in error));
}

const CreditHistoryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'CreditHistoryScreen'>>();
  const dispatch = useAppDispatch();
  const canGoBack =
    navigation.canGoBack() && (route.params?.source ?? 'history') !== 'history';

  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const {history, historyHasMore, historyPage, lastFetchedAt} = useAppSelector(
    s => s.credits,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      dispatch(fetchCreditsThunk({page: 1, limit: 20}))
        .unwrap()
        .then(() => setIsOffline(false))
        .catch(error => {
          if (isOfflineError(error) && history.length > 0) {
            setIsOffline(true);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [dispatch, history.length, isAuthenticated]);

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
        if (isOfflineError(error) && history.length > 0) {
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
      datasets: [{data: years.map(y => byYear[y])}],
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
      <View
        className="flex-1 items-center justify-center"
        style={{backgroundColor: COLORS.OFF_WHITE}}>
        <LottieView
          source={require('../../../assets/lottie/spinning_leaf.json')}
          autoPlay
          loop
          style={{width: 120, height: 120}}
        />
      </View>
    );
  }

  // Empty state
  if (!isLoading && history.length === 0) {
    return (
      <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
        <View className="flex-row items-center px-4 pt-12 pb-4">
          {canGoBack ? (
            <TouchableOpacity
              className="min-h-[48px] min-w-[48px] items-center justify-center"
              onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons
                color={COLORS.DARK_SLATE}
                name="arrow-left"
                size={24}
              />
            </TouchableOpacity>
          ) : null}
          <Text
            className={`${canGoBack ? 'ml-3 ' : ''}text-xl font-bold font-[Roboto]`}
            style={{color: COLORS.DARK_SLATE}}>
            Credit History
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text
            className="text-center text-base font-[Roboto]"
            style={{color: COLORS.DISABLED_GREY}}>
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
      className="mb-3 rounded-xl p-4 shadow-sm"
      style={{backgroundColor: COLORS.CARD_WHITE}}>
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className="text-base font-bold font-[Roboto]"
          style={{color: COLORS.DARK_SLATE}}>
          {item.land_name}
        </Text>
        <View
          className="rounded-full px-3 py-1"
          style={{backgroundColor: COLORS.OFF_WHITE}}>
          <Text
            className="text-xs font-[RobotoMono-Regular]"
            style={{color: COLORS.DISABLED_GREY}}>
            {item.audit_year}
          </Text>
        </View>
      </View>

      <Text
        className="mb-3 text-xl font-bold font-[RobotoMono-Bold]"
        style={{color: COLORS.FOREST_GREEN}}>
        +{item.credits_issued} CTT
      </Text>

      <View className="flex-row items-center">
        {item.ipfs_certificate_url ? (
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center mr-4"
            onPress={() => void Linking.openURL(item.ipfs_certificate_url)}>
            <Text
              className="text-sm font-[Roboto]"
              style={{color: COLORS.TEAL}}>
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
            }>
            <Text
              className="text-xs font-[RobotoMono-Regular]"
              style={{color: COLORS.DISABLED_GREY}}>
              {truncateHash(item.tx_hash)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderListHeader = () => (
    <View>
      <View className="flex-row items-center mb-2">
        {canGoBack ? (
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center"
            onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons
              color={COLORS.DARK_SLATE}
              name="arrow-left"
              size={24}
            />
          </TouchableOpacity>
        ) : null}
        <Text
          className={`${canGoBack ? 'ml-3 ' : ''}text-xl font-bold font-[Roboto]`}
          style={{color: COLORS.DARK_SLATE}}>
          Credit History
        </Text>
      </View>

      {isOffline && history.length > 0 ? (
        <View
          className="mb-4 rounded-xl px-4 py-3"
          style={{backgroundColor: 'rgba(221,107,32,0.12)'}}>
          <Text style={{color: COLORS.WARNING_ORANGE}}>
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
          style={{color: COLORS.DISABLED_GREY}}>
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
          className="mb-6 rounded-xl p-4 shadow-sm"
          style={{backgroundColor: COLORS.CARD_WHITE}}>
          <Text
            className="mb-3 text-sm font-[Roboto]"
            style={{color: COLORS.DISABLED_GREY}}>
            Year-over-Year Growth
          </Text>
          <BarChart
            data={chartData}
            width={screenWidth - 64}
            height={200}
            chartConfig={chartConfig}
            fromZero
            showBarTops
            yAxisLabel=""
            yAxisSuffix=""
            style={{borderRadius: 12}}
          />
        </View>
      )}

      <Text
        className="mb-3 text-lg font-bold font-[Roboto]"
        style={{color: COLORS.DARK_SLATE}}>
        Audit History
      </Text>
    </View>
  );

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
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
        contentContainerStyle={{paddingHorizontal: 16, paddingTop: 48, paddingBottom: 24}}
      />
    </View>
  );
};

export default CreditHistoryScreen;
