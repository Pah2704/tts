// apps/frontend/src/pages/Workspace.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { postBlock, patchBlock, createTtsJob, API_BASE } from '../lib/api';
import type { RowMetrics } from '../lib/api';

type Row = { rowId: string; text: string };
type Block = { id: string; kind: 'mono'|'dialog'; rows: Row[]; text: string };
type RowOutput = { fileKey: string; bytes: number; durationMs: number; metrics: RowMetrics };

export default function Workspace() {
  const [mode, setMode] = useState<'mono'|'dialog'>('mono');
  const [text, setText] = useState('');
  const [block, setBlock] = useState<Block | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState<boolean[]>([]);
  const [rowOutputs, setRowOutputs] = useState<Array<RowOutput | null>>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qcSummary, setQcSummary] = useState<{ rowsPass: number; rowsFail: number; blockLufs?: number; blockTruePeakDb?: number; blockClippingPct?: number } | null>(null);
  const [mergedKey, setMergedKey] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const canContinue = text.trim().length > 0;

  const warnings = useMemo(() => {
    if (mode === 'dialog') {
      // cảnh báo dòng hội thoại không đúng cú pháp [Tên]:
      return text
        .split(/\n+/)
        .map((l, i) => (/^\s*\[[^\]]+\]\s*:/).test(l) ? null : i + 1)
        .filter(Boolean) as number[];
    }
    return [];
  }, [mode, text]);

  const onContinue = async () => {
    const b = await postBlock({ projectId: 'demo', kind: mode, text });
    setBlock(b);
    setRows(b.rows);
    setDone(Array(b.rows.length).fill(false));
    setRowOutputs(Array(b.rows.length).fill(null));
    // reset trạng thái job cũ nếu có
    setJobId(null);
    setQcSummary(null);
    setMergedKey(null);
    setJobError(null);
    closeES();
  };

  const mergeWithNext = (i: number) => {
    if (isGenerating) return;
    if (i < 0 || i >= rows.length - 1) return;
    const merged = rows[i].text + ' ' + rows[i + 1].text;
    const next = [...rows];
    next.splice(i, 2, { rowId: nanoid(), text: merged.trim() });
    setRows(next);
    setDone(d => {
      const nd = [...d];
      nd.splice(i, 2, false);
      return nd;
    });
    setRowOutputs(() => Array(next.length).fill(null));
  };

  const splitRow = (i: number) => {
    if (isGenerating) return;
    const r = rows[i];
    const mid = Math.floor(r.text.length / 2);
    const at = r.text.indexOf(' ', mid);
    if (at < 0) return;
    const a = r.text.slice(0, at).trim();
    const b = r.text.slice(at + 1).trim();
    const next = [...rows];
    next.splice(i, 1, { rowId: nanoid(), text: a }, { rowId: nanoid(), text: b });
    setRows(next);
    setDone(d => {
      const nd = [...d];
      nd.splice(i, 1, false, false);
      return nd;
    });
    setRowOutputs(() => Array(next.length).fill(null));
  };

  const save = async () => {
    if (!block || isGenerating) return;
    const joined = rows.map(r => r.text).join(' ');
    const b = await patchBlock(block.id, { text: joined });
    setBlock(b);
    setRows(b.rows);
    setDone(Array(b.rows.length).fill(false));
    setRowOutputs(Array(b.rows.length).fill(null));
  };

  const closeES = () => {
    try {
      esRef.current?.close?.();
    } catch {}
    esRef.current = null;
  };

  const startTts = async () => {
    if (!block) return;

    // nếu đang chạy, đóng stream cũ trước
    closeES();
    setIsGenerating(true);

    try {
      const payloadRows = rows.map(r => ({ rowId: r.rowId, text: r.text }));
      const { jobId } = await createTtsJob(block.id, payloadRows, 'piper', 'demo');
      setJobId(jobId);
      setQcSummary(null);
      setMergedKey(null);
      setJobError(null);
      setRowOutputs(Array(rows.length).fill(null));
      setDone(Array(rows.length).fill(false));

      const es = new EventSource(`${API_BASE}/jobs/${jobId}/stream`);
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'row') {
            if (data.state === 'done') {
              setDone(d => {
                const nd = [...d];
                if (data.rowIndex >= 0 && data.rowIndex < nd.length) {
                  nd[data.rowIndex] = true;
                }
                return nd;
              });
              setRowOutputs(outputs => {
                const next = [...outputs];
                if (data.rowIndex >= 0 && data.rowIndex < next.length) {
                  next[data.rowIndex] = {
                    fileKey: data.fileKey,
                    bytes: data.bytes,
                    durationMs: data.durationMs,
                    metrics: data.metrics,
                  };
                }
                return next;
              });
            }
          } else if (data.type === 'final') {
            if (data.state === 'done') {
              setQcSummary(data.qcSummary || null);
              setMergedKey(data.mergedKey ?? null);
              closeES();
              setIsGenerating(false);
            } else if (data.state === 'error') {
              setJobError(data.error || 'Job failed');
              closeES();
              setIsGenerating(false);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        closeES();
        setIsGenerating(false);
      };
    } catch (e) {
      setIsGenerating(false);
      throw e;
    }
  };

  // cleanup khi unmount
  useEffect(() => {
    return () => {
      closeES();
    };
  }, []);

  const completedCount = rowOutputs.filter(Boolean).length;
  const totalRows = rowOutputs.length || rows.length || 1;
  const completionPct = Math.round((completedCount / totalRows) * 100);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Workspace (Block-first)</h1>

      {!block && (
        <div className="space-y-2">
          <div className="flex gap-4 items-center">
            <label className="font-medium">Loại văn bản:</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as any)}
              className="border rounded p-1"
              disabled={isGenerating}
            >
              <option value="mono">Đơn thoại</option>
              <option value="dialog">Hội thoại</option>
            </select>
            {mode === 'dialog' && warnings.length > 0 && (
              <span className="text-amber-600 text-sm">
                ⚠ Có {warnings.length} dòng có thể sai cú pháp [Tên]:
              </span>
            )}
          </div>

          <textarea
            className="w-full h-40 border rounded p-2"
            placeholder={mode === 'dialog' ? '[Nam]: Xin chào...' : 'Dán đoạn văn...'}
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={isGenerating}
          />

          <button
            disabled={!canContinue || isGenerating}
            onClick={onContinue}
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            Tiếp tục
          </button>
        </div>
      )}

      {block && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm opacity-70">Block ID: {block.id}</div>
            <div className="space-x-2">
              <button
                onClick={save}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50"
              >
                Lưu cập nhật
              </button>
              <button
                onClick={startTts}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded bg-purple-600 text-white disabled:opacity-50"
              >
                Generate (SSE thật)
              </button>
            </div>
          </div>

          {totalRows > 0 && (
            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          )}

          {jobError && (
            <div className="p-3 rounded bg-red-100 text-sm text-red-700">
              QC Error: {jobError}
            </div>
          )}

          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.rowId} className="border rounded p-2 flex items-start gap-2">
                <div className="text-xs opacity-60 w-12">#{i + 1}</div>
                <div className="flex-1">
                  <div className="text-sm">
                    {r.text}
                    {done[i] ? <span className="ml-2 text-emerald-600 text-xs">✓ done</span> : null}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => mergeWithNext(i)}
                      disabled={isGenerating}
                      className="text-xs px-2 py-1 border rounded disabled:opacity-50"
                    >
                      Gộp với câu sau
                    </button>
                    <button
                      onClick={() => splitRow(i)}
                      disabled={isGenerating}
                      className="text-xs px-2 py-1 border rounded disabled:opacity-50"
                    >
                      Chia câu ~1/2
                    </button>
                  </div>
                  {rowOutputs[i] && rowOutputs[i]?.metrics && (
                    <div className="mt-2 text-xs border-t pt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${rowOutputs[i]!.metrics.warnings.length ? 'text-amber-600' : 'text-emerald-600'}`}>
                          QC {rowOutputs[i]!.metrics.score.toFixed(2)}
                        </span>
                        <span className="opacity-70">LUFS {rowOutputs[i]!.metrics.lufsIntegrated.toFixed(1)}</span>
                        <span className="opacity-70">Peak {rowOutputs[i]!.metrics.truePeakDb.toFixed(2)} dB</span>
                        <span className="opacity-70">Clip {rowOutputs[i]!.metrics.clippingPct.toFixed(2)}%</span>
                      </div>
                      {rowOutputs[i]!.metrics.warnings.length > 0 && (
                        <div className="text-amber-600">Warnings: {rowOutputs[i]!.metrics.warnings.join(', ')}</div>
                      )}
                      <div className="flex gap-3 text-blue-600">
                        <a
                          href={`${API_BASE}/files/${rowOutputs[i]!.fileKey}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          Tải WAV
                        </a>
                        <span className="opacity-70">{(rowOutputs[i]!.bytes / 1024).toFixed(1)} KB • {Math.round(rowOutputs[i]!.durationMs)} ms</span>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {qcSummary && (
            <div className="border rounded p-3 text-sm space-y-2">
              <div className="font-semibold">QC Summary</div>
              <div className="flex flex-wrap gap-4">
                <span>Rows pass: {qcSummary.rowsPass}</span>
                <span>Rows fail: {qcSummary.rowsFail}</span>
                {typeof qcSummary.blockLufs === 'number' && <span>Block LUFS: {qcSummary.blockLufs.toFixed(2)}</span>}
                {typeof qcSummary.blockTruePeakDb === 'number' && <span>True Peak: {qcSummary.blockTruePeakDb.toFixed(2)} dBTP</span>}
                {typeof qcSummary.blockClippingPct === 'number' && <span>Clipping: {qcSummary.blockClippingPct.toFixed(2)}%</span>}
              </div>
              {mergedKey && (
                <div>
                  <a
                    href={`${API_BASE}/files/${mergedKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Tải bản ghép (merged)
                  </a>
                </div>
              )}
            </div>
          )}

          {jobId && <div className="text-xs opacity-70">Job: {jobId}</div>}
        </div>
      )}
    </div>
  );
}
