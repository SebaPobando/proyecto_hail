/**
 * Endpoints del backend de Hail y sus tipos. Reflejan los esquemas de
 * los archivos schemas.py de cada app del backend; la documentación interactiva está en /api/docs.
 */
import { request } from './api';

// ------------------------------------------------------------------ sesión

export type MembershipRole = 'viewer' | 'operator' | 'org_admin';

export interface Me {
  id: number;
  email: string;
  full_name: string;
  is_platform_admin: boolean;
  organizations: { slug: string; name: string; role: MembershipRole }[];
}

export const getMe = (signal?: AbortSignal) => request<Me>('/auth/me', { signal });
export const login = (email: string, password: string) =>
  request<Me>('/auth/login', { method: 'POST', body: { email, password } });
export const logout = () => request<void>('/auth/logout', { method: 'POST' });
export const requestPasswordReset = (email: string) =>
  request<{ detail: string }>('/auth/password-reset', { method: 'POST', body: { email } });
export const confirmPasswordReset = (uid: string, token: string, newPassword: string) =>
  request<void>('/auth/password-reset/confirm', {
    method: 'POST',
    body: { uid, token, new_password: newPassword },
  });

// ------------------------------------------------------------------ proyectos

export type HmiType = 'aguapozo' | 'electrical' | 'nutrial' | 'generic';
export type ProjectStatus = 'development' | 'demo' | 'live';
export type ProjectRole = MembershipRole | 'platform_admin' | '';

export interface ProjectSummary {
  slug: string;
  name: string;
  category: string;
  description: string;
  hmi_type: HmiType;
  status: ProjectStatus;
  image: string;
  is_active: boolean;
  organization: { slug: string; name: string };
  role: ProjectRole;
}

export type DeviceKind = 'gateway' | 'plc' | 'meter' | 'other';

export interface Device {
  code: string;
  name: string;
  kind: DeviceKind | string;
  hardware_model: string;
  last_seen_at: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  devices: Device[];
  signal_count: number;
}

export type SignalKind = 'AI' | 'AO' | 'DI' | 'DO' | 'STATE';

export interface Signal {
  tag: string;
  description: string;
  kind: SignalKind | string;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  decimals: number;
  address: string;
  module: string;
  field_device: string;
  logic: string;
  position: number;
  device: string | null;
}

export const listProjects = (signal?: AbortSignal) => request<ProjectSummary[]>('/projects', { signal });
export const getProject = (slug: string, signal?: AbortSignal) =>
  request<ProjectDetail>(`/projects/${encodeURIComponent(slug)}`, { signal });
export const listSignals = (slug: string, signal?: AbortSignal) =>
  request<Signal[]>(`/projects/${encodeURIComponent(slug)}/signals`, { signal });

// ------------------------------------------------------------------ telemetría

export type ReadingQuality = 'good' | 'uncertain' | 'bad' | 'simulated';

export interface LatestReading {
  tag: string;
  description: string;
  kind: string;
  unit: string;
  decimals: number;
  value: number | null;
  state_label: string | null;
  quality: ReadingQuality | null;
  time: string | null;
  /** El backend lo marca si la lectura es más antigua que `stale_after_seconds` o no existe. */
  stale: boolean;
}

export interface LatestSnapshot {
  server_time: string;
  stale_after_seconds: number;
  readings: LatestReading[];
}

