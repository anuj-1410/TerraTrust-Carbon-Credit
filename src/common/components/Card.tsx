import { useTheme } from '../theme/theme';
import React from 'react';
import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

const Card = ({ children, className, style, ...props }: CardProps) => {
  const { colors: COLORS } = useTheme();
  return (
    <View
      className={`rounded-[28px] border p-4 ${className ?? ''}`}
      style={[
        {
          backgroundColor: COLORS.CARD_WHITE,
          borderColor: COLORS.BORDER,
          shadowColor: '#102A22',
          shadowOpacity: 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 0,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

export default Card;
