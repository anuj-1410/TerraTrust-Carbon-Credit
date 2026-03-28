import React, {useState} from 'react';
import {
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
import {setUser, setKycCompleted} from '../store/authSlice';
import api from '../../../services/api';
import {supabase} from '../../../services/supabase';
import {sha256} from '../../../common/utils/hash';
import Loader from '../../../common/components/Loader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'KYCScreen'>;

const kycSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(255, 'Name must be 255 characters or fewer'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
});

type KYCForm = z.infer<typeof kycSchema>;

const KYCScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const userPhone = useAppSelector(state => state.auth.user?.phone ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<KYCForm>({
    resolver: zodResolver(kycSchema),
    defaultValues: {fullName: '', aadhaarNumber: ''},
  });

  const onSubmit = async (data: KYCForm) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const {
        data: {session},
      } = await supabase.auth.getSession();
      const response = await api.post('/api/v1/auth/kyc', {
        full_name: data.fullName,
        aadhaar_number: data.aadhaarNumber,
      });

      if (response.status === 200) {
        const userId = response.data.user_id;
        // Compute SHA-256 hash on-device before dispatching to Redux
        const aadhaarHash = await sha256(data.aadhaarNumber);

        dispatch(
          setUser({
            id: userId,
            name: data.fullName,
            phone: userPhone || session?.user.phone || '',
            aadhaar_hash: aadhaarHash,
          }),
        );
        dispatch(setKycCompleted(true));
        // aadhaarNumber goes out of scope — never stored (D-003)
        navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]});
      }
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err
      ) {
        const axiosErr = err as {response?: {data?: {error?: string}}};
        const message = axiosErr.response?.data?.error;
        if (message === 'KYC already completed') {
          dispatch(setKycCompleted(true));
          navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]});
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
                  onChangeText={onChange}
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
                  onChangeText={onChange}
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
              isLoading ? 'bg-[#2F855A]/70' : 'bg-[#2F855A]'
            } shadow-md`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.8}>
            {isLoading ? (
              <Loader />
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
