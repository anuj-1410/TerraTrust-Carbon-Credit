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
import {useAppSelector, useAppDispatch} from '../../../store/hooks';
import {setUser, setWalletAddress, setKycCompleted} from '../store/authSlice';
import api from '../../../services/api';
import {type AuthBootstrapResponse} from '../../../services/firebase';
import {sha256} from '../../../common/utils/hash';
import {getAuthenticatedEntryRoute} from '../../../common/utils/onboarding';

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

const KYCScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const existingAadhaarHash = useAppSelector(
    state => state.auth.user?.aadhaar_hash ?? '',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
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

  const syncProfile = async (aadhaarHash: string) => {
    const {data: profile} = await api.get<AuthBootstrapResponse>('/api/v1/auth/me');

    dispatch(
      setUser({
        id: profile.user_id,
        firebaseUid: profile.firebase_uid,
        name: profile.full_name ?? '',
        phone: profile.phone_number,
        aadhaar_hash: aadhaarHash,
      }),
    );
    dispatch(setWalletAddress(profile.wallet_address));
    dispatch(setKycCompleted(profile.kyc_completed));
  };

  const onSubmit = async (data: KYCForm) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const aadhaarHash = await sha256(data.aadhaarNumber);
      const response = await api.post('/api/v1/auth/kyc', {
        full_name: data.fullName,
        aadhaar_number: data.aadhaarNumber,
      });

      if (response.status === 200) {
        await syncProfile(aadhaarHash);
        reset({fullName: data.fullName, aadhaarNumber: ''});
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
          await syncProfile(existingAadhaarHash);
          reset({fullName: data.fullName, aadhaarNumber: ''});
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
          <View className="rounded-xl bg-[#FEF3C7] p-4">
            <Text className="text-sm font-semibold text-[#92400E]">
              Use the exact owner name printed on your land document.
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#92400E]">
              Your Aadhaar is sent securely for KYC verification, and only a hashed value is stored on this device.
            </Text>
          </View>

          <Text className="text-base text-gray-700 leading-6">
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
                  maxLength={12}
                  onBlur={onBlur}
                  onChangeText={text => onChange(text.replace(/\D/g, ''))}
                  value={value}
                  editable={!isLoading}
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
