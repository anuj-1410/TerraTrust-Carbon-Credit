import {combineReducers, configureStore, createAction} from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createMigrate,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import type {PersistConfig} from 'redux-persist';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';
import {mmkvStorage} from './mmkvStorage';
import authReducer from '../features/auth/store/authSlice';
import type {AuthState} from '../features/auth/store/authSlice';
import landReducer from '../features/land/store/landSlice';
import type {LandState} from '../features/land/store/landSlice';
import auditReducer from '../features/ar-audit/store/auditSlice';
import type {AuditState} from '../features/ar-audit/store/auditSlice';
import creditsReducer from '../features/dashboard/store/creditsSlice';
import type {CreditsState} from '../features/dashboard/store/creditsSlice';
import profileReducer, {
  profileInitialState,
  type ProfileState,
} from '../features/profile/store/profileSlice';
import notificationsReducer, {
  notificationsInitialState,
  type NotificationsState,
} from '../features/notifications/store/notificationsSlice';
import uiReducer from './uiSlice';

export const resetAppState = createAction('app/resetState');

const migrations = {};

async function migrateProfileState(state: any): Promise<any> {
  if (!state || typeof state !== 'object') {
    return state;
  }

  const legacyState = state as Partial<ProfileState> & {
    notificationsEnabled?: boolean;
    gpsHighAccuracy?: boolean;
  };

  return {
    ...profileInitialState,
    settingsNotificationsEnabled:
      legacyState.settingsNotificationsEnabled ??
      legacyState.notificationsEnabled ??
      profileInitialState.settingsNotificationsEnabled,
    settingsHighAccuracyGPS:
      legacyState.settingsHighAccuracyGPS ??
      legacyState.gpsHighAccuracy ??
      profileInitialState.settingsHighAccuracyGPS,
    onboardingComplete:
      legacyState.onboardingComplete ??
      profileInitialState.onboardingComplete,
    walletRecoveryStatus:
      legacyState.walletRecoveryStatus ??
      (legacyState.walletRecoveryPending ? 'PENDING' : null),
    walletRecoveryRequestedAt:
      legacyState.walletRecoveryRequestedAt ??
      profileInitialState.walletRecoveryRequestedAt,
  };
}

async function migrateNotificationsState(state: any): Promise<any> {
  if (!state || typeof state !== 'object') {
    return state;
  }

  const legacyState = state as Partial<NotificationsState> & {
    items?: NotificationsState['notifications'];
  };
  const notifications = Array.isArray(legacyState.notifications)
    ? legacyState.notifications
    : Array.isArray(legacyState.items)
      ? legacyState.items
      : notificationsInitialState.notifications;

  return {
    ...legacyState,
    notifications,
    unreadCount:
      typeof legacyState.unreadCount === 'number'
        ? legacyState.unreadCount
        : notifications.filter(item => !item.read).length,
  };
}

const authPersistConfig: PersistConfig<AuthState> = {
  key: 'auth',
  version: 1,
  storage: mmkvStorage,
  migrate: createMigrate(migrations, {debug: false}),
  stateReconciler: autoMergeLevel2,
};

const landPersistConfig: PersistConfig<LandState> = {
  key: 'land',
  version: 1,
  storage: mmkvStorage,
  blacklist: ['currentDraft'],
  migrate: createMigrate(migrations, {debug: false}),
  stateReconciler: autoMergeLevel2,
};

const auditPersistConfig: PersistConfig<AuditState> = {
  key: 'audit',
  version: 1,
  storage: mmkvStorage,
  blacklist: ['uploadStatus'],
  migrate: createMigrate(migrations, {debug: false}),
  stateReconciler: autoMergeLevel2,
};

const profilePersistConfig: PersistConfig<ProfileState> = {
  key: 'profile',
  version: 3,
  storage: mmkvStorage,
  migrate: migrateProfileState,
  stateReconciler: autoMergeLevel2,
};

const creditsPersistConfig: PersistConfig<CreditsState> = {
  key: 'credits',
  version: 1,
  storage: mmkvStorage,
  migrate: createMigrate(migrations, {debug: false}),
  stateReconciler: autoMergeLevel2,
};

const notificationsPersistConfig: PersistConfig<NotificationsState> = {
  key: 'notifications',
  version: 2,
  storage: mmkvStorage,
  migrate: migrateNotificationsState,
  stateReconciler: autoMergeLevel2,
};

const appReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  land: persistReducer(landPersistConfig, landReducer),
  audit: persistReducer(auditPersistConfig, auditReducer),
  credits: persistReducer(creditsPersistConfig, creditsReducer),
  profile: persistReducer(profilePersistConfig, profileReducer),
  notifications: persistReducer(notificationsPersistConfig, notificationsReducer),
  ui: uiReducer,
});

const rootReducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: {type: string},
) => {
  if (action.type === resetAppState.type) {
    return appReducer(undefined, action);
  }

  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof appReducer>;
export type AppDispatch = typeof store.dispatch;
