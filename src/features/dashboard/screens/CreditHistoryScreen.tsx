import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import {BarChart} from 'react-native-chart-kit';
import LottieView from 'lottie-react-native';
import {useNavigation} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '../../../store/hooks';
import {fetchCreditsThunk} from '../store/creditsSlice';
import type {AuditRecord} from '../store/creditsSlice';
import {COLORS} from '../../../common/constants/colors';

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

const CreditHistoryScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const canGoBack = navigation.canGoBack();

  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const {history, lastFetchedAt} = useAppSelector(s => s.credits);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      dispatch(fetchCreditsThunk()).finally(() => setIsLoading(false));
    }
  }, [dispatch, isAuthenticated]);

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
    () => [...history].sort((a, b) => b.audit_year - a.audit_year),
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
            No audits yet. Complete your first audit to see your history.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView className="flex-1 px-4 pt-12 pb-6">
        {/* Header */}
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

        {/* Last Updated Badge */}
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

        {/* Bar Chart */}
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

        {/* Audit History List */}
        <Text
          className="mb-3 text-lg font-bold font-[Roboto]"
          style={{color: COLORS.DARK_SLATE}}>
          Audit History
        </Text>
        {sortedHistory.map((record: AuditRecord, index: number) => (
          <View
            key={`${record.audit_year}-${record.minted_at ?? index}`}
            className="mb-3 rounded-xl p-4 shadow-sm"
            style={{backgroundColor: COLORS.CARD_WHITE}}>
            {/* Top row: land name + year */}
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className="text-base font-bold font-[Roboto]"
                style={{color: COLORS.DARK_SLATE}}>
                {record.land_name}
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{backgroundColor: COLORS.OFF_WHITE}}>
                <Text
                  className="text-xs font-[RobotoMono-Regular]"
                  style={{color: COLORS.DISABLED_GREY}}>
                  {record.audit_year}
                </Text>
              </View>
            </View>

            {/* Credits */}
            <Text
              className="mb-3 text-xl font-bold font-[RobotoMono-Bold]"
              style={{color: COLORS.FOREST_GREEN}}>
              +{record.credits_issued} CTT
            </Text>

            {/* Action links */}
            <View className="flex-row items-center">
              {record.ipfs_certificate_url ? (
                <TouchableOpacity
                  className="min-h-[48px] min-w-[48px] items-center justify-center mr-4"
                  onPress={() =>
                    void Linking.openURL(record.ipfs_certificate_url)
                  }>
                  <Text
                    className="text-sm font-[Roboto]"
                    style={{color: COLORS.TEAL}}>
                    View Certificate
                  </Text>
                </TouchableOpacity>
              ) : null}
              {record.tx_hash ? (
                <TouchableOpacity
                  className="min-h-[48px] min-w-[48px] items-center justify-center"
                  onPress={() =>
                    void Linking.openURL(
                      `https://amoy.polygonscan.com/tx/${record.tx_hash}`,
                    )
                  }>
                  <Text
                    className="text-xs font-[RobotoMono-Regular]"
                    style={{color: COLORS.DISABLED_GREY}}>
                    {truncateHash(record.tx_hash)}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default CreditHistoryScreen;
