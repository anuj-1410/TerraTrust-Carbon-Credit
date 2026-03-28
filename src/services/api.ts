import axios from 'axios';
import Config from 'react-native-config';
import {supabase} from './supabase';
import {navigationRef} from './navigationRef';
import {store} from '../store';
import {logout} from '../features/auth/store/authSlice';
import {showBanner} from '../store/uiSlice';
import {mmkv} from '../store/mmkvStorage';

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function retryPendingAuditUpload(): Promise<boolean> {
  const raw = mmkv.getString('pending_upload');
  if (!raw) {
    return false;
  }

  try {
    const payload = JSON.parse(raw);
    await api.post('/api/v1/audit/submit-samples', payload);
    mmkv.remove('pending_upload');
    return true;
  } catch (error) {
    const axiosErr = error as {response?: {status?: number}};
    if (axiosErr.response?.status === 401 || error instanceof SyntaxError) {
      mmkv.remove('pending_upload');
    }
    return false;
  }
}

// Request interceptor: attach Supabase JWT
api.interceptors.request.use(async config => {
  const {data} = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: 401 → login, 500 → banner, offline → queue audit only
api.interceptors.response.use(
  response => response,
  async error => {
    // 401: session expired → force re-login
    if (error.response?.status === 401) {
      store.dispatch(logout());
      if (navigationRef.isReady()) {
        navigationRef.reset({index: 0, routes: [{name: 'LoginScreen'}]});
      }
      return Promise.reject(error);
    }

    // 500+: server error → show maintenance banner
    if (error.response?.status >= 500) {
      store.dispatch(
        showBanner({
          message: 'Server issue. Please try again in a few minutes.',
          type: 'error',
        }),
      );
      return Promise.reject(error);
    }

    // Network error (offline): queue ONLY audit/submit-samples requests
    if (!error.response) {
      store.dispatch(
        showBanner({
          message: 'No internet connection. Your data is saved locally.',
          type: 'offline',
        }),
      );

      const requestUrl = error.config?.url ?? '';
      if (requestUrl.includes('/audit/submit-samples') && error.config?.data) {
        const payload =
          typeof error.config.data === 'string'
            ? error.config.data
            : JSON.stringify(error.config.data);
        mmkv.set('pending_upload', payload);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
