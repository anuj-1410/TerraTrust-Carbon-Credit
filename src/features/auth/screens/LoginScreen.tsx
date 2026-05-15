import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {RootStackParamList} from '../../../types/navigation';
import {
  sendPhoneOtp,
  type PendingPhoneOtpSession,
} from '../../../services/firebase';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LoginScreen'>;

const OTP_TIMEOUT_MS = 20000;
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
  const navigation = useNavigation<Nav>();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneError, setShowPhoneError] = useState(false);
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();

  const phoneError = useMemo(
    () => (showPhoneError ? getPhoneValidationError(phoneNumber) : null),
    [phoneNumber, showPhoneError],
  );
  const isPhoneValid = getPhoneValidationError(phoneNumber) === null;

  const sendPhoneOtpWithTimeout = async (
    phone: string,
  ): Promise<PendingPhoneOtpSession> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        sendPhoneOtp(phone),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('OTP_TIMEOUT')), OTP_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const onSubmit = async () => {
    if (!isPhoneValid || isLoading) {
      setShowPhoneError(true);
      return;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const phone = `+91${phoneNumber}`;
      const otpSession = await sendPhoneOtpWithTimeout(phone);
      navigation.navigate('OTPScreen', {
        phone,
        verificationId: otpSession.verificationId,
      });
    } catch (error) {
      const firebaseErr = error as {code?: string};
      if (firebaseErr.code === 'auth/too-many-requests') {
        setApiError('Too many attempts. Please wait a few minutes and try again.');
      } else if (firebaseErr.code === 'auth/quota-exceeded') {
        setApiError(
          'Firebase SMS quota is exhausted right now. Please wait a bit and try again.',
        );
      } else if (firebaseErr.code === 'auth/network-request-failed') {
        setApiError('Network issue while sending OTP. Please check your connection.');
      } else if (
        firebaseErr.code === 'auth/invalid-app-credential' ||
        firebaseErr.code === 'auth/missing-client-identifier' ||
        firebaseErr.code === 'auth/app-not-authorized'
      ) {
        setApiError(
          'App verification failed. Please register the release SHA-1/SHA-256 in Firebase and try again.',
        );
      } else if ((error as {message?: string}).message === 'OTP_TIMEOUT') {
        setApiError('Request timed out. Please check your network and try again.');
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
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
          <View
            className="mb-6 h-16 w-16 items-center justify-center rounded-[24px]"
            style={{backgroundColor: 'rgba(47,133,90,0.12)'}}>
            <MaterialCommunityIcons
              color={COLORS.FOREST_GREEN}
              name="sprout"
              size={30}
            />
          </View>
          <Text className="text-3xl font-bold text-gray-900">
            Welcome to TerraTrust
          </Text>
          <Text className="mt-3 text-base leading-6 text-gray-600">
            Enter your mobile number to receive a one-time password and continue.
          </Text>

          <Card className="mt-10 p-5">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Mobile Number
            </Text>
            <View className="flex-row">
              <View className="items-center justify-center rounded-l-xl bg-[#2F855A] px-4">
                <Text className="text-base font-semibold text-white">+91</Text>
              </View>
              <TextInput
                className="flex-1 rounded-r-xl border border-l-0 border-gray-300 px-4 py-3 text-base text-gray-900"
                placeholder="Enter 10-digit number"
                placeholderTextColor="#9CA3AF"
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
            {phoneError && <Text className="mt-1 text-sm text-red-500">{phoneError}</Text>}
            {apiError && (
              <Text className="mt-1 text-sm text-red-500">{apiError}</Text>
            )}
            <Text className="mt-4 text-sm leading-5 text-gray-500">
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
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
