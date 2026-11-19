# Hail

Plataforma web de supervisión IoT para procesos de automatización. Es multitenant:

- el **administrador global** (cuenta *staff*) ve todos los clientes, proyectos y datos;
- cada **cliente** (organización) ve solo sus propios proyectos.

Hoy el proyecto está en migración desde Node + Firebase a Django + PostgreSQL/TimescaleDB, siguiendo el [roadmap](docs/ROADMAP.md).

## Estructura

```
project_hail/
├── backend/            Django 5.2 + Django Ninja (API, admin, multitenant)
│   ├── config/         settings por entorno, urls, API raíz
│   ├── apps/
│   │   ├── accounts/   usuario con login por correo, API de autenticación
│   │   ├── tenancy/    organizaciones (clientes) y membresías
│   │   ├── projects/   proyectos, dispositivos, señales, comando seed_demo
│   │   └── audit/      registro de auditoría (accesos y permisos)
│   ├── templates/      correos
│   └── tests/          pruebas de aislamiento, auth y plataforma
├── frontend/           app React + TypeScript + Vite (HMI actuales)
├── infra/              docker compose de desarrollo, broker MQTT
├── docs/               roadmap, arquitectura, decisiones (ADR), documentos legados
└── .github/workflows/  CI: pruebas del backend y build del frontend
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
python manage.py migrate
python manage.py createsuperuser          # tu cuenta de administrador global
python manage.py seed_demo --demo-users   # AguaPozo, Medidores y Nutrial + un usuario por cliente
python manage.py runserver
```

- Admin: http://localhost:8000/admin/
- API y documentación interactiva: http://localhost:8000/api/docs
- Usuarios demo: `cliente-aguapozo@hail.local`, `cliente-ulagos@hail.local`, `cliente-nutrial@hail.local` (contraseña `hail-demo-2026`, solo desarrollo).

```powershell
# 3. Frontend (en otra terminal). Sigue usando Firebase hasta la fase F3.
cd frontend
npm.cmd install
npm.cmd run dev
```

## Pruebas

```powershell
cd backend
pytest              # usa SQLite en memoria
ruff check .
```

En CI las pruebas corren contra PostgreSQL + TimescaleDB.

## Estado

| Fase | Estado |
| --- | --- |
| F0 · Preparación | Monorepo, compose y CI listos. Pendiente: capturar trama real de la CBOX y elegir broker de producción. |
| F1 · Backend multitenant | Modelos, admin, autenticación, API de proyectos y pruebas de aislamiento listos. Pendiente: tipos TS desde OpenAPI. |
| F2 a F6 | Por iniciar. |

Arquitectura, API y convenciones del código: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
