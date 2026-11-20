import { StatusBadge, tokens } from '../design-system';
import { downloadCsv } from '../services/exportCsv';
import { getLatest, getProject, type ProjectSummary } from '../services/hail';
import { buildMeters, type Meter, type MeterField } from '../services/meters';
import { useRouteValue } from '../services/navigation';
import { summarizeLatest } from '../services/projectStatus';
import { usePolling } from '../services/usePolling';
import MeterDetail from './MeterDetail';
import './electricalOverview.css';

export type { Meter };

export const format = (value: number | null, unit = '', digits = 2) => value === null || !Number.isFinite(value)
  ? '—'
  : `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}${unit ? ` ${unit}` : ''}`;

const fields: { key: MeterField; label: string; unit: string; digits: number }[] = [
  { key: 'voltage', label: 'Voltaje A–N', unit: 'V', digits: 1 },
  { key: 'lineVoltage', label: 'Voltaje A–B', unit: 'V', digits: 1 },
  { key: 'current', label: 'Corriente A', unit: 'A', digits: 2 },
  { key: 'power', label: 'P. total', unit: 'kW', digits: 2 },
  { key: 'factor', label: 'FP', unit: '', digits: 2 },
  { key: 'frequency', label: 'Frecuencia', unit: 'Hz', digits: 2 },
  { key: 'thd', label: 'THD V máx.', unit: '%', digits: 2 },
  { key: 'energy', label: 'Energía', unit: 'kWh', digits: 1 },
];

