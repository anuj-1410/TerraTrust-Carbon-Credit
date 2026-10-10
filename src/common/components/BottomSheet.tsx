import { useTheme } from '../theme/theme';
import React from 'react';
import { View, ScrollView } from 'react-native';
import SheetModal from './SheetModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const BottomSheet = ({ visible, onClose, children }: BottomSheetProps) => {
  const { colors: COLORS } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SheetModal visible={visible} onRequestClose={onClose}>
      <View
        className="self-center rounded-t-[32px] border border-b-0 bg-surface px-6 pt-4"
        style={{
          width: '100%',
          maxWidth: 560,
          borderColor: COLORS.BORDER,
          backgroundColor: COLORS.CARD_WHITE,
          paddingBottom: Math.max(insets.bottom + 18, 28),
          flexShrink: 1,
          maxHeight: '100%',
        }}
      >
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{ flexGrow: 0, flexShrink: 1 }}
        >
          {children}
        </ScrollView>
      </View>
    </SheetModal>
  );
};

export default BottomSheet;
