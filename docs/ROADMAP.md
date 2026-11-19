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
| F6 · Retiro de Firebase | 15 a 16 | Migración de datos y usuarios, limpieza de legado | Firebase apagado |

Las semanas son de trabajo efectivo, no fechas de calendario.
