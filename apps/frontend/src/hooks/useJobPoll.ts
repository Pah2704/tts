import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJobStatus, type JobState } from '../lib/api';

type Options = {
  interval?: number;
};

const COMPLETE_STATES: JobState[] = ['done', 'error'];

export function useJobPoll(jobId?: string | null, options: Options = {}) {
  const interval = Math.max(250, options.interval ?? 1000);
  const [state, setState] = useState<JobState>('unknown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeJobRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const pollOnce = useCallback(
    async (id: string) => {
      try {
        const result = await fetchJobStatus(id);
        if (!isMountedRef.current) return;
        setState(result.state);
        if (COMPLETE_STATES.includes(result.state)) {
          clearTimer();
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error(err);
        setState('error');
        clearTimer();
      }
    },
    [clearTimer],
  );

  const stop = useCallback(() => {
    activeJobRef.current = null;
    clearTimer();
  }, [clearTimer]);

  const start = useCallback(
    (nextId?: string) => {
      const id = nextId ?? jobId;
      if (!id) return;
      if (activeJobRef.current === id && timerRef.current) {
        return;
      }

      stop();
      activeJobRef.current = id;
      setState('unknown');
      pollOnce(id);
      timerRef.current = setInterval(() => pollOnce(id), interval);
    },
    [interval, jobId, pollOnce, stop],
  );

  useEffect(() => {
    if (!jobId) {
      stop();
      setState('unknown');
      return;
    }
    start(jobId);
  }, [jobId, start, stop]);

  return useMemo(
    () => ({
      state,
      start,
      stop,
    }),
    [start, state, stop],
  );
}
