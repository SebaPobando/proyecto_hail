# Arquitectura de Hail

## Componentes

| Componente | Tecnología | Estado |
| --- | --- | --- |
| Frontend (HMI, portal) | React 19 + TypeScript + Vite | F3 (listo): sesión de Django y datos de la API |
| API y administración | Django 5.2 + Django Ninja | F1 |
| Base de datos | PostgreSQL + TimescaleDB | F1 (relacional), F2 (hypertable de lecturas) |
| Broker MQTT | Mosquitto en desarrollo; producción por decidir (EMQX o Mosquitto) | F2 |
| Ingesta | Worker Python `manage.py ingest_mqtt` (paho-mqtt) | F2 (listo) |
| Tiempo real | Django Channels (Daphne) + Redis | F4b (listo) |
| Proxy y TLS | Caddy | F5 |

Cadena de datos: PLC → gateway (Haiwell CBOX) → broker MQTT → worker de ingesta → TimescaleDB → API → navegador.

## Modelo de datos

```
Organization (cliente)
 ├─ Membership ── User           rol: viewer | operator | org_admin
 └─ Project (instalación)        hmi_type: aguapozo | nutrial | electrical | generic
     ├─ Device (PLC, gateway, medidor)   credencial MQTT propia (solo hash), decodificador
     └─ Signal (tag)             unidad, rango válido, escala, dirección, módulo, etiquetas de estado
         ├─ Reading              historial: PK (señal, tiempo), valor, calidad · hypertable en TimescaleDB
         └─ LatestReading        último valor por señal
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
| GET | `/api/projects/{slug}/latest` | Sí | Valor actual de cada señal, calidad y si está vencido (> 30 s) |
| GET | `/api/projects/{slug}/history?tags=&start=&end=&points=` | Sí | Historial agregado (promedio, mín., máx., muestras) por intervalo; máx. 31 días y 20 señales |
| GET | `/api/projects/{slug}/connectivity` | Sí | Estado del worker de ingesta y última comunicación de cada dispositivo (fuera de línea tras 60 s) |

Esquema OpenAPI: `/api/openapi.json`. Documentación interactiva: `/api/docs`.

## Telemetría (F2)

Tópico `hail/{organización}/{proyecto}/{dispositivo}/telemetry`. Formatos, reglas de validación y lo que falta de la CBOX: [PROTOCOLO_MQTT.md](PROTOCOLO_MQTT.md).

```
equipo ──MQTT──▶ broker ──▶ manage.py ingest_mqtt ──▶ telemetry.services.ingest()
                                                        │ valida tópico, formato, fecha, rango, pertenencia
                                                        ▼
                                          Reading (historial) + LatestReading (actual)
