# Roadmap de migración

Versión completa, con criterios de cierre por fase y riesgos: [documento del roadmap](https://claude.ai/artifact/65uv7VohhLKmcLwKHiomwE).

| Fase | Semanas | Entrega | Hito de cierre |
| --- | --- | --- | --- |
| F0 · Preparación | 1 | Monorepo, entorno local, convención MQTT, trama real de la CBOX | Repo y entorno listos |
| F1 · Backend multitenant | 2 a 4 | Modelos, admin, autenticación, API de proyectos | Aislamiento en verde en CI |
| F2 · Ingesta y series | 5 a 7 | Worker MQTT, hypertables, agregados, `latest` e `history` | Datos fluyen a TimescaleDB |
| F3 · Frontend a la API | 7 a 8 | Adaptadores en `src/services`, sesión Django, catálogo dinámico | Cliente ve solo su proyecto |
| F4 · Alarmas y operación | 9 a 12 | Reglas de alarma, notificaciones, seguimiento compartido, WebSocket | Alarma notifica y se reconoce |
| F5 · Producción y piloto | 13 a 14 | Servidores, TLS, respaldos, observabilidad, piloto en paralelo | AguaPozo real en producción |
| F6 · Retiro de Firebase | — | Adelantado a F3: no había usuarios ni datos reales que migrar | Firebase y Vercel fuera del repo |

Las semanas son de trabajo efectivo, no fechas de calendario.

## Estado

| Fase | Estado | Pendiente |
| --- | --- | --- |
| F0 | Listo | Capturar la trama real de la CBOX |
| F1 | Listo | — |
| F2 | Listo | Definir la retención del dato crudo con cada cliente |
| F3 | Listo | Conectar el PLC de Nutrial (su esquema de proceso sigue simulado en el navegador) |
| F4a | Listo | Aprobar con ingeniería los límites de alarma de cada instalación real |
| F4b | Listo | Avisos externos (correo o mensajería) cuando se decida quién los recibe |
| F5 | Siguiente | Servidor, TLS, respaldos, observabilidad y piloto en paralelo |
| F6 | Listo (en F3) | — |
