/**
 * Avisos en vivo por WebSocket (/ws/updates).
 *
 * El servidor solo avisa "cambió algo de tal tipo en tal proyecto"; las
 * pantallas vuelven a pedir los datos por la API. Si el WebSocket no conecta,
 * o el servidor dice que no puede avisar entre procesos (`live: false`, sin
 * Redis), las pantallas siguen consultando periódicamente como siempre.
 */
import { useSyncExternalStore } from 'react';

export type LiveKind = 'telemetry' | 'alarms' | 'work_items';
export interface LiveEvent { project: string; kind: LiveKind }
/** off: sin sesión · connecting · live: avisos al instante · polling: solo consulta periódica. */
export type LiveStatus = 'off' | 'connecting' | 'live' | 'polling';

const UNAUTHENTICATED = 4401;
const MAX_RETRY_MS = 30_000;

type Socket = Pick<WebSocket, 'close' | 'onopen' | 'onmessage' | 'onclose' | 'onerror'>;

export class LiveClient {
  private socket: Socket | null = null;
  private status: LiveStatus = 'off';
  private retryMs = 1000;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private readonly events = new Set<(event: LiveEvent) => void>();
  private readonly statuses = new Set<() => void>();

  constructor(private readonly open: () => Socket | null) {}

  getStatus = () => this.status;

  subscribeStatus = (listener: () => void) => {
    this.statuses.add(listener);
    return () => { this.statuses.delete(listener); };
  };

  subscribe(listener: (event: LiveEvent) => void) {
    this.events.add(listener);
    return () => { this.events.delete(listener); };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.retryMs = 1000;
    this.connect();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setStatus('off');
  }

  /** Para pruebas y para el manejador del socket. */
  handleMessage(data: string) {
    let message: { type?: string; live?: boolean; project?: string; kind?: LiveKind };
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (message.type === 'hello') {
      this.retryMs = 1000;
      this.setStatus(message.live ? 'live' : 'polling');
    } else if (message.type === 'event' && message.project && message.kind) {
      const event = { project: message.project, kind: message.kind };
      this.events.forEach(listener => listener(event));
    }
  }

  private connect() {
    const socket = this.open();
    if (!socket) {
      this.setStatus('polling');
      return;
    }
    this.socket = socket;
    this.setStatus('connecting');
    socket.onmessage = event => this.handleMessage(String(event.data));
    socket.onclose = event => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (!this.running) return;
      this.setStatus('polling');
      if (event.code === UNAUTHENTICATED) return; // sin sesión: no insistir
      this.timer = setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
    };
  }

  private setStatus(status: LiveStatus) {
    if (status === this.status) return;
    this.status = status;
    this.statuses.forEach(listener => listener());
  }
}

function openBrowserSocket(): Socket | null {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  try {
    return new WebSocket(`${protocol}://${window.location.host}/ws/updates`);
  } catch {
    return null;
  }
}

export const live = new LiveClient(openBrowserSocket);

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(live.subscribeStatus, live.getStatus, () => 'off');
}

/** ¿Este aviso interesa a quien mira `kinds` del proyecto `project` (o de cualquiera si no se indica)? */
export const matches = (event: LiveEvent, kinds: readonly LiveKind[], project?: string) =>
  kinds.includes(event.kind) && (project === undefined || event.project === project);
