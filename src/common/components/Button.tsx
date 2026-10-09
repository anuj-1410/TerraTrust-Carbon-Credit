import { useTheme } from '../theme/theme';
import React from 'react';
import {
  TouchableOpacity,
  Text,
  type TouchableOpacityProps,
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
}

const Button = ({
  label,
  variant = 'primary',
  className,
  style,
  ...props
}: ButtonProps) => {
  const { colors: COLORS } = useTheme();
  const baseClasses =
    'min-h-[54px] rounded-[22px] px-6 items-center justify-center';
  const variantStyles = {
    primary: {
      backgroundColor: COLORS.BUTTON_BACKGROUND,
      shadowColor: '#0F3D2E',
      shadowOpacity: 0,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 0,
    },
    secondary: {
      backgroundColor: COLORS.CARD_WHITE,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    destructive: {
      backgroundColor: COLORS.CARD_WHITE,
      borderWidth: 1,
      borderColor: COLORS.ERROR_RED,
    },
  };
  const textStyles = {
    primary: { color: COLORS.ON_PRIMARY, fontFamily: 'Roboto-Regular' },
    secondary: { color: COLORS.FOREST_GREEN, fontFamily: 'Roboto-Regular' },
    destructive: { color: COLORS.ERROR_RED, fontFamily: 'Roboto-Regular' },
  };

  return (
    <TouchableOpacity
      className={`${baseClasses} ${className ?? ''}`}
      style={[
        variantStyles[variant],
        props.disabled
          ? {
              opacity: 0.58,
              elevation: 0,
              shadowOpacity: 0,
            }
          : null,
        style,
      ]}
      activeOpacity={0.82}
      {...props}
    >
      <Text
        className="text-base font-semibold tracking-[0.2px]"
        style={textStyles[variant]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default Button;
