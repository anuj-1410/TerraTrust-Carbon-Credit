import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../types/navigation';
import { waitForFirebaseAuthState } from '../../../services/firebase';
import { bootstrapAuthenticatedProfile } from '../../../services/authBootstrap';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setAuthenticatedProfile, setSessionReady } from '../store/authSlice';
import {
  getAuthenticatedEntryRoute,
  markOnboardingComplete,
} from '../../../common/utils/onboarding';
import { setOnboardingComplete } from '../../profile/store/profileSlice';
import Button from '../../../common/components/Button';
import { resetAppState } from '../../../store';
import { useTheme } from '../../../common/theme/theme';
import { launchBrandRemaining } from '../../../common/utils/launchBrand';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const SplashScreen = () => {
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const cachedAuth = useAppSelector(state => state.auth);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let finishBrand!: () => void;
    const brandReady = new Promise<void>(resolve => {
      finishBrand = resolve;
    });
    const brandTimer = setTimeout(finishBrand, launchBrandRemaining());
    const enterApp = (kycCompleted: boolean) => {
      if (kycCompleted) {
        markOnboardingComplete();
        dispatch(setOnboardingComplete(true));
      }
      navigation.replace(getAuthenticatedEntryRoute(kycCompleted));
    };
    const restore = async () => {
      setError(null);
      try {
        const user = await waitForFirebaseAuthState();
        if (!active) {
          return;
        }
        if (!user) {
          await brandReady;
          if (!active) {
            return;
          }
          dispatch(resetAppState());
          navigation.replace('LoginScreen');
          return;
        }
        // The cache is usable only after native Firebase confirms its owner.
        if (
          cachedAuth.isAuthenticated &&
          cachedAuth.user?.firebaseUid === user.uid
        ) {
          await brandReady;
          if (!active) {
            return;
          }
          dispatch(setSessionReady(true));
          enterApp(cachedAuth.kycCompleted);
          return;
        }
        if (cachedAuth.user && cachedAuth.user.firebaseUid !== user.uid) {
          dispatch(resetAppState());
        }
        const { profile } = await bootstrapAuthenticatedProfile();
        await brandReady;
        if (!active) {
          return;
        }
        dispatch(setAuthenticatedProfile(profile));
        enterApp(profile.kyc_completed);
      } catch (caught) {
        if (!active) {
          return;
        }
        setError(
          (caught as Error)?.message === 'APP_CONFIG_MISSING_API_BASE_URL'
            ? 'Server configuration is missing. Please install the latest release.'
            : 'We could not load your account. Check your connection and retry. Your sign-in is saved.',
        );
      }
    };
    void restore();
    return () => {
      active = false;
      clearTimeout(brandTimer);
      finishBrand();
    };
    // Capture the persisted snapshot once per attempt. Committing auth must
    // not restart restoration before navigation finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, dispatch, navigation]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.OFF_WHITE,
        paddingHorizontal: 24,
      }}
    >
      <View className="mb-5 h-[120px] w-[120px] items-center justify-center rounded-[32px] bg-surface ">
        <MaterialCommunityIcons
          color={COLORS.FOREST_GREEN}
          name="sprout"
          size={52}
        />
      </View>
      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: COLORS.DARK_SLATE,
          marginBottom: 18,
        }}
      >
        TerraTrust
      </Text>
      {error ? (
        <>
          <Text
            accessibilityRole="alert"
            style={{
              textAlign: 'center',
              color: COLORS.DARK_SLATE,
              marginBottom: 20,
            }}
          >
            {error}
          </Text>
          <Button
            label="Retry"
            onPress={() => setAttempt(value => value + 1)}
          />
        </>
      ) : (
        <LottieView
          source={require('../../../assets/lottie/spinning_leaf.json')}
          autoPlay
          loop
          style={{ width: 96, height: 96 }}
        />
      )}
    </View>
  );
};

export default SplashScreen;
