import { connect } from 'mqtt';
import { sampleSimulation } from '../src/services/simulation.ts';
import { TEST_TOPIC } from './ingest.ts';

const client = connect(process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883', {
  username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD,
});
const start = Date.now();
function publish() {
  if (!client.connected) return;
  const data = sampleSimulation((Date.now() - start) / 1000);
  const { level, wellWaterDepthM, flow, chlorine, states, timestamp } = data;
  client.publish(TEST_TOPIC, JSON.stringify({
    version: 1, timestamp, level: level.value, wellWaterDepthM: wellWaterDepthM.value,
    flow: flow.value, chlorine: chlorine.value, pump: states.pump, dosing: states.dosing,
  }), { qos: 1 }, error => { if (error) console.error(error.message); });
}
client.on('connect', () => { console.log('Publicando datos simulados en', TEST_TOPIC); publish(); });
client.on('error', error => console.error('MQTT:', error.message));
setInterval(publish, 10_000);
