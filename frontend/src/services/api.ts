/**
 * Cliente HTTP del backend de Hail (Django + Django Ninja).
 *
 * - Sesión por cookie: el navegador la envía sola porque la API se sirve desde
 *   el mismo origen (en desarrollo, mediante el proxy de Vite).
 * - CSRF: Django exige el encabezado X-CSRFToken en POST, PUT, PATCH y DELETE.
 *   El token se lee de la cookie `csrftoken` en cada petición, porque Django
 *   lo rota al iniciar sesión.
 * - Una respuesta 401 avisa a quien esté suscrito con `onUnauthorized` (la
 *   sesión expiró o se cerró en otra pestaña).
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const BASE = '/api';
const TIMEOUT_MS = 10_000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const unauthorizedListeners = new Set<() => void>();

/** Suscribe una función que se llama cuando la API responde 401. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function readCookie(name: string, cookies = typeof document === 'undefined' ? '' : document.cookie): string | null {
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

async function csrfToken(): Promise<string> {
  const fromCookie = readCookie('csrftoken');
  if (fromCookie) return fromCookie;
  const response = await fetch(`${BASE}/auth/csrf`, { credentials: 'same-origin' });
  if (!response.ok) throw new ApiError(response.status, 'No se pudo preparar la sesión segura.');
  const body = (await response.json()) as { csrf_token: string };
  return readCookie('csrftoken') ?? body.csrf_token;
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') return body.detail;
  if (status === 401) return 'Tu sesión no está activa.';
  if (status === 403) return 'No tienes permiso para esta acción.';
  if (status === 404) return 'No encontrado.';
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.';
  return 'La solicitud no se pudo completar.';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | readonly string[] | undefined>;
  signal?: AbortSignal;
}

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const search = params.toString();
  return `${BASE}${path}${search ? `?${search}` : ''}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!SAFE_METHODS.has(method)) headers['X-CSRFToken'] = await csrfToken();
  const signals = [AbortSignal.timeout(TIMEOUT_MS)];
  if (options.signal) signals.push(options.signal);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'No hay conexión con el servidor de Hail.');
  }

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) unauthorizedListeners.forEach(listener => listener());
    throw new ApiError(response.status, errorMessage(response.status, body));
  }
  return body as T;
}
