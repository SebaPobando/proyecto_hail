/** Etiquetas, tonos y permisos de alarmas y bitácora para las pantallas. */
import type { StatusTone } from '../design-system';
import type { Alarm, AlarmPriority, AlarmState, AlarmSummary, ProjectSummary, WorkPriority, WorkStatus } from './hail';

export const priorityLabel: Record<AlarmPriority, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
/** Alta = crítica (rojo), media = advertencia (ámbar), baja = información. Nunca el naranjo de marca. */
export const priorityTone: Record<AlarmPriority, StatusTone> = { high: 'critical', medium: 'warning', low: 'info' };
export const priorityRank: Record<AlarmPriority, number> = { high: 0, medium: 1, low: 2 };

export const stateLabel: Record<AlarmState, string> = {
  active_unack: 'Activa sin reconocer',
  active_ack: 'Activa reconocida',
  cleared_unack: 'Normalizada sin reconocer',
  closed: 'Cerrada',
};

export const workStatusLabel: Record<WorkStatus, string> = { pending: 'Pendiente', in_progress: 'En atención', resolved: 'Resuelto' };
export const workPriorityLabel: Record<WorkPriority, string> = { normal: 'Normal', high: 'Alta' };

/** Reconocer alarmas y escribir en la bitácora: operador, administrador del cliente o de plataforma. */
export const canOperate = (project: Pick<ProjectSummary, 'role'> | undefined) =>
  !!project && ['operator', 'org_admin', 'platform_admin'].includes(project.role);

export const needsAck = (state: AlarmState) => state === 'active_unack' || state === 'cleared_unack';

export function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  const text = value.toLocaleString('es-CL', { maximumFractionDigits: 3 });
  return unit ? `${text} ${unit}` : text;
}

/** Duración legible entre dos instantes: "45 s", "12 min", "3 h 05 min", "2 d 4 h". */
export function duration(fromIso: string, to: number | string = Date.now()): string {
  const end = typeof to === 'string' ? Date.parse(to) : to;
  const seconds = Math.max(0, Math.round((end - Date.parse(fromIso)) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** Valor con que se activó la alarma, en palabras para las de comunicación. */
export function raiseLabel(alarm: Pick<Alarm, 'kind' | 'raise_value' | 'unit'>): { label: string; value: string } {
  if (alarm.kind === 'communication') {
    return {
      label: 'Sin datos',
      value: alarm.raise_value === null ? 'Nunca ha enviado datos' : `${duration(new Date(0).toISOString(), alarm.raise_value * 1000)} sin datos`,
    };
  }
  return { label: 'Valor al activarse', value: formatValue(alarm.raise_value, alarm.unit) };
}

export interface AlarmTotals { open: number; unacknowledged: number; active: number }

export function alarmTotals(summary: readonly AlarmSummary[], slugs?: readonly string[]): AlarmTotals {
  return summary
    .filter(row => !slugs || slugs.includes(row.project))
    .reduce((total, row) => ({
      open: total.open + row.open,
      unacknowledged: total.unacknowledged + row.unacknowledged,
      active: total.active + row.active,
    }), { open: 0, unacknowledged: 0, active: 0 });
}
