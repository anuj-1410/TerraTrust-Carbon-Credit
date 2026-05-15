import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';
import {
  confirmPhoneOtp,
  getCurrentFirebaseUser,
  sendPhoneOtp,
  type AuthBootstrapResponse,
} from '../../../services/firebase';
import {bootstrapAuthenticatedProfile} from '../../../services/authBootstrap';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAppDispatch} from '../../../store/hooks';
import {setUser, setWalletAddress, setKycCompleted} from '../store/authSlice';
import {
  getAuthenticatedEntryRoute,
  markOnboardingComplete,
} from '../../../common/utils/onboarding';
import {
  setOnboardingComplete,
  setWalletRecoveryState,
} from '../../profile/store/profileSlice';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import {showBanner} from '../../../store/uiSlice';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPScreen'>;

const OTP_LENGTH = 6;
const COUNTDOWN_SECONDS = 28;
const OTP_BOOTSTRAP_ERROR_MESSAGE =
  'OTP verified, but we could not finish sign-in. Please check your connection and try again.';

const OTPScreen = ({route, navigation}: Props) => {
  const {phone, verificationId} = route.params;
  const dispatch = useAppDispatch();
  const {width} = useWindowDimensions();
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [activeVerificationId, setActiveVerificationId] = useState<string | null>(
    verificationId ?? null,
  );
  const [hasVerifiedOtp, setHasVerifiedOtp] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
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
    startTimer();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTimer]);

  // Mask phone: show last 4 digits
  const maskedPhone = phone.replace(
    /(\+91)(\d{6})(\d{4})/,
    '$1 XXXXXX$3',
  );
  const otpCellSize = Math.max(
    46,
    Math.min(
      54,
      Math.floor(
        (Math.min(width, contentMaxWidth) -
          horizontalPadding * 2 -
          52 -
          10 * (OTP_LENGTH - 1)) /
          OTP_LENGTH,
      ),
    ),
  );
  const otpGap = 10;
  const otpValue = digits.join('');
  const isOtpComplete = otpValue.length === OTP_LENGTH;

  const resetOtpInputs = useCallback(() => {
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  }, []);

  const applyProfile = useCallback(
    (profile: AuthBootstrapResponse) => {
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
    },
    [dispatch],
  );

  const bootstrapProfile = useCallback(async () => {
    const {profile, warning} = await bootstrapAuthenticatedProfile();

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

    const nextRoute = getAuthenticatedEntryRoute(profile.kyc_completed);

    if (nextRoute !== 'KYCScreen') {
      navigation.reset({index: 0, routes: [{name: nextRoute}]});
      return;
    }

    navigation.replace(nextRoute);
  }, [applyProfile, dispatch, navigation]);

  const handleVerifyOtp = useCallback(
    async () => {
      if (isLoading) {
        return;
      }

      if (!isOtpComplete) {
        setError('Enter the full 6-digit OTP to continue.');
        return;
      }

      setIsLoading(true);
      setError(null);

      if (!hasVerifiedOtp || !getCurrentFirebaseUser()) {
        try {
          await confirmPhoneOtp(otpValue, activeVerificationId);
          setHasVerifiedOtp(true);
        } catch (caughtError) {
          const firebaseErr = caughtError as {code?: string; message?: string};
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
          return;
        }
      }

      try {
        await bootstrapProfile();
      } catch (caughtError) {
        const axiosErr = caughtError as {
          response?: {status?: number};
          message?: string;
        };
        if (axiosErr.message === 'APP_CONFIG_MISSING_API_BASE_URL') {
          setError(
            'This release build is missing server configuration. Please reinstall the latest release APK.',
          );
        } else if (axiosErr.response?.status === 401) {
          setError('Your session expired while loading your account. Please try again.');
        } else if (axiosErr.response?.status && axiosErr.response.status >= 500) {
          setError('Server issue while finishing sign-in. Please try again in a moment.');
        } else if (axiosErr.message === 'Network Error') {
          setError(OTP_BOOTSTRAP_ERROR_MESSAGE);
        } else {
          setError(OTP_BOOTSTRAP_ERROR_MESSAGE);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeVerificationId,
      bootstrapProfile,
      hasVerifiedOtp,
      isLoading,
      isOtpComplete,
      otpValue,
      resetOtpInputs,
    ],
  );

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
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: {nativeEvent: {key: string}},
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    try {
      const otpSession = await sendPhoneOtp(phone);
      setActiveVerificationId(otpSession.verificationId);
      setHasVerifiedOtp(false);
      resetOtpInputs();
      setError(null);
      startTimer();
    } catch (caughtError) {
      const firebaseErr = caughtError as {code?: string};
      if (firebaseErr.code === 'auth/network-request-failed') {
        setError('Network issue while resending OTP. Please try again.');
      } else {
        setError('Failed to resend OTP. Try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{backgroundColor: COLORS.OFF_WHITE}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled">
        <View
          className="flex-1 w-full self-center"
          style={{
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
            paddingTop: topSpacing,
            paddingBottom: bottomSpacing,
          }}>
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center self-start"
            onPress={() => navigation.replace('LoginScreen')}
            activeOpacity={0.7}>
            <MaterialCommunityIcons
              color="#2F855A"
              name="arrow-left"
              size={24}
            />
          </TouchableOpacity>

          <Text className="text-base text-gray-700">
            Enter the 6-digit code sent to
          </Text>
          <Text className="mt-1 text-base font-bold text-[#2F855A]">
            {maskedPhone}
          </Text>

          <Card className="mt-8 p-5">
            <Text className="text-sm leading-5 text-gray-600">
              Enter the verification code below to continue securely.
            </Text>
            <View
              className="mt-6 flex-row items-center justify-center"
              style={{gap: otpGap}}>
              {digits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={ref => {
                    inputRefs.current[index] = ref;
                  }}
                  className={`rounded-2xl border-2 text-center text-2xl font-bold text-gray-900 ${
                    digit
                      ? 'border-[#2F855A] bg-[#2F855A]/5'
                      : 'border-gray-300'
                  }`}
                  style={{
                    width: otpCellSize,
                    height: otpCellSize,
                    minWidth: 46,
                    minHeight: 46,
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={text => handleDigitChange(text, index)}
                  onKeyPress={e => handleKeyPress(e, index)}
                  editable={!isLoading}
                  selectTextOnFocus
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                />
              ))}
            </View>

            {error && (
              <Text className="mt-4 text-center text-sm text-red-500">
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
              <Text className="text-sm text-gray-500">
                Resend in {countdown}s
              </Text>
            ) : (
              <TouchableOpacity
                className="min-h-[48px] min-w-[48px] items-center justify-center"
                onPress={handleResend}
                activeOpacity={0.7}>
                <Text className="text-sm font-bold text-[#2F855A]">
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
