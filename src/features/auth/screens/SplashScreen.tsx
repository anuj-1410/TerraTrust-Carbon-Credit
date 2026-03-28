import React, {useEffect} from 'react';
import {View, Text} from 'react-native';
import LottieView from 'lottie-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';
import {supabase} from '../../../services/supabase';
import {useAppDispatch} from '../../../store/hooks';
import {setUser, setWalletAddress, setKycCompleted} from '../store/authSlice';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const SplashScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: {session},
      } = await supabase.auth.getSession();

      if (session) {
        // Fetch user profile from Supabase users table
        const {data: profile} = await supabase
          .from('users')
          .select('name, phone, aadhaar_hash, wallet_address, kyc_completed')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          dispatch(
            setUser({
              id: session.user.id,
              name: profile.name ?? '',
              phone: profile.phone ?? session.user.phone ?? '',
              aadhaar_hash: profile.aadhaar_hash ?? '',
            }),
          );
          if (profile.wallet_address) {
            dispatch(setWalletAddress(profile.wallet_address));
          }
          if (profile.kyc_completed) {
            dispatch(setKycCompleted(true));
            navigation.replace('HomeScreen');
          } else {
            navigation.replace('KYCScreen');
          }
        } else {
          navigation.replace('KYCScreen');
        }
      } else {
        navigation.replace('LoginScreen');
      }
    };

    checkSession();
  }, [navigation, dispatch]);

  return (
    <View className="flex-1 items-center justify-center bg-[#2F855A]">
      <View className="mb-6 h-[120px] w-[120px] items-center justify-center rounded-3xl bg-white">
        <Text className="text-5xl">🌿</Text>
      </View>
      <LottieView
        source={require('../../../assets/lottie/spinning_leaf.json')}
        autoPlay
        loop
        style={{width: 100, height: 100}}
      />
    </View>
  );
};

export default SplashScreen;
