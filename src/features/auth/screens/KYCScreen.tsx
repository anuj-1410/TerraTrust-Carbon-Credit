import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import {useAppDispatch} from '../../../store/hooks';
import {setUser, setWalletAddress, setKycCompleted} from '../store/authSlice';
import api from '../../../services/api';
import {type AuthBootstrapResponse} from '../../../services/firebase';
import {getAuthenticatedEntryRoute} from '../../../common/utils/onboarding';
import {setWalletRecoveryState} from '../../profile/store/profileSlice';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCScreen'>;

const kycSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your full name as shown on the land document')
    .max(255, 'Name must be 255 characters or fewer')
    .regex(/^[A-Za-z ]+$/, 'Use letters and spaces only'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
});

type KYCForm = z.infer<typeof kycSchema>;

function formatAadhaarDisplay(value: string, isFocused: boolean): string {
  if (!value) {
    return '';
  }

  const visibleValue = isFocused
    ? value
    : `${'X'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;

  return visibleValue.replace(/(\w{4})(?=\w)/g, '$1 ').trim();
}

const KYCScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [aadhaarFocused, setAadhaarFocused] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: {errors},
  } = useForm<KYCForm>({
    resolver: zodResolver(kycSchema),
    mode: 'onChange',
    defaultValues: {fullName: '', aadhaarNumber: ''},
  });

  const [fullName, aadhaarNumber] = watch(['fullName', 'aadhaarNumber']);
  const isFormReady =
    /^[A-Za-z ]{2,}$/.test(fullName.trim()) && /^\d{12}$/.test(aadhaarNumber);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );

    return () => subscription.remove();
  }, []);

  const syncProfile = async () => {
    const {data: profile} = await api.get<AuthBootstrapResponse>('/api/v1/auth/me');

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
  };

  const clearAadhaarInput = () => {
    setAadhaarFocused(false);
    setValue('aadhaarNumber', '', {shouldValidate: true, shouldDirty: false});
  };

  const onSubmit = async (data: KYCForm) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await api.post('/api/v1/auth/kyc', {
        full_name: data.fullName,
        aadhaar_number: data.aadhaarNumber,
      });

      if (response.status === 200) {
        await syncProfile();
        reset({fullName: '', aadhaarNumber: ''});
        setAadhaarFocused(false);
        navigation.reset({
          index: 0,
          routes: [{name: getAuthenticatedEntryRoute(true)}],
        });
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as {response?: {data?: {error?: string}}};
        const message = axiosErr.response?.data?.error;
        if (message === 'KYC already completed') {
          await syncProfile();
          reset({fullName: '', aadhaarNumber: ''});
          setAadhaarFocused(false);
          navigation.reset({
            index: 0,
            routes: [{name: getAuthenticatedEntryRoute(true)}],
          });
          return;
        }
        setApiError(message ?? 'Something went wrong. Please try again.');
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    } finally {
      clearAadhaarInput();
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
        <View className="flex-1 px-6 pt-16">
          <Text className="text-3xl font-bold text-gray-900">
            Complete Your Profile
          </Text>
          <Text className="mt-3 text-base leading-6 text-gray-600">
            This is a one-time setup. Your name must match your land document.
          </Text>

          <View className="rounded-xl bg-[#FEF3C7] p-4">
            <Text className="text-sm font-semibold text-[#92400E]">
              Use the exact owner name printed on your land document.
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#92400E]">
              Your Aadhaar is used only for this KYC request and is cleared from the app immediately after submission.
            </Text>
          </View>

          <Text className="mt-6 text-base leading-6 text-gray-700">
            Enter your name exactly as written on your land document (7/12 Extract)
          </Text>

          {/* Full Name */}
          <View className="mt-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Full Name
            </Text>
            <Controller
              control={control}
              name="fullName"
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900"
                  placeholder="Full name"
                  placeholderTextColor="#9CA3AF"
                  onBlur={onBlur}
                  onChangeText={text =>
                    onChange(text.replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' '))
                  }
                  value={value}
                  editable={!isLoading}
                  autoCapitalize="words"
                />
              )}
            />
            {errors.fullName && (
              <Text className="mt-1 text-sm text-red-500">
                {errors.fullName.message}
              </Text>
            )}
          </View>

          {/* Aadhaar Number */}
          <View className="mt-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Aadhaar Number
            </Text>
            <Controller
              control={control}
              name="aadhaarNumber"
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900"
                  placeholder="Enter 12-digit Aadhaar number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={14}
                  onBlur={() => {
                    setAadhaarFocused(false);
                    onBlur();
                  }}
                  onFocus={() => setAadhaarFocused(true)}
                  onChangeText={text => onChange(text.replace(/\D/g, ''))}
                  value={formatAadhaarDisplay(value, aadhaarFocused)}
                  editable={!isLoading}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                />
              )}
            />
            {errors.aadhaarNumber && (
              <Text className="mt-1 text-sm text-red-500">
                {errors.aadhaarNumber.message}
              </Text>
            )}
          </View>

          {/* API Error */}
          {apiError && (
            <Text className="mt-4 text-center text-sm text-red-500">
              {apiError}
            </Text>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            className={`mt-8 min-h-[48px] items-center justify-center rounded-xl ${
              isLoading || !isFormReady ? 'bg-[#9CA3AF]' : 'bg-[#2F855A]'
            } shadow-md`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading || !isFormReady}
            activeOpacity={0.8}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-bold text-white">Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default KYCScreen;
