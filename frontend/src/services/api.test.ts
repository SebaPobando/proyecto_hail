import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, buildUrl, onUnauthorized, readCookie, request } from './api';

const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readCookie', () => {
  it('lee una cookie entre varias', () => {
    expect(readCookie('csrftoken', 'sessionid=abc; csrftoken=x%3Dy; otra=1')).toBe('x=y');
    expect(readCookie('csrftoken', 'sessionid=abc')).toBeNull();
  });
});

describe('buildUrl', () => {
  it('repite los parámetros de lista y omite los indefinidos', () => {
    expect(buildUrl('/projects/a/history', { tags: ['LT-101', 'FT-101'], points: 240, end: undefined }))
      .toBe('/api/projects/a/history?tags=LT-101&tags=FT-101&points=240');
  });
});

describe('request', () => {
  it('envía el token CSRF de la cookie en peticiones que modifican', async () => {
    vi.stubGlobal('document', { cookie: 'csrftoken=token-1' });
    const fetch = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);
    await request('/auth/login', { method: 'POST', body: { email: 'a@b.cl' } });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(init.headers['X-CSRFToken']).toBe('token-1');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.cl' });
  });

  it('pide el token a /auth/csrf si todavía no hay cookie', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(200, { csrf_token: 'nuevo' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await expect(request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
    expect(fetch.mock.calls[0][0]).toBe('/api/auth/csrf');
    expect(fetch.mock.calls[1][1].headers['X-CSRFToken']).toBe('nuevo');
  });

  it('no envía CSRF en GET', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', fetch);
    await request('/projects');
    expect(fetch.mock.calls[0][1].headers['X-CSRFToken']).toBeUndefined();
  });

  it('convierte el detalle del backend en ApiError y avisa los 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { detail: 'Unauthorized' })));
    const listener = vi.fn();
    const stop = onUnauthorized(listener);
    await expect(request('/auth/me')).rejects.toMatchObject({ status: 401, message: 'Unauthorized' });
    expect(listener).toHaveBeenCalledOnce();
    stop();
  });

  it('usa un mensaje propio si el backend no trae detalle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(500, null)));
    const error = await request<never>('/projects').catch((e: unknown) => e as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(/servidor/);
  });

  it('informa la falta de conexión como ApiError con estado 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/projects')).rejects.toMatchObject({ status: 0 });
  });
});
