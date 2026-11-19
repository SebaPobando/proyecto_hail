# Hail · Supervisión IoT de procesos industriales

Hail es una plataforma web para **supervisar a distancia instalaciones automatizadas**: pozos y plantas de agua potable, tableros eléctricos con medidores, líneas de proceso con PLC. Desde el navegador se ven en tiempo casi real los niveles, caudales, estados de equipos, variables eléctricas y alarmas de cada instalación, con su historial.

Está pensada para atender a **varios clientes a la vez** desde una sola plataforma:

- el **administrador** (nosotros) ve todas las instalaciones y todos sus datos;
- cada **cliente** entra con su cuenta y ve **solo su instalación**.

---

## Equipo

| Integrante | Profesión |
| --- | --- |
| Seba | Ingeniero Informático |
| Gabriel | Ingeniero Civil Electrónico |

Buscamos sumar **ingeniería eléctrica** al equipo. Más abajo explicamos [dónde aporta](#dónde-aporta-la-ingeniería-eléctrica).

---

## Cómo funciona

Los datos viajan desde el equipo de campo hasta la pantalla del cliente así:

```
  INSTALACIÓN DEL CLIENTE                         NUESTRA PLATAFORMA (servidor)                     USUARIOS
 ┌──────────────────────────┐                   ┌───────────────────────────────────┐            ┌─────────────────┐
 │ Sensores e instrumentos  │                   │ 3. Broker MQTT                    │            │ Navegador web   │
 │ (nivel, caudal, cloro,   │                   │    recibe los mensajes de cada    │            │ PC, tablet o    │
 │  medidores eléctricos)   │                   │    equipo, con usuario propio     │            │ celular         │
 │            │             │                   │                │                  │            │                 │
 │            ▼             │    Internet       │                ▼                  │   HTTPS    │ - Proceso (HMI) │
 │ 1. PLC (Siemens S7-1200) │  ─────────────▶   │ 4. Recepción y validación         │ ◀────────▶ │ - Tendencias    │
 │            │             │   (MQTT cifrado)  │    rangos, fechas, calidad del    │            │ - Alarmas       │
 │            ▼             │                   │    dato, duplicados               │            │ - Inventario    │
 │ 2. Gateway Haiwell CBOX  │                   │                │                  │            │ - Seguimiento   │
 └──────────────────────────┘                   │                ▼                  │            └─────────────────┘
                                                │ 5. Base de datos de series de     │
                                                │    tiempo (historial por señal)   │
                                                │                │                  │
                                                │                ▼                  │
                                                │ 6. API + control de acceso        │
                                                │    cada cliente ve solo lo suyo   │
                                                └───────────────────────────────────┘
```

1. **PLC**: controla el proceso, como siempre. Hail no lo reemplaza.
2. **Gateway (Haiwell CBOX)**: lee las variables del PLC y las envía por Internet.
3. **Broker MQTT**: el "buzón" que recibe los mensajes de todos los equipos. Cada equipo tiene su propia credencial y solo puede publicar en su canal.
4. **Recepción**: revisa cada lectura antes de guardarla: que esté dentro del rango físico, que la fecha sea válida, que no sea un duplicado.
5. **Base de datos de series de tiempo**: guarda el historial de cada señal y prepara resúmenes por minuto y por hora para los gráficos.
6. **API**: entrega los datos al navegador, verificando en cada petición qué puede ver ese usuario.

### Principio de seguridad: solo monitoreo

**Hail no envía órdenes al PLC.** No arranca bombas, no cambia consignas, no rearma fallas. Es una plataforma de supervisión de solo lectura. Cualquier mando a distancia queda fuera de alcance hasta hacer un análisis de seguridad específico, con doble confirmación y registro de quién hizo qué.

### Calidad del dato

Cada lectura lleva su **calidad** (válida, dudosa, mala, simulada) y su **fecha de adquisición**. Si una instalación deja de enviar datos por más de 30 segundos, la pantalla lo muestra como **dato vencido**: nunca presenta un valor antiguo como si fuera actual, ni una alarma no verificada como "sin alarmas".

---

## Instalaciones actuales

| Instalación | Tipo | Qué se supervisa | Estado |
| --- | --- | --- | --- |
| **AguaPozo** | Agua potable | Pozo profundo, bomba sumergible P-101, estanque elevado. Nivel de estanque LT-101 (%), nivel de pozo LT-102 (m), caudal FT-101 (m³/h), cloro residual AIT-101 (mg/L), dosificación D-101 | HMI completa con datos simulados; cadena MQTT probada |
| **Medidores Eléctricos** (Universidad de Los Lagos) | Energía | 5 medidores (Accuenergy Acuvim II-R, Schneider PM5330, CHINT PD7777 y PD666): voltaje fase-neutro y fase-fase, corriente, potencia activa, factor de potencia, frecuencia, THD de voltaje, energía acumulada | Pantallas listas con datos de ejemplo |
| **Nutrial** | Proceso industrial | Línea de sustitutos lácteos en polvo: tecle, descargador big bag, tamizadores, esclusas, transporte neumático, mezcladora y ensacadora. Lista de E/S de 58 señales del PLC CPU 1215C (DI, DO, AI, AO) | Esquema de proceso y catálogo de señales; sin datos de campo |

### Qué se ve en pantalla

- **Proceso**: diagrama de la instalación con los equipos dibujados y los valores en vivo sobre cada instrumento.
- **Tendencias**: gráficos históricos por variable (1 h, 8 h, 24 h, 7 días) con exportación a CSV.
- **Alarmas**: alarmas activas, historial de eventos y filtros por prioridad y fecha.
- **Medidores**: resumen general y detalle por medidor, incluido análisis de armónicos.
- **Centro de operaciones**: resumen de todas las instalaciones del usuario, inventario de equipos, bitácora de revisiones e intervenciones, y estado de conectividad de cada tramo de la cadena.

---

## Dónde aporta la ingeniería eléctrica

La plataforma está construida, pero hay decisiones que **no deben tomarse desde el software**. Ahí es donde la ingeniería eléctrica es clave:

| Tema | Qué se necesita |
| --- | --- |
| **Límites de alarma** | Definir umbrales, histéresis y tiempos de persistencia por variable. Hoy no hay ningún límite aprobado y la plataforma no activa alarmas reales sin esa aprobación. |
| **Mapa de variables** | Validar tags, escalas, unidades y rangos físicos de cada señal contra los planos y la lista de E/S. |
| **Calibración** | Cotas de instalación de sondas (ej. LT-102), factores de escala de transformadores de corriente y potencial. |
| **Calidad de energía** | Interpretar THD, factor de potencia y desbalance; definir qué reportar a cada cliente. |
| **Levantamiento en terreno** | Series, fechas de instalación y plan de mantenimiento de cada equipo para el inventario. |
| **Puesta en marcha** | Captura de la trama real del gateway en cada instalación, pruebas de corte de comunicación y validación con el cliente. |
| **Clientes** | Relación técnica y comercial con cada cliente: levantar necesidades, validar entregables y presentar resultados. |
| **Mandos a distancia (futuro)** | Si algún día se habilitan, el análisis de seguridad y los enclavamientos son responsabilidad de ingeniería. |

---

## Estado del proyecto y próximos pasos

Estamos migrando la plataforma desde un prototipo (Node + Firebase) a una base profesional preparada para varios clientes. El plan completo está en el [roadmap](docs/ROADMAP.md).

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| F0 · Preparación | Orden del proyecto, entorno de desarrollo, pruebas automáticas | **Listo** (falta capturar la trama real de la CBOX) |
| F1 · Plataforma multicliente | Clientes, usuarios, permisos, proyectos, equipos y señales administrables; registro de auditoría | **Listo** |
| F2 · Recepción de datos | Broker MQTT, validación, base de datos de series de tiempo, historial | **En curso**: recepción, validación, historial y simulador listos; faltan credenciales por equipo en el broker |
| F3 · Pantallas conectadas | Las HMI actuales leen desde la nueva plataforma | Pendiente |
| F4 · Operación | Alarmas configurables, avisos por correo o mensajería, bitácora compartida | Pendiente |
| F5 · Producción | Servidor, cifrado, respaldos, monitoreo; piloto con AguaPozo en datos reales | Pendiente |
| F6 · Cierre de migración | Retiro del prototipo | Pendiente |

Para ser claros: **hoy los datos que se ven son simulados o de ejemplo.** La primera instalación con datos reales está planificada para la fase F5.

### Seguridad y control de acceso

- Cada cliente ve solo sus instalaciones; un proyecto ajeno no aparece ni por enlace directo. Esto se verifica con pruebas automáticas en cada cambio del código.
- Contraseñas guardadas cifradas (hash); recuperación de contraseña por correo.
- Cada equipo de campo tiene su propia credencial MQTT.
- Registro de auditoría: inicios de sesión, intentos fallidos y cada vez que se da o quita acceso a alguien.
- Comunicación cifrada (HTTPS y MQTT sobre TLS) en producción.

---

# Parte técnica

Esta sección es para quien desarrolla o despliega la plataforma.

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Pantallas (frontend) | React 19 + TypeScript + Vite |
| API y administración | Python · Django 5.2 + Django Ninja |
| Base de datos | PostgreSQL + TimescaleDB (series de tiempo) |
| Mensajería con equipos | MQTT (Mosquitto en desarrollo) |
| Tiempo real y tareas (F4) | Redis, Django Channels, Celery |
| Despliegue (F5) | Docker Compose + Caddy (HTTPS) |

Los motivos de cada decisión están en [docs/adr/](docs/adr/).

## Estructura

```
project_hail/
├── backend/            Django + Django Ninja (API, admin, multicliente)
│   ├── config/         configuración por entorno, URLs, API raíz
│   ├── apps/
│   │   ├── accounts/   usuarios (login por correo) y API de autenticación
│   │   ├── tenancy/    organizaciones (clientes) y membresías
│   │   ├── projects/   proyectos, dispositivos, señales, comando seed_demo
│   │   ├── telemetry/  recepción MQTT, lecturas, historial, simulador
│   │   └── audit/      registro de auditoría
│   ├── templates/      correos
│   └── tests/          pruebas de aislamiento, autenticación y plataforma
├── frontend/           pantallas React (HMI actuales)
├── infra/              servicios de desarrollo (base de datos, Redis, broker)
├── docs/               roadmap, arquitectura, decisiones, documentos anteriores
└── .github/workflows/  integración continua: pruebas y compilación
```

## Puesta en marcha (Windows / PowerShell)

Requisitos: Python 3.12+, Node.js 22, Docker Desktop.

```powershell
# 1. Servicios: PostgreSQL + TimescaleDB, Redis y Mosquitto
docker compose -f infra/compose.yaml up -d

# 2. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
# Sin Docker: en backend\.env cambia DATABASE_URL por  sqlite:///db.sqlite3
python manage.py migrate
python manage.py createsuperuser          # cuenta de administrador global
python manage.py seed_demo --demo-users   # carga AguaPozo, Medidores y Nutrial + un usuario por cliente
python manage.py runserver
```

- Administración: http://localhost:8000/admin/
- API con documentación interactiva: http://localhost:8000/api/docs
- Usuarios de prueba: `cliente-aguapozo@hail.local`, `cliente-ulagos@hail.local`, `cliente-nutrial@hail.local` (contraseña `hail-demo-2026`, solo en desarrollo).

**Datos simulados** (otra terminal, con el entorno activado):

```powershell
# Sin broker: escribe directo en la base cada 10 s
python manage.py simulate_telemetry --direct

# Con Docker: recepción real por MQTT
python manage.py ingest_mqtt          # terminal 1: worker que escucha el broker
python manage.py simulate_telemetry   # terminal 2: publica como lo haría la CBOX
```

Los datos entran en Admin → Telemetría → Lecturas actuales, y en la API: `GET /api/projects/aguapozo/latest`.

```powershell
# 3. Pantallas (otra terminal). Usan el prototipo con Firebase hasta la fase F3.
cd frontend
npm.cmd install
npm.cmd run dev
```

## Pruebas

```powershell
cd backend
pytest              # pruebas automáticas
ruff check .        # revisión de estilo y errores
```

En integración continua las pruebas corren además contra PostgreSQL + TimescaleDB.

## Documentación

- [Roadmap](docs/ROADMAP.md): fases, entregables y fechas estimadas.
- [Arquitectura](docs/ARQUITECTURA.md): componentes, modelo de datos, API y convenciones del código.
- [Protocolo MQTT](docs/PROTOCOLO_MQTT.md): cómo debe publicar un equipo de campo; qué falta de la CBOX.
- [Decisiones](docs/adr/): por qué este stack, por qué este modelo multicliente, broker MQTT.
- [Operación del prototipo](docs/legacy/OPERACION.md): verificaciones pendientes antes de operar con equipos reales.
