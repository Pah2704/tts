import io
import logging
import re

from apps.worker.config import log_effective_settings
from apps.worker.config import settings


def test_boot_log_snapshot():
    logger = logging.getLogger("worker")
    logger.setLevel(logging.INFO)
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    logger.handlers = [handler]

    log_effective_settings()
    s = buf.getvalue().strip()

    assert s.startswith("settings: ")
    pattern = r"^settings:\s+HQ=(true|false)\s+OVERSAMPLE=(1|2|4|8)x\s+TARGET_LUFS=-?\d+\.\d{2}±\d+\.\d{2}\s+TRUEPEAK_MAX=-?\d+\.\d{2} dBTP$"
    assert re.match(pattern, s), s


def test_boot_log_full_line_matches_required_format():
    hq = "true" if settings.HQ_ENABLED else "false"
    line = f"settings: HQ={hq} OVERSAMPLE={settings.TRUEPEAK_OVERSAMPLE}x TARGET_LUFS={settings.TARGET_LUFS:.2f}±{settings.LUFS_TOLERANCE:.2f} TRUEPEAK_MAX={settings.TRUEPEAK_MAX_DBTP:.2f} dBTP"
    pat = r"^settings:\s+HQ=(true|false)\s+OVERSAMPLE=\d+x\s+TARGET_LUFS=-16\.00±1\.00\s+TRUEPEAK_MAX=-1\.00 dBTP$"
    if (
        settings.TRUEPEAK_OVERSAMPLE == 4
        and settings.TARGET_LUFS == -16.0
        and settings.LUFS_TOLERANCE == 1.0
        and settings.TRUEPEAK_MAX_DBTP == -1.0
    ):
        assert re.match(pat, line), f"Boot line not matching: {line}"
