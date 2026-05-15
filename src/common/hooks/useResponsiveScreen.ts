import {useContext, useMemo} from 'react';
import {useWindowDimensions} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

export function useResponsiveScreen() {
  const {width, height} = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  const topInset = insets?.top ?? 0;
  const bottomInset = insets?.bottom ?? 0;

  return useMemo(() => {
    const horizontalPadding = width >= 768 ? 32 : width >= 400 ? 24 : 16;
    const contentMaxWidth = width >= 1024 ? 600 : width >= 768 ? 560 : 520;
    const compactHeight = height < 700;

    return {
      width,
      height,
      horizontalPadding,
      contentMaxWidth,
      topSpacing: topInset + (compactHeight ? 12 : 20),
      bottomSpacing: Math.max(bottomInset + 16, 24),
      compactHeight,
    };
  }, [bottomInset, height, topInset, width]);
}

