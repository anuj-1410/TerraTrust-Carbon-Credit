import React, {useEffect} from 'react';
import {BackHandler, View, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';

import Button from '../../../common/components/Button';
import {COLORS} from '../../../common/constants/colors';
import {hectaresToAcres} from '../../../common/utils/units';
import {useAppSelector} from '../../../store/hooks';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LandRegistrationSuccessScreen'>;
type RouteType = RouteProp<RootStackParamList, 'LandRegistrationSuccessScreen'>;

const LandRegistrationSuccessScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const parcel = useAppSelector(state =>
    state.land.parcels.find(item => item.id === route.params.landId),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{name: 'HomeScreen', params: {screen: 'LandTab'}}],
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );

    return () => subscription.remove();
  }, []);

  return (
    <View className="flex-1 items-center justify-center px-6" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <LottieView
        source={require('../../../assets/lottie/scan_success.json')}
        autoPlay
        loop={false}
        style={{width: 220, height: 220}}
      />
      <Text className="mt-2 text-3xl font-bold" style={{color: COLORS.FOREST_GREEN}}>
        Land Registered!
      </Text>
      <Text className="mt-4 text-center text-base leading-7" style={{color: COLORS.DARK_SLATE}}>
        {parcel?.farm_name ?? 'Your land'} has been verified using official government records.
      </Text>
      {parcel ? (
        <Text className="mt-3 text-lg font-semibold" style={{color: COLORS.DARK_SLATE}}>
          {hectaresToAcres(parcel.area_hectares).toFixed(2)} acres
        </Text>
      ) : null}
      <Text className="mt-3 text-center" style={{color: COLORS.DISABLED_GREY}}>
        You can now start your annual audit for this land.
      </Text>
      <View className="mt-8 w-full">
        <Button
          label="Go to My Lands"
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{name: 'HomeScreen', params: {screen: 'LandTab'}}],
            })
          }
        />
      </View>
    </View>
  );
};

export default LandRegistrationSuccessScreen;