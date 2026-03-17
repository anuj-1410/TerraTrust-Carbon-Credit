import {createMMKV} from 'react-native-mmkv';
import type {Storage} from 'redux-persist';

const mmkvInstance = createMMKV({id: 'terratrust-store'});

export const mmkvStorage: Storage = {
  setItem: (key: string, value: string): Promise<boolean> => {
    mmkvInstance.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key: string): Promise<string | null | undefined> => {
    const value = mmkvInstance.getString(key);
    return Promise.resolve(value ?? null);
  },
  removeItem: (key: string): Promise<void> => {
    mmkvInstance.remove(key);
    return Promise.resolve();
  },
};
