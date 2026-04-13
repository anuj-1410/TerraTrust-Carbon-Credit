import React, {useEffect, useRef} from 'react';
import {View} from 'react-native';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';
import api from '../../../services/api';
import {
  getCurrentFirebaseUser,
  getFreshFirebaseIdToken,
  signOutFirebase,
  type AuthBootstrapResponse,
} from '../../../services/firebase';
import {useAppDispatch} from '../../../store/hooks';
import {setUser, setWalletAddress, setKycCompleted} from '../store/authSlice';
import {getAuthenticatedEntryRoute} from '../../../common/utils/onboarding';
import {showBanner} from '../../../store/uiSlice';
import {setWalletRecoveryState} from '../../profile/store/profileSlice';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const SplashScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;
    let isMounted = true;
    let hasResolved = false;

    const resetSession = async () => {
      try {
        await signOutFirebase();
      } catch {
        // Ignore sign-out cleanup failures during bootstrap.
      }
    };

    const timeoutHandle = setTimeout(() => {
      if (!isMounted || hasResolved) {
        return;
      }

      hasResolved = true;
      void resetSession();
      dispatch(
        showBanner({
          message: 'Connection issue. Please log in again.',
          type: 'offline',
        }),
      );
      navigation.replace('LoginScreen');
    }, 10000);

    const redirectToLogin = (message?: string) => {
      if (!isMounted || hasResolved) {
        return;
      }

      hasResolved = true;
      clearTimeout(timeoutHandle);
      void resetSession();

      if (message) {
        dispatch(showBanner({message, type: 'offline'}));
      }

      navigation.replace('LoginScreen');
    };

    const checkSession = async () => {
      const currentUser = getCurrentFirebaseUser();
      if (!currentUser) {
        redirectToLogin();
        return;
      }

      try {
        await getFreshFirebaseIdToken(true);
        const {data: profile} = await api.get<AuthBootstrapResponse>(
          '/api/v1/auth/me',
        );

        if (!isMounted) {
          return;
        }

        if (hasResolved) {
          return;
        }

        hasResolved = true;
        clearTimeout(timeoutHandle);

        dispatch(
          setUser({
            id: profile.user_id,
            firebaseUid: profile.firebase_uid,
            name: profile.full_name ?? '',
            phone: profile.phone_number,
          }),
        );
        dispatch(setWalletAddress(profile.wallet_address));
        dispatch(setKycCompleted(profile.kyc_completed));
        dispatch(
          setWalletRecoveryState({
            status: profile.wallet_recovery_status,
            requestedAt: profile.wallet_recovery_requested_at,
          }),
        );
        navigation.replace(getAuthenticatedEntryRoute(profile.kyc_completed));
      } catch {
        redirectToLogin(
          'We could not verify your session right now. Please sign in again.',
        );
      }
    };

    void checkSession();

    return () => {
      isMounted = false;
      clearTimeout(timeoutHandle);
    };
  }, [dispatch, navigation]);

  return (
    <View className="flex-1 items-center justify-center bg-[#F8FAF8] px-6">
      <View className="mb-5 h-[120px] w-[120px] items-center justify-center rounded-[32px] bg-white shadow-sm">
        <MaterialCommunityIcons color="#1B4332" name="sprout" size={52} />
      </View>
      <LottieView
        source={require('../../../assets/lottie/spinning_leaf.json')}
        autoPlay
        loop
        style={{width: 96, height: 96}}
      />
    </View>
  );
};

export default SplashScreen;
