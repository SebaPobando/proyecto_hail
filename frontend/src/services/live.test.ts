import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveClient, matches, type LiveEvent } from './live';

type Fake = { close: () => void; onopen: null; onmessage: ((e: { data: string }) => void) | null; onclose: ((e: { code: number }) => void) | null; onerror: null };

function setup() {
  const sockets: Fake[] = [];
  const client = new LiveClient(() => {
    const socket: Fake = { close: vi.fn(), onopen: null, onmessage: null, onclose: null, onerror: null };
    sockets.push(socket);
    return socket as unknown as WebSocket;
  });
  return { client, sockets };
}

afterEach(() => vi.useRealTimers());

describe('LiveClient', () => {
  it('pasa a "en vivo" solo si el servidor puede avisar entre procesos', () => {
    const { client, sockets } = setup();
    client.start();
    expect(client.getStatus()).toBe('connecting');
    sockets[0].onmessage!({ data: JSON.stringify({ type: 'hello', live: false }) });
    expect(client.getStatus()).toBe('polling');
    sockets[0].onmessage!({ data: JSON.stringify({ type: 'hello', live: true }) });
    expect(client.getStatus()).toBe('live');
  });

  it('entrega los avisos a quienes están suscritos e ignora mensajes inválidos', () => {
    const { client, sockets } = setup();
    const received: LiveEvent[] = [];
    const stop = client.subscribe(event => received.push(event));
    client.start();
    sockets[0].onmessage!({ data: JSON.stringify({ type: 'event', project: 'aguapozo', kind: 'alarms' }) });
    sockets[0].onmessage!({ data: 'no es json' });
    sockets[0].onmessage!({ data: JSON.stringify({ type: 'event' }) });
    stop();
    sockets[0].onmessage!({ data: JSON.stringify({ type: 'event', project: 'aguapozo', kind: 'telemetry' }) });
    expect(received).toEqual([{ project: 'aguapozo', kind: 'alarms' }]);
  });

  it('reconecta con espera creciente y no insiste sin sesión', () => {
    vi.useFakeTimers();
    const { client, sockets } = setup();
    client.start();
    sockets[0].onclose!({ code: 1006 });
    expect(client.getStatus()).toBe('polling');
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1].onclose!({ code: 1006 });
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2].onclose!({ code: 4401 });
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(3);
  });

  it('al cerrar sesión se detiene y no reconecta', () => {
    vi.useFakeTimers();
    const { client, sockets } = setup();
    client.start();
    client.stop();
    expect(sockets[0].close).toHaveBeenCalled();
    expect(client.getStatus()).toBe('off');
    sockets[0].onclose?.({ code: 1000 });
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('sin WebSocket disponible queda en consulta periódica', () => {
    const client = new LiveClient(() => null);
    client.start();
    expect(client.getStatus()).toBe('polling');
  });
});

describe('matches', () => {
  it('filtra por tipo y, si se indica, por proyecto', () => {
    const event = { project: 'aguapozo', kind: 'alarms' } as const;
    expect(matches(event, ['alarms'])).toBe(true);
    expect(matches(event, ['alarms'], 'aguapozo')).toBe(true);
    expect(matches(event, ['alarms'], 'nutrial')).toBe(false);
    expect(matches(event, ['telemetry'])).toBe(false);
  });
});
