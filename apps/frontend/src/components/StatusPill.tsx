type Status = 'idle' | 'queued' | 'running' | 'done' | 'error';

const LABEL: Record<Status, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  error: 'Error',
};

export function StatusPill({ status, detail }: { status: Status; detail?: string }) {
  const suffix = detail ? ` • ${detail}` : '';
  return (
    <span className={`status-pill status-pill--${status}`} role="status" aria-live="polite">
      {LABEL[status]}
      {suffix}
    </span>
  );
}

export type { Status };
