import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {validTelemetry,telemetryStatus,isUsable}=await server.ssrLoadModule('/src/services/quality.ts');
 const {validAlarmSnapshot}=await server.ssrLoadModule('/src/services/alarmValidation.ts');
 const {detailValues}=await server.ssrLoadModule('/src/components/MeterDetail.tsx');
 const now=Date.now();const measurement={value:10,quality:'good'};
 const sample={timestamp:new Date(now).toISOString(),level:measurement,wellWaterDepthM:measurement,flow:measurement,chlorine:measurement,states:{pump:'running',dosing:'active',communication:'connected'}};
 assert(validTelemetry(sample));assert.equal(telemetryStatus(sample,now),'En línea');assert.equal(telemetryStatus(sample,now+31000),'Datos antiguos');assert(!isUsable(telemetryStatus(sample,now+31000)));
 assert.equal(telemetryStatus({...sample,states:{...sample.states,communication:'disconnected'}},now),'Sin comunicación');
 assert(!validTelemetry({...sample,level:{value:NaN,quality:'good'}}));assert(!validTelemetry({...sample,states:{pump:'unknown'}}));assert.equal(telemetryStatus({...sample,timestamp:new Date(now+6000).toISOString()},now),'Datos inválidos');
 assert(validAlarmSnapshot({updatedAt:sample.timestamp,alarms:[],events:[]}));assert(!validAlarmSnapshot({updatedAt:sample.timestamp,alarms:[{}],events:[]}));
 const detail=detailValues({online:true,voltage:230,lineVoltage:400,current:10,power:6,factor:.9},0);
 assert.deepEqual(detail.currents,[10,null,null,null]);assert.equal(detail.apparent,null);assert.equal(detail.reactive,null);
 console.log('OK: calidad, fechas, desconexión, alarmas inválidas y fases no inferidas.');
}finally{await server.close()}
