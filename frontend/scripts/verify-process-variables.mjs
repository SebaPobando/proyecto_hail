import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const server=await createServer({optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom'});
try{
 const {default:Picker,normalizeVariableSelection:normalize}=await server.ssrLoadModule('/src/components/ProcessVariables.tsx');
 assert.deepEqual(normalize(['a','wrong','a'],['a','b'],['b']),['a']);
 assert.deepEqual(normalize([],['a','b'],['b']),['b']);
 assert.deepEqual(normalize(null,['a','b'],['b']),['b']);
 global.localStorage={getItem:()=>JSON.stringify(['b'])};
 const html=renderToStaticMarkup(createElement(Picker,{project:'test',defaults:['a'],variables:[{id:'a',tag:'A',label:'Primera',value:'123',unit:'m'},{id:'b',tag:'B',label:'Segunda',value:'456',unit:'%'}]}));
 assert(!html.includes('123'));assert(html.includes('456'));assert(html.includes('disabled=""'));assert(html.includes('Personalizar variables'));
 console.log('OK: preferencias válidas, selección persistida y al menos una lectura visible.');
}finally{await server.close();}
