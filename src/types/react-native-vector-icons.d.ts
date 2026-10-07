declare module '@react-native-vector-icons/material-design-icons' {
  import type {ComponentType} from 'react';
  import type {TextProps} from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export const MaterialDesignIcons: ComponentType<IconProps>;
}