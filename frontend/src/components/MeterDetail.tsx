import { MeterHarmonics, MeterReports } from './MeterAnalysis';
import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {downloadCsv} from '../services/exportCsv';
import type { Meter } from './ElectricalOverview';

type Reading = number | null;
const fmt = (n: Reading, unit = '', digits = 2) => n === null ? '—' : `${n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${unit}`;
const colors = ['#0059bc', '#f39200', '#80b600', '#718096'];
const clock = (time: number) => new Date(time).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
export function detailValues(meter: Meter, _index: number) {
  // No inferir fases ni potencias que el equipo no ha reportado.
  const voltages: Reading[] = meter.online ? [meter.voltage,null,null,meter.lineVoltage,null,null] : [null,null,null,null,null,null];
  const currents: Reading[] = meter.online ? [meter.current,null,null,null] : [null,null,null,null];
  return {voltages,currents,apparent:null as Reading,reactive:null as Reading};
}
export default function MeterDetail({ meter, index }: { meter: Meter; index: number }) {
  const [tab, setTab] = useState('Medidas');
  const [hours, setHours] = useState(6);
  const [end] = useState(Date.now);
  const { voltages, currents, apparent, reactive } = detailValues(meter, index);
  const data = useMemo(() => {
    const values = detailValues(meter, index);
    return Array.from({ length: 145 }, (_, i) => {
      const timestamp = end - (144 - i) / 144 * hours * 3600000;
      const vary = (value: Reading, channel: number) => value === null ? null : value === 0 ? 0 : value * (1 + .003 * (Math.sin(timestamp / 90000 + channel) - Math.sin(end / 90000 + channel)));
      return { timestamp, va: vary(values.voltages[0], 0), vb: vary(values.voltages[1], 1), vc: vary(values.voltages[2], 2), ia: vary(values.currents[0], 0), ib: vary(values.currents[1], 1), ic: vary(values.currents[2], 2), neutral: vary(values.currents[3], 3), active: vary(meter.power, 0), reactive: vary(values.reactive, 0), apparent: vary(values.apparent, 0), hz: vary(meter.frequency, 0) };
    });
  }, [meter, index, hours, end]);
  const metrics = [ ['Potencia activa', fmt(meter.power, 'kW')], ['Potencia reactiva', fmt(reactive, 'kvar')], ['Potencia aparente', fmt(apparent, 'kVA')], ['Factor de potencia', fmt(meter.factor)], ['Frecuencia', fmt(meter.frequency, 'Hz')], ['Energía acumulada', fmt(meter.energy, 'kWh')] ];
  const plots = [
    { title: 'Voltaje fase-neutro (V)', unit: 'V', keys: ['va', 'vb', 'vc'], names: ['A–N', 'B–N', 'C–N'], available: meter.voltage !== null },
    { title: 'Corrientes (A)', unit: 'A', keys: ['ia', 'ib', 'ic', 'neutral'], names: ['A', 'B', 'C', 'N'], available: meter.current !== null },
    { title: 'Potencias totales', unit: '', keys: ['active', 'reactive', 'apparent'], names: ['Activa kW', 'Reactiva kvar', 'Aparente kVA'], available: meter.power !== null },
    { title: 'Frecuencia (Hz)', unit: 'Hz', keys: ['hz'], names: ['Hz'], available: meter.frequency !== null },
  ];
  return <div className="meter-detail">
    <div className="meter-detail-status"><span className={meter.online ? 'meter-online' : 'meter-offline'}>{meter.online ? 'En línea · simulado' : 'Sin comunicación · simulado'}</span><nav className="meter-tabs" aria-label="Sección del medidor">{['Medidas','Armónicos','Reportes'].map(item=><button key={item} aria-pressed={tab===item} onClick={()=>setTab(item)}>{item}</button>)}</nav></div>
    {tab === 'Armónicos' ? <MeterHarmonics meter={meter}/> : tab === 'Reportes' ? <MeterReports meter={meter}/> : <>
    <div className="electric-kpis detail-kpis">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="meter-phase-panels"><section><h3>Voltajes</h3><dl>{['A–N', 'B–N', 'C–N', 'A–B', 'B–C', 'C–A'].map((label, i) => <div key={label}><dt>{label}</dt><dd>{fmt(voltages[i], 'V', 1)}</dd></div>)}</dl></section><section><h3>Corrientes y potencia por fase</h3><dl>{['I A', 'I B', 'I C', 'P A', 'P B', 'P C', 'I N'].map((label, i) => <div key={label}><dt>{label}</dt><dd>{fmt(i < 3 ? currents[i] : i === 6 ? currents[3] : null, i < 3 || i === 6 ? 'A' : 'kW')}</dd></div>)}</dl></section></div>
    <div className="meter-periods" aria-label="Período del historial"><span>Historial:</span>{[1, 6, 24].map(h => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} h</button>)}<button onClick={()=>downloadCsv('historial-electrico-demo.csv',[['Fuente','Historial sintético de demostración'],['Fecha UTC','A–N (V)','B–N (V)','C–N (V)','I A (A)','I B (A)','I C (A)','P (kW)','Q (kvar)','S (kVA)','Hz'],...data.map(p=>[new Date(p.timestamp).toISOString(),p.va,p.vb,p.vc,p.ia,p.ib,p.ic,p.active,p.reactive,p.apparent,p.hz])])}>Exportar CSV</button><small>Historial simulado · hasta {clock(end)}</small></div>
    <div className="meter-chart-grid">{plots.map(plot => <section key={plot.title}><h3>{plot.title}</h3>{!plot.available && <p className="meter-chart-empty">{meter.online ? 'Variable no disponible en esta demostración' : 'Sin datos · equipo sin comunicación'}</p>}<div className="meter-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}><CartesianGrid stroke="#e0e8f2" vertical={false}/><XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={clock} tick={{ fontSize: 11 }} minTickGap={35}/><YAxis width={48} tick={{ fontSize: 11 }} domain={plot.unit === 'Hz' ? [49.5, 50.5] : [0, 'auto']}/><Tooltip labelFormatter={label => clock(Number(label))} contentStyle={{ background: '#fff', border: '1px solid #dbe5ef', borderRadius: 8 }} formatter={(value) => typeof value === 'number' ? fmt(value, plot.unit) : '—'}/><Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }}/>{plot.keys.map((key, i) => <Line key={key} dataKey={key} name={plot.names[i]} stroke={plot.title === 'Potencias totales' ? ['#0059bc', '#9445b2', '#13a3b2'][i] : colors[i]} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/>)}</LineChart></ResponsiveContainer></div></section>)}</div>
    </>}
  </div>;
}
