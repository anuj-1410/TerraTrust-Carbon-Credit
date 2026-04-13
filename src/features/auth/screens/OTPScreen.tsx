import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';
import {createFarmerWallet, getWalletAddress} from '../../../services/wallet';
import api from '../../../services/api';
import {
  confirmPhoneOtp,
  getFreshFirebaseIdToken,
  sendPhoneOtp,
  type AuthBootstrapResponse,
} from '../../../services/firebase';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAppDispatch} from '../../../store/hooks';
import {setUser, setWalletAddress, setKycCompleted} from '../store/authSlice';
import {getAuthenticatedEntryRoute} from '../../../common/utils/onboarding';
import {setWalletRecoveryState} from '../../profile/store/profileSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPScreen'>;

const OTP_LENGTH = 6;
const COUNTDOWN_SECONDS = 28;

const OTPScreen = ({route, navigation}: Props) => {
  const {phone} = route.params;
  const dispatch = useAppDispatch();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

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
    await getFreshFirebaseIdToken(true);

    let {data: profile} = await api.get<AuthBootstrapResponse>('/api/v1/auth/me');

    if (!profile.wallet_address) {
      const walletAddress =
        (await getWalletAddress()) ?? (await createFarmerWallet());

      await api.post('/api/v1/auth/register-wallet', {
        wallet_address: walletAddress,
      });

      await getFreshFirebaseIdToken(true);
      const refreshedProfile = await api.get<AuthBootstrapResponse>(
        '/api/v1/auth/me',
      );
      profile = refreshedProfile.data.wallet_address
        ? refreshedProfile.data
        : {...refreshedProfile.data, wallet_address: walletAddress};
    }

    applyProfile(profile);

    const nextRoute = getAuthenticatedEntryRoute(profile.kyc_completed);

    if (nextRoute !== 'KYCScreen') {
      navigation.reset({index: 0, routes: [{name: nextRoute}]});
      return;
    }

    navigation.replace(nextRoute);
  }, [applyProfile, navigation]);

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

      try {
        await confirmPhoneOtp(otpValue);
        await bootstrapProfile();
      } catch (caughtError) {
        const firebaseErr = caughtError as {code?: string; message?: string};
        if (
          firebaseErr.message === 'OTP_SESSION_MISSING' ||
          firebaseErr.code === 'auth/session-expired'
        ) {
          setError('OTP session expired. Please resend the code.');
        } else if (firebaseErr.code === 'auth/invalid-verification-code') {
          setError('Incorrect code. Please try again.');
        } else {
          setError('Something went wrong. Please try again.');
        }
        resetOtpInputs();
      } finally {
        setIsLoading(false);
      }
    },
    [bootstrapProfile, isLoading, isOtpComplete, otpValue, resetOtpInputs],
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
      await sendPhoneOtp(phone);
      resetOtpInputs();
      setError(null);
      startTimer();
    } catch {
      setError('Failed to resend OTP. Try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 px-6 pt-16">
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

        {/* OTP Digit Boxes */}
        <View className="mt-10 flex-row justify-between">
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => {
                inputRefs.current[index] = ref;
              }}
              className={`h-14 w-12 min-h-[48px] min-w-[48px] rounded-xl border-2 text-center text-2xl font-bold text-gray-900 ${
                digit
                  ? 'border-[#2F855A] bg-[#2F855A]/5'
                  : 'border-gray-300'
              }`}
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

        {/* Error */}
        {error && (
          <Text className="mt-4 text-center text-sm text-red-500">
            {error}
          </Text>
        )}

        <TouchableOpacity
          className={`mt-8 min-h-[48px] items-center justify-center rounded-xl ${
            isLoading || !isOtpComplete ? 'bg-[#9CA3AF]' : 'bg-[#2F855A]'
          }`}
          onPress={() => {
            void handleVerifyOtp();
          }}
          disabled={isLoading || !isOtpComplete}
          activeOpacity={0.8}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-bold text-white">Verify OTP</Text>
          )}
        </TouchableOpacity>

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
    </KeyboardAvoidingView>
  );
};

export default OTPScreen;
