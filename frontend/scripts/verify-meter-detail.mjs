import {createServer} from 'vite';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
const {default:Detail,detailValues}=await server.ssrLoadModule('/src/components/MeterDetail.tsx');
for(let index=0;index<5;index++) {
const online=index<3;
const meter={name:`Medidor ${index+1}`,model:'Demo',online,voltage:online?231:null,lineVoltage:null,current:online?0:null,power:online?0:null,factor:null,frequency:null,thd:null,energy:null};
const html=renderToStaticMarkup(createElement(Detail,{meter,index}));
if(!html.includes('Voltajes') || !html.includes('Potencias totales') || !html.includes('24 h')) throw Error('Missing detail section');
if(!online && detailValues(meter,index).voltages.some(v=>v!==null)) throw Error('Offline values fabricated');
}
console.log('OK: five detail views render; offline voltages remain null.');
}finally{await server.close()}
