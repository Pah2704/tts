from __future__ import annotations

import math
from typing import Tuple

import numpy as np


def estimate_lufs(samples: np.ndarray, sample_rate: int) -> float:
    """Estimate integrated loudness (LUFS) using the same filter chain as QC."""

    if samples.size == 0:
        return float('-inf')

    weighted = _k_weight(samples, sample_rate)
    rms = float(np.sqrt(np.mean(np.square(weighted))) if weighted.size else 0.0)
    if rms <= 1e-12:
        return float('-inf')
    return -0.691 + 10.0 * math.log10(rms * rms)


def _k_weight(samples: np.ndarray, sample_rate: int) -> np.ndarray:
    if samples.size == 0:
        return samples

    a_hp = math.exp(-2.0 * math.pi * 40.0 / sample_rate)
    hp = np.empty_like(samples, dtype=np.float64)
    prev_y = 0.0
    prev_x = 0.0
    for idx, x in enumerate(samples):
        y = a_hp * (prev_y + x - prev_x)
        hp[idx] = y
        prev_y = y
        prev_x = x

    c = math.exp(-2.0 * math.pi * 1500.0 / sample_rate)
    shelf = np.empty_like(hp)
    prev = 0.0
    for idx, x in enumerate(hp):
        prev = x + c * prev
        shelf[idx] = prev

    return shelf.astype(np.float32)
