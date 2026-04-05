import {MMKV} from 'react-native-mmkv';
import type {Storage} from 'redux-persist';

export const mmkv = new MMKV({
  id: 'terratrust-store',
});

export const mmkvStorage: Storage = {
  setItem: (key: string, value: string): Promise<boolean> => {
    mmkv.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key: string): Promise<string | null | undefined> => {
    const value = mmkv.getString(key);
    return Promise.resolve(value ?? null);
  },
  removeItem: (key: string): Promise<void> => {
    mmkv.delete(key);
    return Promise.resolve();
  },
};

export function clearPersistedAppStatePreserveOnboarding(): void {
  const onboardingComplete = mmkv.getBoolean('onboarding_complete');

  mmkv.clearAll();

  if (onboardingComplete === true) {
    mmkv.set('onboarding_complete', true);
  }
}
