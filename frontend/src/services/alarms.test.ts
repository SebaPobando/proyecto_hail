import { describe, expect, it } from 'vitest';
import { sortAlarms } from '../components/AlarmsPanel';
import { iso, NOW } from '../test/fixtures';
import { alarmTotals, canOperate, duration, formatValue, needsAck, raiseLabel } from './alarms';
import type { Alarm } from './hail';

const alarm = (id: number, patch: Partial<Alarm>): Alarm => ({
  id, project: 'aguapozo', project_name: 'AguaPozo', tag: 'AIT-101', description: 'Cloro', unit: 'mg/L', kind: 'signal', condition: '≤ 0,2 mg/L',
  priority: 'medium', message: '', state: 'active_unack', raised_at: iso(), raise_value: 0.1, cleared_at: null, clear_value: null,
  acknowledged_at: null, acknowledged_by: null, ack_comment: '', simulated: true, ...patch,
});

describe('alarmas en pantalla', () => {
  it('solo operadores y administradores pueden operar', () => {
    expect(canOperate({ role: 'viewer' })).toBe(false);
    expect(canOperate({ role: '' })).toBe(false);
    expect(canOperate(undefined)).toBe(false);
    for (const role of ['operator', 'org_admin', 'platform_admin'] as const) expect(canOperate({ role })).toBe(true);
  });

  it('pendientes de reconocer: activa sin reconocer y normalizada sin reconocer', () => {
    expect(needsAck('active_unack')).toBe(true);
    expect(needsAck('cleared_unack')).toBe(true);
    expect(needsAck('active_ack')).toBe(false);
    expect(needsAck('closed')).toBe(false);
  });

  it('ordena: sin reconocer, luego prioridad, luego la más antigua', () => {
    const sorted = sortAlarms([
      alarm(1, { state: 'active_ack', priority: 'high' }),
      alarm(2, { priority: 'low', raised_at: iso(-60_000) }),
      alarm(3, { priority: 'high', raised_at: iso() }),
      alarm(4, { priority: 'high', raised_at: iso(-120_000) }),
    ]);
    expect(sorted.map(a => a.id)).toEqual([4, 3, 2, 1]);
  });

  it('duración legible', () => {
    expect(duration(iso(-45_000), NOW)).toBe('45 s');
    expect(duration(iso(-12 * 60_000), NOW)).toBe('12 min');
    expect(duration(iso(-(3 * 60 + 5) * 60_000), NOW)).toBe('3 h 05 min');
    expect(duration(iso(-(52 * 60) * 60_000), NOW)).toBe('2 d 4 h');
  });

  it('formatea valores y totaliza el resumen por proyecto', () => {
    expect(formatValue(0.15, 'mg/L')).toBe('0,15 mg/L');
    expect(formatValue(null, '%')).toBe('—');
    const summary = [
      { project: 'a', active: 2, unacknowledged: 1, open: 3, highest_priority: 'high' as const },
      { project: 'b', active: 1, unacknowledged: 1, open: 1, highest_priority: 'low' as const },
    ];
    expect(alarmTotals(summary)).toEqual({ open: 4, unacknowledged: 2, active: 3 });
    expect(alarmTotals(summary, ['b'])).toEqual({ open: 1, unacknowledged: 1, active: 1 });
  });

  it('presenta en palabras el valor de las alarmas de comunicación', () => {
    expect(raiseLabel(alarm(1, {}))).toEqual({ label: 'Valor al activarse', value: '0,1 mg/L' });
    expect(raiseLabel(alarm(1, { kind: 'communication', unit: 's', raise_value: null })).value).toBe('Nunca ha enviado datos');
    expect(raiseLabel(alarm(1, { kind: 'communication', unit: 's', raise_value: 150 })).value).toBe('2 min sin datos');
  });
});
