import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {reportSamples,MeterHarmonics,MeterReports}=await server.ssrLoadModule('/src/components/MeterAnalysis.tsx');
 const meter={name:'Prueba',model:'Demo',online:true,voltage:230,lineVoltage:400,current:0,power:0,factor:null,frequency:50,thd:2,energy:100};
 const rows=reportSamples(meter,0,3600000,15);
 assert.equal(rows.length,4);assert.equal(rows[0].current,0);assert.equal(rows[0].factor,null);
 assert.equal(reportSamples(meter,1,0,15).length,0);
 assert.equal(reportSamples(meter,0,1e12,15).length,0);
 assert(reportSamples({...meter,online:false},0,3600000,15).every(r=>r.voltage===null));
 const html=renderToStaticMarkup(React.createElement(MeterHarmonics,{meter}));assert(html.includes('THD de voltaje'));assert(html.includes('THD de corriente'));assert(html.includes('Sin muestras por fase'));
 const report=renderToStaticMarkup(React.createElement(MeterReports,{meter}));assert(report.includes('Descargar CSV'));assert(report.includes('Generar resumen'));
 console.log('OK: reportes validan período, preservan cero y ausencias; armónicos no inventan fases.');
} finally {await server.close();}
