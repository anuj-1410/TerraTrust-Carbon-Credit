import React from 'react';
import {View, Text} from 'react-native';

const HomeScreen = () => {
  return (
    <View className="flex-1 bg-green-900 items-center justify-center">
      <Text className="text-white text-2xl font-bold">TerraTrust AR</Text>
      <Text className="text-green-300 text-base mt-2">HomeScreen</Text>
    </View>
  );
};

export default HomeScreen;
