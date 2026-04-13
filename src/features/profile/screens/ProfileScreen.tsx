import React, {useMemo, useState} from 'react';
import {Alert, Linking, Text, TouchableOpacity, View} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {CompositeNavigationProp, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import Badge from '../../../common/components/Badge';
import BottomSheet from '../../../common/components/BottomSheet';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {clearPersistedAppStatePreserveOnboarding} from '../../../store/mmkvStorage';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {resetAppState} from '../../../store';
import {signOutFirebase} from '../../../services/firebase';
import type {
  ProfileStackParamList,
  RootStackParamList,
} from '../../../types/navigation';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList, 'ProfileScreen'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const privacyUrl = 'https://terratrust.app/privacy';
const supportUrl = 'mailto:support@terratrust.app?subject=TerraTrust%20support';

const ProfileScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const walletAddress = useAppSelector(state => state.auth.walletAddress);
  const kycCompleted = useAppSelector(state => state.auth.kycCompleted);
  const balance = useAppSelector(state => state.credits.balance);
  const unreadCount = useAppSelector(state => state.notifications.unreadCount);
  const walletRecoveryPending = useAppSelector(
    state => state.profile.walletRecoveryPending,
  );
  const [showAboutSheet, setShowAboutSheet] = useState(false);

  const initials = useMemo(() => {
    if (!user?.name) {
      return 'TT';
    }

    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [user?.name]);

  const maskedPhone = useMemo(() => {
    if (!user?.phone) {
      return 'Phone unavailable';
    }

    return user.phone.replace(/(\+91)(\d{6})(\d{4})/, '$1 XXXXXX$3');
  }, [user?.phone]);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? All your scan data will remain saved on our servers.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOutFirebase();
            clearPersistedAppStatePreserveOnboarding();
            dispatch(resetAppState());
            navigation.reset({index: 0, routes: [{name: 'LoginScreen'}]});
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 px-4 pt-12" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <Text className="text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
        My Profile
      </Text>

      <Card className="mt-5 flex-row items-center">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{backgroundColor: 'rgba(47,133,90,0.12)'}}>
          <Text className="text-xl font-bold" style={{color: COLORS.FOREST_GREEN}}>
            {initials}
          </Text>
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
            {user?.name ?? 'Farmer'}
          </Text>
          <Text className="mt-1" style={{color: COLORS.DISABLED_GREY}}>
            {maskedPhone}
          </Text>
          <View className="mt-3 self-start">
            <Badge
              label={kycCompleted ? 'Verified' : 'Pending KYC'}
              variant={kycCompleted ? 'verified' : 'pending'}
            />
          </View>
        </View>
      </Card>

      <Card className="mt-4">
        <Text className="text-sm" style={{color: COLORS.DISABLED_GREY}}>
          Wallet
        </Text>
        <Text className="mt-2 text-xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}` : 'Not available'}
        </Text>
        <Text className="mt-1" style={{color: COLORS.FOREST_GREEN}}>
          {balance.toFixed(1)} CTT
        </Text>
        {walletAddress ? (
          <TouchableOpacity
            className="mt-4 min-h-[48px] items-center justify-center self-start"
            onPress={() => void Linking.openURL(`https://amoy.polygonscan.com/address/${walletAddress}`)}>
            <Text style={{color: COLORS.TEAL}}>View on PolygonScan</Text>
          </TouchableOpacity>
        ) : null}
      </Card>

      <Card className="mt-4 gap-4">
        <TouchableOpacity onPress={() => navigation.navigate('SettingsScreen')}>
          <Text style={{color: COLORS.DARK_SLATE}}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('NotificationsScreen')}>
          <Text style={{color: COLORS.DARK_SLATE}}>
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void Linking.openURL(privacyUrl)}>
          <Text style={{color: COLORS.DARK_SLATE}}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void Linking.openURL(supportUrl)}>
          <Text style={{color: COLORS.DARK_SLATE}}>Help & Support</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowAboutSheet(true)}>
          <Text style={{color: COLORS.DARK_SLATE}}>About TerraTrust</Text>
        </TouchableOpacity>
      </Card>

      <Card className="mt-4 gap-4">
        <TouchableOpacity onPress={() => navigation.navigate('WalletRecoveryScreen')}>
          <Text style={{color: COLORS.ERROR_RED}}>
            Wallet Recovery{walletRecoveryPending ? ' (Pending)' : ''}
          </Text>
          <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
            Only use this if you changed your phone
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={{color: COLORS.ERROR_RED}}>Log Out</Text>
        </TouchableOpacity>
      </Card>

      <BottomSheet visible={showAboutSheet} onClose={() => setShowAboutSheet(false)}>
        <Text className="text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
          About TerraTrust
        </Text>
        <Text className="mt-4 leading-6" style={{color: COLORS.DISABLED_GREY}}>
          TerraTrust helps farmers verify land, complete annual tree audits, and track carbon credit issuance clearly.
        </Text>
        <Text className="mt-4" style={{color: COLORS.DARK_SLATE}}>
          Version {DeviceInfo.getVersion()} build {DeviceInfo.getBuildNumber()}
        </Text>
        <Text className="mt-2" style={{color: COLORS.DISABLED_GREY}}>
          support@terratrust.app
        </Text>
      </BottomSheet>
    </View>
  );
};

export default ProfileScreen;