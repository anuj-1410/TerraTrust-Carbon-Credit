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

const variantClasses: Record<BadgeVariant, {container: string; text: string}> = {
  verified: {container: `bg-[${COLORS.FOREST_GREEN}]/15`, text: `text-[${COLORS.FOREST_GREEN}]`},
  pending: {container: `bg-[${COLORS.WARNING_ORANGE}]/15`, text: `text-[${COLORS.WARNING_ORANGE}]`},
  rejected: {container: `bg-[${COLORS.ERROR_RED}]/15`, text: `text-[${COLORS.ERROR_RED}]`},
  'high-precision': {container: `bg-[${COLORS.TEAL}]/15`, text: `text-[${COLORS.TEAL}]`},
  'standard-precision': {container: `bg-[${COLORS.WARNING_ORANGE}]/15`, text: `text-[${COLORS.WARNING_ORANGE}]`},
  manual: {container: `bg-[${COLORS.WARNING_ORANGE}]/15`, text: `text-[${COLORS.WARNING_ORANGE}]`},
};

const Badge = ({label, variant}: BadgeProps) => {
  const styles = variantClasses[variant];
  return (
    <View className={`px-3 py-1 rounded-full ${styles.container}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{label}</Text>
    </View>
  );
};

export default Badge;
