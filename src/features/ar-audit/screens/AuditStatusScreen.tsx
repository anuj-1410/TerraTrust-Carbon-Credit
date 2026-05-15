import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  BackHandler,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Button from '../../../common/components/Button';
import {COLORS} from '../../../common/constants/colors';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  cleanupAuditSession,
  setLastPolledAt,
  setUploadStatus,
  type AuditResultResponse,
} from '../store/auditSlice';
import {setPendingMint} from '../../dashboard/store/creditsSlice';
import {store} from '../../../store';
import {
  isAuditResultProcessingStatus,
  syncAuditStatus,
} from '../utils/auditStatus';
import type {RootStackParamList} from '../../../types/navigation';
import {moveAppToBackground} from '../../../services/ar-bridge';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AuditStatusScreen'>;
type RouteType = RouteProp<RootStackParamList, 'AuditStatusScreen'>;

const supportUrl = 'mailto:support@terratrust.app?subject=TerraTrust%20audit%20support';

const AuditStatusScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const dispatch = useAppDispatch();
  const auditResult = useAppSelector(state => state.audit.auditResult);
  const activeLandId = useAppSelector(state => state.audit.activeLandId);
  const parcelName = useAppSelector(
    state =>
      state.land.parcels.find(parcel => parcel.id === activeLandId)?.farm_name ??
      null,
  );
  const [currentResult, setCurrentResult] = useState<AuditResultResponse>(
    auditResult ?? {status: 'PROCESSING'},
  );
  const [statusHint, setStatusHint] = useState('');
  const isInProgress = isAuditResultProcessingStatus(currentResult.status);
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();

  const goHome = useCallback(
    (options?: {cleanupAudit?: boolean}) => {
      const navigateHome = () => {
        navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]});
      };

      if (options?.cleanupAudit) {
        void dispatch(cleanupAuditSession())
          .unwrap()
          .finally(navigateHome);
        return;
      }

      navigateHome();
    },
    [dispatch, navigation],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isInProgress) {
        void moveAppToBackground();
        return true;
      }

      goHome();
      return true;
    });

    return () => subscription.remove();
  }, [goHome, isInProgress]);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextPoll = (delayMs: number) => {
      timer = setTimeout(() => {
        void pollStatus();
      }, delayMs);
    };

    const pollStatus = async () => {
      try {
        const nextResult = await syncAuditStatus({
          auditId: route.params.auditId,
          dispatch,
          getState: store.getState,
        });

        if (!isMounted) {
          return;
        }

        setStatusHint('');
        setCurrentResult(nextResult);

        if (isAuditResultProcessingStatus(nextResult.status)) {
          scheduleNextPoll(5000);
          return;
        }
      } catch (error: any) {
        if (!isMounted) {
          return;
        }

        if (error?.response?.status === 429) {
          const retryAfterHeader = error.response?.headers?.['retry-after'];
          const retryAfterSeconds = Number(retryAfterHeader ?? 5);
          setStatusHint('Server busy, retrying...');
          scheduleNextPoll(Math.max(retryAfterSeconds, 5) * 1000);
          return;
        }

        setStatusHint('Connection issue while checking status. Retrying...');
        dispatch(setLastPolledAt(new Date().toISOString()));

        if (isAuditResultProcessingStatus(currentResult.status)) {
          dispatch(setUploadStatus('processing'));
          dispatch(setPendingMint(true));
        }

        scheduleNextPoll(10000);
      }
    };

    void pollStatus();

    return () => {
      isMounted = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [currentResult.status, dispatch, route.params.auditId]);

  const truncatedTxHash = useMemo(() => {
    if (!currentResult.tx_hash) {
      return null;
    }

    return `${currentResult.tx_hash.slice(0, 8)}...${currentResult.tx_hash.slice(-4)}`;
  }, [currentResult.tx_hash]);
  const progressHeading = useMemo(() => {
    if (currentResult.status === 'PROCESSING') {
      return 'Preparing your audit for satellite verification...';
    }

    if (currentResult.status === 'READY_TO_MINT') {
      return 'Minting your tokens to the wallet...';
    }

    return 'Calculating your carbon credits...';
  }, [currentResult.status]);
  const progressSteps = useMemo(() => {
    const currentStepIndex =
      currentResult.status === 'PROCESSING'
        ? 0
        : currentResult.status === 'CALCULATING'
          ? 1
          : 3;

    const steps = [
      {
        key: 'scan',
        label: 'Scan data received',
        icon: 'check-circle-outline',
      },
      {
        key: 'satellite',
        label: 'Running satellite analysis',
        icon: 'satellite-variant',
      },
      {
        key: 'credits',
        label: 'Calculating carbon credits',
        icon: 'calculator',
      },
      {
        key: 'mint',
        label: 'Minting tokens to your wallet',
        icon: 'wallet-outline',
      },
    ];

    return steps.map((step, index) => {
      const state =
        index < currentStepIndex
          ? 'done'
          : index === currentStepIndex
            ? 'active'
            : 'pending';

      return {
        ...step,
        state,
        color:
          state === 'done'
            ? COLORS.FOREST_GREEN
            : state === 'active'
              ? COLORS.TEAL
              : COLORS.DISABLED_GREY,
      };
    });
  }, [currentResult.status]);

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
          paddingBottom: bottomSpacing,
        }}>
        <Text className="text-center text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          Processing Your Credits
        </Text>
        {parcelName || currentResult.audit_year ? (
          <Text className="mt-3 text-center leading-6" style={{color: COLORS.DISABLED_GREY}}>
            {parcelName ?? 'Your land parcel'}
            {currentResult.audit_year ? ` • Audit Year ${currentResult.audit_year}` : ''}
          </Text>
        ) : null}

        {isInProgress ? (
          <View className="items-center pt-10">
            <LottieView
              source={require('../../../assets/lottie/spinning_leaf.json')}
              autoPlay
              loop
              style={{width: 180, height: 180}}
            />
            <Text className="mt-2 text-center text-xl font-semibold" style={{color: COLORS.DARK_SLATE}}>
              {progressHeading}
            </Text>
            <View className="mt-8 w-full rounded-2xl bg-white px-5 py-5">
              {progressSteps.map(step => (
                <View key={step.key} className="mt-3 flex-row items-center first:mt-0">
                  <MaterialCommunityIcons color={step.color} name={step.icon} size={18} />
                  <Text className="ml-2" style={{color: step.color}}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text className="mt-6 text-center leading-6" style={{color: COLORS.DISABLED_GREY}}>
              This takes about 30-60 seconds. You can leave this screen.
            </Text>
            {statusHint ? (
              <Text className="mt-3 text-center" style={{color: COLORS.WARNING_ORANGE}}>
                {statusHint}
              </Text>
            ) : null}
            <TouchableOpacity
              className="mt-8 min-h-[48px] items-center justify-center"
              onPress={() => goHome()}>
              <Text style={{color: COLORS.DISABLED_GREY}}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {currentResult.status === 'MINTED' ? (
          <View className="items-center pt-10">
            <LottieView
              source={require('../../../assets/lottie/credit_earned.json')}
              autoPlay
              loop={false}
              style={{width: 220, height: 220}}
            />
            <Text className="text-center text-3xl font-bold" style={{color: COLORS.FOREST_GREEN}}>
              Carbon Credits Earned!
            </Text>
            <Text className="mt-2 text-[40px] font-bold" style={{color: COLORS.FOREST_GREEN}}>
              +{(currentResult.credits_issued ?? 0).toFixed(1)} CTT
            </Text>
            <Text className="mt-2" style={{color: COLORS.DISABLED_GREY}}>
              Added to your wallet
            </Text>

            {currentResult.tx_hash && truncatedTxHash ? (
              <TouchableOpacity
                className="mt-6"
                onPress={() => void Linking.openURL(`https://amoy.polygonscan.com/tx/${currentResult.tx_hash}`)}>
                <Text style={{color: COLORS.TEAL}}>Tx: {truncatedTxHash}</Text>
              </TouchableOpacity>
            ) : null}

            {currentResult.ipfs_certificate_url ? (
              <TouchableOpacity
                className="mt-4 min-h-[48px] items-center justify-center"
                onPress={() => void Linking.openURL(currentResult.ipfs_certificate_url as string)}>
                <Text style={{color: COLORS.TEAL}}>View Certificate</Text>
              </TouchableOpacity>
            ) : null}

            <View className="mt-8 w-full">
              <Button label="Go to Home" onPress={() => goHome({cleanupAudit: true})} />
            </View>
          </View>
        ) : null}

        {currentResult.status === 'COMPLETE_NO_CREDITS' ? (
          <View className="items-center pt-16">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-[#D1FAE5]">
              <MaterialCommunityIcons color={COLORS.FOREST_GREEN} name="check-circle-outline" size={34} />
            </View>
            <Text className="mt-5 text-3xl font-bold" style={{color: COLORS.DARK_SLATE}}>
              Audit Complete
            </Text>
            <Text className="mt-4 text-xl font-semibold" style={{color: COLORS.FOREST_GREEN}}>
              0 credits issued this audit cycle.
            </Text>
            <Text className="mt-4 text-center leading-7" style={{color: COLORS.DISABLED_GREY}}>
              {currentResult.reason ?? 'Baseline year established; future growth earns credits.'}
            </Text>
            <View className="mt-8 w-full">
              <Button label="Go to Home" onPress={() => goHome({cleanupAudit: true})} />
            </View>
          </View>
        ) : null}

        {currentResult.status === 'FAILED' ? (
          <View className="items-center pt-16">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-[#FEE2E2]">
              <MaterialCommunityIcons color={COLORS.ERROR_RED} name="alert-circle-outline" size={34} />
            </View>
            <Text className="mt-5 text-3xl font-bold" style={{color: COLORS.ERROR_RED}}>
              Something went wrong
            </Text>
            <Text className="mt-4 text-center leading-7" style={{color: COLORS.DISABLED_GREY}}>
              {currentResult.error ?? 'Our team has been notified. Please try again later or contact support.'}
            </Text>
            <TouchableOpacity
              className="mt-6 min-h-[48px] items-center justify-center"
              onPress={() => void Linking.openURL(supportUrl)}>
              <Text style={{color: COLORS.TEAL}}>Contact Support</Text>
            </TouchableOpacity>
            <View className="mt-4 w-full">
              <Button label="Go to Home" onPress={() => goHome()} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default AuditStatusScreen;
