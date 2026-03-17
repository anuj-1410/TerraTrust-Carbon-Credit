import React from 'react';
import {View} from 'react-native';
import LottieView from 'lottie-react-native';

interface LoaderProps {
  size?: number;
}

const Loader = ({size = 120}: LoaderProps) => {
  return (
    <View className="flex-1 items-center justify-center">
      <LottieView
        source={require('../../assets/lottie/spinning_leaf.json')}
        autoPlay
        loop
        style={{width: size, height: size}}
      />
    </View>
  );
};

export default Loader;
