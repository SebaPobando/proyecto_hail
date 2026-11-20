import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { tokens } from '../design-system';
import { downloadCsv } from '../services/exportCsv';
import { getHistory, HISTORY_MAX_DAYS, HISTORY_MAX_POINTS, type HistoryResponse } from '../services/hail';
import { mergeSeries, meterTag, summarizeBuckets, type Meter, type MeterField } from '../services/meters';
import './meterAnalysis.css';

const fields = [
  ['voltage', 'Voltaje A–N', 'V', 'Voltajes'], ['lineVoltage', 'Voltaje A–B', 'V', 'Voltajes'],
  ['current', 'Corriente A', 'A', 'Corrientes'], ['power', 'Potencia activa total', 'kW', 'Potencias'],
  ['factor', 'Factor de potencia', '', 'Potencias'], ['frequency', 'Frecuencia', 'Hz', 'Frecuencia y energía'],
  ['thd', 'THD voltaje máximo', '%', 'Armónicos'],
] as const satisfies readonly (readonly [MeterField, string, string, string])[];
type Key = typeof fields[number][0];
const fieldOf = (key: Key) => fields.find(f => f[0] === key)!;
const format = (v: number | null) => v === null ? '—' : v.toLocaleString('es-CL', { maximumFractionDigits: 3 });
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const phases = [tokens.phaseColors.A, tokens.phaseColors.B, tokens.phaseColors.C];

/** Valida el período del reporte y calcula cuántos intervalos pedir al backend. */
export function reportPlan(from: number, to: number, minutes: number): { points: number } | { error: string } {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return { error: 'La fecha final debe ser posterior a la inicial.' };
  if (to - from > HISTORY_MAX_DAYS * 86_400_000) return { error: `El período máximo es de ${HISTORY_MAX_DAYS} días.` };
  const points = Math.ceil((to - from) / 60_000 / minutes);
  if (points > HISTORY_MAX_POINTS) return { error: `Son ${points} intervalos; el máximo es ${HISTORY_MAX_POINTS}. Acorta el período o usa un intervalo mayor.` };
  return { points: Math.max(2, points) };
}

export function MeterHarmonics({ meter }: { meter: Meter }) {
  return <div className="meter-analysis">
    <p className="electric-data-note">Distorsión armónica total (THD). Hail recibe solo el máximo de voltaje; no se asigna a una fase ni se infiere el THD de corriente.</p>
    <div className="electric-kpis">
      <article><span>THD de voltaje máximo</span><strong>{format(meter.online ? meter.thd : null)} %</strong></article>
      <article><span>Datos por fase</span><strong>No disponibles</strong></article>
    </div>
    <div className="meter-chart-grid">{['voltaje', 'corriente'].map(kind => <section key={kind}>
      <h3>THD de {kind} por fase (%)</h3>
      <div className="meter-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={['A', 'B', 'C'].map(phase => ({ phase, value: null }))}>
        <CartesianGrid vertical={false} stroke={tokens.color.gray200}/><XAxis dataKey="phase"/><YAxis unit=" %" domain={[0, 10]}/><Tooltip/>
        <Bar dataKey="value">{phases.map(color => <Cell key={color} fill={color}/>)}</Bar>
      </BarChart></ResponsiveContainer></div>
      <dl className="harmonic-phases">{['A', 'B', 'C'].map(phase => <div key={phase}><dt>Fase {phase}</dt><dd>— %</dd></div>)}</dl>
      <p>Sin muestras por fase. Se requieren esos registros del equipo para habilitar esta vista.</p>
    </section>)}</div>
    <section className="analysis-panel"><h3>Evolución de armónicos</h3><p>No hay historial de THD por fase ni espectro por orden. Un valor ausente no equivale a 0 %.</p></section>
  </div>;
}

