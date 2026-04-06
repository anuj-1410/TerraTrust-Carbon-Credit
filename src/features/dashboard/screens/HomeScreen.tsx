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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '../../../store/hooks';
import {fetchCreditsThunk} from '../store/creditsSlice';
import type {AuditRecord} from '../store/creditsSlice';
import {getLandStatusMeta} from '../../../common/utils/getLandStatus';
import {COLORS} from '../../../common/constants/colors';
import api from '../../../services/api';
import {
  mergeLandParcels,
  normalizeLandParcels,
  setLastSynced,
  setParcels,
  type LandListResponse,
  type LandParcel,
} from '../../land/store/landSlice';
import type {RootStackParamList} from '../../../types/navigation';
import Badge from '../../../common/components/Badge';
import {hectaresToAcres} from '../../../common/utils/units';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const walletAddress = useAppSelector(s => s.auth.walletAddress);
  const firstName = useAppSelector(
    s => s.auth.user?.name?.trim().split(/\s+/)[0] ?? 'Farmer',
  );
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const {balance, history, pendingMint, lastFetchedAt} = useAppSelector(
    s => s.credits,
  );
  const parcels = useAppSelector(s => s.land.parcels);
  const unreadNotifications = useAppSelector(
    s => s.notifications.items.filter(item => !item.read).length,
  );
  const parcelsRef = useRef(parcels);
  const [isLoadingParcels, setIsLoadingParcels] = useState(false);

  useEffect(() => {
    parcelsRef.current = parcels;
  }, [parcels]);

  // Fetch on mount
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCreditsThunk());
    }
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;

    const loadParcelPreview = async () => {
      if (parcelsRef.current.length === 0) {
        setIsLoadingParcels(true);
      }

      try {
        const {data} = await api.get<LandListResponse | Array<Record<string, unknown>>>(
          '/api/v1/land/list',
          {
            params: {page: 1, limit: 3},
          },
        );

        if (!isMounted) {
          return;
        }

        const currentParcels = parcelsRef.current;
        const items = Array.isArray(data) ? data : data.items ?? [];
        const previewParcels = normalizeLandParcels(items, currentParcels);

        dispatch(setParcels(mergeLandParcels(currentParcels, previewParcels)));
        dispatch(setLastSynced(new Date().toISOString()));
      } catch {
        // Leave cached parcels in place when preview refresh fails.
      } finally {
        if (isMounted) {
          setIsLoadingParcels(false);
        }
      }
    };

    void loadParcelPreview();

    return () => {
      isMounted = false;
    };
  }, [dispatch, isAuthenticated]);

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

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [],
  );

  // History preview — last 2 entries desc
  const previewHistory = useMemo(
    () =>
      [...history]
        .sort((a, b) => b.audit_year - a.audit_year)
        .slice(0, 2),
    [history],
  );

  const previewParcels = useMemo(() => parcels.slice(0, 3), [parcels]);

  const getBadgeVariant = (status: 'green' | 'orange' | 'red') => {
    if (status === 'green') {
      return 'verified' as const;
    }

    if (status === 'orange') {
      return 'pending' as const;
    }

    return 'rejected' as const;
  };

  const openLandDetail = (parcelId: string) => {
    navigation.navigate('LandDetailScreen', {
      landId: parcelId,
      originTab: 'HomeTab',
    });
  };

  const handleParcelAction = (parcel: LandParcel) => {
    const meta = getLandStatusMeta(parcel);

    if (meta.primaryAction === 'view_status' && parcel.current_audit_id) {
      navigation.navigate('AuditStatusScreen', {auditId: parcel.current_audit_id});
      return;
    }

    if (meta.primaryAction === 'start_audit') {
      navigation.navigate('AuditStartScreen', {
        landId: parcel.id,
        landName: parcel.farm_name,
        originTab: 'HomeTab',
      });
      return;
    }

    openLandDetail(parcel.id);
  };

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView className="flex-1 px-4 pt-12 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text
              className="text-2xl font-bold font-[Roboto]"
              style={{color: COLORS.DARK_SLATE}}>
              Hello, {firstName}
            </Text>
            <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
              {todayLabel}
            </Text>
          </View>
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full px-3"
            onPress={() => navigation.navigate('NotificationsScreen')}
            activeOpacity={0.7}>
            <View>
              <MaterialCommunityIcons
                color={COLORS.DARK_SLATE}
                name="bell-outline"
                size={22}
              />
              {unreadNotifications > 0 ? (
                <View
                  className="absolute -right-2 -top-1 min-h-[20px] min-w-[20px] items-center justify-center rounded-full px-1"
                  style={{backgroundColor: COLORS.ERROR_RED}}>
                  <Text className="text-xs font-bold text-white">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* CTT Balance Card */}
        <View
          className="mb-2 rounded-xl p-5 shadow-sm"
          style={{backgroundColor: COLORS.CARD_WHITE}}>
          <View className="flex-row items-baseline">
            <Text
              className="text-4xl font-bold font-[RobotoMono-Bold]"
              style={{color: COLORS.DARK_SLATE}}>
              {balance.toFixed(1)}
            </Text>
            <Text
              className="ml-2 text-lg font-[RobotoMono-Regular]"
              style={{color: COLORS.FOREST_GREEN}}>
              CTT
            </Text>
          </View>
          <Text
            className="mt-1 text-sm font-[Roboto]"
            style={{color: COLORS.DISABLED_GREY}}>
            Carbon Ton Tokens earned
          </Text>
          <Text
            className="mt-1 text-xs font-[Roboto]"
            style={{color: COLORS.FOREST_GREEN}}>
            = {balance.toFixed(1)} tonnes of CO₂ stored on your land
          </Text>

          {/* Pending Mint Banner */}
          {pendingMint && (
            <View
              className="mt-3 flex-row items-center rounded-lg px-3 py-2"
              style={{backgroundColor: 'rgba(221, 107, 32, 0.1)'}}>
              <MaterialCommunityIcons
                color={COLORS.WARNING_ORANGE}
                name="progress-clock"
                size={16}
              />
              <Text
                className="text-sm font-[Roboto]"
                style={{color: COLORS.WARNING_ORANGE}}>
                {' '}
                Minting in progress...
              </Text>
            </View>
          )}

          {/* View on PolygonScan */}
          <TouchableOpacity
            className="flex-row items-center mt-4 min-h-[48px] min-w-[48px]"
            onPress={() => {
              if (walletAddress) {
                void Linking.openURL(
                  `https://amoy.polygonscan.com/address/${walletAddress}`,
                );
              }
            }}>
            <Text className="text-sm font-[Roboto]" style={{color: COLORS.TEAL}}>
              View on PolygonScan
            </Text>
            <MaterialCommunityIcons
              color={COLORS.TEAL}
              name="open-in-new"
              size={16}
            />
          </TouchableOpacity>
        </View>

        {/* Last Updated Badge */}
        {lastFetchedAt && (
          <Text
            className="mb-6 text-xs font-[Roboto]"
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

        {/* Land Parcels Section */}
        <View className="mb-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className="text-lg font-bold font-[Roboto]"
              style={{color: COLORS.DARK_SLATE}}>
              My Lands
            </Text>
            <TouchableOpacity
              className="min-h-[48px] min-w-[48px] items-center justify-center"
              onPress={() =>
                navigation.navigate('HomeScreen', {
                  screen: 'LandTab',
                  params: {screen: 'LandListScreen'},
                })
              }>
              <Text className="font-[Roboto]" style={{color: COLORS.TEAL}}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          {isLoadingParcels && previewParcels.length === 0 ? (
            <View
              className="items-center rounded-xl px-5 py-6"
              style={{backgroundColor: COLORS.CARD_WHITE}}>
              <Text style={{color: COLORS.DISABLED_GREY}}>
                Loading your registered lands...
              </Text>
            </View>
          ) : null}
          {previewParcels.map((parcel: LandParcel) => {
            const meta = getLandStatusMeta(parcel);
            return (
              <TouchableOpacity
                key={parcel.id}
                className="mb-3 flex-row items-center rounded-xl p-3 shadow-sm"
                style={{backgroundColor: COLORS.CARD_WHITE}}
                activeOpacity={0.82}
                onPress={() => openLandDetail(parcel.id)}>
                {parcel.thumbnail_url ? (
                  <Image
                    source={{uri: parcel.thumbnail_url}}
                    className="w-16 h-16 rounded-lg"
                  />
                ) : (
                  <View
                    className="h-16 w-16 rounded-lg"
                    style={{backgroundColor: COLORS.OFF_WHITE}}
                  />
                )}
                <View className="flex-1 ml-3">
                  <Text
                    className="text-base font-bold font-[Roboto]"
                    style={{color: COLORS.DARK_SLATE}}>
                    {parcel.farm_name}
                  </Text>
                  <Text
                    className="text-sm font-[Roboto]"
                    style={{color: COLORS.DISABLED_GREY}}>
                    {hectaresToAcres(parcel.area_hectares).toFixed(2)} acres
                  </Text>
                  <Text
                    className="mt-1 text-xs font-[Roboto]"
                    style={{color: COLORS.DISABLED_GREY}}>
                    Survey No. {parcel.survey_number}
                  </Text>
                  {meta.secondaryLabel ? (
                    <Text
                      className="mt-1 text-xs font-[Roboto]"
                      style={{color: COLORS.DISABLED_GREY}}>
                      {meta.secondaryLabel}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end">
                  <Badge
                    label={meta.label}
                    variant={getBadgeVariant(meta.status)}
                  />
                  {meta.primaryActionLabel ? (
                    <TouchableOpacity
                      className="mt-2 min-h-[48px] min-w-[48px] items-center justify-center rounded-full px-3 py-2"
                      style={{backgroundColor: COLORS.FOREST_GREEN}}
                      onPress={() => handleParcelAction(parcel)}>
                      <Text className="text-white text-xs font-bold font-[Roboto]">
                        {meta.primaryActionLabel}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
          {!isLoadingParcels && previewParcels.length === 0 ? (
            <TouchableOpacity
              className="items-center rounded-xl px-5 py-6"
              style={{backgroundColor: COLORS.CARD_WHITE}}
              onPress={() => navigation.navigate('DocumentUploadScreen')}
              activeOpacity={0.82}>
              <Text className="text-lg font-semibold" style={{color: COLORS.DARK_SLATE}}>
                Add your first land parcel
              </Text>
              <Text className="mt-2 text-center" style={{color: COLORS.DISABLED_GREY}}>
                Upload your land document once to start audits and track credits.
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Credit History Preview */}
        <View className="mb-8">
          <Text
            className="mb-3 text-lg font-bold font-[Roboto]"
            style={{color: COLORS.DARK_SLATE}}>
            Credit History
          </Text>
          {previewHistory.length === 0 ? (
            <View
              className="rounded-xl p-4 shadow-sm"
              style={{backgroundColor: COLORS.CARD_WHITE}}>
              <Text style={{color: COLORS.DISABLED_GREY}}>
                No credit history yet. Complete your first audit to earn credits.
              </Text>
            </View>
          ) : null}
          {previewHistory.map((record: AuditRecord, index: number) => (
            <TouchableOpacity
              key={`${record.audit_year}-${record.minted_at ?? index}`}
              className="mb-3 rounded-xl p-4 shadow-sm"
              style={{backgroundColor: COLORS.CARD_WHITE}}
              onPress={() => {
                if (record.ipfs_certificate_url) {
                  Linking.openURL(record.ipfs_certificate_url);
                }
              }}>
              <Text
                className="text-sm font-[Roboto]"
                style={{color: COLORS.DARK_SLATE}}>
                {record.audit_year}: +{record.credits_issued} CTT{' '}
                <Text style={{color: COLORS.TEAL}}>| View Certificate</Text>
              </Text>
            </TouchableOpacity>
          ))}
          {history.length > 0 && (
            <TouchableOpacity
              className="mt-1 min-h-[48px] min-w-[48px] flex-row items-center justify-center"
              onPress={() =>
                navigation.navigate('HomeScreen', {
                  screen: 'HistoryTab',
                  params: {
                    screen: 'CreditHistoryScreen',
                    params: {source: 'history'},
                  },
                })
              }>
              <Text className="text-sm font-bold font-[Roboto]" style={{color: COLORS.TEAL}}>
                View All History
              </Text>
              <MaterialCommunityIcons
                color={COLORS.TEAL}
                name="arrow-right"
                size={18}
              />
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
