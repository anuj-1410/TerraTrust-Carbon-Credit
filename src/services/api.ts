import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import Config from 'react-native-config';
import {
  getCurrentFirebaseUser,
  getFreshFirebaseIdToken,
  signOutFirebase,
} from './firebase';
import { navigationRef } from './navigationRef';
import { resetAppState, store } from '../store';
import { setMaintenance, showBanner } from '../store/uiSlice';
import {
  clearPersistedAppStatePreserveOnboarding,
  mmkv,
} from '../store/mmkvStorage';

const normalizedApiBaseUrl =
  Config.API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export function getConfiguredApiBaseUrl(): string | null {
  if (!normalizedApiBaseUrl || !/^https?:\/\//i.test(normalizedApiBaseUrl)) {
    return null;
  }

  return normalizedApiBaseUrl;
}

export function assertApiBaseUrlConfigured(): string {
  const apiBaseUrl = getConfiguredApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('APP_CONFIG_MISSING_API_BASE_URL');
  }

  return apiBaseUrl;
}

const api = axios.create({
  baseURL: getConfiguredApiBaseUrl() ?? undefined,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface SessionRequestConfig extends InternalAxiosRequestConfig {
  terraAuthUid?: string | null;
  terraAuthRetried?: boolean;
}

let tokenRefresh: { uid: string; promise: Promise<string | null> } | null =
  null;
let sessionInvalidation: Promise<void> | null = null;

function refreshSessionToken(uid: string) {
  if (tokenRefresh?.uid === uid) {
    return tokenRefresh.promise;
  }
  const promise = getFreshFirebaseIdToken(true).finally(() => {
    if (tokenRefresh?.promise === promise) {
      tokenRefresh = null;
    }
  });
  tokenRefresh = { uid, promise };
  return promise;
}

async function invalidateSession(uid: string) {
  if (getCurrentFirebaseUser()?.uid !== uid) {
    return;
  }
  if (sessionInvalidation) {
    return sessionInvalidation;
  }
  const pending = (async () => {
    await signOutFirebase();
    clearPersistedAppStatePreserveOnboarding();
    store.dispatch(resetAppState());
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
    }
  })().finally(() => {
    sessionInvalidation = null;
  });
  sessionInvalidation = pending;
  return pending;
}

function parsePendingAuditPayload(raw: string): Record<string, unknown> | null {
  try {
    const payload = JSON.parse(raw);

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const record = payload as Record<string, unknown>;
    if (
      typeof record.land_id !== 'string' ||
      typeof record.audit_id !== 'string' ||
      !Array.isArray(record.trees)
    ) {
      return null;
    }

    return record;
  } catch {
    return null;
  }
}

export async function retryPendingAuditUpload(): Promise<boolean> {
  const raw = mmkv.getString('pending_upload');
  if (!raw) {
    return false;
  }

  const payload = parsePendingAuditPayload(raw);
  if (!payload) {
    mmkv.delete('pending_upload');
    return false;
  }

  try {
    await api.post('/api/v1/audit/submit-samples', payload);
    mmkv.delete('pending_upload');
    return true;
  } catch (error) {
    const axiosErr = error as { response?: { status?: number } };
    if (axiosErr.response?.status === 401) {
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
  const sessionConfig = config as SessionRequestConfig;
  const uid = getCurrentFirebaseUser()?.uid ?? null;
  if (
    sessionConfig.terraAuthUid !== undefined &&
    sessionConfig.terraAuthUid !== uid
  ) {
    throw new axios.CanceledError('Account changed during request');
  }
  sessionConfig.terraAuthUid = uid;
  if (sessionConfig.terraAuthRetried && config.headers.has('Authorization')) {
    return config;
  }
  const token = await getFreshFirebaseIdToken();
  if ((getCurrentFirebaseUser()?.uid ?? null) !== uid) {
    throw new axios.CanceledError('Account changed during token retrieval');
  }
  if (token) {
    return withAuthorizationHeader(config, token);
  }

  return config;
});

// Response interceptor: 401 → login, 500 → banner, offline → queue audit only
api.interceptors.response.use(
  response => {
    const uid = (response.config as SessionRequestConfig).terraAuthUid;
    if (uid && getCurrentFirebaseUser()?.uid !== uid) {
      throw new axios.CanceledError('Discarded response from previous account');
    }
    enterMaintenanceMode(response.data);
    return response;
  },
  async error => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    const config = error.config as SessionRequestConfig | undefined;
    const uid = config?.terraAuthUid;
    if (uid && getCurrentFirebaseUser()?.uid !== uid) {
      return Promise.reject(
        new axios.CanceledError('Discarded response from previous account'),
      );
    }
    if (enterMaintenanceMode(error.response?.data)) {
      return Promise.reject(error);
    }

    // Refresh once before declaring a session invalid. Network failure while
    // refreshing is recoverable and must never erase a valid login.
    if (error.response?.status === 401) {
      if (!uid || !config) {
        return Promise.reject(error);
      }
      if (!config.terraAuthRetried) {
        try {
          const token = await refreshSessionToken(uid);
          if (token && getCurrentFirebaseUser()?.uid === uid) {
            config.terraAuthRetried = true;
            return api.request(withAuthorizationHeader(config, token));
          }
        } catch (refreshError) {
          const code = (refreshError as { code?: string }).code;
          if (
            code === 'auth/user-disabled' ||
            code === 'auth/user-token-expired'
          ) {
            await invalidateSession(uid);
          }
          return Promise.reject(refreshError);
        }
        return Promise.reject(error);
      }
      await invalidateSession(uid);
      return Promise.reject(error);
    }

    if (error.response?.status === 429) {
      store.dispatch(
        showBanner({
          message: 'Too many requests. Please wait a moment and try again.',
          type: 'info',
        }),
      );
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
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      store.dispatch(
        showBanner({
          message: timedOut
            ? 'The server is taking longer than expected. Please try again.'
            : 'No internet connection. Your data is saved locally.',
          type: timedOut ? 'info' : 'offline',
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
