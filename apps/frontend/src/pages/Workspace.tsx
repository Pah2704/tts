import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { postBlock, patchBlock, createMockJob, API_BASE } from '../lib/api';

type Row = { rowId: string; text: string };
type Block = { id: string; kind: 'mono'|'dialog'; rows: Row[]; text: string };

export default function Workspace() {
  const [mode, setMode] = useState<'mono'|'dialog'>('mono');
  const [text, setText] = useState('');
  const [block, setBlock] = useState<Block| null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState<boolean[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  const canContinue = text.trim().length > 0;

  const warnings = useMemo(() => {
    if (mode === 'dialog') {
      return text.split(/\n+/).map((l,i)=>(/^\s*\[[^\]]+\]\s*:/).test(l) ? null : i+1).filter(Boolean) as number[];
    }
    return [];
  }, [mode, text]);

  const onContinue = async () => {
    const b = await postBlock({ projectId: 'demo', kind: mode, text });
    setBlock(b); setRows(b.rows);
    setDone(Array(b.rows.length).fill(false));
  };

  const mergeWithNext = (i: number) => {
    if (i<0 || i>=rows.length-1) return;
    const merged = rows[i].text + ' ' + rows[i+1].text;
    const next = [...rows];
    next.splice(i,2,{ rowId: nanoid(), text: merged.trim() });
    setRows(next);
    setDone(d => {
      const nd = [...d]; nd.splice(i,2,false); return nd;
    });
  };

  const splitRow = (i: number) => {
    const r = rows[i];
    const mid = Math.floor(r.text.length/2);
    const at = r.text.indexOf(' ', mid);
    if (at<0) return;
    const a = r.text.slice(0, at).trim();
    const b = r.text.slice(at+1).trim();
    const next = [...rows];
    next.splice(i,1,{rowId:nanoid(), text:a},{rowId:nanoid(), text:b});
    setRows(next);
    setDone(d => { const nd=[...d]; nd.splice(i,1,false,false); return nd; });
  };

  const save = async () => {
    if (!block) return;
    const joined = rows.map(r=>r.text).join(' ');
    const b = await patchBlock(block.id, { text: joined });
    setBlock(b); setRows(b.rows);
    setDone(Array(b.rows.length).fill(false));
  };

  const startMock = async () => {
    if (!block) return;
    const { jobId } = await createMockJob(block.id);
    setJobId(jobId);
    const es = new EventSource(`${API_BASE}/jobs/${jobId}/stream`);
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'row-progress') {
        setDone(d => {
          const nd = [...d];
          nd[data.index] = true;
          return nd;
        });
      } else if (data.type === 'done' || data.type === 'error') {
        es.close();
      }
    };
    es.onerror = () => { es.close(); };
  };

  const completedCount = done.filter(Boolean).length;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Workspace (Block-first)</h1>

      {!block && (
        <div className="space-y-2">
          <div className="flex gap-4 items-center">
            <label className="font-medium">Loại văn bản:</label>
            <select value={mode} onChange={e=>setMode(e.target.value as any)} className="border rounded p-1">
              <option value="mono">Đơn thoại</option>
              <option value="dialog">Hội thoại</option>
            </select>
            {mode==='dialog' && warnings.length>0 && (
              <span className="text-amber-600 text-sm">⚠ Có {warnings.length} dòng có thể sai cú pháp [Tên]:</span>
            )}
          </div>
          <textarea className="w-full h-40 border rounded p-2" placeholder={mode==='dialog' ? '[Nam]: Xin chào...' : 'Dán đoạn văn...'}
            value={text} onChange={e=>setText(e.target.value)} />
          <button disabled={!canContinue} onClick={onContinue} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
            Tiếp tục
          </button>
        </div>
      )}

      {block && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm opacity-70">Block ID: {block.id}</div>
            <div className="space-x-2">
              <button onClick={save} className="px-3 py-1.5 rounded bg-emerald-600 text-white">Lưu cập nhật</button>
              <button onClick={startMock} className="px-3 py-1.5 rounded bg-purple-600 text-white">Giả lập Generate (SSE)</button>
            </div>
          </div>

          {done.length > 0 && (
            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2"
                style={{ width: `${Math.round((completedCount / done.length) * 100)}%` }}
              />
            </div>
          )}

          <ul className="space-y-2">
            {rows.map((r, i)=>(
              <li key={r.rowId} className="border rounded p-2 flex items-start gap-2">
                <div className="text-xs opacity-60 w-12">#{i+1}</div>
                <div className="flex-1">
                  <div className="text-sm">
                    {r.text}
                    {done[i] ? <span className="ml-2 text-emerald-600 text-xs">✓ done</span> : null}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <button onClick={()=>mergeWithNext(i)} className="text-xs px-2 py-1 border rounded">Gộp với câu sau</button>
                    <button onClick={()=>splitRow(i)} className="text-xs px-2 py-1 border rounded">Chia câu ~1/2</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {jobId && <div className="text-xs opacity-70">Job: {jobId}</div>}
        </div>
      )}
    </div>
  );
}
