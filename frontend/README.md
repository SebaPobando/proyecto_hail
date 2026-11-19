> **Monorepo Hail.** Esta carpeta es la app web existente, copiada sin cambios para que siga compilando.
> Durante la migración (ver `../docs/ROADMAP.md`) las HMI se mantienen y solo cambia la fuente de datos (F3).
> Se retiran en F6: `server/`, `scripts/iot-local.mjs`, `scripts/manage-project-access.mjs`, la integración con Firebase
> y el despliegue anterior (`Dockerfile`, `compose.yaml`, `deploy/`). El documento de operación quedó en `../docs/legacy/OPERACION.md`.

# HMI Web · Sistema de Agua Potable

Pantallas implementadas: **Proceso** (aprobada), **Tendencias** y **Alarmas**. Referencias originales en `referencias/`. Interfaz React + TypeScript + Vite; equipos dibujados con SVG, sin imágenes de fondo.

## Instalación y ejecución

Requiere Node.js 22 y npm.

```sh
npm install
npm run dev
```

Abrir la dirección local que imprime Vite (por defecto http://127.0.0.1:5173). En PowerShell, si la política de ejecución bloquea npm, usar `npm.cmd install` y `npm.cmd run dev`.

```sh
npm run build
npm run preview
```

## Datos y arquitectura

- `src/services/types.ts`: contratos de telemetría, estados, alarmas y calidad de datos.
- `src/services/simulation.ts`: simulador independiente, actualización cada segundo. Inicio: 68 %, 12.4 m³/h y 0.65 mg/L. Evolución suave y acotada: nivel 65–71 %, caudal 11.8–13.0 m³/h y cloro 0.625–0.675 mg/L.
- `src/services/index.ts`: punto de inyección de un futuro adaptador de lectura del backend, con `getSnapshot`, `subscribe` y `queryHistory`. Los componentes no dependen del simulador.
- `src/components/ProcessDiagram.tsx`: proceso SVG; altura de agua ligada al nivel. Volumen calculado como nivel × 50 / 100, suponiendo sección constante.
- `src/App.tsx`: paneles de variables, estados y navegación de esta etapa.

Arquitectura futura: Siemens S7-1200 → Haiwell CBOX → Broker MQTT → Backend → Web. El backend deberá entregar calidad, fecha de adquisición y estados reales; implementar desconexión y caducidad de datos en el adaptador. No hay MQTT, comandos al PLC, escrituras, credenciales ni autenticación ficticia. El estado de comunicación actual está identificado como simulado. Alarmas incluye resumen, tabla de activas, historial y filtros. Diagnóstico fue retirado de la navegación.

La hora se muestra en America/Santiago. El diseño se adapta a escritorio y tablets desde 760 px; en tablets angostas los paneles de variables y estados pasan debajo del proceso. Colores planos y representación industrial de equipos conservando las proporciones de la referencia. El encabezado conserva los ajustes aprobados: sin rótulos PLC Simulado, DEMO ni Solo monitoreo. Los datos siguen siendo simulados.

## Tendencias

Tres gráficos Recharts independientes: LT-101 (0–100 %), FT-101 (0–25 m³/h) y AIT-101 (0–1.20 mg/L). Períodos móviles de 1 h, 8 h, 24 h y 7 días, inicialmente 8 h. Las tarjetas actuales comparten la misma telemetría que Proceso. El eje horizontal usa hora local de Santiago; en 7 días muestra fechas. El tooltip incluye fecha, hora, valor y unidad. La fecha superior indica la fecha actual; no es un selector de fechas.

`src/services/history.ts` genera una única serie inicial de siete días al abrir la aplicación y añade una muestra por minuto durante la sesión, conservando el último valor en vivo. Los puntos iniciales son un escenario histórico ilustrativo (llenado de 47 a 68 % en las últimas ocho horas), no mediciones de una instalación. El archivo existe en memoria y se reinicia al recargar. Las consultas remuestrean por interpolación a 241 puntos; no se calculan máximos/mínimos por intervalo. La consulta asíncrona `queryHistory({ from, to, maxPoints })` se actualiza cada 15 segundos, mientras el extremo derecho y las lecturas actuales se actualizan cada segundo. Un futuro adaptador del backend debe implementar este contrato junto con la telemetría. La interfaz contempla carga, historial vacío y error con reintento.

Los gráficos se cargan al abrir Tendencias para reducir el tamaño inicial de Proceso. No hay comandos a equipos.

Verificaciones:

```sh
node scripts/verify-history.mjs
node scripts/verify-process.mjs
npm run build
```

## Alarmas

`src/services/alarms.ts` contiene un escenario ilustrativo independiente de la telemetría normal: una alarma crítica (cloro bajo), dos advertencias (caudal y nivel bajos), ocho eventos en las últimas 24 horas y dos eventos anteriores. Los valores de las descripciones son valores al disparo, no las lecturas actuales de Proceso. No se han configurado umbrales reales ni una política de reconocimiento o enclavamiento. El indicador «Valores al disparo» incluye esta aclaración en su descripción emergente.

`alarmService`, inyectado desde `src/services/index.ts`, expone `getSnapshot` y `subscribe`. El escenario se crea al iniciar y permanece estable entre pantallas; su marca de actualización se refresca cada 15 segundos mientras Alarmas está abierta. No persiste después de recargar. El futuro backend podrá reemplazar este servicio sin cambiar las tablas.

- Estado: Todas, Activas (eventos de activación) o Normalizadas. La tabla de activas queda vacía al seleccionar Normalizadas; los resultados normalizados se consultan en el historial.
- Prioridad: Todas, Crítica o Advertencia. Los eventos de estado de equipos son informativos y solo aparecen con Todas.
- Rango: Hoy (día calendario de Santiago), Últimas 24 h o Últimos 7 días. Se aplica a la fecha de las filas de ambas tablas.
- Los contadores superiores son generales y no cambian con los filtros. El contador de eventos siempre cubre las últimas 24 horas.
- Historial ordenado de más reciente a más antiguo, hasta 20 resultados, con desplazamiento y encabezados fijos.

No hay botones de reconocimiento, rearme ni escritura a equipos. Verificar filtros y límites horarios con `node scripts/verify-alarms.mjs`.

## Instrumentos y estados

- LT-102: sonda hidrostática con cable, sumergida junto a P-101. `wellWaterDepthM` es la profundidad desde la boca del pozo hasta el espejo de agua (no la altura de columna sobre la sonda). Inicia en 12.0 m y varía suavemente entre 11 y 13 m. El agua del pozo sigue esta lectura; la cota se dibuja desde la boca hasta su superficie. Posiciones de equipos esquemáticas, no planos de instalación.
- Para datos reales, el backend deberá convertir la columna medida por la sonda a profundidad usando la cota de instalación calibrada. La web consume directamente profundidad en metros; no se presupone una calibración real.
- LT-101: sensor sin contacto, ultrasónico o radar, sobre el agua del estanque; los trazos discontinuos representan su medición, no flujo de agua.
- P-101: indicador sobre el cuerpo y etiqueta local sincronizados con el panel de estados. Verde y «En marcha», gris y «Detenida», rojo y «Falla». Las flechas de impulsión se muestran solo con marcha y caudal positivo. La demo inicia en marcha; no se agregan mandos de operación.



## Integración MQTT local

Con Node.js 22.18 o posterior, ejecuta `npm install` y luego `npm run iot:local`.
Abre la URL que imprime Vite y selecciona **Fuente de datos → MQTT de prueba**.
También puedes añadir `?source=mqtt` a esa URL. El broker y la API escuchan en localhost.

El publicador envía una muestra cada 10 segundos a
`pozoagua/pruebas/v1/telemetria`. El backend valida el mensaje y lo registra en
`.iot-data/telemetry.sqlite`. Proceso consulta la última lectura cada dos segundos.
Tendencias consulta las muestras registradas durante los últimos siete días.
Tras 30 segundos sin datos, la última lectura se conserva y aparece como desactualizada.
Alarmas usa su escenario simulado independiente.

Para probar el corte manualmente, inicia en terminales separadas `npm run iot:broker`,
`npm run iot:backend`, `npm run iot:publish` y `npm run dev`. Detén el publicador
con Ctrl+C. El backend y el publicador admiten MQTT_URL, MQTT_USERNAME y MQTT_PASSWORD.
La CBOX requerirá incorporar su tópico y formato real al adaptador de entrada.

## Conectar la HMI a AguaPozo

La opción **Fuente de datos → Firebase** (o `?source=firebase`) requiere una
cuenta de Firebase Authentication. En Authentication habilita correo y
contraseña, crea el usuario y copia su UID. En Realtime Database agrega
`operators/<UID>` con valor booleano `true` desde la consola administrativa.
Aplica el contenido de `database.rules.json` en la pestaña Reglas del proyecto.
El acceso de operador es solo lectura. El nodo de operadores queda privado.

El receptor MQTT deberá escribir con credenciales del servidor en
`telemetry/latest` con el contrato `Telemetry` y en `telemetry/history` con
registros `HistoryPoint`. La última lectura lleva fecha ISO 8601 y los puntos
del historial usan milisegundos Unix. Proceso se suscribe a la última lectura y
Tendencias consulta el rango seleccionado. Alarmas presenta el escenario local
de demostración. La base vacía indica que todavía espera la primera lectura.

El SDK web incluye la configuración pública del proyecto. Guarda las
credenciales de escritura y el futuro secreto del webhook solo en el servidor.

### Enviar las muestras MQTT de prueba a Firebase

1. Configura Application Default Credentials (ADC) para una identidad de
   servidor con acceso de escritura a Realtime Database en AguaPozo. Puedes
   usar credenciales locales de una cuenta de servicio ya autorizada mediante
   `GOOGLE_APPLICATION_CREDENTIALS`, apuntando a un archivo fuera del repositorio,
   o ADC con suplantación de una cuenta de servicio. No uses el usuario de la HMI.
2. Con el broker y el publicador de prueba activos, ejecuta `npm run iot:firebase`
   en la terminal que tiene esa identidad. Si el entorno MQTT no está activo,
   inicia `npm run iot:local` en otra terminal.
3. Abre la HMI, inicia sesión y confirma que llegan lecturas en Proceso y que
   aparecen puntos en Tendencias. Cada punto lleva calidad `simulated`.

El puente guarda el histórico con la fecha como clave y actualiza la lectura
actual con una transacción que evita retrocesos y preserva una lectura real.
Las reglas del navegador siguen en solo lectura. Ejecuta
`npm run verify:iot:firebase` para comprobar el contrato sin escribir en la nube.

## Portal de proyectos

La portada abre **Mis proyectos** después del acceso. Para revisar las tres
tarjetas con datos de demostración sin modificar Firebase, inicia el servidor
local y abre `/?source=portal`. Esta vista solo existe en desarrollo.

Para activar el selector con cuentas reales, publica `database.rules.json`
en AguaPozo y registra el acceso desde la consola administrativa:

- Administrador: `portalAccess/<UID>/admin = true`.
- Cliente: `portalAccess/<UID>/projects/<proyecto> = true`, con
  `aguapozo`, `medidores-electricos` o `nutrial` como identificador.

Las cuentas heredadas de `operators/<UID>` conservan el acceso a AguaPozo
mientras se migra el catálogo. Si retiras AguaPozo a una de esas cuentas,
retira también su asignación heredada en Firebase.

El puente MQTT de AguaPozo mantiene las rutas existentes. Medidores usa datos
ilustrativos y Nutrial muestra un esquema de referencia. Al conectar las fuentes
de esos dos proyectos, aplica reglas de lectura específicas a sus rutas de datos.

### Simulación MQTT conectada a la web publicada

Desde la raíz del proyecto:

```powershell
npm.cmd run iot:demo:firebase
```

Inicia broker MQTT local (127.0.0.1:1883), receptor/API, publicador de AguaPozo y puente Firebase. Publica cada 10 segundos en `pozoagua/pruebas/v1/telemetria`; guarda historial y última lectura con calidad `simulated`. Requiere las credenciales de servidor ADC previamente configuradas y acceso a Internet. No colocar credenciales en el frontend ni en Git.

La terminal debe permanecer abierta; Ctrl+C detiene los procesos de esta ejecución. No ejecutar dos instancias simultáneas. Vercel sirve la web, no ejecuta este simulador. Tras detenerlo, la lectura queda antigua después de 30 segundos. La web local se abre en la URL que imprima Vite con `?source=mqtt`; Vite puede elegir otro puerto si 5173 está ocupado.

Este comando escribe muestras de prueba en `telemetry/latest` e `history` de AguaPozo; no usarlo simultáneamente con la futura fuente real. No controla equipos ni reproduce aún el protocolo propietario de la CBOX. Medidores y Nutrial no están incluidos en este publicador.
