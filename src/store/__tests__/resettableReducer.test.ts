import { configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import authReducer, { setUser } from '../../features/auth/store/authSlice';
import { resetAppState, resettableReducer } from '../resettableReducer';
it('continues persisting a new login after logout resets account state', async () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => saved.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: async (key: string) => {
      saved.delete(key);
    },
  };
  const store = configureStore({
    reducer: persistReducer(
      { key: 'auth-test', storage, timeout: 0 },
      resettableReducer(authReducer),
    ),
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });
  let rehydrated!: () => void;
  const ready = new Promise<void>(resolve => {
    rehydrated = resolve;
  });
  const persistor = persistStore(store, undefined, rehydrated);
  await ready;
  store.dispatch(
    setUser({
      id: 'user-1',
      firebaseUid: 'farmer-1',
      phone: '+919999999999',
      name: 'One',
    }),
  );
  await persistor.flush();
  store.dispatch(resetAppState());
  expect(store.getState()._persist.rehydrated).toBe(true);
  await persistor.flush();
  expect(
    JSON.parse(JSON.parse(saved.get('persist:auth-test')!).user),
  ).toBeNull();
  store.dispatch(
    setUser({
      id: 'user-2',
      firebaseUid: 'farmer-2',
      phone: '+918888888888',
      name: 'Two',
    }),
  );
  await persistor.flush();
  expect(
    JSON.parse(JSON.parse(saved.get('persist:auth-test')!).user).firebaseUid,
  ).toBe('farmer-2');
  persistor.pause();
});
