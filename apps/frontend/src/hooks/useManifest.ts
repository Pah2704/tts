import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchManifest, type Manifest } from '../lib/api';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function useManifest(blockId?: string) {
  const [data, setData] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const controllerRef = useRef<AbortController | null>(null);
  const currentIdRef = useRef<string | null>(null);

  const abortInFlight = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const load = useCallback(
    async (id: string) => {
      if (status === 'loading' && currentIdRef.current === id) {
        return;
      }
      abortInFlight();
      const controller = new AbortController();
      controllerRef.current = controller;
      currentIdRef.current = id;

      setStatus('loading');
      setError(null);

      try {
        const manifest = await fetchManifest(id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setData(manifest);
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        setData(null);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Manifest load failed');
      }
    },
    [abortInFlight, status],
  );

  useEffect(() => {
    if (!blockId) {
      abortInFlight();
      setData(null);
      setError(null);
      setStatus('idle');
      currentIdRef.current = null;
      return;
    }

    load(blockId);

    return () => {
      abortInFlight();
    };
  }, [abortInFlight, blockId, load]);

  const refresh = useCallback(() => {
    if (blockId) {
      load(blockId);
    }
  }, [blockId, load]);

  return {
    data,
    error,
    loading: status === 'loading',
    refresh,
    status,
  };
}
