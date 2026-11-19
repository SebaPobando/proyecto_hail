import { createServer } from 'node:net';
import { Aedes } from 'aedes';

const broker = await Aedes.createBroker();
createServer(broker.handle).listen(1883, process.env.IOT_BROKER_HOST ?? '127.0.0.1', () => {
  console.log('Broker MQTT de prueba iniciado');
});
