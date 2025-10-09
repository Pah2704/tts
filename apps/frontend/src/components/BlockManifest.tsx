import QCBadge from './QCBadge';
import { fileUrl, type Manifest } from '../lib/api';

type Props = {
  manifest: Manifest;
};

const FALLBACK = '—';

export default function BlockManifest({ manifest }: Props) {
  const qc = manifest.qcBlock ?? null;
  const summary = manifest.qcSummary ?? null;
  const mixUrl = manifest.mixKey ? fileUrl(manifest.mixKey) : null;
  const warnings = (qc?.warnings ?? []).filter(Boolean);
  const rows = Array.isArray(manifest.rows) ? manifest.rows : [];

  return (
    <section className="manifest" aria-label="Block manifest">
      <header className="manifest__header">
        <div className="manifest__title">
          <p className="manifest__subtitle">Block ID</p>
          <h2>{manifest.blockId}</h2>
        </div>
        <div className="manifest__header-actions">
          <QCBadge qcBlock={qc} />
          {mixUrl ? (
            <a className="button is-primary" href={mixUrl} download>
              Download merged.wav
            </a>
          ) : (
            <span className="manifest__hint">Merged output not available yet</span>
          )}
        </div>
      </header>

      <div className="manifest__metrics" role="list">
        <Metric label="LUFS" value={formatNumber(qc?.lufsIntegrated)} />
        <Metric label="True Peak (dBTP)" value={formatNumber(qc?.truePeakDbtp)} />
        <Metric label="Clipping" value={formatNumber(qc?.clippingCount, 0)} />
        <Metric label="Oversample" value={formatNumber(qc?.oversampleFactor, 0, 'x')} />
        <Metric label="Score" value={formatNumber(qc?.score, 1)} />
        <Metric label="Pass" value={qc?.pass === null || qc?.pass === undefined ? '—' : qc?.pass ? 'Yes' : 'No'} />
      </div>

      {summary && (
        <div className="manifest__summary">
          <span>Rows pass: {summary.rowsPass}</span>
          <span>Rows fail: {summary.rowsFail}</span>
          <span>Block LUFS: {formatNumber(summary.blockLufs)}</span>
          <span>True Peak: {formatNumber(summary.blockTruePeakDb)} dBTP</span>
          <span>Clipping: {formatNumber(summary.blockClippingPct)}%</span>
        </div>
      )}

      {qc === null && (
        <div className="manifest__hint">QC pending…</div>
      )}

      {warnings.length > 0 && (
        <div className="manifest__warnings" role="region" aria-live="polite">
          <h3>Warnings</h3>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="manifest__rows" role="region" aria-label="Rows">
        <table>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Row ID</th>
              <th scope="col">Text</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>No rows available.</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.rowId || `${index}`}>
                  <td>{index + 1}</td>
                  <td>{shortId(row.rowId)}</td>
                  <td>{row.text ?? FALLBACK}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="manifest__metric" role="listitem">
      <span className="manifest__metric-label">{label}</span>
      <span className="manifest__metric-value">{value}</span>
    </div>
  );
}

function formatNumber(value?: number | null, digits = 2, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return FALLBACK;
  }
  return `${value.toFixed(digits)}${suffix}`;
}

function shortId(id?: string) {
  if (!id) return FALLBACK;
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}
