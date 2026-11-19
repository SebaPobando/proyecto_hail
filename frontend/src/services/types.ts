export type DataQuality = 'simulated' | 'good' | 'uncertain' | 'bad' | 'stale';
export interface Measurement { value: number; quality: DataQuality; }
export interface EquipmentStates { pump: 'running' | 'stopped' | 'fault'; dosing: 'active' | 'inactive' | 'fault'; communication: 'simulated' | 'connected' | 'disconnected'; }
export interface Telemetry { timestamp: string; level: Measurement; /** Profundidad hasta el espejo de agua, desde la boca del pozo; metros positivos hacia abajo. */ wellWaterDepthM: Measurement; flow: Measurement; chlorine: Measurement; states: EquipmentStates; }
export interface Alarm { id: string; timestamp: string; tag: string; description: string; priority: 'critical' | 'warning'; state: 'active' | 'normalized'; quality: DataQuality; }
export interface AlarmEvent { id: string; timestamp: string; tag: string; description: string; priority: 'critical' | 'warning' | 'info'; type: 'activated' | 'normalized' | 'state'; quality: DataQuality; }
export interface AlarmSnapshot { updatedAt: string; alarms: Alarm[]; events: AlarmEvent[]; }
export interface AlarmService { getSnapshot(): AlarmSnapshot; subscribe(listener: () => void): () => void; }
export interface HistoryPoint { timestamp: number; level: number; flow: number; chlorine: number; quality: DataQuality; }
export interface HistoryQuery { from: number; to: number; maxPoints?: number; }
export interface HistoryService { queryHistory(query: HistoryQuery): Promise<HistoryPoint[]>; }
export interface TelemetryService extends HistoryService { getSnapshot(): Telemetry; subscribe(listener: () => void): () => void; }
