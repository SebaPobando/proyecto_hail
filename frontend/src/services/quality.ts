import type { Telemetry } from './types';
export function validTelemetry(value: unknown): value is Telemetry {
 if(!value||typeof value!=='object')return false;
 const v=value as Telemetry;
 if(!Number.isFinite(Date.parse(v.timestamp)))return false;
 for(const [key,min,max] of [['level',0,100],['wellWaterDepthM',0,50],['flow',0,Infinity],['chlorine',0,Infinity]] as const){const m=v[key];if(!m||!Number.isFinite(m.value)||m.value<min||m.value>max||!['good','simulated','uncertain','bad','stale'].includes(m.quality))return false;}
 return !!v.states&&['running','stopped','fault'].includes(v.states.pump)&&['active','inactive','fault'].includes(v.states.dosing)&&['connected','disconnected','simulated'].includes(v.states.communication);
}
export function telemetryStatus(data: Telemetry | null | undefined, now=Date.now()): string {
 if(!data)return 'Sin datos';
 if(!validTelemetry(data)||Date.parse(data.timestamp)>now+5000)return 'Datos inválidos';
 if(data.states.communication==='disconnected')return 'Sin comunicación';
 if(now-Date.parse(data.timestamp)>30000||[data.level,data.flow,data.chlorine,data.wellWaterDepthM].some(m=>m.quality==='stale'))return 'Datos antiguos';
 if([data.level,data.flow,data.chlorine,data.wellWaterDepthM].some(m=>m.quality==='bad'||m.quality==='uncertain'))return 'Calidad no válida';
 return [data.level,data.flow,data.chlorine,data.wellWaterDepthM].some(m=>m.quality==='simulated')?'Simulación':'En línea';
}
export const isUsable=(status:string)=>status==='Simulación'||status==='En línea';
