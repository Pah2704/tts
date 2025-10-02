export const API_BASE =
  (typeof import.meta !== 'undefined' &&
   (import.meta.env?.VITE_API_BASE || import.meta.env?.VITE_API_URL)) ||
  'http://localhost:4000';

export async function postBlock(payload: {projectId:string, kind:'mono'|'dialog', text:string}) {
  const r = await fetch(`${API_BASE}/blocks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Create block failed'); return r.json();
}

export async function patchBlock(id: string, payload: Partial<{text:string, kind:'mono'|'dialog'}>) {
  const r = await fetch(`${API_BASE}/blocks/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Update block failed'); return r.json();
}

export async function createMockJob(blockId: string): Promise<{jobId: string}> {
  const r = await fetch(`${API_BASE}/jobs/mock`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ blockId }) });
  if (!r.ok) throw new Error('Create job failed'); return r.json();
}
