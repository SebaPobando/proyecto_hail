# Frontend de Hail

SPA de React 19 + TypeScript + Vite. Inicia sesión contra Django y muestra el portal de proyectos y las HMI con datos de la API. No tiene backend propio ni dependencias de Firebase.

## Desarrollo

Requiere Node.js 22 y el backend corriendo en `127.0.0.1:8000` (ver el README principal).

```powershell
npm.cmd install
npm.cmd run dev        # http://127.0.0.1:5173
npm.cmd test           # pruebas (Vitest)
npm.cmd run build      # revisión de tipos y compilación de producción
```

Vite reenvía `/api`, `/admin`, `/static` y el WebSocket `/ws` al backend. Para usar otro backend: `$env:HAIL_BACKEND_URL="http://otra-direccion:8000"` antes de `npm.cmd run dev`.

## Estructura

```
src/
├── App.tsx                 entrada: <Session/>
├── design-system/          tokens, componentes base y logo (ver su README)
├── services/
│   ├── api.ts              fetch con sesión, CSRF y aviso de 401
│   ├── hail.ts             endpoints y tipos de la API
│   ├── usePolling.ts       consulta periódica; refresca al instante con avisos en vivo
│   ├── live.ts             WebSocket /ws/updates: avisos en vivo con reconexión
│   ├── aguapozo.ts         adaptador de AguaPozo (lectura actual e historial)
│   ├── meters.ts           adaptador de medidores eléctricos y resúmenes
│   ├── projectStatus.ts    estado de datos por proyecto
│   ├── alarms.ts           etiquetas, tonos y permisos de alarmas y bitácora
│   └── quality.ts          validación de la telemetría de AguaPozo
├── components/
│   ├── Session.tsx         login, recuperación y nueva contraseña
│   ├── ProjectPortal.tsx   menú, catálogo y pantalla según hmi_type
│   ├── OperationsCenter.tsx resumen, alarmas, inventario, bitácora compartida y conectividad
│   ├── AlarmsPanel.tsx     alarmas abiertas e historial, reconocer y crear seguimiento
│   ├── WaterHmi.tsx        AguaPozo: proceso, tendencias y alarmas
│   ├── ElectricalOverview.tsx, MeterDetail.tsx, MeterAnalysis.tsx   medidores
│   ├── NutrialHmi.tsx      Nutrial: proceso (simulado), señales desde la API
│   └── GenericHmi.tsx      tabla de lectura actual para proyectos sin HMI propia
└── test/fixtures.ts        datos de prueba
```

## Reglas

- Los componentes no llaman a `fetch`: usan `services/hail.ts`.
- Una lectura vencida no se muestra como actual; un hueco del historial no se rellena con ceros; lo simulado se rotula.
- Colores y tipografía, solo desde el design system (`src/design-system`).
