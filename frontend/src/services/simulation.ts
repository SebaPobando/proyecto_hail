import type { Telemetry, TelemetryService } from './types';
import { createSimulatedHistory } from './history.ts';
const measurement = (value: number) => ({ value, quality: 'simulated' as const });
export function sampleSimulation(seconds: number): Telemetry {
  return { timestamp: new Date().toISOString(), level: measurement(68 + 3 * Math.sin(seconds / 140)), wellWaterDepthM: measurement(12 + Math.sin(seconds / 100)), flow: measurement(12.4 + 0.6 * Math.sin(seconds / 28)), chlorine: measurement(0.65 + 0.025 * Math.sin(seconds / 48)), states: { pump: 'running', dosing: 'active', communication: 'simulated' } };
}
export function createSimulationService(): TelemetryService {
  let snapshot = sampleSimulation(0);
  const history = createSimulatedHistory(snapshot);
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let seconds = 0;
  return { getSnapshot: () => snapshot, queryHistory: history.queryHistory, subscribe(listener) {
    listeners.add(listener);
    if (!timer) timer = setInterval(() => { seconds += 1; snapshot = sampleSimulation(seconds); history.record(snapshot); listeners.forEach(notify => notify()); }, 1000);
    return () => { listeners.delete(listener); if (!listeners.size) { clearInterval(timer); timer = undefined; } };
  } };
}