/** Promedio de los valores disponibles; null si no hay ninguno (no se inventa un 0). */
export function average(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

export function onlineTone(online: number, total: number) {
  if (!total || online === 0) return tokens.status.critical;
  return online === total ? tokens.status.ok : tokens.status.warning;
}

/** IEEE 519-2014: THD de voltaje recomendado ≤ 8 % en baja tensión (≤ 1 kV). */
export function thdTone(thd: number | null) {
  if (thd === null) return tokens.status.stopped;
  return thd > 8 ? tokens.status.critical : thd > 5 ? tokens.status.warning : tokens.status.ok;
}

function Badge({ meter }: { meter: Meter }) {
  if (!meter.online) return <span className="meter-offline">Sin comunicación</span>;
  return <span className="meter-online">{meter.simulated ? 'En línea · simulado' : 'En línea'}</span>;
}

function Gauge({ label, value, amount, max, color, scale }: { label: string; value: string; amount: number | null; max: number; color: string; scale: string }) {
  const percent = amount === null ? 0 : Math.max(0, Math.min(100, amount / max * 100));
  return <article className="electric-gauge">
    <svg viewBox="0 0 260 155" role="img" aria-label={`${label}: ${value}. Escala ${scale}`}>
      <path d="M24 130 A106 106 0 0 1 236 130" pathLength="100"/>
      <path d="M24 130 A106 106 0 0 1 236 130" pathLength="100" style={{ stroke: color }} strokeDasharray={`${percent} 100`}/>
    </svg>
    <strong>{value}</strong><span>{label}</span><small>{scale}</small>
  </article>;
}

export default function ElectricalOverview({ project }: { project: ProjectSummary }) {
  const detail = usePolling(signal => getProject(project.slug, signal), 0, `detail:${project.slug}`);
  const latest = usePolling(signal => getLatest(project.slug, signal), 5000, `meters:${project.slug}`, true, { kinds: ['telemetry'], project: project.slug });
  const meters = buildMeters(detail.data?.devices ?? [], latest.data?.readings ?? []);
  const [route, setRoute] = useRouteValue('meter', 'all', ['all', ...meters.map(meter => meter.code)]);
  const selected = meters.find(meter => meter.code === route) ?? null;
  const summary = summarizeLatest(latest.data, latest.error);
  const organization = project.organization.name;

  if (!detail.data) {
    return <section className="electrical-dashboard" aria-label="Monitoreo eléctrico">
      {detail.error ? <p role="alert">No se pudo cargar el proyecto. {detail.error.message} <button onClick={detail.refresh}>Reintentar</button></p> : <p role="status">Cargando medidores…</p>}
    </section>;
  }

  const online = meters.filter(meter => meter.online);
  const sum = (key: 'power' | 'energy') => online.some(m => m[key] !== null) ? online.reduce((total, m) => total + (m[key] ?? 0), 0) : null;
  const frequency = average(online.map(m => m.frequency));
  const voltage = average(online.map(m => m.voltage));
  const thdValues = online.flatMap(m => (m.thd === null ? [] : [m.thd]));
  const thd = thdValues.length ? Math.max(...thdValues) : null;
  const displayed = selected ? [selected] : meters;
  const source = summary.label === 'Simulación' ? 'Lecturas simuladas recibidas por Hail' : 'Lecturas recibidas por Hail';

  return <section className="electrical-dashboard" aria-label="Monitoreo eléctrico">
    <div className="electric-heading">
      <div>
        <h2>{selected ? selected.name : 'Resumen de monitoreo eléctrico'}</h2>
        <p>{organization} · {selected ? selected.model : `Vista general de ${meters.length} medidores`}</p>
      </div>
      <StatusBadge tone={summary.tone}>{summary.label}</StatusBadge>
    </div>
    {latest.error && <p role="alert" className="portal-notice">No se pudieron actualizar las lecturas. {latest.error.message}</p>}
    <button className="ds-button ds-button--secondary ds-button--sm report-export" onClick={() => downloadCsv('medidores.csv', [
      ['Fuente', source],
      ['Consulta', new Date().toISOString()],
      ['Medidor', 'Estado', ...fields.map(f => `${f.label}${f.unit ? ` (${f.unit})` : ''}`)],
      ...displayed.map(m => [m.name, m.online ? 'En línea' : 'Sin comunicación', ...fields.map(f => m[f.key])]),
    ])}>Exportar medidas CSV</button>
    <div className="electric-navigation" aria-label="Seleccionar medidor">
      <button aria-pressed={!selected} onClick={() => setRoute('all')}>Inicio</button>
      {meters.map(m => <button key={m.code} aria-pressed={selected?.code === m.code} onClick={() => setRoute(m.code)}>{m.name}</button>)}
    </div>
    {selected ? <MeterDetail key={selected.code} meter={selected} slug={project.slug}/> : <>
      <div className="electric-kpis">{[
        { label: 'Medidores instalados', value: String(meters.length) },
        { label: 'Medidores en línea', value: `${online.length} de ${meters.length}` },
        { label: 'Potencia activa total', value: format(sum('power'), 'kW') },
        { label: 'Energía acumulada disponible', value: format(sum('energy'), 'kWh', 1) },
      ].map(k => <article key={k.label}><span>{k.label}</span><strong>{k.value}</strong></article>)}</div>
      <div className="electric-gauge-grid">
        <Gauge label="Medidores en línea" value={`${online.length} de ${meters.length}`} amount={online.length} max={Math.max(1, meters.length)} color={onlineTone(online.length, meters.length)} scale={`0–${meters.length} equipos`}/>
        <Gauge label="Frecuencia promedio" value={format(frequency, 'Hz')} amount={frequency} max={60} color={tokens.color.blue500} scale="0–60 Hz"/>
        <Gauge label="Promedio A–N disponible" value={format(voltage, 'V', 1)} amount={voltage} max={300} color={tokens.color.blue500} scale="0–300 V"/>
        <Gauge label="THD voltaje máximo" value={format(thd, '%')} amount={thd} max={10} color={thdTone(thd)} scale="0–10 %"/>
      </div>
      <p className="electric-data-note">Resumen calculado solo con los medidores en línea. Los guiones indican variables sin lectura vigente. La energía es el contador acumulado del equipo; no representa el consumo de un período. THD de voltaje: IEEE 519 recomienda hasta 8 % en baja tensión.</p>
      <div className="electric-meter-grid">{displayed.map(m => <article key={m.code} className={`electric-meter ${m.online ? '' : 'is-offline'}`}>
        <header><button onClick={() => setRoute(m.code)}>{m.name}</button><Badge meter={m}/></header>
        <p>{m.model}</p>
        <dl>{[
          { label: 'Voltaje A–N', value: format(m.voltage, 'V', 1) },
          { label: 'Corriente A', value: format(m.current, 'A') },
          { label: 'Potencia', value: format(m.power, 'kW') },
          { label: 'Frecuencia', value: format(m.frequency, 'Hz') },
        ].map(v => <div key={v.label}><dt>{v.label}</dt><dd>{v.value}</dd></div>)}</dl>
      </article>)}</div>
      <section className="portal-table-panel"><h2>Resumen de medidas</h2>
        <div className="portal-table-scroll" tabIndex={0} role="region" aria-label="Tabla de medidas eléctricas"><table>
          <thead><tr><th>Medidor</th><th>Estado</th>{fields.map(f => <th key={f.key}>{f.label}</th>)}</tr></thead>
          <tbody>{displayed.map(m => <tr key={m.code}>
            <th><button className="electric-table-link" onClick={() => setRoute(m.code)}>{m.name}</button><small>{m.model}</small></th>
            <td><Badge meter={m}/></td>
            {fields.map(f => <td key={f.key}>{format(m[f.key], f.unit, f.digits)}</td>)}
          </tr>)}</tbody>
        </table></div>
      </section>
    </>}
    <footer className="electric-footer">{organization} · Monitoreo eléctrico</footer>
  </section>;
}
