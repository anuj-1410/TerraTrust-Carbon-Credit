import React, {useState} from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import type {RootStackParamList} from '../../../types/navigation';
import {sendPhoneOtp} from '../../../services/firebase';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LoginScreen'>;

const loginSchema = z.object({
  phoneNumber: z
    .string()
    .regex(
      /^[2-9]\d{9}$/,
      'Enter a valid 10-digit mobile number that does not start with 0 or 1',
    ),
});

type LoginForm = z.infer<typeof loginSchema>;

const OTP_TIMEOUT_MS = 20000;

const LoginScreen = () => {
  const navigation = useNavigation<Nav>();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: {errors},
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {phoneNumber: ''},
  });

  const phoneNumber = watch('phoneNumber');
  const isPhoneValid = /^[2-9]\d{9}$/.test(phoneNumber);

  const sendPhoneOtpWithTimeout = async (phone: string) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        sendPhoneOtp(phone),
        new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('OTP_TIMEOUT')), OTP_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const phone = '+91' + data.phoneNumber;
      await sendPhoneOtpWithTimeout(phone);
      navigation.navigate('OTPScreen', {phone});
    } catch (error) {
      const firebaseErr = error as {code?: string};
      if (firebaseErr.code === 'auth/too-many-requests') {
        setApiError('Too many attempts. Please wait a few minutes and try again.');
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
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-20">
          <Text className="text-3xl font-bold text-gray-900">
            Welcome to TerraTrust
          </Text>
          <Text className="mt-3 text-base leading-6 text-gray-600">
            Enter your mobile number to receive a one-time password and continue.
          </Text>

          {/* Phone Input */}
          <View className="mt-12">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Mobile Number
            </Text>
            <View className="flex-row">
              <View className="items-center justify-center rounded-l-xl bg-[#2F855A] px-4">
                <Text className="text-base font-semibold text-white">+91</Text>
              </View>
              <Controller
                control={control}
                name="phoneNumber"
                render={({field: {onChange, onBlur, value}}) => (
                  <TextInput
                    className="flex-1 rounded-r-xl border border-l-0 border-gray-300 px-4 py-3 text-base text-gray-900"
                    placeholder="Enter 10-digit number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={10}
                    onBlur={onBlur}
                    onChangeText={text => onChange(text.replace(/\D/g, ''))}
                    value={value}
                    editable={!isLoading}
                  />
                )}
              />
            </View>
            {errors.phoneNumber && (
              <Text className="mt-1 text-sm text-red-500">
                {errors.phoneNumber.message}
              </Text>
            )}
            {apiError && (
              <Text className="mt-1 text-sm text-red-500">{apiError}</Text>
            )}
          </View>

          {/* Send OTP Button */}
          <TouchableOpacity
            className={`mt-8 min-h-[48px] items-center justify-center rounded-xl ${
              isLoading || !isPhoneValid ? 'bg-[#9CA3AF]' : 'bg-[#2F855A]'
            } shadow-md`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading || !isPhoneValid}
            activeOpacity={0.8}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-bold text-white">Send OTP</Text>
            )}
          </TouchableOpacity>

          <Text className="mt-4 text-sm leading-5 text-gray-500">
            Standard SMS rates may apply. Your phone number is processed by
            Google/Firebase for abuse prevention.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
