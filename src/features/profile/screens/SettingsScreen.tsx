import React from 'react';
import {Switch, Text, TouchableOpacity, View} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  setGpsHighAccuracy,
  setNotificationsEnabled,
} from '../store/profileSlice';
import {clearCachedSatelliteImages} from '../../land/store/landSlice';
import {showBanner} from '../../../store/uiSlice';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SettingsScreen'>;

const SettingsScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const notificationsEnabled = useAppSelector(
    state => state.profile.notificationsEnabled,
  );
  const gpsHighAccuracy = useAppSelector(state => state.profile.gpsHighAccuracy);

  return (
    <View className="flex-1 px-4 pt-12" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <View className="flex-row items-center">
        <TouchableOpacity
          className="min-h-[48px] min-w-[48px] items-center justify-center"
          onPress={() => navigation.goBack()}>
          <Text className="text-2xl" style={{color: COLORS.DARK_SLATE}}>←</Text>
        </TouchableOpacity>
        <Text className="ml-3 text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          Settings
        </Text>
      </View>

      <Card className="mt-5 gap-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text style={{color: COLORS.DARK_SLATE}}>Notifications</Text>
            <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
              Enable audit, sync, and credit alerts.
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={value => {
              dispatch(setNotificationsEnabled(value));
            }}
            trackColor={{true: COLORS.FOREST_GREEN}}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text style={{color: COLORS.DARK_SLATE}}>GPS High Accuracy Mode</Text>
            <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
              Uses more battery but improves zone arrival detection.
            </Text>
          </View>
          <Switch
            value={gpsHighAccuracy}
            onValueChange={value => {
              dispatch(setGpsHighAccuracy(value));
            }}
            trackColor={{true: COLORS.FOREST_GREEN}}
          />
        </View>

        <View>
          <Text style={{color: COLORS.DARK_SLATE}}>Offline Mode</Text>
          <Text className="mt-1 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
            Scanning and GPS navigation work without internet. Document upload and audit submission require a connection.
          </Text>
        </View>
      </Card>

      <Card className="mt-4 gap-4">
        <Text className="text-sm font-semibold uppercase" style={{color: COLORS.DISABLED_GREY}}>
          Data
        </Text>
        <TouchableOpacity
          className="min-h-[48px] justify-center"
          onPress={() => {
            dispatch(clearCachedSatelliteImages());
            dispatch(
              showBanner({
                message: 'Cached satellite images cleared.',
                type: 'info',
              }),
            );
          }}>
          <Text style={{color: COLORS.DARK_SLATE}}>Clear Cached Satellite Images</Text>
        </TouchableOpacity>
        <View>
          <Text style={{color: COLORS.DARK_SLATE}}>App Version</Text>
          <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
            {DeviceInfo.getVersion()} build {DeviceInfo.getBuildNumber()}
          </Text>
        </View>
      </Card>
    </View>
  );
};

export default SettingsScreen;