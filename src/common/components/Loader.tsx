import React from 'react';
import {View, Text, Modal} from 'react-native';
import LottieView from 'lottie-react-native';
import {COLORS} from '../constants/colors';

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
            backgroundColor: 'rgba(15, 23, 20, 0.34)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View
            style={{
              minWidth: 180,
              alignItems: 'center',
              borderRadius: 24,
              backgroundColor: COLORS.CARD_WHITE,
              paddingHorizontal: 24,
              paddingVertical: 20,
            }}>
            <LottieView
              source={require('../../assets/lottie/spinning_leaf.json')}
              autoPlay
              loop
              style={{width: 84, height: 84}}
            />
            {message && (
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: COLORS.DARK_SLATE,
                  textAlign: 'center',
                }}>
                {message}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{backgroundColor: COLORS.OFF_WHITE}}>
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
