import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialDesignIcons as Icon } from '@react-native-vector-icons/material-design-icons';
import { COLORS } from '../common/constants/colors';

const ICONS = {
  HomeTab: 'home-outline',
  LandTab: 'sprout-outline',
  HistoryTab: 'chart-timeline-variant',
  ProfileTab: 'account-outline',
} as const;

type TabName = keyof typeof ICONS;

function TabItem({
  name,
  label,
  focused,
  badge,
  onPress,
  onLongPress,
}: {
  name: TabName;
  label: string;
  focused: boolean;
  badge: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      stiffness: 260,
      damping: 24,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      style={{
        flex: 1,
        minWidth: 0,
        height: 62,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: 64,
            height: 48,
            borderRadius: 25,
            backgroundColor: '#E3F2E9',
            opacity: progress,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.65, 1],
                }),
              },
            ],
          }}
        />
        <Animated.View
          style={{
            alignItems: 'center',
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -2],
                }),
              },
            ],
          }}
        >
          <View>
            <Icon
              name={ICONS[name]}
              size={24}
              color={focused ? COLORS.FOREST_GREEN : '#84918C'}
            />
            {badge ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: COLORS.ERROR_RED,
                }}
              />
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              color: focused ? COLORS.FOREST_GREEN : '#84918C',
              fontSize: 10,
              fontWeight: focused ? '700' : '500',
            }}
          >
            {label}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const activeRoute = state.routes[state.index];
  if (
    keyboardVisible ||
    (activeRoute.name === 'ProfileTab' &&
      getFocusedRouteNameFromRoute(activeRoute) === 'WalletRecoveryScreen')
  ) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 82 + insets.bottom,
        paddingHorizontal: 18,
        paddingTop: 7,
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: 'transparent',
      }}
    >
      <BlurView
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        blurType="light"
        blurAmount={18}
        blurRadius={14}
        downsampleFactor={4}
        enabled
        autoUpdate
        overlayColor="rgba(247, 250, 247, 0.16)"
        reducedTransparencyFallbackColor="#F4F7F4"
      />
      <View
        style={{
          height: 64,
          maxWidth: 520,
          width: '100%',
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 36,
          backgroundColor: 'rgba(255, 255, 255, 0.68)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.85)',
          shadowColor: '#173D28',
          shadowOffset: { width: 0, height: 7 },
          shadowOpacity: 0.14,
          shadowRadius: 16,
          elevation: 9,
        }}
      >
        {state.routes.map((route, index) => {
          const name = route.name as TabName;
          const options = descriptors[route.key].options;
          const focused = state.index === index;
          return (
            <TabItem
              key={route.key}
              name={name}
              label={typeof options.title === 'string' ? options.title : name}
              focused={focused}
              badge={Boolean(options.tabBarBadge)}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
            />
          );
        })}
      </View>
    </View>
  );
}
