import React, {useEffect} from 'react';
import {BackHandler, Linking, Text, View} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Button from '../components/Button';
import Card from '../components/Card';
import {COLORS} from '../constants/colors';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {clearMaintenance} from '../../store/uiSlice';
import api from '../../services/api';
import type {RootStackParamList} from '../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MaintenanceScreen'>;

const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.terratrustar';

const MaintenanceScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const maintenanceMessage = useAppSelector(state => state.ui.maintenanceMessage);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    const interval = setInterval(() => {
      void api.get('/api/v1/status').then(response => {
        if (response.data?.maintenance === false) {
          dispatch(clearMaintenance());
          navigation.reset({index: 0, routes: [{name: 'SplashScreen'}]});
        }
      }).catch(() => undefined);
    }, 30000);

    return () => {
      backSubscription.remove();
      clearInterval(interval);
    };
  }, [dispatch, navigation]);

  return (
    <View className="flex-1 items-center justify-center px-6" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <MaterialCommunityIcons color={COLORS.FOREST_GREEN} name="sprout" size={52} />
      <Text className="mt-5 text-3xl font-bold" style={{color: COLORS.DARK_SLATE}}>
        TerraTrust Maintenance
      </Text>

      <Card className="mt-8 w-full">
        <Text className="text-center leading-7" style={{color: COLORS.DARK_SLATE}}>
          {maintenanceMessage ?? 'Scheduled maintenance in progress.'}
        </Text>
        <Text className="mt-4 text-center leading-6" style={{color: COLORS.DISABLED_GREY}}>
          Your data is safe. TerraTrust will reopen automatically when service is restored.
        </Text>
      </Card>

      <View className="mt-8 w-full">
        <Button
          label="Open Play Store"
          onPress={() => void Linking.openURL(playStoreUrl)}
        />
      </View>

      <Text className="mt-6 text-sm" style={{color: COLORS.DISABLED_GREY}}>
        Version {DeviceInfo.getVersion()} build {DeviceInfo.getBuildNumber()}
      </Text>
    </View>
  );
};

export default MaintenanceScreen;