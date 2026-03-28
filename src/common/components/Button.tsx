import React from 'react';
import {TouchableOpacity, Text, type TouchableOpacityProps} from 'react-native';
import {COLORS} from '../constants/colors';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
}

const Button = ({label, variant = 'primary', className, ...props}: ButtonProps) => {
  const baseClasses = 'h-[52px] px-6 rounded-[12px] items-center justify-center';
  const variantClasses = {
    primary: `bg-[${COLORS.FOREST_GREEN}]`,
    secondary: `border border-[${COLORS.FOREST_GREEN}] bg-transparent`,
    destructive: `bg-[${COLORS.ERROR_RED}]`,
  };
  const textClasses = {
    primary: 'text-white font-semibold text-base',
    secondary: `text-[${COLORS.FOREST_GREEN}] font-semibold text-base`,
    destructive: 'text-white font-semibold text-base',
  };

  return (
    <TouchableOpacity
      className={`${baseClasses} ${variantClasses[variant]} ${className ?? ''}`}
      activeOpacity={0.7}
      {...props}>
      <Text className={textClasses[variant]}>{label}</Text>
    </TouchableOpacity>
  );
};

export default Button;
