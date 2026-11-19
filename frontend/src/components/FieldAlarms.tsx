import { useEffect, useState } from 'react';
import { onValue, ref } from '@firebase/database';
import { firebaseDatabase } from '../services/firebase';
import type { AlarmSnapshot } from '../services/types';
import {validAlarmSnapshot} from '../services/alarmValidation';
import AlarmsScreen from './AlarmsScreen';
export default function FieldAlarms(){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),2000);return()=>clearInterval(timer);},[]);
 const [snapshot,setSnapshot]=useState<AlarmSnapshot|null>(null);const [error,setError]=useState(false);
 useEffect(()=>onValue(ref(firebaseDatabase,'projectData/aguapozo/alarms'),s=>{const raw=s.val();const v=raw?{...raw,alarms:raw.alarms??[],events:raw.events??[]}:null;if(!v){setSnapshot(null);setError(false);return;}const valid=validAlarmSnapshot(v);if(!valid){setError(true);return;}setSnapshot(v);setError(false);},()=>setError(true)),[]);
 if(error)return <div className="portal-notice" role="alert">No se pudieron consultar las alarmas de campo. No se puede confirmar ausencia de fallas.</div>;
 if(!snapshot)return <div className="portal-notice" role="status">Alarmas de campo pendientes de integración. No hay un registro verificado; esto no significa que la instalación esté libre de alarmas.</div>;
 if(now-Date.parse(snapshot.updatedAt)>30000||Date.parse(snapshot.updatedAt)>now+5000)return <div className="portal-notice" role="status">Registro de alarmas desactualizado o con fecha inválida. No se puede confirmar el estado actual.</div>;
 return <><p className="portal-notice">Registro recibido: {new Date(snapshot.updatedAt).toLocaleString('es-CL')}. Verifica la fecha antes de interpretar el estado.</p><AlarmsScreen service={{getSnapshot:()=>snapshot,subscribe:()=>()=>{}}}/></>;
}
