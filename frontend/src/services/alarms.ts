import type { Alarm, AlarmEvent, AlarmService, AlarmSnapshot } from './types';

export interface AlarmFilters { state: 'all' | 'active' | 'normalized'; priority: 'all' | 'critical' | 'warning'; range: 'today' | '24h' | '7d'; }
const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY = 86_400_000;
export function withinAlarmRange(timestamp: string, range: AlarmFilters['range'], now: number): boolean {
  const value = Date.parse(timestamp);
  if (!Number.isFinite(value) || value > now) return false;
  return range === 'today' ? localDay.format(value) === localDay.format(now) : value >= now - (range === '24h' ? DAY : 7 * DAY);
}
export function filterAlarmSnapshot(snapshot: AlarmSnapshot, filters: AlarmFilters, now: number) {
  const matches = (item: Alarm | AlarmEvent) => (filters.priority === 'all' || item.priority === filters.priority) && withinAlarmRange(item.timestamp, filters.range, now);
  const newest = (a: { timestamp: string }, b: { timestamp: string }) => Date.parse(b.timestamp) - Date.parse(a.timestamp);
  const alarms = snapshot.alarms.filter(alarm => alarm.state === 'active' && filters.state !== 'normalized' && matches(alarm)).sort(newest);
  const events = snapshot.events.filter(event => matches(event) && (filters.state === 'all' || (filters.state === 'active' ? event.type === 'activated' : event.type === 'normalized'))).sort(newest);
  return { alarms, events };
}
export function alarmSummary(snapshot: AlarmSnapshot, now: number) {
  return {
    critical: snapshot.alarms.filter(alarm => alarm.state === 'active' && alarm.priority === 'critical').length,
    warning: snapshot.alarms.filter(alarm => alarm.state === 'active' && alarm.priority === 'warning').length,
    events: snapshot.events.filter(event => withinAlarmRange(event.timestamp, '24h', now)).length,
  };
}

/** Escenario ilustrativo independiente de la telemetría: valores al disparo. */
export function createAlarmScenario(now: number): AlarmSnapshot {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const alarms: Alarm[] = [
    { id: 'alarm-chlorine', timestamp: ago(8), tag: 'AIT-101', description: 'Cloro residual bajo (0.22 mg/L)', priority: 'critical', state: 'active', quality: 'simulated' },
    { id: 'alarm-flow', timestamp: ago(12), tag: 'FT-101', description: 'Caudal bajo (5.8 m³/h)', priority: 'warning', state: 'active', quality: 'simulated' },
    { id: 'alarm-level', timestamp: ago(20), tag: 'LT-101', description: 'Nivel bajo en estanque (24.5 %)', priority: 'warning', state: 'active', quality: 'simulated' },
  ];
  const events: AlarmEvent[] = [
    ...alarms.map(alarm => ({ id: `event-${alarm.id}`, timestamp: alarm.timestamp, tag: alarm.tag, description: alarm.description, priority: alarm.priority, type: 'activated' as const, quality: 'simulated' as const })),
    { id: 'chlorine-normal', timestamp: ago(25), tag: 'AIT-101', description: 'Cloro residual en rango (0.65 mg/L)', priority: 'critical', type: 'normalized', quality: 'simulated' },
    { id: 'pump-running', timestamp: ago(38), tag: 'P-101', description: 'Bomba en marcha', priority: 'info', type: 'state', quality: 'simulated' },
    { id: 'pump-stopped', timestamp: ago(40), tag: 'P-101', description: 'Bomba detenida', priority: 'info', type: 'state', quality: 'simulated' },
    { id: 'level-normal', timestamp: ago(55), tag: 'LT-101', description: 'Nivel en rango (68.0 %)', priority: 'warning', type: 'normalized', quality: 'simulated' },
    { id: 'flow-normal', timestamp: ago(70), tag: 'FT-101', description: 'Caudal en rango (12.4 m³/h)', priority: 'warning', type: 'normalized', quality: 'simulated' },
    { id: 'previous-chlorine', timestamp: ago(26 * 60), tag: 'AIT-101', description: 'Cloro residual en rango (0.64 mg/L)', priority: 'critical', type: 'normalized', quality: 'simulated' },
    { id: 'previous-pump', timestamp: ago(72 * 60), tag: 'P-101', description: 'Bomba en marcha', priority: 'info', type: 'state', quality: 'simulated' },
  ];
  return { updatedAt: new Date(now).toISOString(), alarms, events };
}
export function createAlarmSimulationService(): AlarmService {
  let snapshot = createAlarmScenario(Date.now());
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (!timer) timer = setInterval(() => { snapshot = { ...snapshot, updatedAt: new Date().toISOString() }; listeners.forEach(notify => notify()); }, 15_000);
      return () => { listeners.delete(listener); if (!listeners.size) { clearInterval(timer); timer = undefined; } };
    },
  };
}
