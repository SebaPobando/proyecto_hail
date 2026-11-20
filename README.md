# Hail · Supervisión IoT de procesos industriales

Hail es una plataforma web para **supervisar a distancia instalaciones automatizadas**: pozos y plantas de agua potable, tableros eléctricos con medidores, líneas de proceso con PLC. Desde el navegador se ven en tiempo casi real los niveles, caudales, estados de equipos, variables eléctricas y alarmas de cada instalación, con su historial.

Está pensada para atender a **varios clientes a la vez** desde una sola plataforma:

- el **administrador** (nosotros) ve todas las instalaciones y todos sus datos;
- cada **cliente** entra con su cuenta y ve **solo su instalación**.

---

## Identidad visual

Hail usa la paleta de PROYEC: azul de marca, acento naranja y formas rectas. Colores, tipografía, logo y componentes están en el [design system de Hail](https://claude.ai/artifact/LafspLZ7MAk8BhUgVa1XxS) y en el código en `frontend/src/design-system/`.

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

La plataforma ya dejó atrás el prototipo (Node + Firebase): hoy todo corre sobre una base profesional preparada para varios clientes. El plan completo está en el [roadmap](docs/ROADMAP.md).

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| F0 · Preparación | Orden del proyecto, entorno de desarrollo, pruebas automáticas | **Listo** (falta capturar la trama real de la CBOX) |
| F1 · Plataforma multicliente | Clientes, usuarios, permisos, proyectos, equipos y señales administrables; registro de auditoría | **Listo** |
| F2 · Recepción de datos | Broker MQTT, validación, base de datos de series de tiempo, historial | **Listo** (falta definir cuánto tiempo se guardan los datos crudos) |
| F3 · Pantallas conectadas | Las HMI leen desde la nueva plataforma; inicio de sesión propio; cada cliente ve solo lo suyo | **Listo** |
| F4 · Operación | Alarmas configurables, avisos por correo o mensajería, bitácora compartida | Pendiente |
| F5 · Producción | Servidor, cifrado, respaldos, monitoreo; piloto con AguaPozo en datos reales | Pendiente |
| F6 · Cierre de migración | Retiro del prototipo y de Firebase | **Listo** (se adelantó a F3: Firebase no tenía usuarios reales) |

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
| Pantallas (frontend) | React 19 + TypeScript + Vite; pruebas con Vitest |
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
├── frontend/           pantallas React: portal, HMI y cliente de la API
├── infra/              servicios de desarrollo (base de datos, Redis, broker)
├── docs/               roadmap, arquitectura, decisiones, guía de prueba local
├── scripts/            instalación e inicio con doble clic (Windows)
├── instalar.cmd        doble clic: instala todo para probar en local
├── iniciar.cmd         doble clic: abre Hail (backend, simulador y pantallas)
└── .github/workflows/  integración continua: pruebas y compilación
```

## Probarlo en tu computador (sin programar)

Para Gabriel, Jorge o cualquiera que quiera ver Hail funcionando sin escribir comandos: **[docs/GUIA_PRUEBA_LOCAL.md](docs/GUIA_PRUEBA_LOCAL.md)**. En resumen: instalar Git, Python y Node.js, descargar el proyecto, y luego doble clic en `instalar.cmd` (una vez) e `iniciar.cmd` (cada vez que se use).

## Puesta en marcha para desarrollo (Windows / PowerShell)

Lo mismo que hacen `instalar.cmd` e `iniciar.cmd`, pero paso a paso y con la opción de usar Docker. Toma unos 15 minutos la primera vez.

**Requisitos**

| Programa | Versión | Para qué |
| --- | --- | --- |
| [Git](https://git-scm.com/download/win) | cualquiera reciente | descargar el código |
| [Python](https://www.python.org/downloads/) | 3.12 o superior (marca "Add python.exe to PATH" al instalar) | backend |
| [Node.js](https://nodejs.org/) | 22 LTS | pantallas |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | opcional | base de datos real y broker MQTT. Sin Docker se usa SQLite |

Para revisar lo instalado: `git --version`, `python --version`, `node --version`, `docker --version`.

### Paso 1 · Descargar el código

```powershell
git clone https://github.com/SebaPobando/proyecto_hail.git
cd proyecto_hail
```

Si el repositorio es privado, pídele a Seba que te agregue como colaborador en GitHub.

### Paso 2 · Base de datos (solo con Docker)

Con Docker Desktop abierto:

```powershell
docker compose -f infra/compose.yaml up -d --wait db redis
```

La primera vez descarga las imágenes y tarda unos minutos. Sin Docker, sáltate este paso.

### Paso 3 · Backend (terminal 1)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1           # el prompt pasa a decir (.venv)
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

**Sin Docker:** abre `backend\.env` y cambia la línea `DATABASE_URL=...` por `DATABASE_URL=sqlite:///db.sqlite3`.

```powershell
python manage.py migrate
python manage.py createsuperuser          # tu cuenta de administrador (correo y contraseña a elección)
python manage.py seed_demo --demo-users   # carga AguaPozo, Medidores y Nutrial + un usuario por cliente
python manage.py runserver
```

Deja esta terminal abierta. El backend queda en http://localhost:8000.

### Paso 4 · Datos simulados (terminal 2)

Abre otra terminal en la carpeta del proyecto:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py simulate_telemetry --direct   # escribe lecturas simuladas cada 10 s
```

### Paso 5 · Pantallas (terminal 3)

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

### Qué revisar

| Dirección | Qué se ve |
| --- | --- |
| http://127.0.0.1:5173/ | Las pantallas de Hail. Entra con la cuenta del paso 3 (ve todos los proyectos) o con un usuario de cliente |
| http://127.0.0.1:5173/admin/ | Administración: organizaciones, proyectos, equipos, señales, usuarios. Comparte la sesión con las pantallas |
| http://127.0.0.1:5173/admin/telemetry/latestreading/ | Lecturas que va dejando el simulador, actualizadas cada 10 s |
| http://127.0.0.1:8000/api/docs | La API con documentación interactiva |

Usuarios de cliente para probar el aislamiento entre proyectos: `cliente-aguapozo@hail.local`, `cliente-ulagos@hail.local`, `cliente-nutrial@hail.local`, todos con contraseña `hail-demo-2026` (solo en desarrollo). Cada uno ve únicamente su proyecto.

En desarrollo, Vite reenvía `/api`, `/admin` y `/static` al backend (`frontend/vite.config.ts`): el navegador ve un solo sitio y una misma sesión sirve para las pantallas y la administración.

> **Ojo:** AguaPozo y los medidores muestran lo que escribe el simulador. El esquema de proceso de Nutrial sigue simulado en el navegador hasta conectar su PLC; su lista de señales sí viene del backend.

### Los días siguientes

Ya no hay que instalar nada. Para volver a levantarlo:

```powershell
git pull                                             # trae los últimos cambios
docker compose -f infra/compose.yaml up -d --wait db redis   # solo con Docker
# terminal 1
cd backend; .\.venv\Scripts\Activate.ps1; python manage.py migrate; python manage.py runserver
# terminal 2
cd backend; .\.venv\Scripts\Activate.ps1; python manage.py simulate_telemetry --direct
# terminal 3
cd frontend; npm.cmd install; npm.cmd run dev
```

`migrate` y `npm.cmd install` no hacen nada si no hubo cambios, pero conviene correrlos después de cada `git pull`.

### Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| `Activate.ps1 no se puede cargar porque la ejecución de scripts está deshabilitada` | Windows bloquea los scripts por defecto. Corre una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y responde `S`. |
| `npm : No se puede cargar el archivo npm.ps1` | Mismo bloqueo. Usa `npm.cmd` en vez de `npm` (como en esta guía) o aplica el comando de la fila anterior. |
| `No module named 'django'` | El entorno no está activado. Corre `.\.venv\Scripts\Activate.ps1` dentro de `backend` (el prompt debe decir `(.venv)`). |
| `python` abre la Microsoft Store o no se reconoce | Python no quedó en el PATH. Reinstálalo marcando "Add python.exe to PATH", o usa `py -3.12` en vez de `python`. |
| `ports are not available ... 5432` o `la autentificación password falló para el usuario hail` | Hay un PostgreSQL instalado en el equipo usando el 5432. La base de Docker usa el **5433**: revisa que `DATABASE_URL` en `backend\.env` diga `127.0.0.1:5433`. |
| Las pantallas dicen "No se pudo contactar al servidor de Hail" | El backend no está corriendo: revisa la terminal 1 (`runserver`) o la ventana "Hail - Backend". |
| `server closed the connection unexpectedly` al hacer `migrate` | La base aún se estaba inicializando (la primera vez tarda unos segundos y se reinicia por dentro). Levántala con `--wait` o espera a que `docker compose -f infra/compose.yaml ps` diga `healthy`, y repite `migrate`. |
| `error during connect` o `docker daemon is not running` | Docker Desktop no está abierto. Ábrelo y espera a que diga "Engine running". |
| El simulador dice "No hay broker" o el contenedor `mqtt` se reinicia | Faltan los archivos de usuarios del broker: corre `python manage.py mqtt_sync_auth` (necesita la base arriba). |

Si cambias de SQLite a PostgreSQL, la base nueva parte vacía: repite `migrate`, `createsuperuser` y `seed_demo`.

### Recepción real por MQTT (opcional, con Docker)

Lo anterior escribe los datos simulados directo en la base. Para probar el camino completo de un equipo de campo (equipo → broker MQTT → worker → base):

El broker no acepta conexiones anónimas: cada equipo tiene su usuario y solo puede publicar en su tópico.

```powershell
# 1. En backend\.env: DATABASE_URL de PostgreSQL (127.0.0.1:5433) y las cuentas MQTT (ver .env.example)
# 2. Genera los archivos de usuarios y permisos del broker desde la base
python manage.py mqtt_sync_auth
# 3. Levanta (o reinicia) todos los servicios
docker compose -f infra/compose.yaml up -d --wait
# 4. Worker y simulador, cada uno en su terminal (en vez del simulador --direct)
python manage.py ingest_mqtt
python manage.py simulate_telemetry
```

Para dar acceso a un equipo de campo: Admin → Dispositivos → usuario MQTT y nueva contraseña. Luego `python manage.py mqtt_sync_auth` y `docker compose -f infra/compose.yaml kill -s SIGHUP mqtt` (el broker relee los permisos sin cortar a nadie).

## Pruebas

```powershell
cd backend
pytest              # pruebas automáticas del backend
ruff check .        # revisión de estilo y errores

cd ..\frontend
npm.cmd test        # pruebas automáticas de las pantallas (Vitest)
npm.cmd run build   # compilación de producción (incluye la revisión de tipos)
```

Las pruebas usan SQLite en memoria y no dependen de tu `backend\.env`. Para correrlas contra PostgreSQL, define `HAIL_TEST_DATABASE_URL` (en integración continua corren contra PostgreSQL + TimescaleDB).

## Documentación

- [Guía para probar Hail en local](docs/GUIA_PRUEBA_LOCAL.md): para quien no programa; instalación con doble clic.
- [Roadmap](docs/ROADMAP.md): fases, entregables y fechas estimadas.
- [Arquitectura](docs/ARQUITECTURA.md): componentes, modelo de datos, API y convenciones del código.
- [Protocolo MQTT](docs/PROTOCOLO_MQTT.md): cómo debe publicar un equipo de campo; qué falta de la CBOX.
- [Decisiones](docs/adr/): por qué este stack, por qué este modelo multicliente, broker MQTT, design system, sesión y mismo origen.
- [Design system](frontend/src/design-system/README.md): reglas de color, tipografía, estados y componentes.
- [Operación del prototipo](docs/legacy/OPERACION.md): documento histórico; sirve como lista de verificaciones para la fase F5.
