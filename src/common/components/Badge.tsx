import React from 'react';
import {View, Text} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
    icon: string;
  }
> = {
  verified: {
    container: {backgroundColor: 'rgba(47, 133, 90, 0.15)'},
    text: {color: COLORS.FOREST_GREEN},
    icon: 'check-circle-outline',
  },
  pending: {
    container: {backgroundColor: 'rgba(221, 107, 32, 0.15)'},
    text: {color: COLORS.WARNING_ORANGE},
    icon: 'progress-clock',
  },
  rejected: {
    container: {backgroundColor: 'rgba(229, 62, 62, 0.15)'},
    text: {color: COLORS.ERROR_RED},
    icon: 'close-circle-outline',
  },
  'high-precision': {
    container: {backgroundColor: 'rgba(56, 178, 172, 0.15)'},
    text: {color: COLORS.TEAL},
    icon: 'crosshairs-gps',
  },
  'standard-precision': {
    container: {backgroundColor: 'rgba(221, 107, 32, 0.15)'},
    text: {color: COLORS.WARNING_ORANGE},
    icon: 'tune',
  },
  manual: {
    container: {backgroundColor: 'rgba(107, 114, 128, 0.15)'},
    text: {color: COLORS.DISABLED_GREY},
    icon: 'ruler',
  },
};

const Badge = ({label, variant}: BadgeProps) => {
  const styles = variantStyles[variant];
  return (
    <View
      className="flex-row items-center rounded-full px-3 py-1"
      style={styles.container}>
      <MaterialCommunityIcons
        color={styles.text.color}
        name={styles.icon}
        size={12}
      />
      <Text className="text-xs font-medium" style={styles.text}>
        {' '}
        {label}
      </Text>
    </View>
  );
};

export default Badge;
