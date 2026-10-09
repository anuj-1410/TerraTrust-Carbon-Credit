import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Keyboard,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../types/navigation';
import {
  confirmPhoneOtp,
  getCurrentFirebaseUser,
  sendPhoneOtp,
  type AuthBootstrapResponse,
} from '../../../services/firebase';
import { bootstrapAuthenticatedProfile } from '../../../services/authBootstrap';

import { useAppDispatch } from '../../../store/hooks';
import { setAuthenticatedProfile } from '../store/authSlice';
import {
  getAuthenticatedEntryRoute,
  markOnboardingComplete,
} from '../../../common/utils/onboarding';
import { setOnboardingComplete } from '../../profile/store/profileSlice';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import { showBanner } from '../../../store/uiSlice';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPScreen'>;

const OTP_LENGTH = 6;
const COUNTDOWN_SECONDS = 28;
const OTP_BOOTSTRAP_ERROR_MESSAGE =
  'OTP verified, but we could not finish sign-in. Please check your connection and try again.';

const OTPScreen = ({ route, navigation }: Props) => {
  const { colors: COLORS } = useTheme();
  const { phone, verificationId } = route.params;
  const dispatch = useAppDispatch();
  const { width } = useWindowDimensions();
  const { horizontalPadding, bottomSpacing, contentMaxWidth } =
    useResponsiveScreen();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeVerificationId, setActiveVerificationId] = useState<
    string | null
  >(verificationId ?? null);
  const [hasVerifiedOtp, setHasVerifiedOtp] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const operationRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCountdown(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startTimer();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTimer]);

  // Mask phone: show last 4 digits
  const maskedPhone = phone.replace(/(\+91)(\d{6})(\d{4})/, '$1 XXXXXX$3');
  const otpGap = width < 360 ? 6 : 8;
  const otpAvailableWidth = Math.min(
    width - horizontalPadding * 2 - 24,
    contentMaxWidth - 48,
  );
  const otpCellSize = Math.max(
    42,
    Math.min(
      50,
      Math.floor((otpAvailableWidth - otpGap * (OTP_LENGTH - 1)) / OTP_LENGTH),
    ),
  );
  const otpRowWidth = otpCellSize * OTP_LENGTH + otpGap * (OTP_LENGTH - 1);
  const otpValue = digits.join('');
  const isOtpComplete = otpValue.length === OTP_LENGTH;

  const resetOtpInputs = useCallback(() => {
    setDigits(Array(OTP_LENGTH).fill(''));
    setFocusedIndex(0);
    inputRefs.current[0]?.focus();
  }, []);

  const applyProfile = useCallback(
    (profile: AuthBootstrapResponse) => {
      dispatch(setAuthenticatedProfile(profile));
    },
    [dispatch],
  );

  const bootstrapProfile = useCallback(async () => {
    const { profile, warning } = await bootstrapAuthenticatedProfile();

    if (!mountedRef.current) {
      return;
    }
    if (warning) {
      dispatch(
        showBanner({
          message: warning.message,
          type: 'info',
        }),
      );
    }

    applyProfile(profile);
    if (profile.kyc_completed) {
      markOnboardingComplete();
      dispatch(setOnboardingComplete(true));
    }

    Keyboard.dismiss();
    const nextRoute = getAuthenticatedEntryRoute(profile.kyc_completed);

    if (nextRoute !== 'KYCScreen') {
      navigation.reset({ index: 0, routes: [{ name: nextRoute }] });
      return;
    }

    navigation.replace(nextRoute);
  }, [applyProfile, dispatch, navigation]);

  const handleVerifyOtp = useCallback(async () => {
    if (operationRef.current) {
      return;
    }

    if (!isOtpComplete) {
      setError('Enter the full 6-digit OTP to continue.');
      return;
    }

    operationRef.current = true;
    setIsLoading(true);
    setError(null);

    const currentUser = getCurrentFirebaseUser();
    if (
      (!hasVerifiedOtp && currentUser?.phoneNumber !== phone) ||
      !currentUser
    ) {
      try {
        await confirmPhoneOtp(otpValue, activeVerificationId);
        if (!mountedRef.current) {
          operationRef.current = false;
          return;
        }
        setHasVerifiedOtp(true);
      } catch (caughtError) {
        const firebaseErr = caughtError as { code?: string; message?: string };
        if (
          firebaseErr.message === 'OTP_SESSION_MISSING' ||
          firebaseErr.code === 'auth/session-expired' ||
          firebaseErr.code === 'auth/invalid-verification-id'
        ) {
          setError('OTP session expired. Please resend the code.');
        } else if (firebaseErr.code === 'auth/invalid-verification-code') {
          setError('Incorrect code. Please try again.');
        } else if (firebaseErr.code === 'auth/network-request-failed') {
          setError('Network issue while verifying OTP. Please try again.');
        } else {
          setError('Something went wrong. Please try again.');
        }
        resetOtpInputs();
        operationRef.current = false;
        setIsLoading(false);
        return;
      }
    }

    try {
      await bootstrapProfile();
    } catch (caughtError) {
      const axiosErr = caughtError as {
        response?: { status?: number };
        message?: string;
        code?: string;
      };
      if (axiosErr.message === 'APP_CONFIG_MISSING_API_BASE_URL') {
        setError(
          'This release build is missing server configuration. Please reinstall the latest release APK.',
        );
      } else if (
        axiosErr.code === 'ECONNABORTED' ||
        axiosErr.code === 'ETIMEDOUT'
      ) {
        setError(
          'OTP verified. The server is taking longer than expected; tap Continue to retry.',
        );
      } else if (axiosErr.response?.status === 401) {
        setError(
          'Your session expired while loading your account. Please try again.',
        );
      } else if (axiosErr.response?.status && axiosErr.response.status >= 500) {
        setError(
          'Server issue while finishing sign-in. Please try again in a moment.',
        );
      } else if (axiosErr.message === 'Network Error') {
        setError(OTP_BOOTSTRAP_ERROR_MESSAGE);
      } else {
        setError(OTP_BOOTSTRAP_ERROR_MESSAGE);
      }
    } finally {
      operationRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    activeVerificationId,
    bootstrapProfile,
    hasVerifiedOtp,
    isOtpComplete,
    otpValue,
    phone,
    resetOtpInputs,
  ]);

  const handleDigitChange = (text: string, index: number) => {
    const sanitized = text.replace(/[^0-9]/g, '');
    const newDigits = [...digits];

    if (sanitized.length > 1) {
      sanitized
        .slice(0, OTP_LENGTH - index)
        .split('')
        .forEach((digit, offset) => {
          newDigits[index + offset] = digit;
        });
      setDigits(newDigits);
      const nextIndex = Math.min(index + sanitized.length, OTP_LENGTH - 1);
      setFocusedIndex(nextIndex);
      inputRefs.current[nextIndex]?.focus();
      setError(null);
      return;
    }

    const digit = sanitized.slice(-1);
    newDigits[index] = digit;
    setDigits(newDigits);
    setError(null);

    // Auto-focus next box
    if (digit && index < OTP_LENGTH - 1) {
      setFocusedIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: { nativeEvent: { key: string } },
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      setFocusedIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (operationRef.current || countdown > 0) {
      return;
    }
    operationRef.current = true;
    setIsLoading(true);
    try {
      const otpSession = await sendPhoneOtp(phone);
      setActiveVerificationId(otpSession.verificationId);
      setHasVerifiedOtp(false);
      resetOtpInputs();
      setError(null);
      startTimer();
    } catch (caughtError) {
      const firebaseErr = caughtError as { code?: string };
      if (firebaseErr.code === 'auth/network-request-failed') {
        setError('Network issue while resending OTP. Please try again.');
      } else {
        setError('Failed to resend OTP. Try again.');
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
      <ScreenHeader
        title="Confirm your OTP"
        eyebrow="Secure Verification"
        onBack={() => navigation.replace('LoginScreen')}
        backDisabled={isLoading}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="flex-1 w-full self-center"
          style={{
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
            paddingTop: 16,
            paddingBottom: bottomSpacing,
          }}
        >
          <Text className="mt-3 text-base leading-6 text-muted">
            Enter the 6-digit code sent to the mobile number below.
          </Text>
          <Text className="mt-4 text-base font-bold text-accent">
            {maskedPhone}
          </Text>

          <Card className="mt-8 p-5">
            <Text className="text-sm leading-5 text-muted">
              Enter the verification code below to continue securely.
            </Text>
            <View
              className="mt-6 flex-row self-center"
              style={{
                width: otpRowWidth,
                justifyContent: 'center',
              }}
            >
              {digits.map((digit, index) => (
                <View
                  key={index}
                  className="items-center justify-center rounded-[18px] border-2 bg-surface"
                  style={{
                    width: otpCellSize,
                    height: otpCellSize,
                    marginRight: index === OTP_LENGTH - 1 ? 0 : otpGap,
                    borderColor: error
                      ? COLORS.ERROR_RED
                      : focusedIndex === index
                      ? COLORS.FOREST_GREEN
                      : digit
                      ? COLORS.BORDER
                      : COLORS.BORDER,
                    backgroundColor: digit
                      ? COLORS.INPUT_BACKGROUND
                      : COLORS.CARD_WHITE,
                  }}
                >
                  <TextInput
                    ref={ref => {
                      inputRefs.current[index] = ref;
                    }}
                    className="w-full text-center text-[22px] font-bold text-content"
                    style={{
                      height: otpCellSize,
                      lineHeight: 26,
                      textAlignVertical: 'center',
                    }}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH - index}
                    accessibilityLabel={`OTP digit ${index + 1}`}
                    value={digit}
                    onChangeText={text => handleDigitChange(text, index)}
                    onKeyPress={e => handleKeyPress(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    editable={!isLoading}
                    selectTextOnFocus
                    textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                    autoComplete={index === 0 ? 'sms-otp' : 'off'}
                  />
                </View>
              ))}
            </View>

            {error && (
              <Text className="mt-4 text-center text-sm text-danger">
                {error}
              </Text>
            )}
          </Card>

          <Button
            className="mt-8"
            label={
              isLoading
                ? hasVerifiedOtp
                  ? 'Continuing...'
                  : 'Verifying...'
                : hasVerifiedOtp
                ? 'Continue'
                : 'Verify OTP'
            }
            onPress={() => {
              void handleVerifyOtp();
            }}
            disabled={isLoading || !isOtpComplete}
          />

          {/* Countdown / Resend */}
          <View className="mt-6 items-center">
            {countdown > 0 ? (
              <Text className="text-sm text-muted">Resend in {countdown}s</Text>
            ) : (
              <TouchableOpacity
                className="min-h-[48px] min-w-[48px] items-center justify-center"
                onPress={handleResend}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-bold text-accent">
                  Resend OTP
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default OTPScreen;
