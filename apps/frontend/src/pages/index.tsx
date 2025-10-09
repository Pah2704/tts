import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddContentDialog } from '../components/AddContentDialog';
import BlockManifest from '../components/BlockManifest';
import { BlockCard, type BlockView, type RowView } from '../components/BlockCard';
import { HeaderBar } from '../components/HeaderBar';
import { StatusPill, type Status } from '../components/StatusPill';
import {
  extractError,
  fetchBlock,
  fileUrl,
  postBlock,
  postTtsJob,
  streamJobProgress,
  type Manifest,
  type RowPayload,
  type RowProgress,
} from '../lib/api';
import { useJobPoll } from '../hooks/useJobPoll';
import { useManifest } from '../hooks/useManifest';

type RowState = RowView;

type BlockState = BlockView & {
  text: string;
  error?: string | null;
  fetchingManifest?: boolean;
};

type ContentChunk = {
  kind: 'mono' | 'dialog';
  text: string;
  raw: string;
  title: string;
  subtitle?: string | null;
  speaker?: string | null;
};

type SSEMap = Map<string, EventSource>;

const DEFAULT_ENGINE: 'piper' | 'xtts' = 'piper';

const DEFAULT_BLOCK_SETTINGS = {
  voice: 'Piper · Neutral',
  style: 'Conversational',
  pitch: 0,
  speed: 100,
  pauseMs: 0,
  variability: 10,
};

