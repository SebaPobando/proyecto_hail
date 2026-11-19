import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HistoryPoint } from '../services/types';

export type TrendMetric = 'level' | 'flow' | 'chlorine';
export const metricConfig = {
  level: { tag: 'LT-101', title: 'Nivel del Estanque', axis: 'Nivel (%)', unit: '%', color: '#37b6f0', domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], precision: 1, current: 'Nivel Actual' },
  flow: { tag: 'FT-101', title: 'Caudal de Captación', axis: 'Caudal (m³/h)', unit: 'm³/h', color: '#75e53e', domain: [0, 25], ticks: [0, 5, 10, 15, 20, 25], precision: 1, current: 'Caudal Actual' },
  chlorine: { tag: 'AIT-101', title: 'Cloro Residual', axis: 'Cloro (mg/L)', unit: 'mg/L', color: '#f4dd35', domain: [0, 1.2], ticks: [0, .2, .4, .6, .8, 1, 1.2], precision: 2, current: 'Cloro Actual' },
} as const;
const clockFormat = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayFormat = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit' });
const detailFormat = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function InstrumentIcon({ metric }: { metric: TrendMetric }) {
  return <svg className="instrument-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{metric === 'level' ? <><path d="M6 3v27q0 4 4 4h20q4 0 4-4V3M7 16q7-4 13 0t13 0M13 37h14"/></> : metric === 'flow' ? <><circle cx="20" cy="19" r="14"/><path d="M2 13v12m36-12v12M14 36h12M20 33v3M11 14h18v10H11zM14 10h12"/></> : <><path d="M14 3h12M16 3v11L6 31q-3 5 3 5h22q5 0 2-5L24 14V3M11 26q6-4 10 0t7 0"/><circle cx="20" cy="30" r="1"/></>}</svg>;
}

export default function TrendChart({ metric, points, from, to, longPeriod }: { metric: TrendMetric; points: HistoryPoint[]; from: number; to: number; longPeriod: boolean }) {
  const config = metricConfig[metric];
  const tickCount = longPeriod ? 8 : 9;
  const ticks = Array.from({ length: tickCount }, (_, i) => from + (to - from) * i / (tickCount - 1));
  return <div className="trend-plot" role="img" aria-label={`${config.tag}: ${config.axis}, desde ${detailFormat.format(from)} hasta ${detailFormat.format(to)}`}>
    <span className="trend-axis-title">{config.axis}</span>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={points} margin={{ top: 7, right: 22, bottom: 0, left: 5 }} accessibilityLayer>
        <CartesianGrid stroke="#446477" strokeOpacity={.8} vertical horizontal/>
        <XAxis dataKey="timestamp" type="number" scale="time" domain={[from, to]} ticks={ticks} allowDataOverflow tickFormatter={value => longPeriod ? dayFormat.format(value) : clockFormat.format(value)} tick={{ fill: '#edf4f8', fontSize: 15 }} stroke="#b7cbd6" tickLine={{ stroke: '#b7cbd6' }} minTickGap={20} height={30}/>
        <YAxis domain={[...config.domain]} ticks={[...config.ticks]} interval={0} tickFormatter={value => metric === 'chlorine' ? Number(value).toFixed(2) : String(value)} tick={{ fill: '#edf4f8', fontSize: 15 }} stroke="#b7cbd6" tickLine={false} width={49}/>
        <Tooltip labelFormatter={value => detailFormat.format(Number(value))} formatter={value => [`${Number(value).toFixed(config.precision)} ${config.unit}`, config.tag]} contentStyle={{ background: '#102e41', border: '1px solid #6c9cb6', borderRadius: 5, color: '#f3f6f9' }} itemStyle={{ color: config.color }} cursor={{ stroke: '#c7d8e3', strokeDasharray: '4 4' }}/>
        <Area type="linear" dataKey={metric} name={config.tag} stroke={config.color} strokeWidth={4} fill={config.color} fillOpacity={.13} isAnimationActive={false} dot={false} activeDot={{ r: 4, stroke: '#f1f7fa', strokeWidth: 1 }} connectNulls={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}
