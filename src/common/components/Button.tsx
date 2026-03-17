import React from 'react';
import {TouchableOpacity, Text, type TouchableOpacityProps} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

const Button = ({label, variant = 'primary', className, ...props}: ButtonProps) => {
  const baseClasses = 'h-12 px-6 rounded-lg items-center justify-center';
  const variantClasses = {
    primary: 'bg-green-700',
    secondary: 'bg-neutral-600',
    outline: 'border border-green-700 bg-transparent',
  };
  const textClasses = {
    primary: 'text-white font-semibold text-base',
    secondary: 'text-white font-semibold text-base',
    outline: 'text-green-700 font-semibold text-base',
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