export default function Home() {
  const [blocks, setBlocks] = useState<BlockState[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [quickText, setQuickText] = useState('Hi. Test.');
  const [quickStatus, setQuickStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickBlockId, setQuickBlockId] = useState<string | null>(null);
  const [quickJobId, setQuickJobId] = useState<string | null>(null);

  const sseRefs = useRef<SSEMap>(new Map());
  const jobWaitersRef = useRef<
    Map<
      string,
      {
        resolve: (result: JobResult) => void;
        reject: (error: Error) => void;
      }
    >
  >(new Map());
  const jobPromisesRef = useRef<Map<string, Promise<JobResult>>>(new Map());
  const jobControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [runningAll, setRunningAll] = useState(false);
  const [mergeNotice, setMergeNotice] = useState<string | null>(null);
const quickBlockIdRef = useRef<string | null>(null);
const { state: jobPollState, start: startJobPoll, stop: stopJobPoll } = useJobPoll(undefined, {
  interval: 1000,
});
const pollingRef = useRef<{ blockId: string; jobId: string } | null>(null);

  useEffect(() => {
    return () => {
      sseRefs.current.forEach((source) => source?.close());
      sseRefs.current.clear();
      jobPromisesRef.current.clear();
      jobWaitersRef.current.clear();
      jobControllersRef.current.forEach((controller) => controller.abort());
      jobControllersRef.current.clear();
      stopJobPoll();
    };
  }, [stopJobPoll]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialBlockId = params.get('blockId');
    if (!initialBlockId) return;
    let cancelled = false;

    async function load() {
      try {
        const blockRes = await fetchBlock(initialBlockId);
        if (cancelled) return;
        const chunk: ContentChunk = {
          kind: blockRes.kind,
          raw: blockRes.text,
          text: blockRes.text,
          title: blockRes.kind === 'dialog' ? 'Dialogue block' : 'Imported block',
          subtitle: truncate(blockRes.text, 80),
          speaker: null,
        };
        const loadedBlock = {
          ...convertBlock(blockRes, chunk, DEFAULT_ENGINE),
          fetchingManifest: true,
        };
        setBlocks((prev) => {
          if (prev.some((block) => block.id === blockRes.id)) return prev;
          return [...prev, loadedBlock];
        });
      } catch (err) {
        if (!cancelled) setWorkspaceError((prev) => prev ?? extractError(err, 'Không thể tải block')); 
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    quickBlockIdRef.current = quickBlockId;
  }, [quickBlockId]);

  useEffect(() => {
    if (!quickBlockIdRef.current) return;
    if (jobPollState === 'done' && quickStatus === 'running') {
      setQuickStatus('done');
      stopJobPoll();
    }
    if (jobPollState === 'error' && quickStatus === 'running') {
      setQuickStatus('error');
      setQuickError('Job status unavailable');
      stopJobPoll();
    }
  }, [jobPollState, quickStatus, stopJobPoll]);

  const updateBlock = useCallback(
    (blockId: string, mutator: (block: BlockState) => BlockState) => {
      setBlocks((prev) => prev.map((block) => (block.id === blockId ? mutator(block) : block)));
    },
    [],
  );

  const handleAddContent = useCallback(
    async ({ mode, text }: { mode: 'mono' | 'dialog'; text: string }) => {
      const chunks = parseInput(text, mode);
      if (!chunks.length) {
        setWorkspaceError('Không tìm thấy nội dung hợp lệ.');
        return;
      }
      setCreating(true);
      setWorkspaceError(null);
      try {
        const created: BlockState[] = [];
        for (const chunk of chunks) {
          // eslint-disable-next-line no-await-in-loop
          const blockRes = await postBlock(chunk.raw, chunk.kind);
          created.push(convertBlock(blockRes, chunk, DEFAULT_ENGINE));
        }
        setBlocks((prev) => [...prev, ...created]);
        setDialogOpen(false);
      } catch (err) {
        setWorkspaceError(extractError(err, 'Không thể tạo block'));
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const waitForBlockResult = useCallback((blockId: string) => {
    if (jobPromisesRef.current.has(blockId)) {
      return jobPromisesRef.current.get(blockId)!;
    }
    const promise = new Promise<JobResult>((resolve, reject) => {
      jobWaitersRef.current.set(blockId, { resolve, reject });
    });
    jobPromisesRef.current.set(blockId, promise);
    return promise;
  }, []);

  const handleStartJob = useCallback(
    async (blockId: string, snapshot?: BlockState) => {
      const fromState = blocks.find((b) => b.id === blockId);
      const target = snapshot ?? fromState;
      if (!target) return Promise.resolve<JobResult | void>(undefined);

      if (target.status === 'running' || target.status === 'queued') {
        return waitForBlockResult(blockId);
      }

      if (target.status === 'done' && target.mixKey) {
        return Promise.resolve({ mixKey: target.mixKey });
      }

      const rows: RowPayload[] = target.rows.map((row) => ({
        rowId: row.rowId,
        text: row.text,
      }));

      updateBlock(blockId, (block) => ({
        ...block,
        status: 'queued' as Status,
        rows: block.rows.map((row) => ({
          ...row,
          status: 'queued' as Status,
          progress: undefined,
          error: null,
        })),
        qcBlock: null,
        qcSummary: null,
        mixKey: null,
        manifest: null,
        manifestError: null,
        error: null,
      }));

      try {
        const completion = waitForBlockResult(blockId);
        if (pollingRef.current?.blockId === blockId) {
          pollingRef.current = null;
          stopJobPoll();
        }
        const existingController = jobControllersRef.current.get(blockId);
        existingController?.abort();
        jobControllersRef.current.delete(blockId);
        const { jobId } = await postTtsJob(blockId, {
          engine: target.engine,
          rows,
        });

        updateBlock(blockId, (block) => ({
          ...block,
          jobId,
          status: 'running' as Status,
        }));
        if (quickBlockIdRef.current === blockId) {
          setQuickJobId(jobId);
          setQuickStatus('running');
        }

        attachSse(blockId, jobId);
        return completion;
      } catch (err) {
        const message = extractError(err, 'Tạo job thất bại');
        updateBlock(blockId, (block) => ({
          ...block,
          status: 'error' as Status,
          error: message,
        }));
        const waiter = jobWaitersRef.current.get(blockId);
        if (waiter) {
          waiter.reject(new Error(message));
          jobWaitersRef.current.delete(blockId);
          jobPromisesRef.current.delete(blockId);
        }
        if (quickBlockIdRef.current === blockId) {
          setQuickStatus('error');
          setQuickError(message);
        }
        throw new Error(message);
      }
    },
    [blocks, stopJobPoll, updateBlock, waitForBlockResult],
  );

  const attachSse = useCallback(
    (blockId: string, jobId: string) => {
      const previous = sseRefs.current.get(blockId);
      previous?.close();

      const existingController = jobControllersRef.current.get(blockId);
      existingController?.abort();

      const controller = new AbortController();
      jobControllersRef.current.set(blockId, controller);

      const handleProgress = (event: RowProgress) => {
        if (event.type === 'row') {
          updateBlock(blockId, (block) => {
            if (!block) return block;
            const rows = block.rows.map((row, idx) => {
              if (idx !== event.rowIndex) return row;
              if (event.state === 'running' || event.state === 'queued') {
                return {
                  ...row,
                  status: event.state,
                  progress: event.progress ?? row.progress,
                };
              }
              if (event.state === 'done') {
                return {
                  ...row,
                  status: 'done',
                  audioKey: event.fileKey,
                  metrics: event.metrics,
                  progress: 1,
                  error: null,
                };
              }
              if (event.state === 'error') {
                return {
                  ...row,
                  status: 'error',
                  error: event.error ?? 'Row failed',
                };
              }
              return row;
            });
            return {
              ...block,
              rows,
              status:
                event.state === 'error'
                  ? ('error' as Status)
                  : block.status === 'queued'
                    ? ('running' as Status)
                    : block.status,
            };
          });
          return;
        }

        if (event.type !== 'final') return;

        sseRefs.current.get(blockId)?.close();
        sseRefs.current.delete(blockId);
        jobControllersRef.current.delete(blockId);

        const waiter = jobWaitersRef.current.get(blockId);

        if (event.state === 'done') {
          updateBlock(blockId, (block) => ({
            ...block,
            status: 'done' as Status,
            qcBlock: event.qcBlock ?? block.qcBlock ?? null,
            qcSummary: event.qcSummary ?? block.qcSummary ?? null,
            mixKey: event.mixKey ?? block.mixKey ?? null,
            fetchingManifest: true,
          }));
          if (waiter) {
            waiter.resolve({
              mixKey: event.mixKey ?? null,
              manifestKey: event.manifestKey ?? null,
            });
            jobWaitersRef.current.delete(blockId);
            jobPromisesRef.current.delete(blockId);
          }
          if (quickBlockIdRef.current === blockId) {
            setQuickStatus('done');
            stopJobPoll();
          }
        } else {
          updateBlock(blockId, (block) => ({
            ...block,
            status: 'error' as Status,
            error: event.error || 'Job failed',
            qcBlock: event.qcBlock ?? block.qcBlock ?? null,
          }));
          if (waiter) {
            waiter.reject(new Error(event.error || 'Job failed'));
            jobWaitersRef.current.delete(blockId);
            jobPromisesRef.current.delete(blockId);
          }
          if (quickBlockIdRef.current === blockId) {
            setQuickStatus('error');
            setQuickError(event.error || 'Job failed');
            stopJobPoll();
          }
        }

        if (pollingRef.current?.blockId === blockId) {
          pollingRef.current = null;
          stopJobPoll();
        }
      };

      const source = streamJobProgress(jobId, handleProgress, {
        signal: controller.signal,
        onError: () => {
          pollingRef.current = { blockId, jobId };
          startJobPoll(jobId);
        },
      });

      sseRefs.current.set(blockId, source);
    },
    [startJobPoll, stopJobPoll, updateBlock],
  );

  const handleUpdateField = useCallback(
    (blockId: string, field: keyof Pick<BlockState, 'voice' | 'style' | 'pitch' | 'speed' | 'pauseMs' | 'variability'>, value: string | number) => {
      updateBlock(blockId, (block) => ({
        ...block,
        [field]: value,
      }));
    },
    [updateBlock],
  );

  const handleRowTextChange = useCallback(
    (blockId: string, rowId: string, text: string) => {
      updateBlock(blockId, (block) => ({
        ...block,
        rows: block.rows.map((row) => (row.rowId === rowId ? { ...row, text } : row)),
      }));
    },
    [updateBlock],
  );

  const handleRowSplit = useCallback(
    (blockId: string, rowId: string) => {
      updateBlock(blockId, (block) => {
        const index = block.rows.findIndex((row) => row.rowId === rowId);
        if (index < 0) return block;
        const target = block.rows[index];
        const midpoint = Math.floor(target.text.length / 2);
        const splitAt = target.text.indexOf(' ', midpoint);
        if (splitAt < 0) return block;
        const left = target.text.slice(0, splitAt).trim();
        const right = target.text.slice(splitAt + 1).trim();
        if (!left || !right) return block;
        const nextRows = [...block.rows];
        nextRows.splice(index, 1, { ...target, text: left, rowId: target.rowId }, createRow(right));
        return {
          ...block,
          rows: nextRows,
        };
      });
    },
    [updateBlock],
  );

  const handleRowMerge = useCallback(
    (blockId: string, rowId: string, direction: 'up' | 'down') => {
      updateBlock(blockId, (block) => {
        const index = block.rows.findIndex((row) => row.rowId === rowId);
        if (index < 0) return block;
        const partnerIndex = direction === 'up' ? index - 1 : index + 1;
        if (partnerIndex < 0 || partnerIndex >= block.rows.length) return block;
        const current = block.rows[index];
        const partner = block.rows[partnerIndex];
        const mergedText =
          direction === 'up' ? `${partner.text} ${current.text}` : `${current.text} ${partner.text}`;
        const nextRows = [...block.rows];
        if (direction === 'up') {
          nextRows.splice(partnerIndex, 2, { ...partner, text: mergedText });
        } else {
          nextRows.splice(index, 2, { ...current, text: mergedText });
        }
        return {
          ...block,
          rows: nextRows,
        };
      });
    },
    [updateBlock],
  );

  const handleRowPreview = useCallback((_blockId: string, _rowId: string, audioKey?: string | null) => {
    if (!audioKey) return;
    window.open(fileUrlSafe(audioKey), '_blank', 'noopener');
  }, []);

  const handleRowRetry = useCallback(
    (blockId: string, _rowId: string) => {
      void handleStartJob(blockId);
    },
    [handleStartJob],
  );

  const handlePreviewBlock = useCallback((_blockId: string, mixKey?: string | null) => {
    if (!mixKey) return;
    window.open(fileUrlSafe(mixKey), '_blank', 'noopener');
  }, []);

  const handleDuplicate = useCallback((blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const clone: BlockState = {
      ...block,
      id: `${block.id}-copy-${Date.now()}`,
      jobId: null,
      mixKey: null,
      manifest: null,
      qcBlock: null,
      qcSummary: null,
      rows: block.rows.map((row) => ({ ...row, status: 'idle', audioKey: null })),
      status: 'idle',
      error: null,
      title: `${block.title} (copy)`,
    };
    setBlocks((prev) => [...prev, clone]);
  }, [blocks]);

  const handleDelete = useCallback((blockId: string) => {
    const source = sseRefs.current.get(blockId);
    source?.close();
    sseRefs.current.delete(blockId);
    jobControllersRef.current.get(blockId)?.abort();
    jobControllersRef.current.delete(blockId);
    jobWaitersRef.current.delete(blockId);
    jobPromisesRef.current.delete(blockId);
    setBlocks((prev) => prev.filter((block) => block.id !== blockId));
  }, []);

  const handleMove = useCallback((blockId: string, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === blockId);
      if (index < 0) return prev;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    if (blocks.every((block) => block.qcBlock?.pass)) {
      const first = blocks.find((block) => block.mixKey);
      if (first?.mixKey) {
        window.open(fileUrlSafe(first.mixKey), '_blank', 'noopener');
      }
    }
  }, [blocks]);

  const exportDisabled = useMemo(
    () =>
      blocks.length === 0 ||
      blocks.some((block) => block.status !== 'done' || !block.qcBlock?.pass),
    [blocks],
  );

  const handleManifestLoaded = useCallback(
    (blockId: string, manifest: Manifest) => {
      updateBlock(blockId, (block) => ({
        ...block,
        manifest,
        qcBlock: manifest.qcBlock ?? block.qcBlock ?? null,
        qcSummary: manifest.qcSummary ?? block.qcSummary ?? null,
        mixKey: manifest.mixKey ?? block.mixKey ?? null,
        fetchingManifest: false,
        manifestError: null,
      }));
    },
    [updateBlock],
  );

  const handleManifestError = useCallback(
    (blockId: string, message: string) => {
      updateBlock(blockId, (block) => ({
        ...block,
        fetchingManifest: false,
        manifestError: message,
      }));
      if (quickBlockIdRef.current === blockId) {
        setQuickStatus('error');
        setQuickError(message);
      }
    },
    [updateBlock],
  );

  const handleGenerateAll = useCallback(async () => {
    if (!blocks.length || runningAll) return;
    setRunningAll(true);
    setMergeNotice(null);
    setWorkspaceError(null);
    try {
      for (const block of blocks) {
        await handleStartJob(block.id);
      }
      setMergeNotice(
        'Tất cả block đã được synthesize. Hiện chưa có API merge toàn bộ block thành một file — vui lòng báo để thêm backend khi cần.',
      );
    } catch (err) {
      setWorkspaceError(extractError(err, 'Generate all failed'));
    } finally {
      setRunningAll(false);
    }
  }, [blocks, handleStartJob, runningAll]);

  const quickBlock = useMemo(
    () => (quickBlockId ? blocks.find((block) => block.id === quickBlockId) ?? null : null),
    [blocks, quickBlockId],
  );

  const quickStatusPill: Status = quickStatus === 'idle' ? 'idle' : quickStatus === 'error' ? 'error' : quickStatus === 'done' ? 'done' : 'running';
  const quickBlockIndex = useMemo(
    () => (quickBlock ? blocks.findIndex((block) => block.id === quickBlock.id) : -1),
    [blocks, quickBlock],
  );

  const retryManifest = useCallback(
    (blockId: string) => {
      updateBlock(blockId, (block) => ({
        ...block,
        fetchingManifest: true,
        manifestError: null,
      }));
    },
    [updateBlock],
  );

  useEffect(() => {
    const current = pollingRef.current;
    if (!current) return;
    if (jobPollState === 'done') {
      const { blockId } = current;
      pollingRef.current = null;
      updateBlock(blockId, (block) => ({
        ...block,
        status: 'done',
        fetchingManifest: true,
      }));
      retryManifest(blockId);
      const waiter = jobWaitersRef.current.get(blockId);
      if (waiter) {
        waiter.resolve({ mixKey: null, manifestKey: null });
        jobWaitersRef.current.delete(blockId);
        jobPromisesRef.current.delete(blockId);
      }
      if (quickBlockIdRef.current === blockId) {
        setQuickStatus('done');
      }
      stopJobPoll();
    } else if (jobPollState === 'error') {
      const { blockId } = current;
      pollingRef.current = null;
      updateBlock(blockId, (block) => ({
        ...block,
        status: 'error',
        error: 'Job status unavailable',
      }));
      const waiter = jobWaitersRef.current.get(blockId);
      if (waiter) {
        waiter.reject(new Error('Job status unavailable'));
        jobWaitersRef.current.delete(blockId);
        jobPromisesRef.current.delete(blockId);
      }
      if (quickBlockIdRef.current === blockId) {
        setQuickStatus('error');
        setQuickError('Job status unavailable');
      }
      stopJobPoll();
    }
  }, [jobPollState, retryManifest, stopJobPoll, updateBlock]);

  const handleQuickGenerate = useCallback(async () => {
    if (!quickText.trim() || quickStatus === 'running') return;
    stopJobPoll();
    setQuickError(null);
    setQuickStatus('running');
    setQuickJobId(null);
    try {
      const blockRes = await postBlock(quickText, 'mono');
      const chunk: ContentChunk = {
        kind: 'mono',
        text: quickText,
        raw: quickText,
        title: 'Quick input',
        subtitle: truncate(quickText, 80),
        speaker: null,
      };
      const newBlock = convertBlock(blockRes, chunk, DEFAULT_ENGINE);
      setBlocks((prev) => {
        if (prev.some((b) => b.id === blockRes.id)) return prev;
        return [...prev, newBlock];
      });
      quickBlockIdRef.current = blockRes.id;
      setQuickBlockId(blockRes.id);
      await handleStartJob(blockRes.id, newBlock);
    } catch (err) {
      const message = extractError(err, 'Generate failed');
      setQuickError(message);
      setQuickStatus('error');
    }
  }, [handleStartJob, quickStatus, quickText, stopJobPoll]);

  return (
    <div className="app-shell">
      <HeaderBar />

      <section className="card quick-panel" aria-labelledby="quick-panel-title">
        <div className="quick-panel__header">
          <div>
            <h2 id="quick-panel-title">Quick Generate</h2>
            <p className="quick-panel__subtitle">Nhập đoạn văn ngắn để tạo block và chạy TTS ngay.</p>
          </div>
          {quickJobId && (
            <span className="status-chip" role="status" aria-live="polite">
              Job #{quickJobId}
            </span>
          )}
        </div>
        <label htmlFor="quick-text" className="manifest__metric-label">
          Input text
        </label>
        <textarea
          id="quick-text"
          className="textarea"
          rows={4}
          value={quickText}
          onChange={(event) => setQuickText(event.target.value)}
          disabled={quickStatus === 'running'}
        />
        <div className="controls" aria-live="polite">
          <button
            type="button"
            className="button"
            onClick={handleQuickGenerate}
            disabled={!quickText.trim() || quickStatus === 'running'}
          >
            {quickStatus === 'running' ? <span className="spinner" aria-hidden="true" /> : null}
            <span>{quickStatus === 'running' ? 'Generating…' : 'Generate'}</span>
          </button>
          <StatusPill status={quickStatusPill} />
        </div>
        {quickError && (
          <div className="alert" role="alert">
            <span>{quickError}</span>
            <button type="button" className="button is-secondary" onClick={handleQuickGenerate}>
              Retry
            </button>
          </div>
        )}
        {!quickError && quickBlock?.manifestError && quickBlockId && (
          <div className="alert" role="alert">
            <span>{quickBlock.manifestError}</span>
            <button
              type="button"
              className="button is-secondary"
              onClick={() => retryManifest(quickBlockId)}
              disabled={quickStatus === 'running'}
            >
              Retry manifest
            </button>
          </div>
        )}
        {quickBlock && quickBlock.manifest && (
          <div className="quick-panel__manifest">
            <BlockManifest manifest={quickBlock.manifest} />
          </div>
        )}
        {!quickError && quickBlock && quickBlock.status === 'running' && (
          <span className="manifest__hint" role="status" aria-live="polite">
            {quickBlockIndex >= 0
              ? `Đang synthesize block #${quickBlockIndex + 1}…`
              : 'Đang synthesize block…'}
          </span>
        )}
      </section>

      <section className="workspace-head" aria-label="Workspace controls">
        <div>
          <h2>Workspace</h2>
          <p className="workspace-head__subtitle">Block-first editor cho mono & hội thoại.</p>
        </div>
        <div className="workspace-actions">
          <button type="button" className="button is-secondary" onClick={() => setDialogOpen(true)}>
            Add Content…
          </button>
          <button
            type="button"
            className="button is-secondary"
            onClick={handleGenerateAll}
            disabled={!blocks.length || runningAll}
          >
            {runningAll ? 'Generating…' : 'Generate all blocks'}
          </button>
          <button
            type="button"
            className="button"
            onClick={handleExport}
            disabled={exportDisabled}
          >
            Export
          </button>
        </div>
      </section>

      {workspaceError && (
        <div className="alert" role="alert">
          <span>{workspaceError}</span>
          <button type="button" className="button is-secondary" onClick={() => setWorkspaceError(null)}>
            Đóng
          </button>
        </div>
      )}

      {mergeNotice && (
        <div className="notice" role="status" aria-live="polite">
          {mergeNotice}
        </div>
      )}

      {blocks.length === 0 && (
        <section className="empty-state" role="status">
          <p>Block trống — nhấn “Add Content…” để bắt đầu.</p>
        </section>
      )}

      <div className="blocks-stack" role="list">
        {blocks.map((block, index) => (
          <BlockContainer
            key={block.id}
            block={{
              ...block,
              index,
            }}
            onUpdateField={handleUpdateField}
            onStartJob={handleStartJob}
            onPreviewBlock={handlePreviewBlock}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onMove={handleMove}
            onRowTextChange={handleRowTextChange}
            onRowSplit={handleRowSplit}
            onRowMerge={handleRowMerge}
            onRowPreview={handleRowPreview}
            onRowRetry={handleRowRetry}
            onManifestLoaded={handleManifestLoaded}
            onManifestError={handleManifestError}
            onManifestRetry={retryManifest}
          />
        ))}
      </div>

      <footer className="app-footer">
        <span>Async-ready · {blocks.length} blocks</span>
        <span>
          Status: {creating ? 'Creating blocks…' : 'Idle'} · App v0.1 ·{' '}
          <button type="button" className="link-button" onClick={() => window.alert('Diagnostics coming soon')}>
            Diagnostics
          </button>
        </span>
      </footer>

      <AddContentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddContent}
      />
    </div>
  );
}

function BlockContainer({
  block,
  onUpdateField,
  onStartJob,
  onPreviewBlock,
  onDuplicate,
  onDelete,
  onMove,
  onRowTextChange,
  onRowSplit,
  onRowMerge,
  onRowPreview,
  onRowRetry,
  onManifestLoaded,
  onManifestError,
  onManifestRetry,
}: {
  block: BlockState;
  onUpdateField(blockId: string, field: keyof Pick<BlockState, 'voice' | 'style' | 'pitch' | 'speed' | 'pauseMs' | 'variability'>, value: string | number): void;
  onStartJob(blockId: string): void;
  onPreviewBlock(blockId: string, mixKey?: string | null): void;
  onDuplicate(blockId: string): void;
  onDelete(blockId: string): void;
  onMove(blockId: string, direction: 'up' | 'down'): void;
  onRowTextChange(blockId: string, rowId: string, text: string): void;
  onRowSplit(blockId: string, rowId: string): void;
  onRowMerge(blockId: string, rowId: string, direction: 'up' | 'down'): void;
  onRowPreview(blockId: string, rowId: string, audioKey?: string | null): void;
  onRowRetry(blockId: string, rowId: string): void;
  onManifestLoaded(blockId: string, manifest: Manifest): void;
  onManifestError(blockId: string, message: string): void;
  onManifestRetry(blockId: string): void;
}) {
  const { data, error, loading } = useManifest(
    block.fetchingManifest ? block.id : undefined,
  );

  useEffect(() => {
    if (data) {
      onManifestLoaded(block.id, data);
    }
  }, [block.id, data, onManifestLoaded]);

  useEffect(() => {
    if (error) {
      onManifestError(block.id, error);
    }
  }, [block.id, error, onManifestError]);

  return (
    <>
      <BlockCard
        block={block}
        canUseSsml={block.engine === 'xtts'}
        onUpdateField={onUpdateField}
        onStartJob={onStartJob}
        onPreviewBlock={(id) => onPreviewBlock(id, block.mixKey)}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onMove={onMove}
        onRowTextChange={onRowTextChange}
        onRowSplit={onRowSplit}
        onRowMerge={onRowMerge}
        onRowPreview={onRowPreview}
        onRowRetry={onRowRetry}
        onManifestRetry={onManifestRetry}
      />
      {loading && <div className="manifest__hint">Loading manifest…</div>}
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button type="button" className="button is-secondary" onClick={() => onManifestRetry(block.id)}>
            Retry manifest
          </button>
        </div>
      )}
    </>
  );
}

function parseInput(text: string, mode: 'mono' | 'dialog'): ContentChunk[] {
  if (mode === 'mono') {
    return text
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk, index) => ({
        kind: 'mono' as const,
        text: chunk,
        raw: chunk,
        title: `Mono paragraph ${index + 1}`,
        subtitle: truncate(chunk, 80),
        speaker: null,
      }));
  }

  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const chunks: ContentChunk[] = [];
  let currentSpeaker: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentSpeaker) return;
    const joined = buffer.join('\n').trim();
    const subtitle = truncate(joined, 80);
    const rawContent = joined.length > 0 ? joined : '';
    const raw = `[${currentSpeaker}]: ${rawContent}`.trim();
    chunks.push({
      kind: 'dialog',
      text: joined,
      raw,
      title: `[${currentSpeaker}]`,
      subtitle,
      speaker: currentSpeaker,
    });
    buffer = [];
    currentSpeaker = null;
  };

  lines.forEach((line, index) => {
    const match = line.match(/^\[([^\]]+)\]\s*:(.*)$/);
    if (match) {
      if (currentSpeaker) flush();
      currentSpeaker = match[1].trim() || `Turn ${index + 1}`;
      const content = match[2].trim();
      buffer = content ? [content] : [];
    } else {
      if (!currentSpeaker) {
        currentSpeaker = `Turn ${index + 1}`;
        buffer = [line];
      } else {
        buffer.push(line);
      }
    }
  });

  flush();

  if (!chunks.length) {
    const fallback = text.trim();
    return fallback
      ? [
          {
            kind: 'dialog',
            text: fallback,
            raw: fallback,
            title: 'Dialogue',
            subtitle: truncate(fallback, 80),
            speaker: null,
          },
        ]
      : [];
  }

  return chunks;
}

