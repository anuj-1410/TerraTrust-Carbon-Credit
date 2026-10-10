import OTPDrawer from '../components/OTPDrawer';
import { useTheme } from '../../../common/theme/theme';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Keyboard,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import type { RootStackParamList } from '../../../types/navigation';
import {
  cancelPendingPhoneOtp,
  type AuthBootstrapResponse,
  sendPhoneOtp,
} from '../../../services/firebase';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import { useAppDispatch } from '../../../store/hooks';
import { setAuthenticatedProfile } from '../store/authSlice';
import { setOnboardingComplete } from '../../profile/store/profileSlice';
import {
  getAuthenticatedEntryRoute,
  markOnboardingComplete,
} from '../../../common/utils/onboarding';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LoginScreen'>;

const PHONE_ERROR_MESSAGE =
  'Enter a valid 10-digit mobile number that does not start with 0 or 1';
const PHONE_REGEX = /^[2-9]\d{9}$/;

function getPhoneValidationError(phoneNumber: string): string | null {
  if (PHONE_REGEX.test(phoneNumber)) {
    return null;
  }

  return PHONE_ERROR_MESSAGE;
}

const LoginScreen = () => {
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const [otpSession, setOtpSession] = useState<{
    phone: string;
    verificationId: string | null;
  } | null>(null);
  const operationRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneError, setShowPhoneError] = useState(false);
  const { horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth } =
    useResponsiveScreen();

  const phoneError = useMemo(
    () => (showPhoneError ? getPhoneValidationError(phoneNumber) : null),
    [phoneNumber, showPhoneError],
  );
  const isPhoneValid = getPhoneValidationError(phoneNumber) === null;

  const onVerified = useCallback(
    (profile: AuthBootstrapResponse) => {
      setOtpSession(null);
      dispatch(setAuthenticatedProfile(profile));
      if (profile.kyc_completed) {
        markOnboardingComplete();
        dispatch(setOnboardingComplete(true));
      }
      navigation.reset({
        index: 0,
        routes: [{ name: getAuthenticatedEntryRoute(profile.kyc_completed) }],
      });
    },
    [dispatch, navigation],
  );

  const closeDrawer = () => {
    const phone = otpSession?.phone;
    setOtpSession(null);
    if (phone) {
      void cancelPendingPhoneOtp(phone).catch(() =>
        setApiError('Could not change the number. Please retry sign-in.'),
      );
    }
  };

  const onSubmit = async () => {
    if (!isPhoneValid || operationRef.current) {
      setShowPhoneError(true);
      return;
    }

    operationRef.current = true;
    Keyboard.dismiss();
    setIsLoading(true);
    setApiError(null);
    try {
      const phone = `+91${phoneNumber}`;
      // App verification can open a browser challenge; do not time out that user flow.
      const otpSession = await sendPhoneOtp(phone);
      if (!mountedRef.current) {
        return;
      }
      setOtpSession({ phone, verificationId: otpSession.verificationId });
    } catch (error) {
      const firebaseErr = error as { code?: string };
      if (firebaseErr.code === 'auth/too-many-requests') {
        setApiError(
          'Too many attempts. Please wait a few minutes and try again.',
        );
      } else if (firebaseErr.code === 'auth/quota-exceeded') {
        setApiError(
          'Firebase SMS quota is exhausted right now. Please wait a bit and try again.',
        );
      } else if (firebaseErr.code === 'auth/network-request-failed') {
        setApiError(
          'Network issue while sending OTP. Please check your connection.',
        );
      } else if (firebaseErr.code === 'auth/invalid-phone-number') {
        setApiError(
          'This phone number is invalid. Check the number and try again.',
        );
      } else if (firebaseErr.code === 'auth/operation-not-allowed') {
        setApiError(
          'Phone sign-in is currently unavailable. Please contact support.',
        );
      } else if (firebaseErr.code === 'auth/captcha-check-failed') {
        setApiError('App verification could not finish. Please try again.');
      } else if (
        firebaseErr.code === 'auth/invalid-app-credential' ||
        firebaseErr.code === 'auth/missing-client-identifier' ||
        firebaseErr.code === 'auth/app-not-authorized'
      ) {
        setApiError(
          'App verification failed. Please register the release SHA-1/SHA-256 in Firebase and try again.',
        );
      } else {
        setApiError(
          'SMS could not be sent. Please try again or contact support if this continues.',
        );
      }
    } finally {
      operationRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: COLORS.OFF_WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="flex-1 w-full self-center"
          style={{
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
            paddingTop: topSpacing,
            paddingBottom: bottomSpacing,
          }}
        >
          <View
            className="mb-6 h-[72px] w-[72px] items-center justify-center rounded-[28px]"
            style={{ backgroundColor: COLORS.SUCCESS_SURFACE }}
          >
            <MaterialCommunityIcons
              color={COLORS.FOREST_GREEN}
              name="sprout"
              size={34}
            />
          </View>

          <Text
            style={{
              color: COLORS.FOREST_GREEN,
              fontSize: 12,
              letterSpacing: 1.2,
              fontWeight: '600',
            }}
          >
            FARMER SIGN IN
          </Text>
          <Text
            style={{
              color: COLORS.DARK_SLATE,
              fontSize: 30,
              fontWeight: '700',
              marginTop: 10,
            }}
          >
            Welcome to TerraTrust
          </Text>
          <Text className="mt-3 text-base leading-6 text-muted">
            Enter your mobile number to receive a one-time password and
            continue.
          </Text>

          <Card className="mt-10 p-5">
            <Text className="mb-2 text-sm font-medium text-content">
              Mobile Number
            </Text>
            <View
              className="flex-row items-center overflow-hidden rounded-[20px] border"
              style={{
                borderColor:
                  phoneError || apiError ? COLORS.ERROR_RED : COLORS.BORDER,
              }}
            >
              <View
                className="items-center justify-center self-stretch px-4"
                style={{ backgroundColor: COLORS.SUCCESS_SURFACE }}
              >
                <Text className="text-base font-semibold text-accent">+91</Text>
              </View>
              <TextInput
                className="flex-1 bg-surface px-4 py-4 text-base text-content"
                placeholder="Enter 10-digit number"
                placeholderTextColor={COLORS.DISABLED_GREY}
                keyboardType="phone-pad"
                maxLength={10}
                onBlur={() => setShowPhoneError(true)}
                onChangeText={text => {
                  setPhoneNumber(text.replace(/\D/g, ''));
                }}
                value={phoneNumber}
                editable={!isLoading}
              />
            </View>
            {phoneError && (
              <Text className="mt-1 text-sm text-danger">{phoneError}</Text>
            )}
            {apiError && (
              <Text className="mt-1 text-sm text-danger">{apiError}</Text>
            )}
            <Text className="mt-4 text-sm leading-5 text-muted">
              Standard SMS rates may apply. Your phone number is processed by
              Google/Firebase for abuse prevention.
            </Text>
          </Card>

          <Button
            className="mt-8"
            label={isLoading ? 'Sending OTP...' : 'Send OTP'}
            onPress={onSubmit}
            disabled={isLoading || !isPhoneValid}
          />
        </View>
      </ScrollView>
      {otpSession ? (
        <OTPDrawer
          phone={otpSession.phone}
          verificationId={otpSession.verificationId}
          onClose={closeDrawer}
          onVerified={onVerified}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
