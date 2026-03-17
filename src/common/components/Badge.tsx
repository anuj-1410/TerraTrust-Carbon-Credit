import React from 'react';
import {View, Text} from 'react-native';

type BadgeVariant = 'verified' | 'pending' | 'rejected';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, {container: string; text: string}> = {
  verified: {container: 'bg-green-100', text: 'text-green-800'},
  pending: {container: 'bg-yellow-100', text: 'text-yellow-800'},
  rejected: {container: 'bg-red-100', text: 'text-red-800'},
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
