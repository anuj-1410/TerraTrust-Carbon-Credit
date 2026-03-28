import React from 'react';
import {View, Text, Modal} from 'react-native';
import LottieView from 'lottie-react-native';

interface LoaderProps {
  size?: number;
  overlay?: boolean;
  message?: string;
}

const Loader = ({size = 120, overlay = false, message}: LoaderProps) => {
  if (overlay) {
    return (
      <Modal transparent visible>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <LottieView
            source={require('../../assets/lottie/spinning_leaf.json')}
            autoPlay
            loop
            style={{width: 80, height: 80}}
          />
          {message && (
            <Text style={{color: 'white', marginTop: 12, fontSize: 14}}>
              {message}
            </Text>
          )}
        </View>
      </Modal>
    );
  }

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
