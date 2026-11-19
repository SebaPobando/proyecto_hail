import { useEffect, useState } from 'react';
import type { HistoryPoint, HistoryService, Telemetry } from './types';

interface LatestResponse { data: Telemetry | null; stale: boolean; brokerConnected: boolean }
export const mqttHistory: HistoryService = {
  async queryHistory({ from, to, maxPoints = 241 }) {
    const response = await fetch(`/api/history?from=${from}&to=${to}&maxPoints=${maxPoints}`);
    if (!response.ok) throw new Error('Historial no disponible');
    return await response.json() as HistoryPoint[];
  },
};

export function useMqttTelemetry(enabled: boolean) {
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch('/api/telemetry/latest', {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]),
        });
        if (!response.ok) throw new Error('API no disponible');
        const value = await response.json() as LatestResponse;
        if (!controller.signal.aborted) {
          setLatest(value);
          setFailure(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailure(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [enabled]);
  return { latest, failure };
}
