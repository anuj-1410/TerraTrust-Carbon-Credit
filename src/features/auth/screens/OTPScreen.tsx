import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';
import {supabase} from '../../../services/supabase';
import {createWallet} from '../../../services/wallet';
import api from '../../../services/api';
import {useAppSelector, useAppDispatch} from '../../../store/hooks';
import {setUser, setWalletAddress} from '../store/authSlice';
import Loader from '../../../common/components/Loader';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPScreen'>;

const OTP_LENGTH = 6;
const COUNTDOWN_SECONDS = 28;

const OTPScreen = ({route, navigation}: Props) => {
  const {phone} = route.params;
  const dispatch = useAppDispatch();
  const walletAddress = useAppSelector(state => state.auth.walletAddress);
  const kycCompleted = useAppSelector(state => state.auth.kycCompleted);

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

  // Auto-verify when all 6 digits entered
  const handleVerifyOtp = useCallback(
    async (otpValue: string) => {
      if (isLoading) {
        return;
      }
      setIsLoading(true);
      setError(null);

      try {
        const {data, error: verifyError} = await supabase.auth.verifyOtp({
          phone,
          token: otpValue,
          type: 'sms',
        });

        if (verifyError) {
          setError('Incorrect code. Please try again.');
          setDigits(Array(OTP_LENGTH).fill(''));
          inputRefs.current[0]?.focus();
          setIsLoading(false);
          return;
        }

        // OTP success — set basic user info from Supabase
        if (data.user) {
          dispatch(
            setUser({
              id: data.user.id,
              name: '',
              phone: data.user.phone ?? phone,
              aadhaar_hash: '',
            }),
          );
        }

        // Wallet creation if needed
        if (walletAddress === null) {
          try {
            const address = await createWallet();
            dispatch(setWalletAddress(address));
            await api.post('/api/v1/auth/register-wallet', {
              wallet_address: address,
            });
          } catch {
            // Non-blocking per D-005 — wallet in Redux for retry
          }
        }

        // Route based on KYC status
        if (kycCompleted) {
          navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]});
        } else {
          navigation.navigate('KYCScreen');
        }
      } catch {
        setError('Incorrect code. Please try again.');
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, phone, walletAddress, kycCompleted, navigation, dispatch],
  );

  useEffect(() => {
    const otpValue = digits.join('');
    if (otpValue.length === OTP_LENGTH && !isLoading) {
      handleVerifyOtp(otpValue);
    }
  }, [digits, isLoading, handleVerifyOtp]);

  const handleDigitChange = (text: string, index: number) => {
    // Only allow single digit
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
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
      await supabase.auth.signInWithOtp({phone});
      setDigits(Array(OTP_LENGTH).fill(''));
      setError(null);
      startTimer();
      inputRefs.current[0]?.focus();
    } catch {
      setError('Failed to resend OTP. Try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 px-6 pt-16">
        {/* Header */}
        <Text className="text-base text-gray-700">
          Enter the 6-digit code sent to
        </Text>
        <Text className="mt-1 text-base font-bold text-[#0A3D2E]">
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
                  ? 'border-[#0A3D2E] bg-[#0A3D2E]/5'
                  : 'border-gray-300'
              }`}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={text => handleDigitChange(text, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              editable={!isLoading}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Error */}
        {error && (
          <Text className="mt-4 text-center text-sm text-red-500">
            {error}
          </Text>
        )}

        {/* Loading */}
        {isLoading && (
          <View className="mt-4 items-center">
            <Loader />
          </View>
        )}

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
              <Text className="text-sm font-bold text-[#0A3D2E]">
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
