import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Meter } from './ElectricalOverview';
import { downloadCsv } from '../services/exportCsv';
import './meterAnalysis.css';
const fields = [
  ['voltage','Voltaje A–N','V','Voltajes'], ['lineVoltage','Voltaje A–B','V','Voltajes'],
  ['current','Corriente A','A','Corrientes'], ['power','Potencia activa total','kW','Potencias'],
  ['factor','Factor de potencia','','Potencias'], ['frequency','Frecuencia','Hz','Frecuencia y energía'],
  ['thd','THD voltaje máximo','%','Armónicos'],
] as const;
type Key = typeof fields[number][0];
const format = (v: number | null) => v === null ? '—' : v.toLocaleString('es-CL',{maximumFractionDigits:3});
const localInput = (date: Date) => new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
export function reportSamples(meter: Meter, from: number, to: number, minutes: number) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || minutes <= 0 || (to-from)/60000/minutes > 3000) return [];
  return Array.from({length:Math.ceil((to-from)/60000/minutes)},(_,i)=> {
    const timestamp=from+i*minutes*60000;
    const values=Object.fromEntries(fields.map(([key])=>[key,!meter.online || meter[key] === null ? null : meter[key]! * (1+.003*Math.sin(timestamp/90000))])) as Record<Key,number|null>;
    return { timestamp, ...values };
  });
}
export function MeterHarmonics({meter}:{meter:Meter}) {
  return <div className="meter-analysis"><p className="electric-data-note">Distorsión armónica total (THD). La demostración solo dispone del máximo de voltaje; no se asigna a una fase ni se infiere THD de corriente.</p>
    <div className="electric-kpis"><article><span>THD de voltaje máximo · demo</span><strong>{format(meter.online ? meter.thd : null)} %</strong></article><article><span>Datos por fase</span><strong>No disponibles</strong></article></div>
    <div className="meter-chart-grid">{['voltaje','corriente'].map(kind=><section key={kind}><h3>THD de {kind} por fase (%)</h3><div className="meter-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={['A','B','C'].map(phase=>({phase,value:null}))}><CartesianGrid vertical={false} stroke="#e0e8f2"/><XAxis dataKey="phase"/><YAxis unit=" %" domain={[0,10]}/><Tooltip/><Bar dataKey="value">{['#0059bc','#f39200','#80b600'].map(color=><Cell key={color} fill={color}/>)}</Bar></BarChart></ResponsiveContainer></div><dl className="harmonic-phases">{['A','B','C'].map(phase=><div key={phase}><dt>Fase {phase}</dt><dd>— %</dd></div>)}</dl><p>Sin muestras por fase. Se requieren los registros del equipo para habilitar esta visualización.</p></section>)}</div>
    <section className="analysis-panel"><h3>Evolución de armónicos</h3><p>No hay historial de THD por fase ni espectro por orden disponible. Un valor ausente no equivale a 0 %.</p></section>
  </div>;
}
export function MeterReports({meter}:{meter:Meter}) {
  const [from,setFrom]=useState(()=>localInput(new Date(new Date().setHours(0,0,0,0))));
  const [to,setTo]=useState(()=>localInput(new Date()));
  const [minutes,setMinutes]=useState(15);
  const [selected,setSelected]=useState<Key[]>(['voltage','current','power','frequency']);
  const [generated,setGenerated]=useState(false);
  const rows=useMemo(()=>reportSamples(meter,Date.parse(from),Date.parse(to),minutes),[meter,from,to,minutes]);
  const valid=rows.length>0 && selected.length>0;
  const summaries=selected.map(key=>{const values=rows.flatMap(r=>r[key]===null?[]:[r[key]!]);return {key,count:values.length,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,avg:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};});
  const preset=(days:number)=>{const end=new Date();const start=new Date(end);start.setDate(start.getDate()-days);if(days===0)start.setHours(0,0,0,0);setFrom(localInput(start));setTo(localInput(end));setGenerated(false);};
  const exportReport=()=>downloadCsv(`reporte-medidor-demo.csv`,[['Medidor',meter.name],['Fuente','DEMO: muestras sintéticas; no es un reporte de campo'],['Desde',from,'Hasta',to,'Paso (min)',minutes],['Fecha UTC',...selected.map(key=>{const f=fields.find(f=>f[0]===key)!;return `${f[1]} (${f[2]})`;})],...rows.map(row=>[new Date(row.timestamp).toISOString(),...selected.map(key=>row[key])])]);
  return <div className="meter-analysis"><h3>Reportes · {meter.name}</h3><p>Selecciona período y variables. Los datos de esta sección son sintéticos de demostración, no mediciones del equipo.</p>
    <div className="analysis-panel report-controls"><section><h3>1. Medidor</h3><strong>{meter.name}</strong><p>{meter.model}</p><p>Cambia de medidor desde la navegación superior.</p><p>Energía acumulada disponible: {format(meter.energy)} kWh. Sin historial del contador no se calcula consumo diario.</p></section>
    <section><h3>2. Período</h3><label>Desde<input type="datetime-local" value={from} onChange={e=>{setFrom(e.target.value);setGenerated(false);}}/></label><label>Hasta<input type="datetime-local" value={to} onChange={e=>{setTo(e.target.value);setGenerated(false);}}/></label><div className="report-presets">{[[0,'Hoy'],[1,'Últimas 24 h'],[7,'7 días'],[30,'30 días']].map(([days,label])=><button key={days} onClick={()=>preset(Number(days))}>{label}</button>)}</div><label>Intervalo de muestras<select value={minutes} onChange={e=>{setMinutes(Number(e.target.value));setGenerated(false);}}>{[15,30,60].map(n=><option key={n} value={n}>{n} minutos</option>)}</select></label><small>Hora local del navegador. Máximo 3000 muestras por reporte. Son muestras sintéticas, no promedios de mediciones.</small></section>
    <section><h3>3. Variables</h3><div className="report-fields">{['Voltajes','Corrientes','Potencias','Frecuencia y energía','Armónicos'].map(group=><fieldset key={group}><legend>{group}</legend>{fields.filter(f=>f[3]===group).map(([key,label,unit])=><label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={e=>{setSelected(s=>e.target.checked?[...s,key]:s.filter(k=>k!==key));setGenerated(false);}}/>{label} {unit && `(${unit})`}{meter[key]===null?' · N/D':''}</label>)}</fieldset>)}</div></section></div>
    {!valid && <p role="alert">Selecciona al menos una variable y un período válido de hasta 3000 muestras.</p>}
    <div className="report-actions"><button disabled={!valid} onClick={()=>setGenerated(true)}>Generar resumen</button><button disabled={!valid} onClick={exportReport}>Descargar CSV · demo</button><button disabled={!generated || !valid} onClick={()=>window.print()}>Imprimir / guardar PDF</button></div>
    {generated && valid && <section className="analysis-panel report-result"><h3>Resumen del período · {meter.name}</h3><p>DEMO · {from.replace('T',' ')} a {to.replace('T',' ')} · {rows.length} muestras sintéticas</p><div className="portal-table-scroll"><table><thead><tr><th>Variable</th><th>Mínimo</th><th>Promedio</th><th>Máximo</th><th>Muestras válidas</th></tr></thead><tbody>{summaries.map(s=><tr key={s.key}><th>{fields.find(f=>f[0]===s.key)![1]} ({fields.find(f=>f[0]===s.key)![2]})</th><td>{format(s.min)}</td><td>{format(s.avg)}</td><td>{format(s.max)}</td><td>{s.count} / {rows.length}</td></tr>)}</tbody></table></div><p>La cobertura de muestras no representa disponibilidad de comunicación del dispositivo.</p></section>}
  </div>;
}
