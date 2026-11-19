# ADR 0003 · Broker MQTT en desarrollo

- Estado: aceptada; broker de producción pendiente
- Fecha: 2026-11-19

## Decisión

Se usa **Mosquitto** (imagen `eclipse-mosquitto:2`), publicado solo en `127.0.0.1` en desarrollo y **sin acceso anónimo**. Usuarios y permisos se generan desde la base con `manage.py mqtt_sync_auth` (archivos `passwd` y `acl`) y se recargan con SIGHUP sin cortar conexiones.

El broker de producción se decide antes de F5 entre:

- **EMQX**: autentica dispositivos contra la API de Django y trae panel de monitoreo. Revisar las condiciones de licencia de la versión vigente.
- **Mosquitto** con archivo de contraseñas y ACL, o con un plugin de autenticación.

## Consecuencias

El worker de ingesta solo depende del protocolo MQTT; cambiar de broker no afecta el código del backend.

## Actualización (F2)

Generar archivos desde la base exige ejecutar `mqtt_sync_auth` tras cada cambio de credenciales. Es simple y no agrega componentes. Si llega a haber muchos equipos o cambios frecuentes, EMQX o el plugin `mosquitto-go-auth` pueden consultar a Django en línea.
