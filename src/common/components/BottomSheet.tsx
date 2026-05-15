import React from 'react';
import {View, Modal, Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS} from '../constants/colors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const BottomSheet = ({visible, onClose, children}: BottomSheetProps) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="bg-white rounded-t-[28px] px-6 pt-4"
          style={{paddingBottom: Math.max(insets.bottom + 18, 28)}}>
          <View
            style={{
              width: 40,
              height: 5,
              backgroundColor: COLORS.DISABLED_GREY,
              borderRadius: 999,
              alignSelf: 'center',
              marginBottom: 12,
            }}
          />
          {children}
        </View>
      </View>
    </Modal>
  );
};

export default BottomSheet;