function convertBlock(
  blockRes: { id: string; kind: 'mono' | 'dialog'; text: string; rows: { rowId: string; text: string }[] },
  chunk: ContentChunk,
  engine: 'piper' | 'xtts',
): BlockState {
  return {
    id: blockRes.id,
    index: 0,
    kind: chunk.kind,
    speaker: chunk.speaker ?? null,
    voice: DEFAULT_BLOCK_SETTINGS.voice,
    style: DEFAULT_BLOCK_SETTINGS.style,
    pitch: DEFAULT_BLOCK_SETTINGS.pitch,
    speed: DEFAULT_BLOCK_SETTINGS.speed,
    pauseMs: DEFAULT_BLOCK_SETTINGS.pauseMs,
    variability: DEFAULT_BLOCK_SETTINGS.variability,
    engine,
    title: chunk.title,
    subtitle: chunk.subtitle ?? null,
    rows: blockRes.rows.map((row) => ({
      rowId: row.rowId,
      text: row.text,
      status: 'idle' as Status,
      progress: 0,
      audioKey: null,
      metrics: null,
      error: null,
    })),
    status: 'idle',
    jobId: null,
    text: blockRes.text,
    qcBlock: null,
    qcSummary: null,
    manifest: null,
    mixKey: null,
    manifestError: null,
    error: null,
    fetchingManifest: false,
  };
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function createRow(text: string): RowState {
  return {
    rowId: generateId(),
    text,
    status: 'idle',
    progress: 0,
    audioKey: null,
    metrics: null,
    error: null,
  };
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function fileUrlSafe(key: string) {
  return fileUrl(key);
}

type JobResult = {
  mixKey?: string | null;
  manifestKey?: string | null;
};
