import axios, { type AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL as string;

/**
 * Ports js/auth.js's postJson()/getJson() fetch wrapper, using Sanctum's SPA
 * cookie-session auth instead of the old app's raw PHP session. Every
 * mutating request needs the XSRF-TOKEN cookie (set by GET /sanctum/csrf-cookie)
 * echoed back as an X-XSRF-TOKEN header; axios's automatic handling of that
 * is unreliable across origins, so it's done explicitly here.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Fetches a fresh CSRF cookie before every mutating request — deliberately
 * not cached per page load. The session (and its CSRF token) can be
 * invalidated at any point after an earlier fetch — a prior logout, a 401,
 * or plain token rotation — and a cached cookie value then goes stale,
 * failing every subsequent mutation with "CSRF token mismatch" until a full
 * reload. The extra GET is cheap (no DB query, just touches the session).
 */
export function ensureCsrfCookie(): Promise<void> {
  return axios.get(`${API_URL}/sanctum/csrf-cookie`, { withCredentials: true }).then(() => undefined);
}

/** Dispatched on any 401 from an endpoint that isn't /api/me or /api/login itself — mirrors app.js's sessionExpired(). */
export const AUTH_EXPIRED_EVENT = 'syncura:auth-expired';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = String(error.config?.url ?? '');
      if (!url.endsWith('/api/me') && !url.endsWith('/api/login')) {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (method !== 'get' && method !== 'head') {
    await ensureCsrfCookie();
    const token = readCookie('XSRF-TOKEN');
    if (token) {
      config.headers.set('X-XSRF-TOKEN', token);
    }
  }

  return config;
});

/** Same {success, message} envelope every Laravel controller returns; kept close to the old app's shape. */
export interface ApiEnvelope {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export type ApiResult<T = Record<string, unknown>> =
  | { ok: true; data: T & ApiEnvelope }
  | { ok: false; data: ApiEnvelope; status: number };

/** Mirrors auth.js's postJson()/getJson(): never throws on a non-2xx API response, returns {ok, data} instead. */
export async function apiRequest<T = Record<string, unknown>>(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  body?: unknown,
  config?: Parameters<AxiosInstance['request']>[0]
): Promise<ApiResult<T>> {
  try {
    const response = await api.request<T & ApiEnvelope>({
      url: path,
      method,
      data: body,
      ...config,
    });

    return { ok: true, data: response.data };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return { ok: false, data: error.response.data as ApiEnvelope, status: error.response.status };
    }
    return { ok: false, data: { success: false, message: 'Could not reach the server. Please try again.' }, status: 0 };
  }
}
