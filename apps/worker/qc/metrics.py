# apps/worker/qc/metrics.py
from typing import Tuple
import numpy as np

def _load_wav_float(path: str) -> Tuple[np.ndarray, int]:
    """Đọc WAV → (x float32 [-1,1], sample_rate). Ưu tiên soundfile, fallback scipy."""
    try:
        import soundfile as sf
        x, sr = sf.read(path, dtype="float32", always_2d=False)
    except Exception:
        from scipy.io import wavfile
        sr, x = wavfile.read(path)  # scipy trả (sr, x)
        if x.dtype.kind in ("i", "u"):
            x = x.astype(np.float32) / np.float32(np.iinfo(x.dtype).max)
        else:
            x = x.astype(np.float32, copy=False)
    return x, sr  # QUAN TRỌNG: (x, sr)

def measure_true_peak(wav_path: str, oversample: int = 4) -> float:
    """dBTP = 20*log10(max|x_inter|) với oversample {1,2,4,8}."""
    from scipy.signal import resample_poly
    x, sr = _load_wav_float(wav_path)
    if x.ndim > 1:
        x = x.max(axis=-1)  # peak across channels
    osf = (oversample if oversample in (1,2,4,8) else 4)
    if osf > 1:
        x = resample_poly(x, up=osf, down=1)
    peak = float(np.max(np.abs(x))) if x.size else 0.0
    if peak <= 0:
        return -np.inf
    return 20.0 * float(np.log10(peak + 1e-12))

def estimate_lufs(wav_path: str) -> float:
    """LUFS (BS.1770-4, mặc định pyloudnorm = K-weighting)."""
    import pyloudnorm as pyln
    x, sr = _load_wav_float(wav_path)
    if x.ndim > 1:
        x = x.mean(axis=-1)  # downmix mono
    x64 = x.astype(np.float64, copy=False)
    if x64.size == 0:  # file rỗng -> trả về -inf an toàn
        return float("-inf")
    meter = pyln.Meter(sr, block_size=0.400)  # KHÔNG set filter_class -> mặc định K
    return float(meter.integrated_loudness(x64))

def count_clipping(wav_path: str, thresh: float = 1.0) -> int:
    """Đếm mẫu vượt 0 dBFS (|x|>=1.0)."""
    x, _ = _load_wav_float(wav_path)
    if x.ndim > 1:
        x = np.max(np.abs(x), axis=-1)
    else:
        x = np.abs(x)
    return int(np.count_nonzero(x >= thresh))
