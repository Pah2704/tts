// apps/frontend/src/lib/api.ts
export const API_BASE =
  (typeof import.meta !== 'undefined' &&
   (import.meta.env?.VITE_API_BASE || import.meta.env?.VITE_API_URL)) ||
  'http://localhost:4000';

export async function postBlock(payload: {projectId:string, kind:'mono'|'dialog', text:string}) {
  const r = await fetch(`${API_BASE}/blocks`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Create block failed');
  return r.json();
}

export async function patchBlock(id: string, payload: Partial<{text:string, kind:'mono'|'dialog'}>) {
  const r = await fetch(`${API_BASE}/blocks/${id}`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Update block failed');
  return r.json();
}

/** ---- Ngày 3: gọi job TTS thật + SSE progress ---- */

export type RowPayload = { rowId: string; text: string };

export type RowMetrics = {
  lufsIntegrated: number;
  truePeakDb: number;
  clippingPct: number;
  score: number;
  warnings: string[];
};

export type RowProgress =
  | {
      type: 'row';
      rowIndex: number;
      total: number;
      state: 'running';
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
      type: 'final';
      state: 'done';
      manifestKey: string;
      qcSummary: {
        rowsPass: number;
        rowsFail: number;
        blockLufs?: number;
        blockTruePeakDb?: number;
        blockClippingPct?: number;
      };
      mergedKey?: string;
    }
  | {
      type: 'final';
      state: 'error';
      error: string;
      atRow?: number;
    };

/** Tạo job TTS thật (thay cho /jobs/mock) */
export async function createTtsJob(
  blockId: string,
  rows: RowPayload[],
  engine: 'piper'|'xtts' = 'piper',
  projectId = 'demo'
): Promise<{ jobId: string }> {
  const r = await fetch(`${API_BASE}/jobs/tts`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ blockId, engine, rows, projectId })
  });
  if (!r.ok) throw new Error('Create TTS job failed');
  return r.json();
}

/** Subscribe SSE để nhận tiến độ theo Row */
export function streamJobProgress(
  jobId: string,
  onEvent: (e: RowProgress) => void
): EventSource {
  const es = new EventSource(`${API_BASE}/jobs/${jobId}/stream`);
  es.onmessage = (ev) => {
    try { onEvent(JSON.parse(ev.data)); } catch { /* ignore parse errors */ }
  };
  // optional: handle disconnect/retry tại nơi gọi
  return es;
}

/** (Tuỳ chọn) Alias tạm thời để khỏi vỡ import cũ */
export const createJob = createTtsJob;
