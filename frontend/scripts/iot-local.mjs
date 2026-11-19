import { spawn } from 'node:child_process';

const firebase = process.argv.includes('--firebase');
console.log(firebase ? 'DEMO MQTT → Firebase. Mantén esta terminal abierta.' : 'DEMO MQTT local: http://127.0.0.1:5173/?source=mqtt');
const commands = [
  ['--experimental-strip-types', 'server/broker.ts'],
  ['--experimental-strip-types', 'server/backend.ts'],
  ...(firebase ? [['--experimental-strip-types', 'server/firebaseBridge.ts']] : []),
  ['--experimental-strip-types', 'server/publish.ts'],
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'],
];
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}
for (const args of commands) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 1));
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
