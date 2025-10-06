from __future__ import annotations

import os
import wave
from typing import Iterable

import numpy as np


def tail_merge(wav_paths: list[str], gap_ms: int, fade_ms: int, out_path: str) -> dict:
    if not wav_paths:
        raise ValueError('tail_merge requires at least one wav path')

    sr = None
    segments: list[np.ndarray] = []

    for path in wav_paths:
        with wave.open(path, 'rb') as wf:
            current_sr = wf.getframerate()
            if sr is None:
                sr = current_sr
            elif current_sr != sr:
                raise ValueError('All WAV files must share the same sample rate')
            if wf.getsampwidth() != 2:
                raise ValueError('tail_merge currently supports 16-bit PCM WAV files only')
            channels = wf.getnchannels()
            frames = wf.getnframes()
            data = wf.readframes(frames)
        segment = np.frombuffer(data, dtype='<i2').astype(np.float32) / 32768.0
        if channels > 1:
            segment = segment.reshape(-1, channels).mean(axis=1)
        segments.append(segment)

    assert sr is not None
    fade_samples = max(int(sr * fade_ms / 1000.0), 0)
    gap_samples = int(sr * gap_ms / 1000.0)

    merged: list[np.ndarray] = []
    for idx, segment in enumerate(segments):
        if segment.size == 0:
            continue
        segment = segment.copy()
        if fade_samples > 0:
            fade_samples_eff = min(fade_samples, segment.size // 2)
            if fade_samples_eff:
                fade_in = np.linspace(0.0, 1.0, fade_samples_eff, endpoint=False, dtype=np.float32)
                fade_out = np.linspace(1.0, 0.0, fade_samples_eff, endpoint=False, dtype=np.float32)
                segment[:fade_samples_eff] *= fade_in
                segment[-fade_samples_eff:] *= fade_out
        merged.append(segment)
        if idx < len(segments) - 1 and gap_samples > 0:
            merged.append(np.zeros(gap_samples, dtype=np.float32))

    if not merged:
        raise ValueError('tail_merge produced no audio content')

    final = np.concatenate(merged)
    final = np.clip(final, -1.0, 1.0)
    pcm = (final * 32767.0).astype('<i2')

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with wave.open(out_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())

    bytes_size = os.path.getsize(out_path)
    duration_ms = int(len(final) / sr * 1000)
    return {'bytes': bytes_size, 'durationMs': duration_ms}
