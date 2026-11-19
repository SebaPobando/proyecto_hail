// Uso: node scripts/manage-project-access.mjs usuario@dominio.cl [aguapozo,medidores-electricos,nutrial|admin|none] [--apply]
// Vista previa por defecto. Credenciales ADC exclusivamente de servidor.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
const [email,assignment,...flags]=process.argv.slice(2);
const ids=['aguapozo','medidores-electricos','nutrial'];
if(!email||!assignment||flags.some(f=>f!=='--apply'))throw Error('Indica correo, asignación y opcionalmente --apply.');
const projects=assignment.split(',');
if(!['admin','none'].includes(assignment)&&projects.some(id=>!ids.includes(id)))throw Error('Proyecto desconocido');
initializeApp({credential:applicationDefault(),databaseURL:'https://aguapozo-df56a-default-rtdb.firebaseio.com'});
const user=await getAuth().getUserByEmail(email);
const access={admin:assignment==='admin',projects:Object.fromEntries(ids.map(id=>[id,assignment==='admin'||projects.includes(id)]))};
console.log(JSON.stringify({uid:user.uid,email:user.email,access,apply:flags.includes('--apply')},null,2));
if(flags.includes('--apply')){
 const db=getDatabase();const audit=db.ref('accessAudit').push();
 // Se retira también el permiso legado para que una revocación sea efectiva.
 await db.ref().update({['portalAccess/'+user.uid]:access,['operators/'+user.uid]:null,['accessAudit/'+audit.key]:{uid:user.uid,assignment,timestamp:Date.now()}});
 console.log('Asignación guardada.');
}
process.exit(0);
