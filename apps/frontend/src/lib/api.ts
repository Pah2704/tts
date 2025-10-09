export type Manifest = {
  blockId: string;
  rows: { rowId: string; text: string }[];
  mixKey?: string | null;
  qcKey?: string | null;
  qcBlock?: {
    lufsIntegrated?: number | null;
    truePeakDbtp?: number | null;
    clippingCount?: number | null;
    oversampleFactor?: number | null;
    score?: number | null;
    pass?: boolean | null;
    warnings?: string[] | null;
  };
  qcSummary?: {
    rowsPass: number;
    rowsFail: number;
    blockLufs: number | null;
    blockTruePeakDb: number | null;
    blockClippingPct: number | null;
  };
};

export type JobState = 'unknown' | 'active' | 'delayed' | 'done' | 'error';

export type RowPayload = { rowId: string; text: string };

export type RowMetrics = {
  lufsIntegrated: number | null;
  truePeakDb: number | null;
  truePeakDbtp: number | null;
  clippingPct: number | null;
  clippingCount?: number | null;
  oversampleFactor?: number | null;
  score?: number | null;
  warnings: string[];
};

export type RowProgress =
  | {
      type: 'row';
      rowIndex: number;
      total: number;
      state: 'running' | 'queued';
      progress?: number;
    }
  | {
      type: 'row';
      rowIndex: number;
      total: number;
      state: 'done';
      fileKey: string;
      bytes: number;
      durationMs: number;
      metrics: RowMetrics;
    }
  | {
      type: 'row';
      rowIndex: number;
      total: number;
      state: 'error';
      error?: string;
    }
  | {
      type: 'final';
      state: 'done';
      manifestKey?: string;
      qcSummary?: Manifest['qcSummary'];
      mixKey?: string | null;
      qcBlock?: Manifest['qcBlock'];
      qcKey?: string | null;
    }
  | {
      type: 'final';
      state: 'error';
      error: string;
      atRow?: number;
      qcBlock?: Manifest['qcBlock'];
      qcKey?: string | null;
    };

function getWindowLocation() {
  if (typeof window === 'undefined') {
    return { protocol: 'http:', hostname: 'localhost' };
  }
  const { protocol, hostname } = window.location;
  return {
    protocol: protocol || 'http:',
    hostname: hostname || 'localhost',
  };
}

export function sanitizeBase(input?: string) {
  const raw = (input ?? '').trim();
  const { protocol, hostname } = getWindowLocation();
  if (!raw) return `${protocol}//${hostname}:4000`;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/+$/, '');
  }
  if (raw.startsWith(':')) {
    return `${protocol}//${hostname}${raw}`;
  }
  if (/^\d+$/.test(raw)) {
    return `${protocol}//${hostname}:${raw}`;
  }
  return raw.replace(/\/+$/, '');
}

export const BASE = sanitizeBase(
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE : undefined,
);

export function extractError(err: unknown, fallback = 'Unexpected error') {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err || fallback;
  return fallback;
}

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    const detail = text || response.statusText || 'Request failed';
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  if (!text) {
    throw new Error(`HTTP ${response.status}: Empty response`);
  }
  const trimmed = text.trim();
  if (trimmed === 'undefined' || trimmed === 'null') {
    throw new Error(`HTTP ${response.status}: Invalid JSON (${trimmed || 'empty'})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    throw new Error(`HTTP ${response.status}: Invalid JSON (${snippet})`);
  }
}

export type BlockResponse = {
  id: string;
  kind: 'mono' | 'dialog';
  text: string;
  rows: { rowId: string; text: string }[];
};

export async function postBlock(text: string, kind: 'mono' | 'dialog' = 'mono', projectId = 'demo') {
  const response = await fetch(`${BASE}/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      kind,
      text,
    }),
  });
  return safeJson<BlockResponse>(response);
}

export async function fetchBlock(blockId: string): Promise<BlockResponse> {
  const response = await fetch(`${BASE}/blocks/${blockId}`);
  return safeJson<BlockResponse>(response);
}

export async function patchBlock(blockId: string, payload: Partial<{ text: string }>) {
  const response = await fetch(`${BASE}/blocks/${blockId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return safeJson<BlockResponse>(response);
}

export async function postTtsJob(
  blockId: string,
  options: {
    rows?: RowPayload[];
    engine?: 'piper' | 'xtts';
    projectId?: string;
  } = {},
) {
  const response = await fetch(`${BASE}/jobs/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blockId,
      rows: options.rows,
      engine: options.engine,
      projectId: options.projectId ?? 'demo',
    }),
  });
  return safeJson<{ jobId: string }>(response);
}

export async function fetchJobStatus(jobId: string): Promise<{ state: JobState }> {
  const response = await fetch(`${BASE}/jobs/${jobId}/status`);
  if (response.status === 404) {
    return { state: 'unknown' };
  }
  const payload = await safeJson<{ state?: string }>(response);
  const rawState = typeof payload.state === 'string' ? payload.state : 'unknown';
  const allowed: JobState[] = ['unknown', 'active', 'delayed', 'done', 'error'];
  return { state: allowed.includes(rawState as JobState) ? (rawState as JobState) : 'unknown' };
}

export async function fetchManifest(
  blockId: string,
  options: { signal?: AbortSignal } = {},
): Promise<Manifest> {
  const response = await fetch(`${BASE}/blocks/${blockId}/manifest`, {
    signal: options.signal,
  });
  return safeJson<Manifest>(response);
}

export function streamJobProgress(
  jobId: string,
  onEvent: (event: RowProgress) => void,
  options: { signal?: AbortSignal; onError?: (event: Event) => void } = {},
) {
  const url = `${BASE}/jobs/${encodeURIComponent(jobId)}/stream`;
  const source = new EventSource(url);
  const handleClose = () => {
    source.close();
    if (options.signal) {
      options.signal.removeEventListener('abort', handleClose);
    }
  };

  source.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      onEvent(payload);
    } catch {
      // ignore
    }
  };
  source.onerror = (event) => {
    options.onError?.(event);
    handleClose();
  };
  if (options.signal) {
    if (options.signal.aborted) {
      handleClose();
    } else {
      options.signal.addEventListener('abort', handleClose);
    }
  }
  return source;
}

export function fileUrl(key: string) {
  const encoded = encodeURIComponent(key);
  return `${BASE}/files/${encoded}`;
}