```

- `ingest()` no depende de MQTT: el worker, el simulador (`simulate_telemetry --direct`) y las pruebas la llaman igual.
- Decodificadores por dispositivo en `apps/telemetry/decoders.py` (`hail_v1`, `test_v1`; `haiwell_cbox` pendiente de la trama real).
- El historial se agrega en Python por ahora. Con volumen real se pasa a agregados continuos de TimescaleDB sin cambiar la API.

**Seguridad del broker.** Mosquitto sin acceso anónimo. `manage.py mqtt_sync_auth` genera `infra/mosquitto/config/passwd` y `acl` desde la base:

| Cuenta | Permiso |
| --- | --- |
| Cada dispositivo con credencial | Publicar solo en su tópico |
| `hail-ingest` (worker) | Leer `hail/+/+/+/telemetry` |
| `hail-simulator` (solo si tiene contraseña; desarrollo) | Publicar en `hail/+/+/+/telemetry` |

Las contraseñas se guardan en el formato `$7$` de Mosquitto (PBKDF2-SHA512); nunca en claro. Esos archivos no se versionan.

**Conectividad.** El worker escribe su pulso en `WorkerStatus` cada 15 s (conectado al broker, último mensaje, aceptados y rechazados). Un pulso de más de 60 s significa worker detenido. Los totales de mensajes solo los ve el administrador global.

Pendiente: plazo de retención y compresión del dato crudo (decisión de ingeniería con cada cliente).

## Alarmas y bitácora (F4a)

Ver [ADR 0006](adr/0006-alarmas.md).

- **Reglas** (`apps/alarms`, `AlarmRule`): por señal, condición alto (≥), bajo (≤) o estado (=), umbral, banda muerta, prioridad (alta, media, baja) y mensaje para el operador. Se configuran en la administración.
- **Evaluación**: dentro de `ingest()`, en la misma transacción, solo con lecturas que pasaron a ser la lectura actual. Las de calidad mala o dudosa no activan ni normalizan. Una restricción de base de datos garantiza una sola alarma activa por regla.
- **Ciclo de vida (ISA-18.2)**: activa sin reconocer → reconocida → normalizada (cerrada); o normalizada sin reconocer → reconocida (cerrada). Una alarma queda "abierta" mientras esté activa o falte reconocerla. Las alarmas no se editan ni se borran; deshabilitar una regla normaliza sus alarmas activas.
- **Permisos** (`apps/projects/permissions.py`): todos los que ven el proyecto ven sus alarmas y su bitácora; reconocer y escribir exige rol de operador, administrador del cliente o de plataforma. Cada reconocimiento queda en la auditoría.
- **Bitácora** (`apps/operations`): seguimientos por proyecto con estado, prioridad, responsable, fecha objetivo y eventos con autor. Puede nacer de una alarma.
- **API**: `GET /api/alarms`, `GET /api/alarms/summary`, `POST /api/alarms/{id}/acknowledge`, `GET|POST /api/work-items`, `PATCH /api/work-items/{id}`, `POST /api/work-items/{id}/notes`.
- **Persistencia (on-delay)**: una regla puede exigir que la condición se mantenga N segundos antes de activar; filtra picos breves.
- **Pérdida de comunicación**: reglas por dispositivo ("sin datos por más de N segundos"). Las revisa `check_communication()` cada 15 s desde el worker de ingesta, el simulador en modo directo o `manage.py check_alarms --loop`; la llegada de datos las normaliza en el acto.
- **Pendiente**: avisos externos (correo o mensajería), cuando se defina quién recibe qué y a qué hora.

## Tiempo real (F4b)

Ver [ADR 0007](adr/0007-tiempo-real.md).

- `runserver` usa Daphne (ASGI): sirve HTTP y el WebSocket `/ws/updates` (`config/asgi.py`, `apps/realtime`). En producción, Daphne o Uvicorn detrás de Caddy (F5).
- **Avisos sin datos**: el servidor solo dice `{"type": "event", "project": "aguapozo", "kind": "alarms"}`; la pantalla vuelve a pedir los datos por la API, con sus permisos de siempre. Tipos: `telemetry`, `alarms`, `work_items`.
- **Quién avisa**: la ingesta (al confirmar la transacción), el reconocimiento de alarmas, la bitácora y la revisión de comunicación. Si Redis no responde, el aviso se pierde sin afectar la operación.
- **Seguridad**: misma sesión de Django; solo se aceptan conexiones cuyo Origin esté en `ALLOWED_HOSTS`; cada conexión se suscribe solo a los proyectos visibles para el usuario al conectarse.
- **Sin Redis** (`REDIS_URL` vacío) los avisos no cruzan del simulador o del worker al servidor web. El servidor lo dice al conectar (`live: false`) y las pantallas siguen consultando cada pocos segundos. Con Redis, la consulta queda como respaldo cada 60 s.
- Dependencia: `redis<8`, porque redis-py 8 corta por tiempo la espera bloqueante de channels-redis 4.3.

## Frontend

`frontend/` es una SPA de React que solo habla con la API de Hail. Firebase, el servidor Node del prototipo y el despliegue en Vercel se retiraron en F3.

**Un solo origen.** El navegador ve las pantallas, `/api` y `/admin` en el mismo sitio: en desarrollo los une el proxy de Vite (`vite.config.ts`); en producción lo hará Caddy (F5). Así la cookie de sesión de Django funciona sin CORS y una sola sesión sirve para las pantallas y la administración. Ver [ADR 0005](adr/0005-sesion-mismo-origen.md).

| Archivo | Responsabilidad |
| --- | --- |
| `src/services/api.ts` | `fetch` con cookie de sesión, encabezado `X-CSRFToken` (leído de la cookie en cada petición, porque Django lo rota al iniciar sesión), tiempo máximo de espera y aviso global de 401 |
| `src/services/hail.ts` | Endpoints y tipos de la API (reflejo de los `schemas.py` del backend) |
| `src/services/usePolling.ts` | Consulta periódica sin superposición; conserva el último dato si una consulta falla |
| `src/services/aguapozo.ts`, `meters.ts` | Adaptadores: convierten lecturas e historial de la API al formato de cada HMI |
| `src/services/projectStatus.ts` | Estado de datos por proyecto: en línea, simulación, datos antiguos, sin datos |
| `src/components/Session.tsx` | Login, recuperación y nueva contraseña (`#reset?uid=…&token=…`), sesión vencida |
| `src/components/ProjectPortal.tsx` | Catálogo desde `/api/projects`; el `hmi_type` de cada proyecto elige la pantalla |

**Pantalla por tipo de HMI.** `aguapozo` → `WaterHmi`, `electrical` → `ElectricalOverview`, `nutrial` → `NutrialHmi`, `generic` → `GenericHmi` (tabla de lectura actual). Un proyecto nuevo funciona con la genérica sin tocar el frontend; cada pantalla se descarga recién al abrirla.

**Reglas de presentación.**

- Una lectura vencida (`stale`) nunca se muestra como valor actual: aparece "—" o la etiqueta "Datos antiguos".
- Un intervalo de historial sin datos es un hueco en el gráfico, no un cero.
- Lo simulado siempre se rotula como simulado.
- Las pantallas de alarmas dicen que los avisos son solo en pantalla y que una instalación sin reglas no genera alarmas: una lista vacía no certifica que todo esté bien.

**Pruebas.** `npm test` corre Vitest sobre los adaptadores, el cliente de la API, el cálculo de estados y el render de las pantallas principales.

## Convenciones del código

Reglas que sigue el backend; respétalas al agregar código.

**Estructura de una app** (`backend/apps/<app>/`)

| Archivo | Contiene |
| --- | --- |
| `models.py` | Modelos y QuerySets. Lógica de acceso a datos (ej. `for_user`) |
| `admin.py` | Registro en el admin, con `list_select_related` en toda lista con FK |
| `api.py` | Un `Router` de Ninja; se monta en `config/api.py` |
| `schemas.py` | `Schema` / `ModelSchema` de entrada y salida; cálculos con `resolve_*` |
| `services.py` | Operaciones con efectos (ej. `audit.services.record`, `telemetry.services.ingest`) |
| `queries.py` | Consultas de lectura armadas para la API |
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
