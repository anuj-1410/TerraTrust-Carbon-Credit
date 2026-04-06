import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

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
  items: NotificationItem[];
}

export const notificationsInitialState: NotificationsState = {
  items: [],
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: notificationsInitialState,
  reducers: {
    addNotification(state, action: PayloadAction<NotificationItem>) {
      const existingIndex = state.items.findIndex(
        notification => notification.id === action.payload.id,
      );

      if (existingIndex >= 0) {
        state.items[existingIndex] = action.payload;
        return;
      }

      state.items.unshift(action.payload);
    },
    markNotificationRead(state, action: PayloadAction<string>) {
      const item = state.items.find(notification => notification.id === action.payload);
      if (item) {
        item.read = true;
      }
    },
    markAllNotificationsRead(state) {
      state.items = state.items.map(item => ({...item, read: true}));
    },
    clearNotifications(state) {
      state.items = [];
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