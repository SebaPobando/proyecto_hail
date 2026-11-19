# ADR 0001 · Stack del backend

- Estado: aceptada
- Fecha: 2026-11-19

## Contexto

El prototipo usa scripts Node (aedes, SQLite, puente a Firebase) y Firebase Auth + Realtime Database para acceso y datos. Para operar con varios clientes se necesita: administración de clientes, usuarios y permisos; aislamiento verificable; series de tiempo con agregados y retención; alarmas y notificaciones en servidor.

## Decisión

- **Django 5.2 LTS + Django Ninja** para la API y la administración.
- **PostgreSQL + TimescaleDB** como única base: relacional y series de tiempo.
- **React + TypeScript + Vite** se mantiene en el frontend; cambia solo el adaptador de datos.
- Redis, Celery y Django Channels se incorporan en F4, cuando hagan falta.

## Alternativas consideradas

- **Flask**: conocido, pero obliga a ensamblar admin, auth, migraciones y permisos a mano.
- **FastAPI**: muy bueno para I/O asíncrono, pero sin admin ni auth incluidos. La parte asíncrona (ingesta) vive igual en un worker separado.
- **NestJS / Fastify (TypeScript)**: un solo lenguaje con el frontend, pero sin un admin equivalente al de Django.

## Consecuencias

- El admin de Django reemplaza `manage-project-access.mjs` y la edición manual de Firebase.
- Los tipos del frontend se generan desde el OpenAPI de Ninja para no perder tipado.
