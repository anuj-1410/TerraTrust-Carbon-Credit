import React from 'react';
import {TouchableOpacity, Text, type TouchableOpacityProps} from 'react-native';
import {COLORS} from '../constants/colors';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
}

const Button = ({label, variant = 'primary', className, ...props}: ButtonProps) => {
  const baseClasses = 'h-[52px] px-6 rounded-[12px] items-center justify-center';
  const variantStyles = {
    primary: {backgroundColor: COLORS.FOREST_GREEN},
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.FOREST_GREEN,
    },
    destructive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.ERROR_RED,
    },
  };
  const textStyles = {
    primary: {color: COLORS.CARD_WHITE},
    secondary: {color: COLORS.FOREST_GREEN},
    destructive: {color: COLORS.ERROR_RED},
  };

  return (
    <TouchableOpacity
      className={`${baseClasses} ${className ?? ''}`}
      style={variantStyles[variant]}
      activeOpacity={0.7}
      {...props}>
      <Text className="text-base font-semibold" style={textStyles[variant]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default Button;
