import React, {useEffect} from 'react';
import {View, Text, Image} from 'react-native';
import LottieView from 'lottie-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppSelector} from '../../../store/hooks';
import {supabase} from '../../../services/supabase';
import {createWallet} from '../../../services/wallet';
import api from '../../../services/api';
import {useAppDispatch} from '../../../store/hooks';
import {setWalletAddress} from '../store/authSlice';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SplashScreen'>;

const SplashScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const kycCompleted = useAppSelector(state => state.auth.kycCompleted);
  const walletAddress = useAppSelector(state => state.auth.walletAddress);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: {session},
      } = await supabase.auth.getSession();

      if (session !== null && isAuthenticated) {
        if (kycCompleted) {
          navigation.replace('HomeScreen');
        } else {
          // Retry wallet creation if needed
          if (walletAddress === null) {
            try {
              const address = await createWallet();
              dispatch(setWalletAddress(address));
              await api.post('/api/v1/auth/register-wallet', {
                wallet_address: address,
              });
            } catch {
              // Non-blocking — proceed to KYC
            }
          }
          navigation.replace('KYCScreen');
        }
      } else {
        navigation.replace('LoginScreen');
      }
    };

    checkSession();
  }, [navigation, isAuthenticated, kycCompleted, walletAddress, dispatch]);

  return (
    <View className="flex-1 items-center justify-center bg-[#0A3D2E]">
      <View className="mb-6 h-[120px] w-[120px] items-center justify-center rounded-3xl bg-white">
        <Text className="text-5xl">🌿</Text>
      </View>
      <LottieView
        source={require('../../../assets/lottie/spinning_leaf.json')}
        autoPlay
        loop
        style={{width: 100, height: 100}}
      />
      <Text className="mt-4 text-[28px] font-bold text-white">TerraTrust</Text>
      <Text className="mt-2 text-sm text-white/50">
        Verifying your identity...
      </Text>
      <View className="absolute bottom-10">
        <Text className="text-xs text-white/30">Powered by Blockchain</Text>
      </View>
    </View>
  );
};

export default SplashScreen;
