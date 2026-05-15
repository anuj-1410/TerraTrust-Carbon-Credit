import React from 'react';
import {TouchableOpacity, Text, type TouchableOpacityProps} from 'react-native';
import {COLORS} from '../constants/colors';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
}

const Button = ({label, variant = 'primary', className, style, ...props}: ButtonProps) => {
  const baseClasses =
    'min-h-[52px] rounded-2xl px-6 items-center justify-center';
  const variantStyles = {
    primary: {
      backgroundColor: COLORS.FOREST_GREEN,
      shadowColor: '#0F3D2E',
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: {width: 0, height: 6},
      elevation: 3,
    },
    secondary: {
      backgroundColor: COLORS.CARD_WHITE,
      borderWidth: 1,
      borderColor: COLORS.FOREST_GREEN,
    },
    destructive: {
      backgroundColor: COLORS.CARD_WHITE,
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
      style={[
        variantStyles[variant],
        props.disabled ? {opacity: 0.55, elevation: 0, shadowOpacity: 0} : null,
        style,
      ]}
      activeOpacity={0.7}
      {...props}>
      <Text className="text-base font-semibold tracking-[0.2px]" style={textStyles[variant]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default Button;
