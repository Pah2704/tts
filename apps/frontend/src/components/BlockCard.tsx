import { useMemo, useState } from 'react';
import { fileUrl, type Manifest, type RowMetrics } from '../lib/api';
import { StatusPill, type Status } from './StatusPill';
import QCBadge from './QCBadge';

export type RowView = {
  rowId: string;
  text: string;
  status: Status;
  progress?: number;
  audioKey?: string | null;
  metrics?: RowMetrics | null;
  error?: string | null;
};

export type BlockView = {
  id: string;
  index: number;
  kind: 'mono' | 'dialog';
  speaker?: string | null;
  voice: string;
  style: string;
  pitch: number;
  speed: number;
  pauseMs: number;
  variability: number;
  engine: 'piper' | 'xtts';
  title: string;
  subtitle?: string | null;
  rows: RowView[];
  status: Status;
  jobId?: string | null;
  qcBlock?: Manifest['qcBlock'] | null;
  qcSummary?: Manifest['qcSummary'] | null;
  manifest?: Manifest | null;
  mixKey?: string | null;
  manifestError?: string | null;
  createdAt?: string | null;
};

type BlockCardProps = {
  block: BlockView;
  canUseSsml: boolean;
  onUpdateField(blockId: string, field: keyof Pick<BlockView, 'voice' | 'style' | 'pitch' | 'speed' | 'pauseMs' | 'variability'>, value: string | number): void;
  onStartJob(blockId: string): void;
  onPreviewBlock(blockId: string): void;
  onDuplicate(blockId: string): void;
  onDelete(blockId: string): void;
  onMove(blockId: string, direction: 'up' | 'down'): void;
  onRowTextChange(blockId: string, rowId: string, next: string): void;
  onRowSplit(blockId: string, rowId: string): void;
  onRowMerge(blockId: string, rowId: string, direction: 'up' | 'down'): void;
  onRowPreview(blockId: string, rowId: string, audioKey?: string | null): void;
  onRowRetry(blockId: string, rowId: string): void;
  onManifestRetry(blockId: string): void;
};

const VOICES = ['Piper · Neutral', 'Piper · Cheerful', 'XTTS · Ada', 'XTTS · Nova'];
const STYLES = ['Conversational', 'Promo', 'Newscast', 'Storytelling', 'Calm', 'Angry', 'Sad'];

