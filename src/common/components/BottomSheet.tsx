import React from 'react';
import {View, Modal, Pressable} from 'react-native';

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
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />
      <View className="bg-white rounded-t-2xl p-6 pb-10">
        {children}
      </View>
    </Modal>
  );
};

export default BottomSheet;
