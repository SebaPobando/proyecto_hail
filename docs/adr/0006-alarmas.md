# ADR 0006 · Alarmas evaluadas por Hail

- Estado: aceptada
- Fecha: 2026-11-19

## Contexto

La fase F4 agrega alarmas. Había que decidir de dónde salen, cómo se reconocen y cómo se avisa.

## Decisión

- **Hail evalúa reglas por señal** (alto, bajo, estado) al recibir cada lectura. Funciona con cualquier equipo que envíe datos, sin depender de la trama de alarmas del PLC, que todavía no conocemos. Leer las alarmas propias del PLC queda abierto para cuando tengamos la trama de la CBOX.
- **Banda muerta** para normalizar, para que una variable que oscila cerca del umbral no active y normalice la alarma una y otra vez.
- **Estados de ISA-18.2** (activa/normalizada × reconocida/sin reconocer). Reconocer deja autor, hora y comentario, y queda en la auditoría.
- **Las lecturas de calidad mala o dudosa no cambian alarmas**: un sensor defectuoso no debe esconder ni inventar una condición de proceso.
- **Avisos solo en pantalla por ahora.** Correo o mensajería se suman en F4b, cuando se defina quién recibe qué y a qué hora.
- **Bitácora compartida en el backend**, reemplazando la del navegador: todos los que ven la instalación la ven; escribir requiere rol de operador.

## Consecuencias

- Una instalación sin reglas configuradas no genera alarmas: las pantallas lo advierten.
- Los límites de demostración (NCh409 para el cloro, IEEE 519 para el THD) son referencias; cada límite real lo aprueba ingeniería.
- Falta el tiempo de persistencia (on-delay) y la alarma por pérdida de comunicación; ambos quedan para F4b.
