import React from 'react';
import {View, Text} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPScreen'>;

const OTPScreen = ({route}: Props) => {
  const {phone} = route.params;

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold">OTPScreen</Text>
      <Text className="text-base text-gray-500 mt-2">{phone}</Text>
    </View>
  );
};

export default OTPScreen;