export function MeterReports({ meter, slug }: { meter: Meter; slug: string }) {
  const [from, setFrom] = useState(() => localInput(new Date(new Date().setHours(0, 0, 0, 0))));
  const [to, setTo] = useState(() => localInput(new Date()));
  const [minutes, setMinutes] = useState(15);
  const [selected, setSelected] = useState<Key[]>(['voltage', 'current', 'power', 'frequency']);
  const [result, setResult] = useState<{ response: HistoryResponse; keys: Key[]; from: string; to: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const plan = reportPlan(Date.parse(from), Date.parse(to), minutes);
  const invalid = 'error' in plan ? plan.error : !selected.length ? 'Selecciona al menos una variable.' : '';
  const reset = () => { setResult(null); setError(''); };

  async function generate() {
    if (invalid || !('points' in plan)) return;
    setBusy(true);
    setError('');
    try {
      const response = await getHistory(slug, {
        tags: selected.map(key => meterTag(meter, key)), start: new Date(from), end: new Date(to), points: plan.points,
      });
      setResult({ response, keys: [...selected], from, to });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo generar el reporte.');
    } finally {
      setBusy(false);
    }
  }

  const summaries = result ? result.keys.map(key => ({
    key,
    ...summarizeBuckets(result.response.series.find(s => s.tag === meterTag(meter, key))?.points ?? []),
  })) : [];
  const expected = result ? Math.ceil((Date.parse(result.response.end) - Date.parse(result.response.start)) / 1000 / result.response.bucket_seconds) : 0;
  const preset = (days: number) => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    if (days === 0) start.setHours(0, 0, 0, 0);
    setFrom(localInput(start));
    setTo(localInput(end));
    reset();
  };
  const exportReport = () => {
    if (!result) return;
    const columns = Object.fromEntries(result.keys.map(key => [key, meterTag(meter, key)])) as Record<Key, string>;
    const rows = mergeSeries(result.response, columns);
    downloadCsv(`reporte-${meter.code}.csv`, [
      ['Medidor', meter.name],
      ['Fuente', `Historial de Hail: promedio por intervalo de ${Math.round(result.response.bucket_seconds / 60)} min${meter.simulated ? ' · datos simulados' : ''}`],
      ['Desde', result.from, 'Hasta', result.to],
      ['Inicio del intervalo (UTC)', ...result.keys.map(key => `${fieldOf(key)[1]}${fieldOf(key)[2] ? ` (${fieldOf(key)[2]})` : ''}`)],
      ...rows.map(row => [new Date(row.timestamp).toISOString(), ...result.keys.map(key => row[key])]),
    ]);
  };

  return <div className="meter-analysis">
    <h3>Reportes · {meter.name}</h3>
    <p>Selecciona período, intervalo y variables. El reporte usa el historial guardado en Hail: promedio, mínimo y máximo reales de cada intervalo.</p>
    <div className="analysis-panel report-controls">
      <section><h3>1. Medidor</h3><strong>{meter.name}</strong><p>{meter.model}</p><p>Cambia de medidor desde la navegación superior.</p><p>Energía acumulada actual: {format(meter.energy)} kWh.</p></section>
      <section><h3>2. Período</h3>
        <label>Desde<input type="datetime-local" value={from} onChange={e => { setFrom(e.target.value); reset(); }}/></label>
        <label>Hasta<input type="datetime-local" value={to} onChange={e => { setTo(e.target.value); reset(); }}/></label>
        <div className="report-presets">{([[0, 'Hoy'], [1, 'Últimas 24 h'], [7, '7 días'], [30, '30 días']] as const).map(([days, label]) => <button key={days} onClick={() => preset(days)}>{label}</button>)}</div>
        <label>Intervalo<select value={minutes} onChange={e => { setMinutes(Number(e.target.value)); reset(); }}>{[5, 15, 30, 60].map(n => <option key={n} value={n}>{n} minutos</option>)}</select></label>
        <small>Hora local del navegador. Máximo {HISTORY_MAX_DAYS} días y {HISTORY_MAX_POINTS} intervalos por reporte.</small>
      </section>
      <section><h3>3. Variables</h3><div className="report-fields">{['Voltajes', 'Corrientes', 'Potencias', 'Frecuencia y energía', 'Armónicos'].map(group => <fieldset key={group}>
        <legend>{group}</legend>
        {fields.filter(f => f[3] === group).map(([key, label, unit]) => <label key={key}>
          <input type="checkbox" checked={selected.includes(key)} onChange={e => { setSelected(s => e.target.checked ? [...s, key] : s.filter(k => k !== key)); reset(); }}/>
          {label} {unit && `(${unit})`}
        </label>)}
      </fieldset>)}</div></section>
    </div>
    {invalid && <p role="alert">{invalid}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="report-actions">
      <button disabled={!!invalid || busy} onClick={() => void generate()}>{busy ? 'Generando…' : 'Generar reporte'}</button>
      <button disabled={!result} onClick={exportReport}>Descargar CSV</button>
      <button disabled={!result} onClick={() => window.print()}>Imprimir / guardar PDF</button>
    </div>
    {result && <section className="analysis-panel report-result">
      <h3>Resumen del período · {meter.name}</h3>
      <p>{result.from.replace('T', ' ')} a {result.to.replace('T', ' ')} · intervalos de {Math.round(result.response.bucket_seconds / 60)} min{meter.simulated ? ' · datos simulados' : ''}</p>
      <div className="portal-table-scroll"><table>
        <thead><tr><th>Variable</th><th>Mínimo</th><th>Promedio</th><th>Máximo</th><th>Intervalos con datos</th></tr></thead>
        <tbody>{summaries.map(s => <tr key={s.key}>
          <th>{fieldOf(s.key)[1]}{fieldOf(s.key)[2] ? ` (${fieldOf(s.key)[2]})` : ''}</th>
          <td>{format(s.min)}</td><td>{format(s.avg)}</td><td>{format(s.max)}</td><td>{s.buckets} / {expected}</td>
        </tr>)}</tbody>
      </table></div>
      <p>Un intervalo sin datos indica que no llegaron lecturas en ese tramo (equipo sin comunicación o Hail detenido); no se rellena con ceros.</p>
    </section>}
  </div>;
}
