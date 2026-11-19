# ADR 0003 · Broker MQTT en desarrollo

- Estado: aceptada para desarrollo; producción pendiente
- Fecha: 2026-11-19

## Decisión

En desarrollo se usa **Mosquitto** (imagen `eclipse-mosquitto:2`), solo en `127.0.0.1` y sin autenticación. Es liviano y suficiente para F2.

El broker de producción se decide antes de F5 entre:

- **EMQX**: autentica dispositivos contra la API de Django y trae panel de monitoreo. Revisar las condiciones de licencia de la versión vigente.
- **Mosquitto** con archivo de contraseñas y ACL, o con un plugin de autenticación.

## Consecuencias

El worker de ingesta solo depende del protocolo MQTT; cambiar de broker no afecta el código del backend.
