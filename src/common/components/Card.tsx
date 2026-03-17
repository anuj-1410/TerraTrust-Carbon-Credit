import React from 'react';
import {View, type ViewProps} from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

const Card = ({children, className, ...props}: CardProps) => {
  return (
    <View
      className={`bg-white rounded-xl p-4 shadow-sm ${className ?? ''}`}
      {...props}>
      {children}
    </View>
  );
};

export default Card;
