import ProcessVariables from './ProcessVariables';
import NutrialEquipmentDialog from './NutrialEquipmentDialog';
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nutrialSimulation } from '../services/nutrialSimulation';
import NutrialEquipment from './NutrialEquipment';
import './nutrialHmi.css';
import {loadDemoEvents,saveDemoEvents} from '../services/demoEvents';
import {useRouteValue} from '../services/navigation';
import HmiNavigation from './HmiNavigation';
import NutrialDiagram from './NutrialDiagram';
const time = (t: number) => new Date(t).toLocaleTimeString('es-CL');
export default function NutrialHmi() {
 const [equipmentFilter,setEquipmentFilter]=useState('all');
 const [selectedEquipment,setSelectedEquipment]=useState<string|null>(null);
 const [events,setEvents]=useState<{timestamp:number;description:string}[]>(loadDemoEvents);
 const [screen,setScreen]=useRouteValue('nutrialScreen','Proceso',['Proceso','Tendencias','Alarmas','Equipos y señales']); const [data,setData]=useState(()=>nutrialSimulation.sample()); const [hours,setHours]=useState(1); const [priority,setPriority]=useState('Todas'); const [state,setState]=useState('Todos');
 useEffect(()=>{const timer=setInterval(()=>setData(nutrialSimulation.sample()),2000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{saveDemoEvents(events);},[events]);
 useEffect(()=>{setEvents(previous=>{const description=data.fault?'SP-01: falla simulada activa':'SP-01: señal sin falla normalizada';return previous[0]?.description===description?previous:[{timestamp:Date.now(),description},...previous].slice(0,200);});},[data.fault]);
 const alarms=[{tag:'EN-01',description:'Tolva de ensacadora: nivel alto',priority:'Advertencia',active:true},{tag:'SP-01',description:'Partidor suave: señal sin falla desactivada',priority:'Crítica',active:data.fault}];
 const filtered=alarms.filter(a=>(priority==='Todas'||a.priority===priority)&&(state==='Todos'||(state==='Activas' ? a.active : !a.active)));
 return <section className="nutrial-hmi"><header className="nutrial-title"><div><small>NUTRIAL · LÍNEA DE POLVOS</small><h2>Supervisión del proceso</h2><p>Tamizado · Transporte neumático · Mezclado · Ensacado</p></div><div><span className="nutrial-demo">DEMO · DATOS SIMULADOS</span><p>Actualización: {time(data.timestamp)}</p></div></header>
 <HmiNavigation value={screen} onChange={setScreen} items={['Proceso','Tendencias','Alarmas','Equipos y señales'].map(s=>({id:s,label:s==='Alarmas'?`Alarmas (${alarms.filter(a=>a.active).length})`:s}))}/>
 <div className="hmi-screen-content">
 {screen==='Proceso' && <><div className="nutrial-process-layout"><section className="nutrial-panel"><h3>Proceso · Línea de sustitutos lácteos</h3><NutrialDiagram data={data} onSelect={setSelectedEquipment}/><p className="nutrial-legend">Azul: aire · Ocre: producto · Pulsa la etiqueta de un equipo para ver su ficha</p></section>
 <div className="nutrial-bottom-panels"><section className="nutrial-panel"><h3>Variables</h3><ProcessVariables project="nutrial" defaults={['weight','pressure','humidity']} variables={[
 {id:'weight',tag:'BB-01',label:'Peso bruto',value:data.weight.toFixed(1),unit:'kg'},
 {id:'pressure',tag:'PT-01',label:'Presión de transporte',value:data.pressure.toFixed(0),unit:'mbar'},
 {id:'humidity',tag:'DH-01',label:'Humedad / rocío',value:'—',unit:'',note:'Sensor y unidad pendientes de definir'},
 ]}/></section><section className="nutrial-panel"><h3>Estados</h3><ul className="nutrial-states"><li>Seguridad y fases <b>OK · simulado</b></li><li>MZ-01 · Mezcladora <b>En marcha</b></li><li>Compuerta descarga <b>Cerrada</b></li><li>SP-01 · Partidor <b className={data.fault?'nutrial-critical':''}>{data.fault?'Falla simulada':'Sin falla'}</b></li><li>EN-01 · Tolva <b className="nutrial-warning">Nivel alto</b></li></ul></section></div></div>
 </>}
 {screen==='Equipos y señales' && <NutrialEquipment initialEquipment={equipmentFilter}/>}
 {screen==='Tendencias' && <><div className="nutrial-periods">Período { [1,8,24,168].map(h=><button key={h} aria-pressed={hours===h} onClick={()=>setHours(h)}>{h===168?'7 días':`${h} h`}</button>)}</div>{[{key:'weight',name:'BB-01 · Peso bruto',unit:'kg',max:2000},{key:'pressure',name:'PT-01 · Presión de transporte',unit:'mbar',max:1000}].map(metric=><section className="nutrial-panel nutrial-trend" key={metric.key}><h3>{metric.name} ({metric.unit})</h3><ResponsiveContainer width="100%" height={240}><LineChart data={nutrialSimulation.history(hours,data.timestamp)} margin={{left:15,right:25,bottom:10}}><CartesianGrid stroke="#dce5ee"/><XAxis dataKey="timestamp" tickFormatter={v=>hours>24?new Date(v).toLocaleDateString('es-CL'):time(v)} minTickGap={50} stroke="#688097"/><YAxis domain={[0,metric.max]} stroke="#688097"/><Tooltip labelFormatter={v=>new Date(Number(v)).toLocaleString('es-CL')} contentStyle={{background:'#fff',color:'#173d61',border:'1px solid #c7d6e4'}}/><Line dataKey={metric.key} name={metric.unit} stroke="#2872bb" dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></section>)}<p>DH-01: tendencia pendiente de confirmar sensor, escala y unidad.</p></>}
 {screen==='Alarmas' && <><div className="nutrial-alarm-summary"><strong>Críticas: {alarms.filter(a=>a.active&&a.priority==='Crítica').length}</strong><strong>Advertencias: 1</strong><span>Escenarios de demostración</span></div><div className="nutrial-periods"><label>Prioridad <select value={priority} onChange={e=>setPriority(e.target.value)}>{['Todas','Crítica','Advertencia'].map(p=><option key={p}>{p}</option>)}</select></label><label>Estado <select value={state} onChange={e=>setState(e.target.value)}>{['Todos','Activas','Normalizadas'].map(p=><option key={p}>{p}</option>)}</select></label></div><section className="nutrial-panel"><h3>Alarmas de proceso</h3><div className="nutrial-table-scroll"><table><thead><tr><th>Equipo</th><th>Descripción</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>{filtered.map(a=><tr key={a.tag}><td>{a.tag}</td><td>{a.description}</td><td className={a.priority==='Crítica'?'nutrial-critical':'nutrial-warning'}>{a.priority}</td><td>{a.active?'Activa':'Normalizada'}</td></tr>)}{filtered.length===0&&<tr><td colSpan={4}>Sin alarmas para estos filtros.</td></tr>}</tbody></table></div></section><section className="nutrial-panel nutrial-signals"><h3>Historial de eventos · demostración local</h3><div className="nutrial-table-scroll"><table><thead><tr><th>Hora</th><th>Evento</th></tr></thead><tbody>{events.map((event,i)=><tr key={`${event.timestamp}-${i}`}><td>{time(event.timestamp)}</td><td>{event.description}</td></tr>)}</tbody></table></div></section></>}
 </div>{selectedEquipment&&<NutrialEquipmentDialog tag={selectedEquipment} onClose={()=>setSelectedEquipment(null)} onSignals={()=>{setEquipmentFilter(selectedEquipment);setScreen('Equipos y señales');setSelectedEquipment(null);}}/>}</section>;
}
