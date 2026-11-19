import ProcessVariables from './components/ProcessVariables';
﻿import { lazy, Suspense, useSyncExternalStore, type ReactNode } from 'react';
import HmiNavigation from './components/HmiNavigation';
import ProcessDiagram from './components/ProcessDiagram';
import { alarmService, telemetryService } from './services';
import { mqttHistory, useMqttTelemetry } from './services/mqttApi';
import { pumpStatus } from './components/equipmentStatus';
import type { HistoryService, Telemetry } from './services/types';
const FirebaseSession = lazy(() => import('./components/FirebaseSession'));
const TrendsScreen = lazy(() => import('./components/TrendsScreen'));
const AlarmsScreen = lazy(() => import('./components/AlarmsScreen'));
import './trends.css';
import { useRouteValue } from './services/navigation';
import {telemetryStatus,isUsable} from './services/quality';
const FieldAlarms=lazy(()=>import('./components/FieldAlarms'));
function Panel({title,children,className=''}:{title:string;children:ReactNode;className?:string}) { return <section className={`panel ${className}`} aria-label={title}><h2>{title}</h2>{children}</section>; }
function Equipment({type}:{type:'pump'|'dose'|'plc'}) { return <svg viewBox="0 0 60 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{type==='plc'?<>{[5,20,35].map(x=><g key={x}><rect x={x} y="6" width="13" height="36"/><path d={`M${x+4} 11v5m0 5v5m0 5v5`}/></g>)}</>:<><rect x="12" y="11" width="35" height="26" rx="2"/>{[17,22,27,32].map(y=><path key={y} d={`M18 ${y}H41`}/>)}<path d="M7 17v14m45-14v14M23 6h15M21 38v6m17-6v6M16 44h28"/></>}</svg>; }
type DashboardProps = {
  mode: string;
  reading?: Telemetry | null;
  history?: HistoryService;
  sessionBar?: ReactNode;
};

function Dashboard({ mode, reading, history, sessionBar }: DashboardProps) {
 const [screen, setScreen] = useRouteValue('waterScreen','process',['process','trends','alarms']);
 const demo = useSyncExternalStore(telemetryService.subscribe, telemetryService.getSnapshot);
 const { latest, failure } = useMqttTelemetry(mode === 'mqtt');
 const candidate = mode === 'firebase' ? reading : mode === 'mqtt' ? latest?.data : demo;
 const quality=telemetryStatus(candidate);
 const data=isUsable(quality)?candidate:null;
 const status = failure ? 'Backend no disponible' : !latest ? 'Conectando al backend…' : !latest.brokerConnected ? 'Broker MQTT desconectado' : !data ? 'Esperando primera muestra' : latest.stale ? 'Lecturas desactualizadas' : 'Recibiendo datos de prueba';
 const renderScreen = (data: Telemetry | null | undefined, history: HistoryService) => <>
 {!data && screen === 'process' && <div className="demo-strip" role="status">Sin datos actuales. Lecturas y estados desconocidos; el esquema no representa niveles reales.</div>}
 {screen === 'process' && data && <div className="demo-strip"><time dateTime={data.timestamp}>Última actualización: {new Date(data.timestamp).toLocaleTimeString('es-CL',{timeZone:'America/Santiago'})}</time></div>}
 {screen === 'process' ? <main><Panel title="Proceso" className="process-panel"><ProcessDiagram data={data}/></Panel><aside><Panel title="Variables del Proceso" className="variables"><ProcessVariables project="aguapozo" defaults={['level','volume','flow','chlorine']} variables={[
 {id:'level',tag:'LT-101',label:'Nivel del estanque',value:data?.level.value.toFixed(1)??'—',unit:'%'},
 {id:'volume',tag:'LT-101',label:'Volumen estimado',value:data?(data.level.value/2).toFixed(1):'—',unit:'m³',note:'Capacidad del estanque: 50 m³'},
 {id:'well',tag:'LT-102',label:'Nivel del pozo',value:data?.wellWaterDepthM.value.toFixed(1)??'—',unit:'m',note:'Distancia desde la boca al espejo de agua'},
 {id:'flow',tag:'FT-101',label:'Caudal',value:data?.flow.value.toFixed(1)??'—',unit:'m³/h'},
 {id:'chlorine',tag:'AIT-101',label:'Cloro residual',value:data?.chlorine.value.toFixed(2)??'—',unit:'mg/L'},
 ]}/></Panel><Panel title="Estados" className="states"><div className="panel-body">{[{type:'pump' as const,label:'P-101 – Bomba Sumergible',status:data ? pumpStatus[data.states.pump].label : 'Desconocido'},{type:'dose' as const,label:'D-101 – Dosificación',status:!data ? 'Desconocido' : data.states.dosing==='active'?'Activa':data.states.dosing==='fault'?'Falla':'Inactiva'},{type:'plc' as const,label:'PLC – Comunicación',status:!data ? 'Desconocido' : {simulated:'Simulada',connected:'Conectado',disconnected:'Desconectado'}[data.states.communication]}].map(s=><div className="state-row" key={s.type}><Equipment type={s.type}/><span>{s.label}</span><strong className={s.type==='plc'?'simulated':''}><i style={!data ? {backgroundColor:'#9aadb9'} : s.type==='pump'?{backgroundColor:pumpStatus[data.states.pump].color}:undefined}/>{s.status}</strong></div>)}</div></Panel></aside></main> : <Suspense fallback={<main className="trends-screen" aria-label={screen === 'trends' ? 'Tendencias' : 'Alarmas'}><p role="status">Cargando pantalla…</p></main>}>{screen === 'trends' ? <TrendsScreen data={data} historyService={history}/> : <>{mode === 'firebase' ? <FieldAlarms/> : <AlarmsScreen service={alarmService}/>}</>}</Suspense> }
 </>;
 return <div className="app-shell water-hmi"><header className="header"><svg className="drop" viewBox="0 0 60 80" aria-hidden="true"><path d="M30 5C22 21 8 39 8 51a22 22 0 0044 0C52 39 38 21 30 5Z" fill="none" stroke="#00aeef" strokeWidth="6"/></svg><div className="header-title"><h1>Sistema de Agua Potable</h1><p>Captación desde Pozo Profundo · Tratamiento · Estanque Elevado</p></div><div className="brand"><b>H</b><span><strong>Haiwell</strong> CBOX</span></div></header>
 {sessionBar}
 {mode !== 'firebase' && <div className="demo-strip">
   <span>{mode === 'mqtt' ? 'MQTT de prueba' : 'Demo local'}</span>
   {mode === 'mqtt' && <span role="status">{status}</span>}
   <a href="/">Volver a la portada</a>
 </div>}
 <HmiNavigation value={screen} onChange={setScreen} items={[{id:'process',label:'Proceso'},{id:'trends',label:'Tendencias'},{id:'alarms',label:'Alarmas'}]}/>
 <div className="hmi-screen-content">{renderScreen(data, history ?? (mode === 'mqtt' ? mqttHistory : telemetryService))}</div>
</div>;
}











export default function App() {
  const source = new URLSearchParams(window.location.search).get('source');
  if (import.meta.env.DEV && source === 'portal') return <Suspense fallback={<p role="status">Cargando proyectos…</p>}><PortalPreview renderWater={back => <Dashboard mode="demo" sessionBar={<div className="demo-strip">{back}</div>}/>}/></Suspense>;
  if (import.meta.env.DEV && (source === 'demo' || source === 'mqtt')) {
    return <Dashboard mode={source}/>;
  }
  return <Suspense fallback={<main className="access-loading" role="status">Cargando portal de supervisión…</main>}>
    <FirebaseSession>{(reading, history, sessionBar) =>
      <Dashboard mode="firebase" reading={reading} history={history} sessionBar={sessionBar}/>}
    </FirebaseSession>
  </Suspense>;
}

const PortalPreview = lazy(() => import('./components/PortalPreview'));
