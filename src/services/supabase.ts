import {createClient} from '@supabase/supabase-js';
import Config from 'react-native-config';
import {mmkvStorage} from '../store/mmkvStorage';

export const supabase = createClient(
  Config.SUPABASE_URL!,
  Config.SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: mmkvStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
