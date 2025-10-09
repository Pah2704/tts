import type { Manifest } from '../lib/api';

type Props = {
  qcBlock?: Manifest['qcBlock'] | null;
};

type Variant = 'pass' | 'override' | 'hq-off' | 'fail';

export default function QCBadge({ qcBlock }: Props) {
  if (!qcBlock) {
    return (
      <span
        className="qc-badge qc-badge--pending"
        role="status"
        aria-live="polite"
        title="QC pending"
      >
        QC pending…
      </span>
    );
  }

  const warnings = (qcBlock.warnings ?? []).map((w) => `${w ?? ''}`.trim());
  const pass = qcBlock.pass === true;
  const hasOverride = warnings.some((w) => w.toLowerCase().includes('override'));
  const hqDisabled = warnings.some((w) => w.toLowerCase().includes('hq disabled'));

  let variant: Variant = 'fail';
  if (pass) variant = 'pass';
  else if (hqDisabled) variant = 'hq-off';
  else if (hasOverride) variant = 'override';

  const labelMap: Record<Variant, string> = {
    pass: 'QC pass',
    override: 'QC override',
    'hq-off': 'HQ disabled',
    fail: 'QC fail',
  };

  const tooltipParts = [
    typeof qcBlock.lufsIntegrated === 'number' ? `LUFS: ${qcBlock.lufsIntegrated.toFixed(2)}` : null,
    typeof qcBlock.truePeakDbtp === 'number' ? `True Peak: ${qcBlock.truePeakDbtp.toFixed(2)} dBTP` : null,
    typeof qcBlock.clippingCount === 'number' ? `Clipping: ${qcBlock.clippingCount}` : null,
    typeof qcBlock.oversampleFactor === 'number' ? `Oversample: ${qcBlock.oversampleFactor}x` : null,
    typeof qcBlock.score === 'number' ? `Score: ${qcBlock.score.toFixed(1)}` : null,
    warnings.length ? `Warnings: ${warnings.join(' • ')}` : null,
  ].filter(Boolean);

  const scoreText =
    typeof qcBlock.score === 'number' ? ` · ${qcBlock.score.toFixed(1)}` : '';

  return (
    <span
      className={`qc-badge qc-badge--${variant}`}
      role="status"
      aria-live="polite"
      title={tooltipParts.join('\n') || labelMap[variant]}
    >
      {labelMap[variant]}
      {scoreText}
    </span>
  );
}
