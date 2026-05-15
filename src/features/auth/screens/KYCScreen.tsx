import React, {useEffect, useState} from 'react';
import {
  BackHandler,
  View,
  Text,
  TextInput,
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
import {bootstrapAuthenticatedProfile} from '../../../services/authBootstrap';
import {getAuthenticatedEntryRoute} from '../../../common/utils/onboarding';
import {setWalletRecoveryState} from '../../profile/store/profileSlice';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import {showBanner} from '../../../store/uiSlice';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';

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
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();
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
    const {profile, warning} = await bootstrapAuthenticatedProfile();

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

    if (warning) {
      dispatch(showBanner({message: warning.message, type: 'info'}));
    }
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
      if ((err as {message?: string})?.message === 'APP_CONFIG_MISSING_API_BASE_URL') {
        setApiError(
          'This release build is missing server configuration. Please reinstall the latest release APK.',
        );
      } else if (err && typeof err === 'object' && 'response' in err) {
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
          <Text className="text-3xl font-bold text-gray-900">
            Complete Your Profile
          </Text>
          <Text className="mt-3 text-base leading-6 text-gray-600">
            This is a one-time setup. Your name must match your land document.
          </Text>

          <Card className="mt-8" style={{backgroundColor: '#FEF3C7'}}>
            <Text className="text-sm font-semibold text-[#92400E]">
              Use the exact owner name printed on your land document.
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#92400E]">
              Your Aadhaar is used only for this KYC request and is cleared from the app immediately after submission.
            </Text>
          </Card>

          <Card className="mt-6">
            <Text className="text-base leading-6 text-gray-700">
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
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-base text-gray-900"
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
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-base text-gray-900"
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

            {apiError && (
              <Text className="mt-4 text-center text-sm text-red-500">
                {apiError}
              </Text>
            )}
          </Card>

          <Button
            className="mt-8"
            label={isLoading ? 'Saving Profile...' : 'Continue'}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading || !isFormReady}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default KYCScreen;
