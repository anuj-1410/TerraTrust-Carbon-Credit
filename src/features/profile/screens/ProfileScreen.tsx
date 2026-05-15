import React, {useMemo, useState} from 'react';
import {Alert, Linking, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';

type ProfileNav = NativeStackNavigationProp<
  ProfileStackParamList,
  'ProfileScreen'
>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

const privacyUrl = 'https://terratrust.app/privacy';
const supportUrl = 'mailto:support@terratrust.app?subject=TerraTrust%20support';

function ProfileActionRow({
  icon,
  label,
  detail,
  tone = 'default',
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  detail?: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const iconColor =
    tone === 'danger' ? COLORS.ERROR_RED : COLORS.FOREST_GREEN;
  const labelColor =
    tone === 'danger' ? COLORS.ERROR_RED : COLORS.DARK_SLATE;

  return (
    <TouchableOpacity
      className="min-h-[56px] flex-row items-center rounded-2xl px-3 py-2"
      style={{backgroundColor: tone === 'danger' ? '#FEF2F2' : '#F8FBF8'}}
      onPress={onPress}
      activeOpacity={0.72}>
      <View
        className="mr-3 h-11 w-11 items-center justify-center rounded-2xl"
        style={{backgroundColor: `${iconColor}18`}}>
        <MaterialCommunityIcons color={iconColor} name={icon} size={21} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold" style={{color: labelColor}}>
          {label}
        </Text>
        {detail ? (
          <Text className="mt-0.5 text-sm leading-5" style={{color: COLORS.DISABLED_GREY}}>
            {detail}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons
        color={tone === 'danger' ? COLORS.ERROR_RED : COLORS.DISABLED_GREY}
        name="chevron-right"
        size={22}
      />
    </TouchableOpacity>
  );
}

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileNav>();
  const rootNavigation = useNavigation<RootNav>();
  const dispatch = useAppDispatch();
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();
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
            try {
              await signOutFirebase();
            } finally {
              clearPersistedAppStatePreserveOnboarding();
              dispatch(resetAppState());
              rootNavigation.reset({index: 0, routes: [{name: 'LoginScreen'}]});
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          alignSelf: 'center',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
          paddingBottom: bottomSpacing,
        }}>
        <Text className="text-3xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          My Profile
        </Text>
        <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
          Manage your account, wallet, notifications, and recovery options from one place.
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
              className="mt-4 min-h-[48px] flex-row items-center self-start"
              onPress={() => void Linking.openURL(`https://amoy.polygonscan.com/address/${walletAddress}`)}>
              <Text style={{color: COLORS.TEAL}}>View on PolygonScan</Text>
              <MaterialCommunityIcons
                color={COLORS.TEAL}
                name="open-in-new"
                size={16}
                style={{marginLeft: 6}}
              />
            </TouchableOpacity>
          ) : null}
        </Card>

        <Card className="mt-4 gap-4">
          <ProfileActionRow
            icon="cog-outline"
            label="Settings"
            detail="Notifications, GPS preferences, and app options"
            onPress={() => navigation.navigate('SettingsScreen')}
          />
          <ProfileActionRow
            icon="bell-outline"
            label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            detail="Review audit updates and recovery alerts"
            onPress={() => rootNavigation.navigate('NotificationsScreen')}
          />
          <ProfileActionRow
            icon="shield-account-outline"
            label="Privacy Policy"
            detail="See how TerraTrust handles your personal data"
            onPress={() => void Linking.openURL(privacyUrl)}
          />
          <ProfileActionRow
            icon="lifebuoy"
            label="Help & Support"
            detail="Contact the TerraTrust team for assistance"
            onPress={() => void Linking.openURL(supportUrl)}
          />
          <ProfileActionRow
            icon="information-outline"
            label="About TerraTrust"
            detail="Version details and project information"
            onPress={() => setShowAboutSheet(true)}
          />
        </Card>

        <Card className="mt-4 gap-4">
          <ProfileActionRow
            icon="key-change"
            label={`Wallet Recovery${walletRecoveryPending ? ' (Pending)' : ''}`}
            detail="Only use this if you changed your phone"
            tone="danger"
            onPress={() => navigation.navigate('WalletRecoveryScreen')}
          />
          <ProfileActionRow
            icon="logout"
            label="Log Out"
            detail="Sign out of this device"
            tone="danger"
            onPress={handleLogout}
          />
        </Card>
      </ScrollView>

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
