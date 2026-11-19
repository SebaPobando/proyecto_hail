import { useState, useSyncExternalStore } from 'react';
import type { AlarmService } from '../services/types';
import { alarmSummary, filterAlarmSnapshot, type AlarmFilters } from '../services/alarms';
import '../alarms.css';

const dateTime = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const formatDate = (value: string) => dateTime.format(new Date(value));
function SummaryIcon({ kind }: { kind: 'critical' | 'warning' | 'info' }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true">{kind === 'info' ? <><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="5"/><path d="M32 28v18" stroke="currentColor" strokeWidth="6"/><circle cx="32" cy="19" r="3.5" fill="currentColor"/></> : <><path d="M27 8q5-8 10 0l24 42q4 8-5 8H8q-9 0-5-8Z" fill="currentColor"/><path d="M32 22v16" stroke="#092333" strokeWidth="6" strokeLinecap="round"/><circle cx="32" cy="47" r="3.5" fill="#092333"/></>}</svg>;
}
function ClockIcon() { return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M16 7v10l7 4"/></svg>; }
function PriorityBadge({ priority }: { priority: 'critical' | 'warning' }) { return <span className={`alarm-badge ${priority}`}>{priority === 'critical' ? 'Crítica' : 'Advertencia'}</span>; }
export default function AlarmsScreen({ service }: { service: AlarmService }) {
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const [filters, setFilters] = useState<AlarmFilters>({ state: 'all', priority: 'all', range: 'today' });
  const now = Date.parse(snapshot.updatedAt);
  const summary = alarmSummary(snapshot, now);
  const { alarms, events } = filterAlarmSnapshot(snapshot, filters, now);
  return <main className="alarms-screen" aria-label="Alarmas">
    <section className="alarm-overview" aria-labelledby="alarms-title">
      <header className="alarm-titlebar"><h2 id="alarms-title">Alarmas</h2><time dateTime={snapshot.updatedAt}><ClockIcon/>Última actualización: {formatDate(snapshot.updatedAt)}</time></header>
      <div className="alarm-overview-body">
        <div className="alarm-summaries" aria-label="Resumen general sin filtros">
          {[{ kind: 'critical' as const, label: 'Críticas', count: summary.critical }, { kind: 'warning' as const, label: 'Advertencias', count: summary.warning }, { kind: 'info' as const, label: 'Eventos (24 h)', count: summary.events }].map(item => <div key={item.kind} className={`alarm-summary ${item.kind}`} title="Resumen general, independiente de los filtros"><SummaryIcon kind={item.kind}/><div><span>{item.label}</span><strong>{item.count}</strong></div></div>)}
        </div>
        <div className="alarm-filters">
          <label>Estado:<select value={filters.state} onChange={event => setFilters({ ...filters, state: event.target.value as AlarmFilters['state'] })}><option value="all">Todas</option><option value="active">Activas</option><option value="normalized">Normalizadas</option></select></label>
          <label>Prioridad:<select value={filters.priority} onChange={event => setFilters({ ...filters, priority: event.target.value as AlarmFilters['priority'] })}><option value="all">Todas</option><option value="critical">Crítica</option><option value="warning">Advertencia</option></select></label>
          <label className="alarm-range">Rango:<select value={filters.range} onChange={event => setFilters({ ...filters, range: event.target.value as AlarmFilters['range'] })}><option value="today">Hoy</option><option value="24h">Últimas 24 h</option><option value="7d">Últimos 7 días</option></select></label>
        </div>
      </div>
    </section>
    <section className="alarm-section" aria-labelledby="active-alarms-heading">
      <div className="alarm-section-heading"><h3 id="active-alarms-heading">Alarmas Activas <span>({alarms.length})</span></h3><span className="alarm-context" title="Registro de alarmas según la fuente seleccionada">Valores al disparo</span></div>
      <div className="alarm-table-wrap active-alarm-table"><table><caption className="sr-only">Alarmas activas filtradas por estado, prioridad y rango</caption><colgroup><col className="date-column"/><col className="tag-column"/><col/><col className="badge-column"/></colgroup><thead><tr><th scope="col">Fecha y Hora</th><th scope="col">Tag</th><th scope="col">Descripción</th><th scope="col">Prioridad</th></tr></thead><tbody>
        {alarms.map(alarm => <tr key={alarm.id} className={`active-alarm ${alarm.priority}`}><td><time dateTime={alarm.timestamp}>{formatDate(alarm.timestamp)}</time></td><td>{alarm.tag}</td><td>{alarm.description}</td><td><PriorityBadge priority={alarm.priority}/></td></tr>)}
        {!alarms.length && <tr><td colSpan={4} className="alarm-empty">{filters.state === 'normalized' ? 'Las alarmas normalizadas se muestran en el historial de eventos.' : 'No hay alarmas activas que coincidan con los filtros.'}</td></tr>}
      </tbody></table></div>
    </section>
    <section className="alarm-section events-section" aria-labelledby="events-heading">
      <div className="alarm-section-heading"><h3 id="events-heading">Historial de Eventos</h3><span>{events.length > 20 ? 'Últimos 20 eventos' : `${events.length} eventos`}</span></div>
      <div className="alarm-table-wrap event-table" tabIndex={0} role="region" aria-label="Historial de eventos desplazable"><table><caption className="sr-only">Historial de eventos filtrado, del más reciente al más antiguo</caption><colgroup><col className="date-column"/><col className="tag-column"/><col/><col className="badge-column"/></colgroup><thead><tr><th scope="col">Fecha y Hora</th><th scope="col">Tag</th><th scope="col">Descripción</th><th scope="col">Evento</th></tr></thead><tbody>
        {events.slice(0, 20).map(event => <tr key={event.id}><td><time dateTime={event.timestamp}>{formatDate(event.timestamp)}</time></td><td>{event.tag}</td><td>{event.description}</td><td><span className={`alarm-badge ${event.type === 'activated' ? event.priority : 'neutral'}`}>{event.type === 'activated' ? 'Activación' : event.type === 'normalized' ? 'Normalizado' : 'Estado'}</span></td></tr>)}
        {!events.length && <tr><td colSpan={4} className="alarm-empty">No hay eventos que coincidan con los filtros.</td></tr>}
      </tbody></table></div>
    </section>
  </main>;
}
