import os, subprocess, wave, contextlib

def synthesize_piper(text: str, out_wav: str) -> dict[str, int]:
    os.makedirs(os.path.dirname(out_wav), exist_ok=True)
    model_path = os.getenv("PIPER_MODEL")
    if not model_path or not os.path.exists(model_path):
        raise RuntimeError("PIPER_MODEL is missing or not found on disk")
    cmd = ["piper", "--model", model_path, "--output_file", out_wav]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    _, stderr = p.communicate(text)
    if p.returncode != 0:
        raise RuntimeError(f"Piper failed: {stderr}")
    bytes_size = os.path.getsize(out_wav)
    with contextlib.closing(wave.open(out_wav, 'rb')) as w:
        frames = w.getnframes(); rate = w.getframerate()
        duration_ms = int(frames * 1000 / rate)
    return {"bytes": bytes_size, "durationMs": duration_ms}