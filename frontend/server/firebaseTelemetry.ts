import type { HistoryPoint, Telemetry } from '../src/services/types.ts';
import { decodeTelemetry, TEST_TOPIC } from './ingest.ts';

export interface FirebaseTelemetryStore {
  saveHistory(key: string, point: HistoryPoint): Promise<void>;
  advanceLatest(sample: Telemetry): Promise<boolean>;
}

export function chooseLatest(current: Telemetry | null, sample: Telemetry): Telemetry | undefined {
  if (current && (current.level?.quality !== 'simulated' ||
      Date.parse(current.timestamp) >= Date.parse(sample.timestamp))) return;
  return sample;
}

export async function forwardTestMessage(
  topic: string, payload: Buffer, store: FirebaseTelemetryStore,
) {
  if (topic !== TEST_TOPIC || payload.length > 4096) return;
  const sample = decodeTelemetry(payload.toString());
  const timestamp = Date.parse(sample.timestamp);
  await store.saveHistory(String(timestamp), {
    timestamp, level: sample.level.value, flow: sample.flow.value,
    chlorine: sample.chlorine.value, quality: 'simulated',
  });
  return { timestamp: sample.timestamp, updatedLatest: await store.advanceLatest(sample) };
}
