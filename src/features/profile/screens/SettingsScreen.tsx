import React from 'react';
import {ScrollView, Switch, Text, TouchableOpacity, View} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  setGpsHighAccuracy,
  setNotificationsEnabled,
} from '../store/profileSlice';
import {clearCachedSatelliteImages} from '../../land/store/landSlice';
import {showBanner} from '../../../store/uiSlice';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SettingsScreen'>;

function SettingsRow({
  title,
  description,
  right,
}: {
  title: string;
  description: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-4">
        <Text className="text-base font-semibold" style={{color: COLORS.DARK_SLATE}}>
          {title}
        </Text>
        <Text className="mt-1 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
          {description}
        </Text>
      </View>
      {right}
    </View>
  );
}

const SettingsScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();
  const notificationsEnabled = useAppSelector(
    state => state.profile.settingsNotificationsEnabled,
  );
  const gpsHighAccuracy = useAppSelector(
    state => state.profile.settingsHighAccuracyGPS,
  );

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
          paddingBottom: bottomSpacing,
        }}>
        <View className="flex-row items-center">
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full"
            style={{backgroundColor: COLORS.CARD_WHITE}}
            onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons
              color={COLORS.DARK_SLATE}
              name="arrow-left"
              size={22}
            />
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <Text
              className="text-[13px] font-semibold uppercase tracking-[1.4px]"
              style={{color: COLORS.FOREST_GREEN}}>
              Preferences
            </Text>
            <Text className="mt-1 text-3xl font-bold" style={{color: COLORS.DARK_SLATE}}>
              Settings
            </Text>
          </View>
        </View>

        <Text className="mt-4 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
          Control notifications, GPS accuracy, offline behavior, and app data
          from one place.
        </Text>

        <Card className="mt-6 gap-6 px-5 py-5">
          <SettingsRow
            title="Notifications"
            description="Enable audit, sync, and carbon-credit alerts."
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={value => {
                  dispatch(setNotificationsEnabled(value));
                }}
                trackColor={{true: COLORS.FOREST_GREEN}}
              />
            }
          />

          <SettingsRow
            title="GPS High Accuracy Mode"
            description="Uses more battery but improves zone arrival detection in the field."
            right={
              <Switch
                value={gpsHighAccuracy}
                onValueChange={value => {
                  dispatch(setGpsHighAccuracy(value));
                }}
                trackColor={{true: COLORS.FOREST_GREEN}}
              />
            }
          />

          <SettingsRow
            title="Offline Mode"
            description="Scanning and GPS navigation work offline. Uploading documents and submitting audits still need a connection."
          />
        </Card>

        <Card className="mt-4 gap-5 px-5 py-5">
          <Text
            className="text-sm font-semibold uppercase tracking-[1.2px]"
            style={{color: COLORS.DISABLED_GREY}}>
            Data
          </Text>

          <TouchableOpacity
            className="rounded-[20px] border px-4 py-4"
            style={{borderColor: '#DCE7DF', backgroundColor: '#F8FBF8'}}
            onPress={() => {
              dispatch(clearCachedSatelliteImages());
              dispatch(
                showBanner({
                  message: 'Cached satellite images cleared.',
                  type: 'info',
                }),
              );
            }}>
            <Text className="text-base font-semibold" style={{color: COLORS.DARK_SLATE}}>
              Clear Cached Satellite Images
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
              Removes saved parcel thumbnails so the app can fetch a fresh copy later.
            </Text>
          </TouchableOpacity>

          <View>
            <Text className="text-base font-semibold" style={{color: COLORS.DARK_SLATE}}>
              App Version
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
              {DeviceInfo.getVersion()} build {DeviceInfo.getBuildNumber()}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
