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
import {supabase} from '../../../services/supabase';
import Loader from '../../../common/components/Loader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LoginScreen'>;

const loginSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\d{10}$/, 'Please enter a valid 10-digit number'),
});

type LoginForm = z.infer<typeof loginSchema>;

const LoginScreen = () => {
  const navigation = useNavigation<Nav>();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {phoneNumber: ''},
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const phone = '+91' + data.phoneNumber;
      const {error} = await supabase.auth.signInWithOtp({phone});
      if (error) {
        setApiError(error.message);
      } else {
        navigation.navigate('OTPScreen', {phone});
      }
    } catch {
      setApiError('Something went wrong. Please try again.');
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
          {/* Phone Input */}
          <View className="mt-12">
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
                    placeholder=""
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={10}
                    onBlur={onBlur}
                    onChangeText={onChange}
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
              isLoading ? 'bg-[#2F855A]/70' : 'bg-[#2F855A]'
            } shadow-md`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            activeOpacity={0.8}>
            {isLoading ? (
              <Loader />
            ) : (
              <Text className="text-base font-bold text-white">Send OTP</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
