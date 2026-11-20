import type { LatestReading, LatestSnapshot, Me, ProjectSummary } from '../services/hail';
import type { Telemetry } from '../services/types';

export const NOW = Date.parse('2026-11-19T15:00:00Z');
export const iso = (offsetMs = 0) => new Date(NOW + offsetMs).toISOString();

export function reading(tag: string, value: number | null, extra: Partial<LatestReading> = {}): LatestReading {
  return {
    tag, description: tag, kind: 'AI', unit: '', decimals: 1, value,
    state_label: null, quality: value === null ? null : 'good', time: value === null ? null : iso(-1000), stale: value === null,
    ...extra,
  };
}

export const snapshot = (readings: LatestReading[]): LatestSnapshot => ({ server_time: iso(), stale_after_seconds: 30, readings });

export const aguapozoReadings = (extra: Partial<LatestReading> = {}) => [
  reading('LT-101', 68.2, extra), reading('LT-102', 12.1, extra), reading('FT-101', 12.4, extra),
  reading('AIT-101', 0.65, extra), reading('P-101', 1, { kind: 'STATE', ...extra }), reading('D-101', 1, { kind: 'STATE', ...extra }),
];

const measurement = (value: number) => ({ value, quality: 'good' as const });
export const telemetry = (patch: Partial<Telemetry> = {}): Telemetry => ({
  timestamp: iso(),
  level: measurement(68), wellWaterDepthM: measurement(12), flow: measurement(12.4), chlorine: measurement(0.65),
  states: { pump: 'running', dosing: 'active', communication: 'connected' },
  ...patch,
});

export const project = (slug: string, patch: Partial<ProjectSummary> = {}): ProjectSummary => ({
  slug, name: slug, category: 'Prueba', description: '', hmi_type: 'generic', status: 'demo', image: '', is_active: true,
  organization: { slug: `org-${slug}`, name: `Cliente ${slug}` }, role: 'viewer',
  ...patch,
});

export const me = (patch: Partial<Me> = {}): Me => ({
  id: 1, email: 'ana@cliente.cl', full_name: 'Ana Pérez', is_platform_admin: false,
  organizations: [{ slug: 'org-a', name: 'Cliente A', role: 'viewer' }],
  ...patch,
});
