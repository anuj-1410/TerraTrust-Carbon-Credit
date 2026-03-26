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
import {getLandStatus} from '../../../common/utils/getLandStatus';
import type {LandParcel} from '../../land/store/landSlice';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const statusConfig = {
  green: {bg: 'bg-[#255235]', text: 'text-[#93c4a0]', label: '✓ Verified'},
  orange: {bg: 'bg-[#5C4200]', text: 'text-[#eec060]', label: '⏳ Pending'},
  red: {bg: 'bg-[#93000a]', text: 'text-[#ffb4ab]', label: '⏳ Pending'},
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

  // History preview — last 2 entries desc
  const previewHistory = useMemo(
    () =>
      [...history]
        .sort((a, b) => b.audit_year - a.audit_year)
        .slice(0, 2),
    [history],
  );

  return (
    <View className="flex-1 bg-[#00180b]">
      <ScrollView className="flex-1 px-4 pt-12 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-[#cbead3] text-2xl font-bold font-[Manrope]">
            TerraTrust
          </Text>
        </View>

        {/* CTT Balance Card */}
        <View className="bg-[#1f3a2a] rounded-xl p-5 mb-2">
          <View className="flex-row items-baseline">
            <Text className="text-white text-4xl font-bold font-[RobotoMono-Bold]">
              {balance.toFixed(1)}
            </Text>
            <Text className="text-[#93c4a0] text-lg ml-2 font-[RobotoMono-Regular]">
              CTT
            </Text>
          </View>
          <Text className="text-[#c2c8c1] text-sm mt-1 font-[Inter]">
            Carbon Ton Tokens earned
          </Text>
          <Text className="text-[#93c4a0] text-xs mt-1 font-[Inter]">
            ≈ {balance.toFixed(1)} tonnes of CO2 stored on your land
          </Text>

          {/* Pending Mint Banner */}
          {pendingMint && (
            <View className="bg-[#322200] rounded-lg px-3 py-2 mt-3">
              <Text className="text-[#eec060] text-sm font-[Inter]">
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
            <Text className="text-[#eec060] text-sm font-[Inter]">
              View on PolygonScan ↗
            </Text>
          </TouchableOpacity>
        </View>

        {/* Last Updated Badge */}
        {lastFetchedAt && (
          <Text className="text-[#8c928c] text-xs mb-6 font-[Inter]">
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
          <Text className="text-[#cbead3] text-lg font-bold mb-3 font-[Manrope]">
            Your Land
          </Text>
          {parcels.map((parcel: LandParcel) => {
            const status = getLandStatus(parcel);
            const cfg = statusConfig[status];
            return (
              <View
                key={parcel.id}
                className="bg-[#092416] rounded-xl p-3 mb-3 flex-row items-center">
                {parcel.thumbnail_url ? (
                  <Image
                    source={{uri: parcel.thumbnail_url}}
                    className="w-16 h-16 rounded-lg"
                  />
                ) : (
                  <View className="w-16 h-16 rounded-lg bg-[#1f3a2a]" />
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-white text-base font-bold font-[Manrope]">
                    {parcel.farm_name}
                  </Text>
                  <Text className="text-[#c2c8c1] text-sm font-[Inter]">
                    {parcel.area_hectares} ha
                  </Text>
                </View>
                <View className="items-end">
                  <View className={`${cfg.bg} rounded-full px-3 py-1`}>
                    <Text className={`${cfg.text} text-xs font-[Inter]`}>
                      {cfg.label}
                    </Text>
                  </View>
                  {(status === 'orange' || status === 'red') && (
                    <TouchableOpacity
                      className="bg-[#eec060] rounded-full px-3 py-2 mt-2 min-h-[48px] min-w-[48px] items-center justify-center"
                      onPress={() =>
                        navigation.navigate('AuditStartScreen', {
                          landId: parcel.id,
                          landName: parcel.farm_name,
                        })
                      }>
                      <Text className="text-[#402d00] text-xs font-bold font-[Inter]">
                        Start Audit
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Recent Credits Preview */}
        <View className="mb-8">
          <Text className="text-[#cbead3] text-lg font-bold mb-3 font-[Manrope]">
            Recent Credits
          </Text>
          {previewHistory.map((record: AuditRecord) => (
            <View
              key={record.audit_id}
              className="bg-[#092416] rounded-xl p-4 mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-[#c2c8c1] text-xs font-[Inter]">
                  {record.audit_year}
                </Text>
                <Text className="text-[#eec060] text-base font-bold font-[RobotoMono-Bold] mt-1">
                  +{record.credits_issued} CTT
                </Text>
              </View>
              {record.ipfs_certificate_url ? (
                <TouchableOpacity
                  className="min-h-[48px] min-w-[48px] items-center justify-center"
                  onPress={() =>
                    Linking.openURL(record.ipfs_certificate_url)
                  }>
                  <Text className="text-[#eec060] text-sm font-[Inter]">
                    View Certificate
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {history.length > 0 && (
            <TouchableOpacity
              className="min-h-[48px] min-w-[48px] items-center justify-center mt-1"
              onPress={() => navigation.navigate('CreditHistoryScreen')}>
              <Text className="text-[#eec060] text-sm font-bold font-[Inter]">
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
