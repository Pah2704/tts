import contextlib
import math
import wave
from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np

from .loudness import estimate_lufs


@dataclass
class Thresholds:
    lufs_target: float
    lufs_tolerance: float
    truepeak_db_max: float
    clip_pct_max: float
    score_min: float


CLIP_SAMPLE_THRESHOLD = 0.999
MIN_LUFS_DURATION_MS = 300
EPS = 1e-12


def analyze_wav(path: str) -> Dict[str, float]:
    """Compute core QC metrics for a WAV file."""

    with contextlib.closing(wave.open(path, 'rb')) as wf:
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sample_rate = wf.getframerate()
        frame_count = wf.getnframes()
        audio_bytes = wf.readframes(frame_count)

    if frame_count == 0:
        raise ValueError(f"QC analyze failed: '{path}' has no audio frames")

    samples = _pcm_to_float(audio_bytes, sample_width)
    if n_channels > 1:
        samples = samples.reshape(-1, n_channels).mean(axis=1)

    samples = samples.astype(np.float32)
    duration_ms = frame_count / float(sample_rate) * 1000.0

    abs_samples = np.abs(samples)
    peak = float(abs_samples.max(initial=0.0))
    if peak <= EPS:
        true_peak_db = float('-inf')
    else:
        true_peak_db = 20.0 * math.log10(peak)

    clipping_pct = float((abs_samples >= CLIP_SAMPLE_THRESHOLD).sum() / abs_samples.size) * 100.0

    lufs = estimate_lufs(samples, sample_rate)

    return {
        'durationMs': duration_ms,
        'sampleRate': sample_rate,
        'truePeakDb': true_peak_db,
        'clippingPct': clipping_pct,
        'lufsIntegrated': lufs,
    }


def evaluate(metrics: Dict[str, float], thresholds: Thresholds) -> Tuple[bool, List[str], float]:
    """Validate metrics against thresholds, returning (passed, warnings, score)."""

    soft_warnings: List[str] = []
    hard_violations: List[str] = []
    score = 1.0
    duration_ms = metrics.get('durationMs', 0.0) or 0.0
    lufs = metrics.get('lufsIntegrated')

    # LUFS tolerance – skip strict gating for very short clips
    if duration_ms >= MIN_LUFS_DURATION_MS and lufs not in (None, float('-inf'), float('inf')):
        delta_lufs = abs(lufs - thresholds.lufs_target)
        if delta_lufs > thresholds.lufs_tolerance:
            hard_violations.append(
                f"lufs-out-of-range: Δ{delta_lufs:.2f} LU (target {thresholds.lufs_target:+.1f}±{thresholds.lufs_tolerance})"
            )
        elif delta_lufs > thresholds.lufs_tolerance * 0.5:
            soft_warnings.append(f"lufs-near-edge: Δ{delta_lufs:.2f} LU")
        score -= min(delta_lufs / max(thresholds.lufs_tolerance, 1e-6) * 0.1, 0.4)
    else:
        if duration_ms < MIN_LUFS_DURATION_MS:
            soft_warnings.append('short-row-skip-lufs')

    # True peak
    true_peak = metrics.get('truePeakDb')
    if true_peak is not None and true_peak > thresholds.truepeak_db_max:
        diff = true_peak - thresholds.truepeak_db_max
        hard_violations.append(
            f"true-peak-exceeded: {true_peak:+.2f} dBTP > {thresholds.truepeak_db_max:+.2f}"
        )
        score -= min(diff * 0.2, 0.4)

    # Clipping percentage
    clipping_pct = metrics.get('clippingPct', 0.0) or 0.0
    if clipping_pct > thresholds.clip_pct_max:
        hard_violations.append(
            f"clipping-exceeded: {clipping_pct:.2f}% > {thresholds.clip_pct_max:.2f}%"
        )
        score -= min((clipping_pct / max(thresholds.clip_pct_max, EPS)) * 0.3, 0.4)

    score = max(0.0, min(1.0, score))
    passed = score >= thresholds.score_min and not hard_violations
    warnings = hard_violations + soft_warnings
    return passed, warnings, score


def _pcm_to_float(data: bytes, sample_width: int) -> np.ndarray:
    if sample_width == 1:
        dtype = np.uint8
        pcm = np.frombuffer(data, dtype=dtype)
        pcm = pcm.astype(np.float32)
        pcm = (pcm - 128.0) / 128.0
        return pcm
    if sample_width == 2:
        pcm = np.frombuffer(data, dtype='<i2').astype(np.float32)
        return pcm / 32768.0
    if sample_width == 3:
        raw = np.frombuffer(data, dtype=np.uint8).reshape(-1, 3)
        ints = (raw[:, 0].astype(np.int32)
                | (raw[:, 1].astype(np.int32) << 8)
                | (raw[:, 2].astype(np.int32) << 16))
        ints = np.where(ints & 0x800000, ints - 0x1000000, ints)
        return ints.astype(np.float32) / 8388608.0
    if sample_width == 4:
        pcm = np.frombuffer(data, dtype='<i4').astype(np.float32)
        return pcm / 2147483648.0
    raise ValueError(f'Unsupported sample width: {sample_width} bytes')


def thresholds_from_env() -> Thresholds:
    clip_pct_max = float(_get_env('QC_CLIP_PCT_MAX', 0.1))
    return Thresholds(
        lufs_target=float(_get_env('QC_LUFS_TARGET', -16.0)),
        lufs_tolerance=float(_get_env('QC_LUFS_TOLERANCE', 1.0)),
        truepeak_db_max=float(_get_env('QC_TRUEPEAK_DB_MAX', -1.0)),
        clip_pct_max=clip_pct_max,
        score_min=float(_get_env('QC_SCORE_MIN', 0.7)),
    )


def _get_env(key: str, default: float) -> float:
    import os

    value = os.getenv(key)
    if value is None:
        return float(default)
    try:
        return float(value)
    except ValueError:
        return float(default)
