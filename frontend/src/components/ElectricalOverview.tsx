import { useRouteValue } from '../services/navigation';
import './electricalOverview.css';
import {downloadCsv} from '../services/exportCsv';
import MeterDetail from './MeterDetail';

export type Meter = { name: string; model: string; online: boolean; voltage: number | null; lineVoltage: number | null; current: number | null; power: number | null; factor: number | null; frequency: number | null; thd: number | null; energy: number | null };
const meters: Meter[] = [
  { name: 'Edificio Docente', model: 'Accuenergy Acuvim II-R · Full', online: true, voltage: 233.7, lineVoltage: 404.2, current: 11.35, power: 6.24, factor: .92, frequency: 49.92, thd: 1.9, energy: 1349.7 },
  { name: 'Medidor 2', model: 'Schneider PM5330 · Full', online: true, voltage: 231.7, lineVoltage: 401.3, current: 0, power: 0, factor: null, frequency: 49.94, thd: 2.71, energy: 3911.4 },
  { name: 'Medidor 3', model: 'CHINT PD7777 · Estándar', online: true, voltage: 231.5, lineVoltage: null, current: 0, power: 0, factor: null, frequency: null, thd: null, energy: null },
  ...[4, 5].map(n => ({ name: `Medidor ${n}`, model: 'CHINT PD666 · Estándar', online: false, voltage: null, lineVoltage: null, current: null, power: null, factor: null, frequency: null, thd: null, energy: null })),
];
const format = (value: number | null, unit = '', digits = 2) => value === null ? '—' : `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}${unit ? ` ${unit}` : ''}`;
const fields = [
  { key: 'voltage', label: 'Voltaje A–N', unit: 'V', digits: 1 },
  { key: 'lineVoltage', label: 'Voltaje A–B', unit: 'V', digits: 1 },
  { key: 'current', label: 'Corriente A', unit: 'A', digits: 2 },
  { key: 'power', label: 'P. total', unit: 'kW', digits: 2 },
  { key: 'factor', label: 'FP', unit: '', digits: 2 },
  { key: 'frequency', label: 'Frecuencia', unit: 'Hz', digits: 2 },
  { key: 'thd', label: 'THD V máx.', unit: '%', digits: 2 },
  { key: 'energy', label: 'Energía', unit: 'kWh', digits: 1 },
] as const;
function Badge({ online }: { online: boolean }) { return <span className={online ? 'meter-online' : 'meter-offline'}>{online ? 'En línea' : 'Sin comunicación'}</span>; }
function Gauge({ label, value, amount, max, color, scale }: { label: string; value: string; amount: number; max: number; color: string; scale: string }) {
  return <article className="electric-gauge"><svg viewBox="0 0 260 155" role="img" aria-label={`${label}: ${value}. Escala ${scale}`}><path d="M24 130 A106 106 0 0 1 236 130" pathLength="100"/><path d="M24 130 A106 106 0 0 1 236 130" pathLength="100" style={{ stroke: color }} strokeDasharray={`${Math.max(0, Math.min(100, amount / max * 100))} 100`}/></svg><strong>{value}</strong><span>{label}</span><small>{scale}</small></article>;
}
export default function ElectricalOverview() {
  const [route,setRoute]=useRouteValue('meter','all',['all','0','1','2','3','4']);
  const selected=route==='all'?null:Number(route);
  const setSelected=(index:number|null)=>setRoute(index===null?'all':String(index));
  const online = meters.filter(m => m.online);
  const sum = (key: 'power' | 'energy') => online.reduce((total, m) => total + (m[key] ?? 0), 0);
  const average = (key: 'voltage' | 'frequency') => { const values = online.flatMap(m => m[key] === null ? [] : [m[key]]); return values.reduce((a, b) => a + b, 0) / values.length; };
  const thd = Math.max(...online.flatMap(m => m.thd === null ? [] : [m.thd]));
  const displayed = selected === null ? meters : [meters[selected]];
  return <section className="electrical-dashboard" aria-label="Monitoreo eléctrico">
    <div className="electric-heading"><div><h2>{selected === null ? 'Resumen de monitoreo eléctrico' : meters[selected].name}</h2><p>Universidad de Los Lagos · {selected === null ? 'Vista general de los cinco medidores' : meters[selected].model}</p></div><span className="electric-demo">Demostración · datos de ejemplo</span></div>
    <button className="ds-button ds-button--secondary ds-button--sm report-export" onClick={()=>downloadCsv('medidores-demostracion.csv',[['Fuente','Demostración; no utilizar como reporte de campo'],['Medidor',...fields.map(f=>`${f.label} (${f.unit})`)],...displayed.map(m=>[m.name,...fields.map(f=>m[f.key])])])}>Exportar medidas CSV · demo</button>
    <div className="electric-navigation" aria-label="Seleccionar medidor"><button aria-pressed={selected === null} onClick={() => setSelected(null)}>Inicio</button>{meters.map((m, i) => <button key={m.name} aria-pressed={selected === i} onClick={() => setSelected(i)}>{m.name}</button>)}</div>
    {selected !== null ? <MeterDetail key={selected} meter={meters[selected]} index={selected}/> : <>
    <div className="electric-kpis">{[{ label: 'Medidores instalados', value: '5' }, { label: 'Medidores en línea', value: '3 de 5' }, { label: 'Potencia activa total', value: format(sum('power'), 'kW') }, { label: 'Energía acumulada disponible', value: format(sum('energy'), 'kWh', 1) }].map(k => <article key={k.label}><span>{k.label}</span><strong>{k.value}</strong></article>)}</div>
    <div className="electric-gauge-grid"><Gauge label="Medidores en línea" value="3 de 5" amount={3} max={5} color="#ed9000" scale="0–5 equipos"/><Gauge label="Frecuencia promedio" value={format(average('frequency'), 'Hz')} amount={average('frequency')} max={60} color="#075ab8" scale="0–60 Hz"/><Gauge label="Promedio A–N disponible" value={format(average('voltage'), 'V', 1)} amount={average('voltage')} max={300} color="#075ab8" scale="0–300 V"/><Gauge label="THD voltaje máximo" value={format(thd, '%')} amount={thd} max={10} color="#80b600" scale="0–10 %"/></div>
    <p className="electric-data-note">Resumen global calculado con lecturas disponibles. Los guiones indican variables sin datos; los equipos sin comunicación no se incluyen. La energía es acumulada y parcial; no representa consumo de un período.</p>
    <div className="electric-meter-grid">{displayed.map(m => <article key={m.name} className={`electric-meter ${m.online ? '' : 'is-offline'}`}><header><button onClick={() => setSelected(meters.indexOf(m))}>{m.name}</button><Badge online={m.online}/></header><p>{m.model}</p><dl>{[{ label: 'Voltaje A–N', value: format(m.voltage, 'V', 1) }, { label: 'Corriente A', value: format(m.current, 'A') }, { label: 'Potencia', value: format(m.power, 'kW') }, { label: 'Frecuencia', value: format(m.frequency, 'Hz') }].map(v => <div key={v.label}><dt>{v.label}</dt><dd>{v.value}</dd></div>)}</dl></article>)}</div>
    <section className="portal-table-panel"><h2>Resumen de medidas</h2><div className="portal-table-scroll" tabIndex={0} role="region" aria-label="Tabla de medidas eléctricas"><table><thead><tr><th>Medidor</th><th>Estado</th>{fields.map(f => <th key={f.key}>{f.label}</th>)}</tr></thead><tbody>{displayed.map(m => <tr key={m.name}><th><button className="electric-table-link" onClick={() => setSelected(meters.indexOf(m))}>{m.name}</button><small>{m.model}</small></th><td><Badge online={m.online}/></td>{fields.map(f => <td key={f.key}>{format(m[f.key], f.unit, f.digits)}</td>)}</tr>)}</tbody></table></div></section>
    </>}
    <footer className="electric-footer">Universidad de Los Lagos · Monitoreo eléctrico</footer>
  </section>;
}
