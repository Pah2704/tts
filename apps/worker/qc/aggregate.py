
"""Aggregate block-level QC metrics and scoring."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .metrics import count_clipping, estimate_lufs, measure_true_peak


def compute_qc_block(
    mix_path: str,
    oversample_factor: int,
    target_lufs: float,
    lufs_tol: float,
    truepeak_max_db: float,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Compute block-level QC metrics and return the canonical schema."""
    lufs = estimate_lufs(mix_path)
    dptp = measure_true_peak(mix_path, oversample_factor)
    clipping = count_clipping(mix_path)

    pen_lufs = max(0.0, abs(lufs - target_lufs) - lufs_tol) * 4.0
    pen_tp = max(0.0, dptp + 1.0) * 10.0
    pen_clip = min(30.0, clipping * 0.1)
    score = max(0.0, 100.0 - (pen_lufs + pen_tp + pen_clip))

    warnings = []
    if pen_lufs > 0:
        warnings.append(f"LUFS off-target: {lufs:.2f}")
    if pen_tp > 0:
        warnings.append(f"TruePeak exceeds: {dptp:.2f} dBTP")
    if clipping > 0:
        warnings.append(f"Clipping detected: {clipping}")

    qc: Dict[str, Any] = {
        "lufsIntegrated": lufs,
        "truePeakDbtp": dptp,
        "clippingCount": clipping,
        "oversampleFactor": oversample_factor,
        "penalties": {
            "penLUFS": pen_lufs,
            "penTP": pen_tp,
            "penClip": pen_clip,
        },
        "score": score,
        "warnings": warnings,
    }
    if extra:
        qc.update(extra)

    qc["pass"] = within_threshold(qc, target_lufs, lufs_tol, truepeak_max_db)
    return qc


def within_threshold(
    qc: Dict[str, Any],
    target_lufs: float,
    lufs_tol: float,
    truepeak_max_db: float,
) -> bool:
    """Check QC metrics against thresholds, treating missing data as failure."""
    lufs = qc.get("lufsIntegrated")
    if not isinstance(lufs, (int, float)) or not float('-inf') < float(lufs) < float('inf'):
        return False

    dptp = qc.get("truePeakDbtp")
    if not isinstance(dptp, (int, float)) or not float('-inf') < float(dptp) < float('inf'):
        return False

    clipping = qc.get("clippingCount")
    if not isinstance(clipping, (int, float)):
        return False

    ok_lufs = abs(float(lufs) - target_lufs) <= lufs_tol
    ok_tp = float(dptp) <= truepeak_max_db
    ok_clip = float(clipping) == 0
    return ok_lufs and ok_tp and ok_clip


__all__ = ["compute_qc_block", "within_threshold"]
