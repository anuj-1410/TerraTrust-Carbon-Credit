import React from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../store/notificationsSlice';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotificationsScreen'>;

type NotificationIconName =
  | 'cash-multiple'
  | 'progress-clock'
  | 'alert-circle-outline'
  | 'calendar-alert'
  | 'map-check-outline'
  | 'wallet-plus-outline';

const NOTIFICATION_ICON: Record<NotificationItem['type'], NotificationIconName> = {
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
    year: timestamp.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  });
}

const NotificationsScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const items = useAppSelector(state =>
    [...state.notifications.notifications].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  );

  const openNotification = (item: NotificationItem) => {
    dispatch(markNotificationRead(item.id));

    if (item.auditId) {
      navigation.replace('AuditStatusScreen', {auditId: item.auditId});
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
                params: {landId: item.landId},
              },
            },
          },
        ],
      });
      return;
    }

    navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]});
  };

  return (
    <View className="flex-1 px-4 pt-12" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          className="min-h-[48px] min-w-[48px] items-center justify-center"
          onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            color={COLORS.DARK_SLATE}
            name="close"
            size={24}
          />
        </TouchableOpacity>
        <Text className="text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          Notifications
        </Text>
        <TouchableOpacity
          className="min-h-[48px] min-w-[48px] items-center justify-center"
          onPress={() => dispatch(markAllNotificationsRead())}>
          <Text style={{color: COLORS.TEAL}}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{paddingTop: 20, paddingBottom: 24}}>
        {items.length === 0 ? (
          <View className="mt-20 items-center px-8">
            <Text className="text-xl font-semibold" style={{color: COLORS.DARK_SLATE}}>
              No notifications yet
            </Text>
            <Text className="mt-3 text-center leading-6" style={{color: COLORS.DISABLED_GREY}}>
              We will show audit processing, land verification, and credit updates here.
            </Text>
          </View>
        ) : (
          items.map(item => (
            <TouchableOpacity key={item.id} onPress={() => openNotification(item)} activeOpacity={0.75}>
              <Card className="mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="mr-3 mt-1 h-10 w-10 items-center justify-center rounded-full" style={{backgroundColor: 'rgba(47,133,90,0.12)'}}>
                    <MaterialCommunityIcons
                      color={item.read ? COLORS.DISABLED_GREY : COLORS.FOREST_GREEN}
                      name={NOTIFICATION_ICON[item.type]}
                      size={20}
                    />
                  </View>
                  <View className="flex-1 pr-4">
                    <Text className="text-base font-semibold" style={{color: COLORS.DARK_SLATE}}>
                      {item.title}
                    </Text>
                    <Text className="mt-2 leading-6" style={{color: COLORS.DISABLED_GREY}}>
                      {item.body}
                    </Text>
                    <Text className="mt-3 text-xs" style={{color: COLORS.DISABLED_GREY}}>
                      {formatNotificationTimestamp(item.createdAt)}
                    </Text>
                  </View>
                  {!item.read ? (
                    <View className="mt-2 h-2.5 w-2.5 rounded-full" style={{backgroundColor: '#DC2626'}} />
                  ) : null}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default NotificationsScreen;