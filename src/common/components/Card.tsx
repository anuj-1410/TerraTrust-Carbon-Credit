import React from 'react';
import {View, type ViewProps} from 'react-native';
import {COLORS} from '../constants/colors';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

const Card = ({children, className, style, ...props}: CardProps) => {
  return (
    <View
      className={`rounded-[28px] border p-4 ${className ?? ''}`}
      style={[
        {
          backgroundColor: COLORS.CARD_WHITE,
          borderColor: '#DCE7DF',
          shadowColor: '#102A22',
          shadowOpacity: 0.07,
          shadowRadius: 16,
          shadowOffset: {width: 0, height: 8},
          elevation: 3,
        },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
};

export default Card;