export function BlockCard({
  block,
  canUseSsml,
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
  onManifestRetry,
}: BlockCardProps) {
  const [detailsRow, setDetailsRow] = useState<RowView | null>(null);
  const [ssmlRow, setSsmlRow] = useState<RowView | null>(null);

  const summaryStats = useMemo(() => {
    if (!block.qcSummary) return null;
    return [
      { label: 'Score', value: formatNumber(block.qcBlock?.score, 1) },
      { label: 'LUFS', value: formatNumber(block.qcBlock?.lufsIntegrated) },
      { label: 'True Peak', value: formatNumber(block.qcBlock?.truePeakDbtp) + ' dBTP' },
      { label: 'Clipping', value: formatNumber(block.qcBlock?.clippingCount, 0) },
      { label: 'Oversample', value: formatNumber(block.qcBlock?.oversampleFactor, 0, 'x') },
    ];
  }, [block.qcBlock, block.qcSummary]);

  return (
    <article className="block-card" id={`block-${block.id}`} aria-label={`Block ${block.index + 1}`}>
      <header className="block-card__header">
        <div>
          <h2>
            <span className="block-card__badge">Block #{block.index + 1}</span>{' '}
            {block.speaker ? `[${block.speaker}]` : block.title}
          </h2>
          {block.subtitle ? <p className="block-card__subtitle">{block.subtitle}</p> : null}
        </div>
        <div className="block-card__header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => onMove(block.id, 'up')}
            aria-label="Move block up"
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onMove(block.id, 'down')}
            aria-label="Move block down"
          >
            ↓
          </button>
          <button type="button" className="icon-button" onClick={() => onDuplicate(block.id)} aria-label="Duplicate block">
            ⧉
          </button>
          <button type="button" className="icon-button" onClick={() => onDelete(block.id)} aria-label="Delete block">
            🗑
          </button>
        </div>
      </header>

      <section className="block-card__controls" aria-label="Voice controls">
        <div className="control-field">
          <label htmlFor={`voice-${block.id}`}>Voice</label>
          <select
            id={`voice-${block.id}`}
            value={block.voice}
            onChange={(event) => onUpdateField(block.id, 'voice', event.target.value)}
          >
            {VOICES.map((voice) => (
              <option key={voice}>{voice}</option>
            ))}
          </select>
        </div>
        <div className="control-field">
          <label htmlFor={`style-${block.id}`}>Style</label>
          <select
            id={`style-${block.id}`}
            value={block.style}
            onChange={(event) => onUpdateField(block.id, 'style', event.target.value)}
          >
            {STYLES.map((style) => (
              <option key={style}>{style}</option>
            ))}
          </select>
        </div>
        <Slider
          id={`pitch-${block.id}`}
          label="Pitch %"
          min={-50}
          max={50}
          value={block.pitch}
          onChange={(value) => onUpdateField(block.id, 'pitch', value)}
        />
        <Slider
          id={`speed-${block.id}`}
          label="Speed %"
          min={70}
          max={130}
          value={block.speed}
          onChange={(value) => onUpdateField(block.id, 'speed', value)}
        />
        <Slider
          id={`pause-${block.id}`}
          label="Pause ms"
          min={0}
          max={2000}
          step={50}
          value={block.pauseMs}
          onChange={(value) => onUpdateField(block.id, 'pauseMs', value)}
        />
        <Slider
          id={`variability-${block.id}`}
          label="Variability"
          min={0}
          max={100}
          value={block.variability}
          onChange={(value) => onUpdateField(block.id, 'variability', value)}
        />
        <div className="block-card__cta">
          <button type="button" className="button is-secondary" onClick={() => onPreviewBlock(block.id)}>
            ▶ Listen
          </button>
          <button
            type="button"
            className="button"
            onClick={() => onStartJob(block.id)}
            disabled={block.status === 'running' || block.status === 'queued'}
          >
            {block.status === 'running' || block.status === 'queued' ? 'Creating…' : 'Create Audio (Async)'}
          </button>
        </div>
      </section>

      <section className="block-card__rows" aria-label="Rows">
        <ol>
          {block.rows.map((row, index) => (
            <li key={row.rowId} className={`row-item row-item--${row.status}`}>
              <div className="row-item__index">
                <span>{index + 1}</span>
              </div>
              <div className="row-item__content">
                <textarea
                  value={row.text}
                  onChange={(event) => onRowTextChange(block.id, row.rowId, event.target.value)}
                  aria-label={`Row ${index + 1} text`}
                  disabled={block.status === 'running'}
                />
                <div className="row-item__meta">
                  <StatusPill status={row.status} detail={row.status === 'running' && row.progress ? `${Math.round(row.progress * 100)}%` : undefined} />
                  {row.error ? <span className="row-item__error">⚠ {row.error}</span> : null}
                  <div className="row-item__actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onRowPreview(block.id, row.rowId, row.audioKey)}
                      aria-label="Preview row"
                      disabled={!row.audioKey}
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setDetailsRow(row)}
                      aria-label="Row details"
                    >
                      ℹ
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setSsmlRow(row)}
                      aria-label="Open SSML editor"
                      disabled={!canUseSsml}
                      title={canUseSsml ? 'Edit SSML' : 'Turn on High-Quality to enable SSML'}
                    >
                      {'</>'}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onRowSplit(block.id, row.rowId)}
                      aria-label="Split row"
                      disabled={row.text.trim().length < 6}
                    >
                      ⌶
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onRowMerge(block.id, row.rowId, 'up')}
                      aria-label="Merge with previous row"
                      disabled={index === 0}
                    >
                      ⇧
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onRowMerge(block.id, row.rowId, 'down')}
                      aria-label="Merge with next row"
                      disabled={index === block.rows.length - 1}
                    >
                      ⇩
                    </button>
                    {row.status === 'error' && (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => onRowRetry(block.id, row.rowId)}
                        aria-label="Retry row"
                      >
                        ↻
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="block-card__qc">
        <div className="block-card__qc-meta">
          <QCBadge qcBlock={block.qcBlock ?? null} />
          {block.qcSummary ? (
            <div className="block-card__qc-stats">
              {summaryStats?.map((item) => (
                <span key={item.label}>
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          ) : (
            <span className="manifest__hint">QC pending…</span>
          )}
        </div>
        {block.manifestError && (
          <div className="alert" role="alert">
            <span>{block.manifestError}</span>
            <button type="button" className="button is-secondary" onClick={() => onManifestRetry(block.id)}>
              Retry manifest
            </button>
          </div>
        )}
        <div className="block-card__qc-actions">
          {block.mixKey ? (
            <a className="button is-secondary" href={fileUrl(block.mixKey)} download>
              Download merged.wav
            </a>
          ) : (
            <span className="manifest__hint">Merged output not available yet</span>
          )}
          {block.manifest ? (
            <details>
              <summary>View manifest</summary>
              <pre>{JSON.stringify(block.manifest, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      </section>

      {detailsRow && (
        <dialog open className="modal" aria-label="Row details">
          <header className="modal__header">
            <h3>Row details</h3>
            <button type="button" className="icon-button" onClick={() => setDetailsRow(null)} aria-label="Close details">
              ×
            </button>
          </header>
          <div className="modal__body">
            <p>
              <strong>Row ID:</strong> {detailsRow.rowId}
            </p>
            <p>
              <strong>Status:</strong> {detailsRow.status}
            </p>
            {detailsRow.metrics ? (
              <ul>
                <li>LUFS: {formatNumber(detailsRow.metrics.lufsIntegrated)}</li>
                <li>True Peak: {formatNumber(detailsRow.metrics.truePeakDbtp)} dBTP</li>
                <li>Clipping: {formatNumber(detailsRow.metrics.clippingPct, 2)}%</li>
                <li>Score: {formatNumber(detailsRow.metrics.score, 1)}</li>
                {detailsRow.metrics.warnings?.length ? (
                  <li>Warnings: {detailsRow.metrics.warnings.join(' • ')}</li>
                ) : null}
              </ul>
            ) : (
              <p>No QC metrics yet.</p>
            )}
          </div>
          <footer className="modal__footer">
            <button type="button" className="button is-secondary" onClick={() => setDetailsRow(null)}>
              Close
            </button>
          </footer>
        </dialog>
      )}

      {ssmlRow && (
        <dialog open className="modal" aria-label="SSML editor">
          <header className="modal__header">
            <h3>SSML editor (preview)</h3>
            <button type="button" className="icon-button" onClick={() => setSsmlRow(null)} aria-label="Close SSML editor">
              ×
            </button>
          </header>
          <div className="modal__body">
            <p>
              Coming soon — Turn on High-Quality to unlock SSML fine-tuning. Current text:
              <br />
              <code>{ssmlRow.text}</code>
            </p>
          </div>
          <footer className="modal__footer">
            <button type="button" className="button is-secondary" onClick={() => setSsmlRow(null)}>
              Close
            </button>
          </footer>
        </dialog>
      )}
    </article>
  );
}

function Slider({
  id,
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange(value: number): void;
}) {
  return (
    <div className="control-field control-field--slider">
      <label htmlFor={id}>
        {label}
        <span className="control-field__value">{value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function formatNumber(value?: number | null, digits = 2, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(digits)}${suffix}`;
}
