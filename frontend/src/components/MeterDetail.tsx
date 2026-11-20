import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { tokens } from '../design-system';
import { downloadCsv } from '../services/exportCsv';
import { getHistory } from '../services/hail';
import { mergeSeries, meterTag, type Meter } from '../services/meters';
import { usePolling } from '../services/usePolling';
import { MeterHarmonics, MeterReports } from './MeterAnalysis';

type Reading = number | null;
const fmt = (n: Reading, unit = '', digits = 2) => n === null ? '—' : `${n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${unit}`;
const clock = (time: number) => new Date(time).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
const phaseSeries = [tokens.phaseColors.A, tokens.phaseColors.B, tokens.phaseColors.C, tokens.phaseColors.N];
const HISTORY_POINTS = 144;

/** Valores por fase que el equipo reporta. No se infieren fases ni potencias que no llegan. */
export function detailValues(meter: Meter) {
  const voltages: Reading[] = [meter.voltage, null, null, meter.lineVoltage, null, null];
  const currents: Reading[] = [meter.current, null, null, null];
  return { voltages, currents, apparent: null as Reading, reactive: null as Reading };
}

export const HISTORY_COLUMNS = (meter: Meter) => ({
  va: meterTag(meter, 'voltage'),
  ia: meterTag(meter, 'current'),
  active: meterTag(meter, 'power'),
  hz: meterTag(meter, 'frequency'),
});

export default function MeterDetail({ meter, slug }: { meter: Meter; slug: string }) {
  const [tab, setTab] = useState('Medidas');
  const [hours, setHours] = useState(6);
  const columns = HISTORY_COLUMNS(meter);
  const history = usePolling(async signal => {
    const end = new Date();
    const response = await getHistory(slug, {
      tags: Object.values(columns), start: new Date(end.getTime() - hours * 3_600_000), end, points: HISTORY_POINTS, signal,
    });
    return { end: end.getTime(), bucket: response.bucket_seconds, rows: mergeSeries(response, columns) };
  }, 60_000, `${slug}:${meter.prefix}:${hours}`, tab === 'Medidas');
  const rows = (history.data?.rows ?? []).map(row => ({ ...row, vb: null, vc: null, ib: null, ic: null, neutral: null, reactive: null, apparent: null }));
  const { voltages, currents, apparent, reactive } = detailValues(meter);

  const metrics = [
    ['Potencia activa', fmt(meter.power, 'kW')], ['Potencia reactiva', fmt(reactive, 'kvar')], ['Potencia aparente', fmt(apparent, 'kVA')],
    ['Factor de potencia', fmt(meter.factor)], ['Frecuencia', fmt(meter.frequency, 'Hz')], ['Energía acumulada', fmt(meter.energy, 'kWh')],
  ];
  const plots = [
    { title: 'Voltaje fase-neutro (V)', unit: 'V', keys: ['va', 'vb', 'vc'], names: ['A–N', 'B–N', 'C–N'], colors: phaseSeries },
    { title: 'Corrientes (A)', unit: 'A', keys: ['ia', 'ib', 'ic', 'neutral'], names: ['A', 'B', 'C', 'N'], colors: phaseSeries },
    { title: 'Potencias totales', unit: '', keys: ['active', 'reactive', 'apparent'], names: ['Activa kW', 'Reactiva kvar', 'Aparente kVA'], colors: [...tokens.chartSeries] },
    { title: 'Frecuencia (Hz)', unit: 'Hz', keys: ['hz'], names: ['Hz'], colors: [tokens.chartSeries[0]] },
  ] as const;
  const bucketMinutes = history.data ? Math.max(1, Math.round(history.data.bucket / 60)) : null;

  return <div className="meter-detail">
    <div className="meter-detail-status">
      <span className={meter.online ? 'meter-online' : 'meter-offline'}>{meter.online ? 'En línea' : 'Sin comunicación'}{meter.simulated ? ' · datos simulados' : ''}</span>
      <nav className="meter-tabs" aria-label="Sección del medidor">{['Medidas', 'Armónicos', 'Reportes'].map(item => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
    </div>
    {tab === 'Armónicos' ? <MeterHarmonics meter={meter}/> : tab === 'Reportes' ? <MeterReports meter={meter} slug={slug}/> : <>
      <div className="electric-kpis detail-kpis">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="meter-phase-panels">
        <section><h3>Voltajes</h3><dl>{['A–N', 'B–N', 'C–N', 'A–B', 'B–C', 'C–A'].map((label, i) => <div key={label}><dt>{label}</dt><dd>{fmt(voltages[i], 'V', 1)}</dd></div>)}</dl></section>
        <section><h3>Corrientes y potencia por fase</h3><dl>{['I A', 'I B', 'I C', 'P A', 'P B', 'P C', 'I N'].map((label, i) => <div key={label}><dt>{label}</dt><dd>{fmt(i < 3 ? currents[i] : i === 6 ? currents[3] : null, i < 3 || i === 6 ? 'A' : 'kW')}</dd></div>)}</dl></section>
      </div>
      <div className="meter-periods" aria-label="Período del historial">
        <span>Historial:</span>
        {[1, 6, 24].map(h => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} h</button>)}
        <button disabled={!rows.length} onClick={() => downloadCsv(`historial-${meter.code}.csv`, [
          ['Fuente', `Historial de Hail: promedio por intervalo de ${bucketMinutes ?? '?'} min`],
          ['Medidor', meter.name],
          ['Fecha UTC', 'A–N (V)', 'I A (A)', 'P (kW)', 'Hz'],
          ...rows.map(p => [new Date(p.timestamp).toISOString(), p.va, p.ia, p.active, p.hz]),
        ])}>Exportar CSV</button>
        <small>{history.error ? `No se pudo cargar el historial: ${history.error.message}`
          : history.data ? `Promedio cada ${bucketMinutes} min · actualizado ${clock(history.data.end)}` : 'Cargando historial…'}</small>
      </div>
      <div className="meter-chart-grid">{plots.map(plot => {
        const available = rows.some(row => plot.keys.some(key => row[key as keyof typeof row] !== null));
        return <section key={plot.title}>
          <h3>{plot.title}</h3>
          {history.data && !available && <p className="meter-chart-empty">Sin datos en este período</p>}
          <div className="meter-chart"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={tokens.color.gray200} vertical={false}/>
              <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={clock} tick={{ fontSize: 11 }} minTickGap={35}/>
              <YAxis width={48} tick={{ fontSize: 11 }} domain={plot.unit === 'Hz' ? [49.5, 50.5] : [0, 'auto']}/>
              <Tooltip labelFormatter={label => clock(Number(label))} contentStyle={{ background: '#fff', border: `1px solid ${tokens.color.gray200}`, borderRadius: 8 }} formatter={value => typeof value === 'number' ? fmt(value, plot.unit) : '—'}/>
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }}/>
              {plot.keys.map((key, i) => <Line key={key} dataKey={key} name={plot.names[i]} stroke={plot.colors[i]} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/>)}
            </LineChart>
          </ResponsiveContainer></div>
        </section>;
      })}</div>
      <p className="electric-data-note">Por ahora Hail recibe de este medidor una fase de voltaje y corriente y la potencia total. Las otras fases y las potencias reactiva y aparente quedan sin datos hasta que se configuren en el gateway.</p>
    </>}
  </div>;
}
