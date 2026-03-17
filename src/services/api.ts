import axios from 'axios';
import Config from 'react-native-config';
import {supabase} from './supabase';
import {mmkvStorage} from '../store/mmkvStorage';

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Supabase JWT
api.interceptors.request.use(async config => {
  const {data} = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: auto-refresh on 401, queue for offline
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Auto-refresh token on 401 (only retry once)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const {error: refreshError} = await supabase.auth.refreshSession();
      if (!refreshError) {
        const {data} = await supabase.auth.getSession();
        const newToken = data.session?.access_token;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      }
    }

    // On network error, save to pending_upload for background-fetch retry
    if (!error.response && originalRequest.data) {
      const pending = await mmkvStorage.getItem('pending_upload');
      const queue: unknown[] = pending ? JSON.parse(pending) : [];
      queue.push({
        url: originalRequest.url,
        method: originalRequest.method,
        data: originalRequest.data,
        timestamp: new Date().toISOString(),
      });
      await mmkvStorage.setItem('pending_upload', JSON.stringify(queue));
    }

    return Promise.reject(error);
  },
);

export default api;
