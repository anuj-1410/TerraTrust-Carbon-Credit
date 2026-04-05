import React from 'react';
import {View, Modal, Pressable} from 'react-native';
import {COLORS} from '../constants/colors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const BottomSheet = ({visible, onClose, children}: BottomSheetProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-[24px] p-6 pb-10">
          <View
            style={{
              width: 32,
              height: 4,
              backgroundColor: COLORS.DISABLED_GREY,
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 8,
            }}
          />
          {children}
        </View>
      </View>
    </Modal>
  );
};

export default BottomSheet;
