import React from 'react';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { MaterialDesignIcons as Icon } from '@react-native-vector-icons/material-design-icons';
import { useResponsiveScreen } from '../hooks/useResponsiveScreen';
import { useTheme } from '../theme/theme';

interface Props {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  backIcon?: 'arrow-left' | 'close';
  backDisabled?: boolean;
  right?: React.ReactNode;
}

/** Render outside scroll content: safe-area aware, fixed, with 48dp controls. */
export default function ScreenHeader({
  title,
  eyebrow,
  onBack,
  backIcon = 'arrow-left',
  backDisabled = false,
  right,
}: Props) {
  const { colors, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, topInset } =
    useResponsiveScreen();
  return (
    <View
      testID="screen-header"
      style={{
        backgroundColor: colors.CARD_WHITE,
        borderBottomColor: colors.BORDER,
        borderBottomWidth: 1,
      }}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View
        style={{
          width: '100%',
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset + 8,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: topInset + 66,
        }}
      >
        {onBack ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              backIcon === 'close' ? 'Close screen' : 'Go back'
            }
            disabled={backDisabled}
            onPress={onBack}
            style={{
              width: 48,
              height: 48,
              marginRight: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={backIcon}
              size={24}
              color={backDisabled ? colors.DISABLED_GREY : colors.DARK_SLATE}
            />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 1,
                marginBottom: 3,
                color: colors.FOREST_GREEN,
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: colors.DARK_SLATE,
            }}
          >
            {title}
          </Text>
        </View>
        {right}
      </View>
    </View>
  );
}
