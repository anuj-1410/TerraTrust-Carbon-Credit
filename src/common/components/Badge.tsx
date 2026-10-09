import { useTheme } from '../theme/theme';
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';

type BadgeVariant =
  | 'verified'
  | 'pending'
  | 'rejected'
  | 'high-precision'
  | 'standard-precision'
  | 'manual';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

const Badge = ({ label, variant }: BadgeProps) => {
  const { colors: COLORS } = useTheme();
  const variantStyles: Record<
    BadgeVariant,
    {
      container: { backgroundColor: string; borderColor: string };
      text: { color: string };
      icon: string;
    }
  > = {
    verified: {
      container: {
        backgroundColor: COLORS.SUCCESS_SURFACE,
        borderColor: COLORS.BORDER,
      },
      text: { color: COLORS.FOREST_GREEN },
      icon: 'check-circle-outline',
    },
    pending: {
      container: {
        backgroundColor: COLORS.WARNING_SURFACE,
        borderColor: COLORS.BORDER,
      },
      text: { color: COLORS.WARNING_ORANGE },
      icon: 'progress-clock',
    },
    rejected: {
      container: {
        backgroundColor: COLORS.ERROR_SURFACE,
        borderColor: COLORS.BORDER,
      },
      text: { color: COLORS.ERROR_RED },
      icon: 'close-circle-outline',
    },
    'high-precision': {
      container: {
        backgroundColor: COLORS.INFO_SURFACE,
        borderColor: COLORS.BORDER,
      },
      text: { color: COLORS.TEAL },
      icon: 'crosshairs-gps',
    },
    'standard-precision': {
      container: {
        backgroundColor: COLORS.WARNING_SURFACE,
        borderColor: COLORS.BORDER,
      },
      text: { color: COLORS.WARNING_ORANGE },
      icon: 'tune',
    },
    manual: {
      container: {
        backgroundColor: COLORS.INPUT_BACKGROUND,
        borderColor: COLORS.BORDER,
      },
      text: { color: COLORS.DISABLED_GREY },
      icon: 'ruler',
    },
  };

  const styles = variantStyles[variant];
  return (
    <View
      className="flex-row items-center rounded-full border px-3 py-1.5"
      style={styles.container}
    >
      <MaterialCommunityIcons
        color={styles.text.color}
        name={styles.icon}
        size={13}
      />
      <Text className="ml-1.5 text-xs font-medium" style={styles.text}>
        {label}
      </Text>
    </View>
  );
};

export default Badge;
