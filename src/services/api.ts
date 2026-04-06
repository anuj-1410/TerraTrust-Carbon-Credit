import axios, {AxiosHeaders, type InternalAxiosRequestConfig} from 'axios';
import Config from 'react-native-config';
import {getFreshFirebaseIdToken, signOutFirebase} from './firebase';
import {navigationRef} from './navigationRef';
import {resetAppState, store} from '../store';
import {setMaintenance, showBanner} from '../store/uiSlice';
import {clearPersistedAppStatePreserveOnboarding, mmkv} from '../store/mmkvStorage';

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
    mmkv.delete('pending_upload');
    return true;
  } catch (error) {
    const axiosErr = error as {response?: {status?: number}};
    if (axiosErr.response?.status === 401 || error instanceof SyntaxError) {
      mmkv.delete('pending_upload');
    }
    return false;
  }
}

function withAuthorizationHeader(
  config: InternalAxiosRequestConfig,
  token: string,
): InternalAxiosRequestConfig {
  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);

  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;

  return config;
}

function enterMaintenanceMode(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || !('maintenance' in payload)) {
    return false;
  }

  const maintenancePayload = payload as {
    maintenance?: boolean;
    message?: string;
  };

  if (maintenancePayload.maintenance !== true) {
    return false;
  }

  store.dispatch(
    setMaintenance({
      message: maintenancePayload.message,
    }),
  );

  return true;
}

// Request interceptor: attach Firebase ID token
api.interceptors.request.use(async config => {
  const token = await getFreshFirebaseIdToken();
  if (token) {
    return withAuthorizationHeader(config, token);
  }

  return config;
});

// Response interceptor: 401 → login, 500 → banner, offline → queue audit only
api.interceptors.response.use(
  response => {
    enterMaintenanceMode(response.data);
    return response;
  },
  async error => {
    if (enterMaintenanceMode(error.response?.data)) {
      return Promise.reject(error);
    }

    // 401: session expired → force re-login
    if (error.response?.status === 401) {
      await signOutFirebase();
      clearPersistedAppStatePreserveOnboarding();
      store.dispatch(resetAppState());
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
