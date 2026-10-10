import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { RootStackParamList } from '../../../types/navigation';
import { useAppDispatch } from '../../../store/hooks';
import { setAuthenticatedProfile } from '../store/authSlice';
import api from '../../../services/api';
import { bootstrapAuthenticatedProfile } from '../../../services/authBootstrap';
import {
  getAuthenticatedEntryRoute,
  markOnboardingComplete,
} from '../../../common/utils/onboarding';
import { setOnboardingComplete } from '../../profile/store/profileSlice';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import { showBanner } from '../../../store/uiSlice';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';

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
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { horizontalPadding, bottomSpacing, contentMaxWidth } =
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
    formState: { errors },
  } = useForm<KYCForm>({
    resolver: zodResolver(kycSchema),
    mode: 'onChange',
    defaultValues: { fullName: '', aadhaarNumber: '' },
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
    const { profile, warning } = await bootstrapAuthenticatedProfile();

    dispatch(setAuthenticatedProfile(profile));
    if (profile.kyc_completed) {
      markOnboardingComplete();
      dispatch(setOnboardingComplete(true));
    }

    if (warning) {
      dispatch(showBanner({ message: warning.message, type: 'info' }));
    }
  };

  const clearAadhaarInput = () => {
    setAadhaarFocused(false);
    setValue('aadhaarNumber', '', { shouldValidate: true, shouldDirty: false });
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
        reset({ fullName: '', aadhaarNumber: '' });
        setAadhaarFocused(false);
        Keyboard.dismiss();
        navigation.reset({
          index: 0,
          routes: [{ name: getAuthenticatedEntryRoute(true) }],
        });
      }
    } catch (err: unknown) {
      if (
        (err as { message?: string })?.message ===
        'APP_CONFIG_MISSING_API_BASE_URL'
      ) {
        setApiError(
          'This release build is missing server configuration. Please reinstall the latest release APK.',
        );
      } else if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        const message = axiosErr.response?.data?.error;
        if (message === 'KYC already completed') {
          await syncProfile();
          reset({ fullName: '', aadhaarNumber: '' });
          setAadhaarFocused(false);
          Keyboard.dismiss();
          navigation.reset({
            index: 0,
            routes: [{ name: getAuthenticatedEntryRoute(true) }],
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
      style={{ backgroundColor: COLORS.OFF_WHITE }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Complete Your Profile"
        eyebrow="One-Time Profile Setup"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
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
            This is a one-time setup. Your name must match your land document.
          </Text>

          <Card
            className="mt-8"
            style={{ backgroundColor: COLORS.WARNING_SURFACE }}
          >
            <Text className="text-sm font-semibold text-warning">
              Use the exact owner name printed on your land document.
            </Text>
            <Text className="mt-2 text-sm leading-6 text-warning">
              Your Aadhaar is used only for this KYC request and is cleared from
              the app immediately after submission.
            </Text>
          </Card>

          <Card className="mt-6">
            <Text className="text-base leading-6 text-content">
              Enter your name exactly as written on your land document (7/12
              Extract)
            </Text>

            {/* Full Name */}
            <View className="mt-6">
              <Text className="mb-2 text-sm font-medium text-content">
                Full Name
              </Text>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="rounded-[20px] border bg-surface px-4 py-4 text-base text-content"
                    style={{
                      borderColor: errors.fullName
                        ? COLORS.ERROR_RED
                        : COLORS.BORDER,
                    }}
                    placeholder="Full name"
                    placeholderTextColor={COLORS.DISABLED_GREY}
                    onBlur={onBlur}
                    onChangeText={text =>
                      onChange(
                        text.replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' '),
                      )
                    }
                    value={value}
                    editable={!isLoading}
                    autoCapitalize="words"
                  />
                )}
              />
              {errors.fullName && (
                <Text className="mt-1 text-sm text-danger">
                  {errors.fullName.message}
                </Text>
              )}
            </View>

            {/* Aadhaar Number */}
            <View className="mt-6">
              <Text className="mb-2 text-sm font-medium text-content">
                Aadhaar Number
              </Text>
              <Controller
                control={control}
                name="aadhaarNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="rounded-[20px] border bg-surface px-4 py-4 text-base text-content"
                    style={{
                      borderColor: errors.aadhaarNumber
                        ? COLORS.ERROR_RED
                        : COLORS.BORDER,
                    }}
                    placeholder="Enter 12-digit Aadhaar number"
                    placeholderTextColor={COLORS.DISABLED_GREY}
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
                <Text className="mt-1 text-sm text-danger">
                  {errors.aadhaarNumber.message}
                </Text>
              )}
            </View>

            {apiError && (
              <Text className="mt-4 text-center text-sm text-danger">
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
