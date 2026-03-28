import {combineReducers, configureStore} from '@reduxjs/toolkit';
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
import uiReducer from './uiSlice';

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

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  land: persistReducer(landPersistConfig, landReducer),
  audit: persistReducer(auditPersistConfig, auditReducer),
  credits: creditsReducer,
  ui: uiReducer,
});

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

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
