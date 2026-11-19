import type { AlarmSnapshot } from './types';
export function validAlarmSnapshot(value: unknown): value is AlarmSnapshot {
 if(!value||typeof value!=='object')return false;
 const v=value as AlarmSnapshot;
 const common=(a:unknown)=>{if(!a||typeof a!=='object')return false;const r=a as Record<string,unknown>;return ['id','tag','description','timestamp'].every(k=>typeof r[k]==='string')&&Number.isFinite(Date.parse(r.timestamp as string))&&['good','simulated','uncertain','bad','stale'].includes(String(r.quality));};
 return Number.isFinite(Date.parse(v.updatedAt))&&Array.isArray(v.alarms)&&Array.isArray(v.events)&&v.alarms.every(a=>common(a)&&['active','normalized'].includes(a.state)&&['critical','warning'].includes(a.priority))&&v.events.every(e=>common(e)&&['activated','normalized','state'].includes(e.type)&&['critical','warning','info'].includes(e.priority));
}
