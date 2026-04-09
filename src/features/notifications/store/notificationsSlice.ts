import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

const MAX_NOTIFICATIONS = 50;

export type NotificationType =
  | 'credits_ready'
  | 'audit_submitted'
  | 'audit_failed'
  | 'audit_due'
  | 'land_registration_complete'
  | 'wallet_recovery';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  auditId?: string;
  landId?: string;
}

export interface NotificationsState {
  notifications: NotificationItem[];
  unreadCount: number;
}

export const notificationsInitialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
};

function updateUnreadCount(state: NotificationsState) {
  state.unreadCount = state.notifications.filter(item => !item.read).length;
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: notificationsInitialState,
  reducers: {
    addNotification(state, action: PayloadAction<NotificationItem>) {
      const existingIndex = state.notifications.findIndex(
        notification => notification.id === action.payload.id,
      );

      if (existingIndex >= 0) {
        state.notifications[existingIndex] = action.payload;
        updateUnreadCount(state);
        return;
      }

      state.notifications.unshift(action.payload);
      state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
      updateUnreadCount(state);
    },
    markNotificationRead(state, action: PayloadAction<string>) {
      const item = state.notifications.find(
        notification => notification.id === action.payload,
      );
      if (item) {
        item.read = true;
        updateUnreadCount(state);
      }
    },
    markAllNotificationsRead(state) {
      state.notifications = state.notifications.map(item => ({
        ...item,
        read: true,
      }));
      updateUnreadCount(state);
    },
    clearNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
} = notificationsSlice.actions;
export default notificationsSlice.reducer;