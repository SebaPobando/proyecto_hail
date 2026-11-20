import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { tokens } from '../design-system';
import { createApiHistory, toWaterTelemetry } from '../services/aguapozo';
import { getLatest, type ProjectSummary } from '../services/hail';
import { useRouteValue } from '../services/navigation';
import { isUsable, telemetryStatus } from '../services/quality';
import { usePolling } from '../services/usePolling';
import { pumpStatus } from './equipmentStatus';
import AlarmsPanel from './AlarmsPanel';
import HmiNavigation from './HmiNavigation';
import ProcessDiagram from './ProcessDiagram';
import ProcessVariables from './ProcessVariables';
import '../trends.css';

const TrendsScreen = lazy(() => import('./TrendsScreen'));
const POLL_MS = 2000;

function Panel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`} aria-label={title}><h2>{title}</h2>{children}</section>;
}

function Equipment({ type }: { type: 'pump' | 'dose' | 'plc' }) {
  return <svg viewBox="0 0 60 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{type === 'plc'
    ? <>{[5, 20, 35].map(x => <g key={x}><rect x={x} y="6" width="13" height="36"/><path d={`M${x + 4} 11v5m0 5v5m0 5v5`}/></g>)}</>
    : <><rect x="12" y="11" width="35" height="26" rx="2"/>{[17, 22, 27, 32].map(y => <path key={y} d={`M18 ${y}H41`}/>)}<path d="M7 17v14m45-14v14M23 6h15M21 38v6m17-6v6M16 44h28"/></>}</svg>;
}

const statusText: Record<string, string> = {
  'Simulación': 'Recibiendo datos simulados',
  'En línea': 'En línea',
  'Datos antiguos': 'Lecturas desactualizadas: no han llegado datos recientes',
  'Sin comunicación': 'Sin comunicación con el gateway',
  'Calidad no válida': 'Lecturas con calidad dudosa o mala',
  'Datos inválidos': 'Lecturas fuera de rango o con fecha inválida',
};

/** HMI de agua potable (pozo, estanque y cloración) con datos de la API de Hail. */
export default function WaterHmi({ project, back }: { project: ProjectSummary; back: ReactNode }) {
  const [screen, setScreen] = useRouteValue('waterScreen', 'process', ['process', 'trends', 'alarms']);
  const latest = usePolling(signal => getLatest(project.slug, signal), POLL_MS, `latest:${project.slug}`, true, { kinds: ['telemetry'], project: project.slug });
  const history = useMemo(() => createApiHistory(project.slug), [project.slug]);

  const candidate = toWaterTelemetry(latest.data);
  // Se evalúa con la hora del servidor para no depender del reloj del navegador.
  const serverNow = latest.data && latest.receivedAt
    ? Date.parse(latest.data.server_time) + (Date.now() - latest.receivedAt)
    : Date.now();
  const quality = telemetryStatus(candidate, serverNow);
  const data = candidate && isUsable(quality) ? candidate : null;
  const status = latest.error ? `Sin respuesta del servidor: ${latest.error.message}`
    : !latest.data ? 'Conectando con Hail…'
      : !candidate ? 'Todavía no hay lecturas completas de AguaPozo'
        : statusText[quality] ?? quality;

  const states = [
    { type: 'pump' as const, label: 'P-101 – Bomba Sumergible', status: data ? pumpStatus[data.states.pump].label : 'Desconocido' },
    { type: 'dose' as const, label: 'D-101 – Dosificación', status: !data ? 'Desconocido' : data.states.dosing === 'active' ? 'Activa' : data.states.dosing === 'fault' ? 'Falla' : 'Inactiva' },
    { type: 'plc' as const, label: 'Gateway – Comunicación', status: !data ? 'Desconocido' : { simulated: 'Simulada', connected: 'Conectado', disconnected: 'Desconectado' }[data.states.communication] },
  ];

  return <div className="app-shell water-hmi">
    <header className="header">
      <svg className="drop" viewBox="0 0 60 80" aria-hidden="true"><path d="M30 5C22 21 8 39 8 51a22 22 0 0044 0C52 39 38 21 30 5Z" fill="none" stroke="#00aeef" strokeWidth="6"/></svg>
      <div className="header-title"><h1>Sistema de Agua Potable</h1><p>Captación desde Pozo Profundo · Tratamiento · Estanque Elevado</p></div>
    </header>
    <div className="demo-strip project-session-bar">
      {back}
      <span role="status">{status}</span>
    </div>
    <HmiNavigation value={screen} onChange={setScreen} items={[{ id: 'process', label: 'Proceso' }, { id: 'trends', label: 'Tendencias' }, { id: 'alarms', label: 'Alarmas' }]}/>
    <div className="hmi-screen-content">
      {screen === 'process' && !data && <div className="demo-strip" role="status">Sin datos actuales. Lecturas y estados desconocidos; el esquema no representa niveles reales.</div>}
      {screen === 'process' && data && <div className="demo-strip"><time dateTime={data.timestamp}>Última actualización: {new Date(data.timestamp).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}</time>{data.states.communication === 'simulated' && <span>Datos simulados</span>}</div>}
      {screen === 'process' ? <main>
        <Panel title="Proceso" className="process-panel"><ProcessDiagram data={data}/></Panel>
        <aside>
          <Panel title="Variables del Proceso" className="variables"><ProcessVariables project={project.slug} defaults={['level', 'volume', 'flow', 'chlorine']} variables={[
            { id: 'level', tag: 'LT-101', label: 'Nivel del estanque', value: data?.level.value.toFixed(1) ?? '—', unit: '%' },
            { id: 'volume', tag: 'LT-101', label: 'Volumen estimado', value: data ? (data.level.value / 2).toFixed(1) : '—', unit: 'm³', note: 'Capacidad del estanque: 50 m³' },
            { id: 'well', tag: 'LT-102', label: 'Nivel del pozo', value: data?.wellWaterDepthM.value.toFixed(1) ?? '—', unit: 'm', note: 'Distancia desde la boca al espejo de agua' },
            { id: 'flow', tag: 'FT-101', label: 'Caudal', value: data?.flow.value.toFixed(1) ?? '—', unit: 'm³/h' },
            { id: 'chlorine', tag: 'AIT-101', label: 'Cloro residual', value: data?.chlorine.value.toFixed(2) ?? '—', unit: 'mg/L' },
          ]}/></Panel>
          <Panel title="Estados" className="states"><div className="panel-body">{states.map(s => <div className="state-row" key={s.type}>
            <Equipment type={s.type}/><span>{s.label}</span>
            <strong className={s.type === 'plc' && data?.states.communication === 'simulated' ? 'simulated' : ''}>
              <i style={!data ? { backgroundColor: tokens.status.stopped } : s.type === 'pump' ? { backgroundColor: pumpStatus[data.states.pump].color } : undefined}/>{s.status}
            </strong>
          </div>)}</div></Panel>
        </aside>
      </main> : screen === 'trends'
        ? <Suspense fallback={<main className="trends-screen" aria-label="Tendencias"><p role="status">Cargando pantalla…</p></main>}><TrendsScreen data={data} historyService={history}/></Suspense>
        : <main className="water-alarms" aria-label="Alarmas"><AlarmsPanel projects={[project]} project={project.slug}/></main>}
    </div>
  </div>;
}
