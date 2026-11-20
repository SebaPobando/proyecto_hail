# ADR 0007 · Actualización en vivo por WebSocket, con consulta periódica de respaldo

- Estado: aceptada
- Fecha: 2026-11-19

## Contexto

Las pantallas consultaban la API cada 2 a 15 segundos. Para operar alarmas hace falta que un cambio se vea al instante en todas las sesiones abiertas, sin sobrecargar el servidor con consultas frecuentes de cada pantalla.

## Decisión

- **Django Channels con Daphne** sirve el WebSocket `/ws/updates` en el mismo servidor que la API, con la misma sesión.
- **El WebSocket solo envía avisos, no datos**: "cambió la telemetría, las alarmas o la bitácora del proyecto X". La pantalla vuelve a pedir los datos por la API. Así los permisos y el formato de los datos viven en un solo lugar, y un aviso perdido no deja datos incorrectos en pantalla.
- **Redis** lleva los avisos entre procesos (worker de ingesta → servidor web). Es opcional: sin Redis las pantallas siguen consultando periódicamente, y el servidor se lo indica al navegador para que no confíe en avisos que no van a llegar.
- **La consulta periódica no desaparece**: con avisos en vivo se espacia a 60 s como respaldo.
- **Persistencia y pérdida de comunicación** se evalúan en el backend (ver ADR 0006); la revisión periódica de comunicación la hace el worker con su pulso.

## Alternativas descartadas

- **Enviar los datos por el WebSocket**: duplica la serialización y los permisos de la API, y obliga a reconciliar estados si se pierde un mensaje.
- **Server-Sent Events**: más simple, pero igual necesita Redis para cruzar procesos; Channels deja abierto el canal de subida si más adelante se necesita.
- **LISTEN/NOTIFY de PostgreSQL**: no funciona con SQLite, que usamos para probar sin Docker.

## Consecuencias

- `redis<8` en las dependencias: redis-py 8 es incompatible con channels-redis 4.3.
- Sin Docker (prueba local de Gabriel) el indicador dice "Actualización periódica"; es lo esperado.
