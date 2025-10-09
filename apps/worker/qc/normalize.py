from __future__ import annotations

import contextlib
import wave
from typing import Dict

import numpy as np

from .loudness import estimate_lufs


def _read_wav_mono(path: str):
    with contextlib.closing(wave.open(path, 'rb')) as wf:
        sr = wf.getframerate()
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        frames = wf.getnframes()
        raw = wf.readframes(frames)

    if sampwidth == 2:
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sampwidth == 4:
        data = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)

    return data, sr, sampwidth


def _write_wav_mono(path: str, samples: np.ndarray, sr: int, sampwidth: int) -> None:
    samples = np.clip(samples, -1.0, 1.0)
    with contextlib.closing(wave.open(path, 'wb')) as wf:
        wf.setnchannels(1)
        wf.setsampwidth(sampwidth)
        wf.setframerate(sr)
        if sampwidth == 2:
            wf.writeframes((samples * 32767.0).astype(np.int16).tobytes())
        else:
            wf.writeframes((samples * 2147483647.0).astype(np.int32).tobytes())


def _sample_truepeak_db(samples: np.ndarray) -> float:
    peak = float(np.max(np.abs(samples)) + 1e-12)
    return 20.0 * np.log10(peak)


def _apply_gain_db(samples: np.ndarray, gain_db: float) -> np.ndarray:
    return samples * (10.0 ** (gain_db / 20.0))


def normalize_lufs_inplace(
    path: str,
    lufs_target: float = -16.0,
    tp_max_db: float = -1.0,
    safety_db: float = 0.3,
) -> Dict[str, float]:
    samples, sr, sampwidth = _read_wav_mono(path)

    pre_lufs = estimate_lufs(samples, sr)
    pre_tp = _sample_truepeak_db(samples)

    gain_for_lufs = float(lufs_target - pre_lufs)
    applied_gain = gain_for_lufs
    warnings = []

    if gain_for_lufs > 0:
        ceiling_db = (tp_max_db - safety_db) - pre_tp
        if ceiling_db <= 0:
            applied_gain = 0.0
            warnings.append('lufs-capped-by-truepeak')
        else:
            applied_gain = min(gain_for_lufs, ceiling_db)

    samples = _apply_gain_db(samples, applied_gain)
    post_lufs = estimate_lufs(samples, sr)
    post_tp = _sample_truepeak_db(samples)

    residual = float(lufs_target - post_lufs)
    if abs(residual) > 0.3:
        add_gain = residual
        if add_gain > 0:
            ceiling2 = (tp_max_db - safety_db) - post_tp
            if ceiling2 <= 0:
                warnings.append('lufs-capped-by-truepeak')
                add_gain = 0.0
            else:
                add_gain = min(add_gain, ceiling2)
        samples = _apply_gain_db(samples, add_gain)
        applied_gain += add_gain
        post_lufs = estimate_lufs(samples, sr)
        post_tp = _sample_truepeak_db(samples)

    _write_wav_mono(path, samples, sr, sampwidth)

    return {
        'appliedGainDb': float(applied_gain),
        'preLufs': float(pre_lufs),
        'postLufs': float(post_lufs),
        'preTruePeakDb': float(pre_tp),
        'postTruePeakDb': float(post_tp),
        'warnings': warnings,
    }
