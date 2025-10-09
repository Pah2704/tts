import io
import logging
import re

from apps.worker.config import log_effective_settings

def test_boot_log_snapshot():
    logger = logging.getLogger("worker")
    logger.setLevel(logging.INFO)
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    logger.handlers = [handler]

    log_effective_settings()
    s = buf.getvalue().strip()

    assert s.startswith("settings: ")
    pattern = r"^settings: HQ=(True|False) OVERSAMPLE=(1|2|4|8)x TARGET_LUFS=-?\d+\.\d{2}±\d+\.\d{2} TRUEPEAK_MAX=-?\d+\.\d{2} dBTP$"
    assert re.match(pattern, s), s
