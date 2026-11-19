# Protocolo MQTT de Hail

Cómo debe publicar sus datos un equipo de campo (gateway, PLC con cliente MQTT o medidor) para que Hail los reciba. Sirve para configurar el gateway en cada instalación.

## Tópico

```
hail/{organización}/{proyecto}/{dispositivo}/telemetry
```

Los tres identificadores son los que aparecen en el admin de Hail. Ejemplos:

| Equipo | Tópico |
| --- | --- |
| Gateway de AguaPozo | `hail/aguapozo/aguapozo/cbox-01/telemetry` |
| Medidor 1 de la ULagos | `hail/ulagos/medidores-electricos/med-01/telemetry` |

Si la organización, el proyecto o el dispositivo no existen o están desactivados, el mensaje se descarta. Cada dispositivo tendrá usuario y contraseña propios en el broker y solo podrá publicar en su tópico.

**Recomendado:** QoS 1, sin `retain`.

## Formato `hail_v1` (estándar)

Es el formato para todo equipo nuevo. Un mensaje JSON en UTF-8:

```json
{
  "v": 1,
  "ts": "2026-11-19T20:15:30Z",
  "quality": "good",
  "values": {
    "MED-01-VAN": 231.4,
    "MED-01-IA": 11.35,
    "MED-01-F": { "value": 50.01, "quality": "uncertain" }
  }
}
```

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| `v` | Sí | Versión del formato. Siempre `1`. |
| `ts` | Sí | Fecha y hora de **adquisición** en ISO 8601 **con zona horaria** (`Z` o `-03:00`). No es la hora de envío. |
| `quality` | No | Calidad por defecto de todos los valores. Si se omite, `good`. |
| `values` | Sí | Objeto `tag: valor`. El tag debe existir en Hail y pertenecer a este dispositivo. El valor es un número, o un objeto con `value` y `quality` propios. |

**Calidades válidas:** `good` (válida), `uncertain` (dudosa), `bad` (mala), `simulated` (simulada).

Los valores van en **unidades de ingeniería**. Si el equipo envía cuentas crudas, cada señal tiene en Hail un factor de escala y un desplazamiento: `valor = crudo × escala + desplazamiento`.

## Reglas de validación

| Regla | Qué pasa si no se cumple |
| --- | --- |
| Tópico corresponde a un dispositivo activo | Se descarta el mensaje completo |
| JSON válido con el formato del dispositivo | Se descarta el mensaje completo |
| `ts` entre 7 días atrás y 5 segundos adelante del servidor | Se descarta el mensaje completo. Revisar la hora del gateway (NTP). |
| Mensaje de 64 KB o menos | Se descarta el mensaje completo |
| Tag existe y pertenece a este dispositivo | Se descarta ese valor; el resto se guarda |
| Valor dentro del rango físico de la señal (mín. y máx. en Hail) | Se descarta ese valor; el resto se guarda |
| Mismo tag e instante ya recibido | Se ignora (duplicado) |
| Instante anterior al último recibido | Se guarda en el historial; la lectura actual no retrocede |

Una lectura más antigua que 30 segundos se muestra en pantalla como **vencida**.

## Formato `test_v1` (prototipo)

Es el mensaje del simulador del prototipo de AguaPozo. Se mantiene por compatibilidad y **siempre** se guarda con calidad `simulated`.

```json
{
  "version": 1,
  "timestamp": "2026-11-19T20:15:30Z",
  "level": 68.2, "wellWaterDepthM": 12.0, "flow": 12.4, "chlorine": 0.65,
  "pump": "running", "dosing": "active"
}
```

| Campo | Señal en Hail |
| --- | --- |
| `level`, `wellWaterDepthM`, `flow`, `chlorine` | LT-101, LT-102, FT-101, AIT-101 |
| `pump` (`stopped` / `running` / `fault`) | P-101 = 0 / 1 / 2 |
| `dosing` (`inactive` / `active` / `fault`) | D-101 = 0 / 1 / 2 |

## Señales de estado

Bombas, válvulas y otros equipos con estados discretos se envían como números enteros. Cada señal tiene en Hail sus etiquetas de estado, por ejemplo P-101: `0` Detenida, `1` En marcha, `2` Falla.

## Gateway Haiwell CBOX (pendiente)

Para escribir el decodificador `haiwell_cbox` necesitamos, por cada instalación:

1. Un mensaje real tal como lo publica la CBOX, y el tópico donde lo publica.
2. Frecuencia de publicación.
3. Si soporta TLS (puerto 8883) y qué autenticación usa (usuario/contraseña o certificado).
4. Si puede fijar la fecha de adquisición desde su reloj (y si ese reloj se sincroniza por NTP).
5. Mapa de variables: registro del PLC → tag de Hail, escala y unidad.

Si la CBOX puede armar el JSON a medida, lo más simple es configurarla para publicar directamente en formato `hail_v1`.
