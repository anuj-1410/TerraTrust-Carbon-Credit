import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import api from '../../../services/api';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  setAuditResult,
  setLastPolledAt,
  setUploadStatus,
  type AuditResultResponse,
} from '../store/auditSlice';
import {fetchCreditsThunk} from '../../dashboard/store/creditsSlice';
import {addNotification} from '../../notifications/store/notificationsSlice';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AuditStatusScreen'>;
type RouteType = RouteProp<RootStackParamList, 'AuditStatusScreen'>;

const supportUrl = 'mailto:support@terratrust.app?subject=TerraTrust%20audit%20support';

const AuditStatusScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const dispatch = useAppDispatch();
  const auditResult = useAppSelector(state => state.audit.auditResult);
  const [currentResult, setCurrentResult] = useState<AuditResultResponse>(
    auditResult ?? {status: 'CALCULATING'},
  );
  const [statusHint, setStatusHint] = useState('');
  const hasAnnouncedTerminalStateRef = useRef(false);

  const goHome = useCallback(() => {
    navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]});
  }, [navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentResult.status === 'CALCULATING') {
        return true;
      }

      goHome();
      return true;
    });

    return () => subscription.remove();
  }, [currentResult.status, goHome]);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextPoll = (delayMs: number) => {
      timer = setTimeout(() => {
        void pollStatus();
      }, delayMs);
    };

    const announceTerminalState = (result: AuditResultResponse) => {
      if (hasAnnouncedTerminalStateRef.current) {
        return;
      }

      hasAnnouncedTerminalStateRef.current = true;

      if (result.status === 'MINTED') {
        dispatch(setUploadStatus('success'));
        dispatch(fetchCreditsThunk());
        dispatch(
          addNotification({
            id: `${route.params.auditId}-minted`,
            type: 'credits_ready',
            title: 'Credits ready',
            body: `Your audit issued ${result.credits_issued ?? 0} CTT.`,
            createdAt: new Date().toISOString(),
            read: false,
            auditId: route.params.auditId,
          }),
        );
        return;
      }

      if (result.status === 'COMPLETE_NO_CREDITS') {
        dispatch(setUploadStatus('success'));
        dispatch(
          addNotification({
            id: `${route.params.auditId}-complete`,
            type: 'audit_submitted',
            title: 'Audit complete',
            body: 'This audit cycle completed with 0 credits issued.',
            createdAt: new Date().toISOString(),
            read: false,
            auditId: route.params.auditId,
          }),
        );
        return;
      }

      dispatch(setUploadStatus('error'));
      dispatch(
        addNotification({
          id: `${route.params.auditId}-failed`,
          type: 'audit_failed',
          title: 'Audit failed',
          body: 'TerraTrust could not finish your audit processing.',
          createdAt: new Date().toISOString(),
          read: false,
          auditId: route.params.auditId,
        }),
      );
    };

    const pollStatus = async () => {
      try {
        const response = await api.get(`/api/v1/audit/result/${route.params.auditId}`);
        const nextResult = response.data as AuditResultResponse;

        if (!isMounted) {
          return;
        }

        setStatusHint('');
        setCurrentResult(nextResult);
        dispatch(setAuditResult(nextResult));
        dispatch(setLastPolledAt(new Date().toISOString()));

        if (nextResult.status === 'CALCULATING') {
          scheduleNextPoll(5000);
          return;
        }

        announceTerminalState(nextResult);
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

        const failedResult: AuditResultResponse = {
          status: 'FAILED',
          error: 'Unable to check audit status right now. Please try again later.',
        };
        setCurrentResult(failedResult);
        dispatch(setAuditResult(failedResult));
        dispatch(setUploadStatus('error'));
      }
    };

    void pollStatus();

    return () => {
      isMounted = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [dispatch, route.params.auditId]);

  const truncatedTxHash = useMemo(() => {
    if (!currentResult.tx_hash) {
      return null;
    }

    return `${currentResult.tx_hash.slice(0, 8)}...${currentResult.tx_hash.slice(-4)}`;
  }, [currentResult.tx_hash]);

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView contentContainerStyle={{padding: 24, paddingTop: 56, paddingBottom: 32}}>
        <Text className="text-center text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          Processing Your Credits
        </Text>

        {currentResult.status === 'CALCULATING' ? (
          <View className="items-center pt-10">
            <LottieView
              source={require('../../../assets/lottie/spinning_leaf.json')}
              autoPlay
              loop
              style={{width: 180, height: 180}}
            />
            <Text className="mt-2 text-center text-xl font-semibold" style={{color: COLORS.DARK_SLATE}}>
              Calculating your carbon credits...
            </Text>
            <View className="mt-8 w-full rounded-2xl bg-white px-5 py-5">
              <View className="flex-row items-center">
                <MaterialCommunityIcons color={COLORS.FOREST_GREEN} name="check-circle-outline" size={18} />
                <Text className="ml-2" style={{color: COLORS.FOREST_GREEN}}>
                  Scan data received
                </Text>
              </View>
              <View className="mt-3 flex-row items-center">
                <MaterialCommunityIcons color={COLORS.TEAL} name="satellite-variant" size={18} />
                <Text className="ml-2" style={{color: COLORS.TEAL}}>
                  Running satellite analysis
                </Text>
              </View>
              <View className="mt-3 flex-row items-center">
                <MaterialCommunityIcons color={COLORS.DISABLED_GREY} name="calculator" size={18} />
                <Text className="ml-2" style={{color: COLORS.DISABLED_GREY}}>
                  Calculating carbon credits
                </Text>
              </View>
              <View className="mt-3 flex-row items-center">
                <MaterialCommunityIcons color={COLORS.DISABLED_GREY} name="wallet-outline" size={18} />
                <Text className="ml-2" style={{color: COLORS.DISABLED_GREY}}>
                  Minting tokens to your wallet
                </Text>
              </View>
            </View>
            <Text className="mt-6 text-center leading-6" style={{color: COLORS.DISABLED_GREY}}>
              This takes about 30-60 seconds. You can leave this screen.
            </Text>
            {statusHint ? (
              <Text className="mt-3 text-center" style={{color: COLORS.WARNING_ORANGE}}>
                {statusHint}
              </Text>
            ) : null}
            <TouchableOpacity className="mt-8 min-h-[48px] items-center justify-center" onPress={goHome}>
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
              <Button label="Go to Home" onPress={goHome} />
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
              <Button label="Go to Home" onPress={goHome} />
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
              <Button label="Go to Home" onPress={goHome} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default AuditStatusScreen;