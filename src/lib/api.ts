import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './constants';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    retriedAfterRefresh?: boolean;
  }
}

type TokenGetter = (forceRefresh?: boolean) => Promise<string | null>;
let tokenGetter: TokenGetter = async () => null;

export function setTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (config.url?.startsWith('/admin/auth/')) return config;
  const token = await tokenGetter();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;
    if (error.response?.status === 401 && config && !config.url?.startsWith('/admin/auth/') && !config.retriedAfterRefresh) {
      config.retriedAfterRefresh = true;
      const token = await tokenGetter(true);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      }
    }
    return Promise.reject(error);
  },
);