export interface HistoryBucket {
  /** Inicio del intervalo. */
  time: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface HistoryResponse {
  start: string;
  end: string;
  bucket_seconds: number;
  series: { tag: string; unit: string; points: HistoryBucket[] }[];
}

export interface Connectivity {
  server_time: string;
  offline_after_seconds: number;
  worker: {
    online: boolean;
    broker_connected: boolean;
    last_heartbeat: string;
    last_message_at: string | null;
    messages_accepted?: number | null;
    messages_rejected?: number | null;
  } | null;
  devices: { code: string; name: string; kind: string; last_seen_at: string | null; online: boolean }[];
}

export const getLatest = (slug: string, signal?: AbortSignal) =>
  request<LatestSnapshot>(`/projects/${encodeURIComponent(slug)}/latest`, { signal });

export const getConnectivity = (slug: string, signal?: AbortSignal) =>
  request<Connectivity>(`/projects/${encodeURIComponent(slug)}/connectivity`, { signal });

/** Historial agregado. El backend acepta hasta 31 días, 20 señales y 2000 puntos. */
export const getHistory = (
  slug: string,
  { tags, start, end, points, signal }: { tags: readonly string[]; start: Date; end: Date; points: number; signal?: AbortSignal },
) =>
  request<HistoryResponse>(`/projects/${encodeURIComponent(slug)}/history`, {
    query: { tags, start: start.toISOString(), end: end.toISOString(), points: Math.round(points) },
    signal,
  });

export const HISTORY_MAX_DAYS = 31;
export const HISTORY_MAX_POINTS = 2000;

// ------------------------------------------------------------------ alarmas

export type AlarmPriority = 'high' | 'medium' | 'low';
/** Ciclo ISA-18.2: activa sin reconocer → reconocida → normalizada; o normalizada sin reconocer → cerrada. */
export type AlarmState = 'active_unack' | 'active_ack' | 'cleared_unack' | 'closed';

export interface Alarm {
  id: number;
  project: string;
  project_name: string;
  tag: string;
  description: string;
  unit: string;
  /** "signal": alto, bajo o estado de una señal. "communication": un dispositivo dejó de enviar datos. */
  kind: 'signal' | 'communication';
  /** Texto de la regla, por ejemplo "≤ 0,2 mg/L", "= Falla" o "sin datos por más de 60 s". */
  condition: string;
  priority: AlarmPriority;
  message: string;
  state: AlarmState;
  raised_at: string;
  /** En comunicación: segundos sin datos; null si el dispositivo nunca envió. */
  raise_value: number | null;
  cleared_at: string | null;
  clear_value: number | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  ack_comment: string;
  simulated: boolean;
}

export interface AlarmSummary {
  project: string;
  active: number;
  unacknowledged: number;
  open: number;
  highest_priority: AlarmPriority;
}

export const listAlarms = ({ project, status = 'open', signal }: { project?: string; status?: 'open' | 'all'; signal?: AbortSignal } = {}) =>
  request<Alarm[]>('/alarms', { query: { project, status }, signal });
export const getAlarmSummary = (signal?: AbortSignal) => request<AlarmSummary[]>('/alarms/summary', { signal });
export const acknowledgeAlarm = (id: number, comment: string) =>
  request<Alarm>(`/alarms/${id}/acknowledge`, { method: 'POST', body: { comment } });

// ------------------------------------------------------------------ bitácora compartida

export type WorkStatus = 'pending' | 'in_progress' | 'resolved';
export type WorkPriority = 'normal' | 'high';

export interface WorkItemEvent { kind: 'created' | 'change' | 'note'; text: string; author: string | null; created_at: string }

export interface WorkItem {
  id: number;
  project: string;
  asset: string;
  title: string;
  priority: WorkPriority;
  status: WorkStatus;
  owner: string;
  due_date: string | null;
  alarm_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  events: WorkItemEvent[];
}

export interface NewWorkItem {
  project: string;
  title: string;
  asset?: string;
  priority?: WorkPriority;
  owner?: string;
  due_date?: string | null;
  alarm_id?: number | null;
}

export const listWorkItems = ({ project, status = 'all', signal }: { project?: string; status?: 'open' | 'all'; signal?: AbortSignal } = {}) =>
  request<WorkItem[]>('/work-items', { query: { project, status }, signal });
export const createWorkItem = (item: NewWorkItem) => request<WorkItem>('/work-items', { method: 'POST', body: item });
export const updateWorkItem = (id: number, changes: Partial<Pick<WorkItem, 'status' | 'priority' | 'owner' | 'due_date'>>) =>
  request<WorkItem>(`/work-items/${id}`, { method: 'PATCH', body: changes });
export const addWorkItemNote = (id: number, text: string) =>
  request<WorkItem>(`/work-items/${id}/notes`, { method: 'POST', body: { text } });
