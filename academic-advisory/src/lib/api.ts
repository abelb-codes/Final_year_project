import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const CSRF_COOKIE_NAME = 'csrftoken';

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | null;
};

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  fieldErrors: FieldErrors;
  responseData: unknown;

  constructor(message: string, fieldErrors: FieldErrors = {}, responseData: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
    this.responseData = responseData;
  }
}

function getCsrfToken() {
  const cookies = document.cookie.split(';').map((cookie) => cookie.trim());
  const csrfCookie = cookies.find((cookie) => cookie.startsWith(`${CSRF_COOKIE_NAME}=`));
  return csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : '';
}

function isUnsafeMethod(method?: string) {
  const normalized = (method || 'GET').toUpperCase();
  return !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(normalized);
}

export async function ensureCsrfCookie() {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, {
    method: 'GET',
    credentials: 'include',
  });
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const { body, headers, method, ...rest } = options;
  const requestMethod = method || 'GET';
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (isUnsafeMethod(requestMethod)) {
    await ensureCsrfCookie();
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    method: requestMethod,
    headers: {
      ...(isUnsafeMethod(requestMethod) ? { 'X-CSRFToken': getCsrfToken() } : {}),
      ...(isFormData
        ? {}
        : {
            'Content-Type': 'application/json',
          }),
      ...headers,
    },
    body:
      body == null || isFormData || typeof body === 'string'
        ? (body as BodyInit | null | undefined)
        : JSON.stringify(body),
    ...rest,
  });

  const rawText = await response.text();
  let parsed: ApiResponse<T> | null = null;

  try {
    parsed = rawText ? (JSON.parse(rawText) as ApiResponse<T>) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.status === 'error') {
    const message = parsed?.message || rawText || 'Request failed. Please try again.';
    const parsedData = parsed?.data;
    const fieldErrors =
      parsedData && typeof parsedData === 'object'
        ? (
            'errors' in (parsedData as Record<string, unknown>)
              ? ((parsedData as Record<string, unknown>).errors as FieldErrors | undefined)
              : (parsedData as FieldErrors)
          ) ?? {}
        : {};
    throw new ApiError(message, fieldErrors, parsedData);
  }

  if (!parsed) {
    throw new ApiError('The server returned an empty response.');
  }

  return parsed;
}
