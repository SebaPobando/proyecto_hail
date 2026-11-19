import { createSimulationService } from './simulation';
import { createAlarmSimulationService } from './alarms';
import type { TelemetryService } from './types';
// Punto único de sustitución por un adaptador de lectura del backend.
export const telemetryService: TelemetryService = createSimulationService();
export const alarmService = createAlarmSimulationService();
