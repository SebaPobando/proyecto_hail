# Arquitectura de Hail

## Componentes

| Componente | Tecnología | Estado |
| --- | --- | --- |
| Frontend (HMI, portal) | React 19 + TypeScript + Vite | Existente; se conecta a la API en F3 |
| API y administración | Django 5.2 + Django Ninja | F1 |
| Base de datos | PostgreSQL + TimescaleDB | F1 (relacional), F2 (series de tiempo) |
| Broker MQTT | Mosquitto en desarrollo; producción por decidir (EMQX o Mosquitto) | F2 |
| Ingesta | Worker Python `manage.py ingest_mqtt` | F2 |
| Tiempo real y tareas | Redis + Django Channels + Celery | F4 |
| Proxy y TLS | Caddy | F5 |

Cadena de datos: PLC → gateway (Haiwell CBOX) → broker MQTT → worker de ingesta → TimescaleDB → API → navegador.

## Modelo de datos

```
Organization (cliente)
 ├─ Membership ── User           rol: viewer | operator | org_admin
 └─ Project (instalación)        hmi_type: aguapozo | nutrial | electrical | generic
     ├─ Device (PLC, gateway, medidor)   credencial MQTT propia (solo hash)
     └─ Signal (tag)             unidad, rango válido, escala, dirección, módulo
AuditLog                          accesos, cambios de permisos, recuperación de contraseña
```

- `User.is_staff` = administrador global. No necesita membresías.
- Una membresía da acceso a **todos** los proyectos activos de esa organización.
- Las señales son datos: un proyecto nuevo no requiere cambios de código para listar sus variables.

## Regla de aislamiento

Todo endpoint que entrega datos de un proyecto usa `Project.objects.for_user(request.user)`:

| Usuario | Ve |
| --- | --- |
| Anónimo o inactivo | Nada (401 en la API) |
| Administrador global | Todos los proyectos, incluidos los inactivos |
| Cliente | Proyectos activos de sus organizaciones activas |

Un proyecto ajeno responde **404**, igual que uno inexistente, para no revelar que existe. Las pruebas en `backend/tests/test_isolation.py` cubren lectura cruzada, acceso directo por URL, revocación y desactivación.

## API (v1)

Sesión de Django + CSRF. El frontend llama primero a `/api/auth/csrf` y envía el token en el encabezado `X-CSRFToken` en cada POST.

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Estado del servicio y la base |
| GET | `/api/auth/csrf` | No | Cookie y token CSRF |
| POST | `/api/auth/login` | No (CSRF sí) | Inicia sesión con correo y contraseña |
| POST | `/api/auth/logout` | Sí | Cierra sesión |
| GET | `/api/auth/me` | Sí | Perfil y organizaciones del usuario |
| POST | `/api/auth/password-reset` | No (CSRF sí) | Envía enlace de recuperación |
| POST | `/api/auth/password-reset/confirm` | No (CSRF sí) | Define la nueva contraseña |
| GET | `/api/projects` | Sí | Proyectos visibles para el usuario |
| GET | `/api/projects/{slug}` | Sí | Detalle, dispositivos y número de señales |
| GET | `/api/projects/{slug}/signals` | Sí | Catálogo de señales |

Esquema OpenAPI: `/api/openapi.json`. Documentación interactiva: `/api/docs`.

## Convención MQTT (F2)

`hail/{organización}/{proyecto}/{dispositivo}/telemetry`, por ejemplo `hail/aguapozo/aguapozo/cbox-01/telemetry`. Cada dispositivo tendrá usuario y ACL propios: solo puede publicar en su tópico.

## Frontend

`frontend/` es la app existente, copiada sin cambios para que siga compilando y desplegando. Las piezas marcadas como legado se retiran en F6:

- `frontend/server/` (broker aedes, backend SQLite, puente Firebase, publicador)
- `frontend/scripts/iot-local.mjs` y `frontend/scripts/manage-project-access.mjs`
- `frontend/firebase.json`, `frontend/database.rules.json`, `src/services/firebase.ts`, `FirebaseSession.tsx`
- `frontend/Dockerfile`, `frontend/compose.yaml` y `frontend/deploy/` (despliegue de prueba anterior)

## Convenciones del código

Reglas que sigue el backend; respétalas al agregar código.

**Estructura de una app** (`backend/apps/<app>/`)

| Archivo | Contiene |
| --- | --- |
| `models.py` | Modelos y QuerySets. Lógica de acceso a datos (ej. `for_user`) |
| `admin.py` | Registro en el admin, con `list_select_related` en toda lista con FK |
| `api.py` | Un `Router` de Ninja; se monta en `config/api.py` |
| `schemas.py` | `Schema` / `ModelSchema` de entrada y salida; cálculos con `resolve_*` |
| `services.py` | Operaciones con efectos (ej. `audit.services.record`) |
| `receivers.py` | Señales de Django; se importan en `AppConfig.ready()` |
| `management/commands/` | Comandos `manage.py` |
| `seed_data/` | Datos de carga inicial propios. `fixtures/` queda reservado para `loaddata` |

**Django**

- Usuario personalizado (`accounts.User`) desde la migración inicial.
- `Meta.ordering` solo con campos de la propia tabla: ordenar por relaciones agrega un JOIN a cada consulta.
- Nada de `distinct()` para filtrar por permisos: subconsultas (`organization_id__in=...`).
- Configuración solo por variables de entorno (`django-environ`); nunca secretos en el código.
- Cada cambio de modelo trae su migración; CI falla si falta (`makemigrations --check`).
- `python manage.py check --deploy` con `config.settings.prod` debe quedar limpio.

**Django Ninja**

- Los endpoints devuelven QuerySets u objetos; la serialización la hacen los schemas.
- Respuestas con código explícito usan `Status(código, cuerpo)`.
- Autenticación por sesión (`django_auth`) en toda la API; los endpoints públicos declaran `auth=None`. Los públicos que reciben POST llevan `csrf_protect`.

**Pruebas**

- `pytest` + `pytest-django` en `backend/tests/`.
- Cada endpoint nuevo de datos suma su caso a `test_isolation.py` (cliente ajeno → 404).
- Listados con prueba de número de consultas para evitar N+1.
