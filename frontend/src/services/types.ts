export type DataQuality = 'simulated' | 'good' | 'uncertain' | 'bad' | 'stale';
export interface Measurement { value: number; quality: DataQuality; }
export interface EquipmentStates { pump: 'running' | 'stopped' | 'fault'; dosing: 'active' | 'inactive' | 'fault'; communication: 'simulated' | 'connected' | 'disconnected'; }
export interface Telemetry { timestamp: string; level: Measurement; /** Profundidad hasta el espejo de agua, desde la boca del pozo; metros positivos hacia abajo. */ wellWaterDepthM: Measurement; flow: Measurement; chlorine: Measurement; states: EquipmentStates; }
/** Punto de tendencia. Un valor null es un intervalo sin datos y se dibuja como hueco. */
export interface HistoryPoint { timestamp: number; level: number | null; flow: number | null; chlorine: number | null; quality: DataQuality; }
export interface HistoryQuery { from: number; to: number; maxPoints?: number; }
export interface HistoryService { queryHistory(query: HistoryQuery): Promise<HistoryPoint[]>; }
