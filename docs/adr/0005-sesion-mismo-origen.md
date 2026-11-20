# ADR 0005 · Sesión de Django y frontend en el mismo origen

- Estado: aceptada
- Fecha: 2026-11-19

## Contexto

En F3 el frontend dejó Firebase Auth y pasó a la autenticación del backend. Había dos caminos: tokens (JWT) guardados en el navegador, o la sesión de Django por cookie.

## Decisión

- **Sesión de Django por cookie** (`HttpOnly`, `SameSite=Lax`, 12 horas), con protección CSRF: el frontend envía `X-CSRFToken` en cada petición que modifica datos.
- **Un solo origen** para pantallas, `/api` y `/admin`. En desarrollo lo arma el proxy de Vite (`frontend/vite.config.ts`); en producción, Caddy sirve el build del frontend y reenvía `/api`, `/admin` y `/static` a Django (F5).
- Sin CORS: ningún otro sitio puede llamar a la API con la sesión del usuario.

## Por qué no JWT

- Un token en `localStorage` queda expuesto a cualquier script inyectado; la cookie `HttpOnly` no.
- Cerrar sesión o desactivar a un usuario en el admin corta el acceso de inmediato; un JWT sigue valiendo hasta que vence.
- La misma sesión sirve para la administración de Django, sin un segundo login.

## Consecuencias

- La app móvil o integraciones de terceros, si llegan, necesitarán otro mecanismo (tokens de API por cliente). Se decide cuando exista el caso.
- Los enlaces de recuperación de contraseña apuntan a `HAIL_FRONTEND_URL`, que debe ser la dirección pública del frontend.
