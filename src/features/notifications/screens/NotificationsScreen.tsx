import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';

import Card from '../../../common/components/Card';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../store/notificationsSlice';
import type { RootStackParamList } from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotificationsScreen'>;

type NotificationIconName =
  | 'cash-multiple'
  | 'progress-clock'
  | 'alert-circle-outline'
  | 'calendar-alert'
  | 'map-check-outline'
  | 'wallet-plus-outline';

const NOTIFICATION_ICON: Record<
  NotificationItem['type'],
  NotificationIconName
> = {
  credits_ready: 'cash-multiple',
  audit_submitted: 'progress-clock',
  audit_failed: 'alert-circle-outline',
  audit_due: 'calendar-alert',
  land_registration_complete: 'map-check-outline',
  wallet_recovery: 'wallet-plus-outline',
};

function formatNotificationTimestamp(createdAt: string): string {
  const timestamp = new Date(createdAt);

  if (Number.isNaN(timestamp.getTime())) {
    return createdAt;
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 60) {
    const minutes = Math.max(diffMinutes, 1);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  if (diffHours < 48) {
    return 'Yesterday';
  }

  return timestamp.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year:
      timestamp.getFullYear() === new Date(now).getFullYear()
        ? undefined
        : 'numeric',
  });
}

const NotificationsScreen = () => {
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { horizontalPadding, bottomSpacing, contentMaxWidth } =
    useResponsiveScreen();
  const items = useAppSelector(state =>
    [...state.notifications.notifications].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    ),
  );
  const unreadCount = items.filter(item => !item.read).length;

  const openNotification = (item: NotificationItem) => {
    dispatch(markNotificationRead(item.id));

    if (item.auditId) {
      navigation.replace('AuditStatusScreen', { auditId: item.auditId });
      return;
    }

    if (item.landId) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'HomeScreen',
            params: {
              screen: 'LandTab',
              params: {
                screen: 'LandDetailScreen',
                params: { landId: item.landId },
              },
            },
          },
        ],
      });
      return;
    }

    navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <ScreenHeader
        title="Notifications"
        eyebrow="Inbox"
        onBack={() => navigation.goBack()}
        backIcon="close"
      />
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: bottomSpacing,
        }}
      >
        <Card className="mt-6 px-5 py-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text
                className="text-sm font-semibold uppercase tracking-[1.3px]"
                style={{ color: COLORS.DISABLED_GREY }}
              >
                Summary
              </Text>
              <Text
                className="mt-1 text-lg font-semibold"
                style={{ color: COLORS.DARK_SLATE }}
              >
                {unreadCount > 0
                  ? `${unreadCount} unread notification${
                      unreadCount === 1 ? '' : 's'
                    }`
                  : 'Everything is up to date'}
              </Text>
            </View>
            {items.length > 0 ? (
              <TouchableOpacity
                className="min-h-[44px] rounded-full px-4 items-center justify-center"
                style={{ backgroundColor: COLORS.INFO_SURFACE }}
                onPress={() => dispatch(markAllNotificationsRead())}
                activeOpacity={0.78}
              >
                <Text className="font-semibold" style={{ color: COLORS.TEAL }}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>

        <View style={{ paddingTop: 20 }}>
          {items.length === 0 ? (
            <Card className="mt-10 items-center px-8 py-10">
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: COLORS.SUCCESS_SURFACE }}
              >
                <MaterialCommunityIcons
                  color={COLORS.FOREST_GREEN}
                  name="bell-outline"
                  size={28}
                />
              </View>
              <Text
                className="mt-5 text-xl font-semibold"
                style={{ color: COLORS.DARK_SLATE }}
              >
                No notifications yet
              </Text>
              <Text
                className="mt-3 text-center leading-6"
                style={{ color: COLORS.DISABLED_GREY }}
              >
                We will show audit processing, land verification, and credit
                updates here.
              </Text>
            </Card>
          ) : (
            items.map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => openNotification(item)}
                activeOpacity={0.82}
              >
                <Card
                  className="mb-3 px-4 py-4"
                  style={{
                    borderColor: COLORS.BORDER,
                    backgroundColor: item.read
                      ? COLORS.CARD_WHITE
                      : COLORS.SUCCESS_SURFACE,
                  }}
                >
                  <View className="flex-row items-start">
                    <View
                      className="mr-4 mt-0.5 h-12 w-12 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: item.read
                          ? COLORS.INPUT_BACKGROUND
                          : COLORS.SUCCESS_SURFACE,
                      }}
                    >
                      <MaterialCommunityIcons
                        color={
                          item.read ? COLORS.DISABLED_GREY : COLORS.FOREST_GREEN
                        }
                        name={NOTIFICATION_ICON[item.type]}
                        size={20}
                      />
                    </View>
                    <View className="flex-1 pr-4">
                      <Text
                        className="text-base font-semibold"
                        style={{ color: COLORS.DARK_SLATE }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        className="mt-2 leading-6"
                        style={{ color: COLORS.DISABLED_GREY }}
                      >
                        {item.body}
                      </Text>
                      <Text
                        className="mt-3 text-xs"
                        style={{ color: COLORS.DISABLED_GREY }}
                      >
                        {formatNotificationTimestamp(item.createdAt)}
                      </Text>
                    </View>
                    <View className="items-end">
                      {!item.read ? (
                        <View
                          className="mb-3 h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: COLORS.ERROR_RED }}
                        />
                      ) : (
                        <View className="mb-3 h-2.5 w-2.5" />
                      )}
                      <MaterialCommunityIcons
                        color={COLORS.DISABLED_GREY}
                        name="chevron-right"
                        size={22}
                      />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default NotificationsScreen;
