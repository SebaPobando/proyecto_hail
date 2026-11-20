import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollState<T> {
  /** Último dato recibido. Se conserva si una consulta posterior falla. */
  data: T | null;
  /** Error de la última consulta, o null si salió bien. */
  error: Error | null;
  /** Momento (reloj del navegador) en que llegó `data`. */
  receivedAt: number | null;
  /** Vuelve a consultar de inmediato. */
  refresh: () => void;
}

/**
 * Consulta `load` al montar y luego cada `intervalMs` (si es mayor que 0).
 * Las consultas no se superponen: la siguiente se programa al terminar la
 * anterior. Cambiar `key` descarta el dato anterior y empieza de nuevo.
 */
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  key: string,
  enabled = true,
): PollState<T> {
  const [state, setState] = useState<{ key: string; data: T | null; error: Error | null; receivedAt: number | null }>(
    { key, data: null, error: null, receivedAt: null },
  );
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function run() {
      try {
        const data = await loadRef.current(controller.signal);
        if (!controller.signal.aborted) setState({ key, data, error: null, receivedAt: Date.now() });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState(previous => ({
          key,
          data: previous.key === key ? previous.data : null,
          receivedAt: previous.key === key ? previous.receivedAt : null,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
      if (!controller.signal.aborted && intervalMs > 0) timer = setTimeout(run, intervalMs);
    }
    void run();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, intervalMs, enabled, tick]);

  const refresh = useCallback(() => setTick(value => value + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    receivedAt: current ? state.receivedAt : null,
    refresh,
  };
}
