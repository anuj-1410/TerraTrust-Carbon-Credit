import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import LottieView from 'lottie-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useAppSelector, useAppDispatch} from '../../../store/hooks';
import {fetchCreditsThunk} from '../store/creditsSlice';
import type {AuditRecord} from '../store/creditsSlice';
import {getLandStatusMeta} from '../../../common/utils/getLandStatus';
import {COLORS} from '../../../common/constants/colors';
import type {LandParcel} from '../../land/store/landSlice';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const statusConfig = {
  green: {bg: `bg-[${COLORS.FOREST_GREEN}]`, text: 'text-white'},
  orange: {bg: `bg-[${COLORS.WARNING_ORANGE}]`, text: 'text-white'},
  red: {bg: `bg-[${COLORS.ERROR_RED}]`, text: 'text-white'},
};

const HomeScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const walletAddress = useAppSelector(s => s.auth.walletAddress);
  const {balance, history, pendingMint, lastFetchedAt} = useAppSelector(
    s => s.credits,
  );
  const parcels = useAppSelector(s => s.land.parcels);

  // Fetch on mount
  useEffect(() => {
    if (walletAddress) {
      dispatch(fetchCreditsThunk(walletAddress));
    }
  }, [walletAddress, dispatch]);

  // Credit earned celebration logic
  const prevPendingMint = useRef(pendingMint);
  const prevBalance = useRef(balance);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (
      prevPendingMint.current &&
      !pendingMint &&
      balance > prevBalance.current
    ) {
      setShowCelebration(true);
    }
    prevPendingMint.current = pendingMint;
    prevBalance.current = balance;
  }, [pendingMint, balance]);

  // History preview — last 3 entries desc
  const previewHistory = useMemo(
    () =>
      [...history]
        .sort((a, b) => b.audit_year - a.audit_year)
        .slice(0, 3),
    [history],
  );

  return (
    <View className={`flex-1 bg-[${COLORS.OFF_WHITE}]`}>
      <ScrollView className="flex-1 px-4 pt-12 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className={`text-[${COLORS.DARK_SLATE}] text-2xl font-bold font-[Roboto]`}>
            TerraTrust
          </Text>
        </View>

        {/* CTT Balance Card */}
        <View className={`bg-[${COLORS.CARD_WHITE}] rounded-xl p-5 mb-2 shadow-sm`}>
          <View className="flex-row items-baseline">
            <Text className={`text-[${COLORS.DARK_SLATE}] text-4xl font-bold font-[RobotoMono-Bold]`}>
              {balance.toFixed(1)}
            </Text>
            <Text className={`text-[${COLORS.FOREST_GREEN}] text-lg ml-2 font-[RobotoMono-Regular]`}>
              CTT
            </Text>
          </View>
          <Text className={`text-[${COLORS.DISABLED_GREY}] text-sm mt-1 font-[Roboto]`}>
            Carbon Ton Tokens earned
          </Text>
          <Text className={`text-[${COLORS.FOREST_GREEN}] text-xs mt-1 font-[Roboto]`}>
            = {balance.toFixed(1)} tonnes of CO₂ stored on your land
          </Text>

          {/* Pending Mint Banner */}
          {pendingMint && (
            <View className={`bg-[${COLORS.WARNING_ORANGE}]/10 rounded-lg px-3 py-2 mt-3`}>
              <Text className={`text-[${COLORS.WARNING_ORANGE}] text-sm font-[Roboto]`}>
                ⏳ Minting in progress…
              </Text>
            </View>
          )}

          {/* View on PolygonScan */}
          <TouchableOpacity
            className="flex-row items-center mt-4 min-h-[48px] min-w-[48px]"
            onPress={() => {
              if (walletAddress) {
                Linking.openURL(
                  `https://polygonscan.com/address/${walletAddress}`,
                );
              }
            }}>
            <Text className={`text-[${COLORS.TEAL}] text-sm font-[Roboto]`}>
              View on PolygonScan ↗
            </Text>
          </TouchableOpacity>
        </View>

        {/* Last Updated Badge */}
        {lastFetchedAt && (
          <Text className={`text-[${COLORS.DISABLED_GREY}] text-xs mb-6 font-[Roboto]`}>
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

        {/* Land Parcels Section */}
        <View className="mb-6">
          <Text className={`text-[${COLORS.DARK_SLATE}] text-lg font-bold mb-3 font-[Roboto]`}>
            My Lands
          </Text>
          {parcels.map((parcel: LandParcel) => {
            const meta = getLandStatusMeta(parcel);
            const cfg = statusConfig[meta.status];
            return (
              <View
                key={parcel.id}
                className={`bg-[${COLORS.CARD_WHITE}] rounded-xl p-3 mb-3 flex-row items-center shadow-sm`}>
                {parcel.thumbnail_url ? (
                  <Image
                    source={{uri: parcel.thumbnail_url}}
                    className="w-16 h-16 rounded-lg"
                  />
                ) : (
                  <View className={`w-16 h-16 rounded-lg bg-[${COLORS.OFF_WHITE}]`} />
                )}
                <View className="flex-1 ml-3">
                  <Text className={`text-[${COLORS.DARK_SLATE}] text-base font-bold font-[Roboto]`}>
                    {parcel.farm_name}
                  </Text>
                  <Text className={`text-[${COLORS.DISABLED_GREY}] text-sm font-[Roboto]`}>
                    {parcel.area_hectares} ha
                  </Text>
                </View>
                <View className="items-end">
                  <View className={`${cfg.bg} rounded-full px-3 py-1`}>
                    <Text className={`${cfg.text} text-xs font-[Roboto]`}>
                      {meta.label}
                    </Text>
                  </View>
                  {meta.showAudit && (
                    <TouchableOpacity
                      className={`bg-[${COLORS.FOREST_GREEN}] rounded-full px-3 py-2 mt-2 min-h-[48px] min-w-[48px] items-center justify-center`}
                      onPress={() =>
                        navigation.navigate('AuditStartScreen', {
                          landId: parcel.id,
                          landName: parcel.farm_name,
                        })
                      }>
                      <Text className="text-white text-xs font-bold font-[Roboto]">
                        Start Audit
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Credit History Preview */}
        <View className="mb-8">
          <Text className={`text-[${COLORS.DARK_SLATE}] text-lg font-bold mb-3 font-[Roboto]`}>
            Credit History
          </Text>
          {previewHistory.map((record: AuditRecord, index: number) => (
            <TouchableOpacity
              key={`${record.audit_year}-${record.minted_at ?? index}`}
              className={`bg-[${COLORS.CARD_WHITE}] rounded-xl p-4 mb-3 shadow-sm`}
              onPress={() => {
                if (record.ipfs_certificate_url) {
                  Linking.openURL(record.ipfs_certificate_url);
                }
              }}>
              <Text className={`text-[${COLORS.DARK_SLATE}] text-sm font-[Roboto]`}>
                {record.audit_year}: +{record.credits_issued} CTT{' '}
                <Text className={`text-[${COLORS.TEAL}]`}>| View Certificate</Text>
              </Text>
            </TouchableOpacity>
          ))}
          {history.length > 0 && (
            <TouchableOpacity
              className="min-h-[48px] min-w-[48px] items-center justify-center mt-1"
              onPress={() =>
                navigation.getParent()?.navigate('DashboardHistoryTab' as never)
              }>
              <Text className={`text-[${COLORS.TEAL}] text-sm font-bold font-[Roboto]`}>
                View All History →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Credit Earned Celebration Overlay */}
      {showCelebration && (
        <View className="absolute inset-0 items-center justify-center">
          <LottieView
            source={require('../../../assets/lottie/credit_earned.json')}
            autoPlay
            loop={false}
            onAnimationFinish={() => setShowCelebration(false)}
            style={{width: 300, height: 300}}
          />
        </View>
      )}
    </View>
  );
};

export default HomeScreen;
