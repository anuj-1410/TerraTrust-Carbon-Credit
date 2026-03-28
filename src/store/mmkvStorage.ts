import {createMMKV} from 'react-native-mmkv';
import type {Storage} from 'redux-persist';

export const mmkv = createMMKV({
  id: 'terratrust-store',
  encryptionKey: 'tt-key',
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
    mmkv.remove(key);
    return Promise.resolve();
  },
};
