type DemoEvent={timestamp:number;description:string};
const key='nutrial-demo-events-v1';
export function loadDemoEvents():DemoEvent[]{try{const data=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(data)?data.filter(e=>Number.isFinite(e?.timestamp)&&typeof e?.description==='string').slice(0,200):[];}catch{return [];}}
export function saveDemoEvents(events:DemoEvent[]){try{localStorage.setItem(key,JSON.stringify(events.slice(0,200)));}catch{/* El bloqueo del almacenamiento no debe interrumpir la HMI de demostración. */}}
