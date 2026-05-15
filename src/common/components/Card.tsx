import React from 'react';
import {View, type ViewProps} from 'react-native';
import {COLORS} from '../constants/colors';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

const Card = ({children, className, style, ...props}: CardProps) => {
  return (
    <View
      className={`rounded-3xl border p-4 ${className ?? ''}`}
      style={[
        {
          backgroundColor: COLORS.CARD_WHITE,
          borderColor: '#E6ECE7',
          shadowColor: '#102A22',
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: {width: 0, height: 6},
          elevation: 2,
        },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
};

export default Card;
