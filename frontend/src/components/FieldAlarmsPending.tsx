/**
 * Las alarmas de campo llegan en la fase F4 (reglas por señal, registro de
 * eventos y reconocimiento). Hasta entonces se dice explícitamente, para que
 * una tabla vacía no se lea como "sin alarmas".
 */
export default function FieldAlarmsPending() {
  return <div className="portal-notice" role="status">
    <strong>Alarmas de campo: próxima fase.</strong>{' '}
    Hail todavía no evalúa alarmas ni recibe el registro de eventos del PLC. Que esta pantalla esté vacía
    <b> no significa que la instalación esté libre de alarmas</b>; revísalas en el HMI local del tablero.
  </div>;
}
