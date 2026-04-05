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
import profileReducer, {
  type ProfileState,
} from '../features/profile/store/profileSlice';
import notificationsReducer, {
  type NotificationsState,
} from '../features/notifications/store/notificationsSlice';
import uiReducer from './uiSlice';

export const resetAppState = createAction('app/resetState');

const migrations = {};

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
  version: 1,
  storage: mmkvStorage,
  migrate: createMigrate(migrations, {debug: false}),
  stateReconciler: autoMergeLevel2,
};

const notificationsPersistConfig: PersistConfig<NotificationsState> = {
  key: 'notifications',
  version: 1,
  storage: mmkvStorage,
  migrate: createMigrate(migrations, {debug: false}),
  stateReconciler: autoMergeLevel2,
};

const appReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  land: persistReducer(landPersistConfig, landReducer),
  audit: persistReducer(auditPersistConfig, auditReducer),
  credits: creditsReducer,
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
