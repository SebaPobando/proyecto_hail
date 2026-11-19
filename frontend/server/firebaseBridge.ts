import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { connect } from 'mqtt';
import { TEST_TOPIC } from './ingest.ts';
import { chooseLatest, forwardTestMessage, type FirebaseTelemetryStore } from './firebaseTelemetry.ts';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'aguapozo-df56a',
  databaseURL: 'https://aguapozo-df56a-default-rtdb.firebaseio.com',
});
try {
  await app.options.credential!.getAccessToken();
} catch (error) {
  console.error('Falta una identidad de servidor válida para Firebase:', (error as Error).message);
  process.exit(1);
}

const telemetry = getDatabase(app).ref('telemetry');
const store: FirebaseTelemetryStore = {
  async saveHistory(key, point) { await telemetry.child('history').child(key).set(point); },
  async advanceLatest(sample) {
    const result = await telemetry.child('latest').transaction(current => chooseLatest(current, sample));
    return result.committed;
  },
};
const client = connect(process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883', {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});
client.on('connect', () => client.subscribe(TEST_TOPIC, { qos: 1 }, (error, granted) => {
  if (error || granted?.[0]?.qos === 128) {
    console.error('No se pudo suscribir a', TEST_TOPIC, error?.message ?? '');
    return;
  }
  console.log('Puente Firebase suscrito a', TEST_TOPIC);
}));
client.on('error', error => console.error('MQTT:', error.message));
client.on('message', async (topic, payload) => {
  try {
    const result = await forwardTestMessage(topic, payload, store);
    if (result) console.log('Muestra guardada:', result.timestamp, result.updatedLatest ? '(lectura actual)' : '(solo historial)');
  } catch (error) {
    console.error('No se guardó completamente la muestra:', (error as Error).message);
  }
});
