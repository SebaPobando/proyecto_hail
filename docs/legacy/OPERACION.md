> **Documento histórico.** Describe el prototipo con Firebase, retirado en la fase F3. Se conserva porque sus verificaciones (vigencia de datos, calidad, exportaciones, permisos) siguen siendo la lista de chequeo para la puesta en producción (F5).

# Preparación para entrega a clientes

## Implementado localmente
- Navegación mediante fragmentos URL; conserva proyecto, pantalla y medidor sin configurar rutas del hosting.
- Recuperación de contraseña mediante Firebase Auth.
- Lecturas AguaPozo validadas; se ocultan indicadores si hay datos antiguos (>30 s), desconexión, calidad inválida o fechas futuras.
- Vista común del portal, incluso en AguaPozo.
- Fuente y última lectura visibles en las tarjetas. Las alarmas no verificadas nunca se presentan como cero.
- Variables eléctricas: las fases no reportadas se muestran como ausentes. La energía se identifica como acumulada disponible, no consumo del período.
- Exportación CSV de demostración e historial eléctrico, con protección de fórmulas en celdas de texto.
- Eventos demo de Nutrial conservados en este navegador (máximo 200). Esto NO es el historial de producción.
- Reglas locales para projectData/<projectId>, lectura por administrador o asignación; escrituras del navegador denegadas.
- Asignación por correo con scripts/manage-project-access.mjs; resuelve el UID automáticamente, presenta una vista previa y aplica solo con --apply. ADC se mantiene fuera del navegador. Revoca acceso legado y registra auditoría.

## Activación pendiente en Firebase
No se han publicado reglas ni cambiado usuarios durante esta mejora. Publicar database.rules.json después de revisar diferencias y verificar aislamiento con Firebase Emulator Suite. La regla antigua de telemetry mantiene compatibilidad solo con AguaPozo. Nunca almacenar otros clientes bajo telemetry.

El permiso de administrador del portal no otorga IAM. Crear usuarios mediante Firebase Authentication; asignarlos con el script de administración usando una identidad de servidor autorizada. No dar credenciales de servidor a clientes.

## Contrato de alarmas de campo
La vista AguaPozo consulta projectData/aguapozo/alarms. Debe publicar un backend un objeto AlarmSnapshot de src/services/types.ts: updatedAt ISO, alarms y events como arrays. Cuando Firebase omita arrays vacíos, el lector los interpreta como arrays vacíos. El backend debe guardar eventos duraderos, IDs únicos, transiciones y calidad; no publicar alarmas calculadas con umbrales sin aprobación de ingeniería. La interfaz muestra un aviso si el registro es inexistente o antiguo.

## Antes de operar con equipos reales
1. Capturar una trama real CBOX por cada proyecto y validar mapa de variables, escalas, unidades, calidad y fecha.
2. Implementar el adaptador real de cada proyecto. El puente actual acepta mensajes de prueba y marca calidad simulada; no cambiar esa etiqueta para aparentar conexión real.
3. Probar pérdida MQTT, pérdida Firebase, reinicio del puente, duplicados, mensajes fuera de orden y recuperación. Confirmar que la web no conserva un estado de marcha como actual.
4. Publicar eventos y alarmas en el backend de cada proyecto y acordar límites, histéresis y tiempos de persistencia.
5. Crear pruebas de reglas con dos usuarios de clientes diferentes, un administrador y un usuario anónimo. Probar lectura cruzada, acceso directo por URL, escritura y revocación.
6. Definir retención y agregados históricos según frecuencia y volumen. El historial AguaPozo actual se descarga por intervalo y luego se reduce en cliente; NO está optimizado para grandes volúmenes. No limitar silenciosamente una consulta larga, porque perdería parte del período.
7. Configurar respaldo y restauración; ejecutar una restauración de ensayo. No asumir que disponer de Firebase equivale a tener respaldos activos.
8. Verificar visualmente escritorio 1366x768 / 1920x1080, tablet, teclado y zoom al 100 %. Confirmar acceso, rutas y exportaciones en navegador.
9. Configurar marca, contacto de soporte, dominio, dominios Auth autorizados y alojamiento del puente. El despliegue remoto sigue pendiente por decisión del proyecto.

No prometer disponibilidad continua ni monitoreo real de los tres proyectos hasta cerrar estas verificaciones. Las pruebas locales no certifican los dispositivos ni las reglas publicadas.

## Centro de operaciones

El portal incluye Resumen, Instalaciones, Equipos, Seguimiento y Conectividad.
- El inventario es una referencia de ingeniería, no descubrimiento de equipos conectados.
- La vigencia de AguaPozo utiliza la calidad y fecha de Firebase; no diagnostica individualmente PLC, gateway ni broker.
- El seguimiento es manual y se guarda en localStorage por UID. No es auditoría inmutable ni almacenamiento compartido. En dispositivos compartidos debe considerarse información local accesible desde el navegador. Exportar CSV para conservar copias; borrar datos del navegador elimina los registros locales.
- No se envían notificaciones, no se escriben variables al PLC y no se crean alarmas automáticas desde la bitácora.
- La interfaz filtra por instalaciones asignadas; las reglas de Firebase siguen siendo la autoridad para datos remotos.

Pendientes para operación comercial: persistencia compartida de intervenciones con reglas y pruebas de aislamiento; diagnóstico del receptor MQTT; alarmas y notificaciones ejecutadas en backend; respaldos con prueba de recuperación; recepción de señales reales y validación del historial; administración de clientes/instalaciones desde un servicio autorizado.
