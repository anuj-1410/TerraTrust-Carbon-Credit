import React from 'react';
import {View, Text} from 'react-native';
import {COLORS} from '../constants/colors';

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

const variantStyles: Record<
  BadgeVariant,
  {
    container: {backgroundColor: string};
    text: {color: string};
  }
> = {
  verified: {
    container: {backgroundColor: 'rgba(47, 133, 90, 0.15)'},
    text: {color: COLORS.FOREST_GREEN},
  },
  pending: {
    container: {backgroundColor: 'rgba(221, 107, 32, 0.15)'},
    text: {color: COLORS.WARNING_ORANGE},
  },
  rejected: {
    container: {backgroundColor: 'rgba(229, 62, 62, 0.15)'},
    text: {color: COLORS.ERROR_RED},
  },
  'high-precision': {
    container: {backgroundColor: 'rgba(56, 178, 172, 0.15)'},
    text: {color: COLORS.TEAL},
  },
  'standard-precision': {
    container: {backgroundColor: 'rgba(221, 107, 32, 0.15)'},
    text: {color: COLORS.WARNING_ORANGE},
  },
  manual: {
    container: {backgroundColor: 'rgba(221, 107, 32, 0.15)'},
    text: {color: COLORS.WARNING_ORANGE},
  },
};

const Badge = ({label, variant}: BadgeProps) => {
  const styles = variantStyles[variant];
  return (
    <View className="rounded-full px-3 py-1" style={styles.container}>
      <Text className="text-xs font-medium" style={styles.text}>
        {label}
      </Text>
    </View>
  );
};

export default Badge;
