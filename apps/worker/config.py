"""Worker runtime configuration and logging utilities."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

_OVERSAMPLE_ALLOWED = {1, 2, 4, 8}


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return default


def _bool_env(name: str, default: bool) -> bool:
    return os.getenv(name, "true" if default else "false").lower() in {"1", "true", "yes", "y", "on"}


@dataclass
class Settings:
    # knobs
    TRUEPEAK_OVERSAMPLE: int = _int_env("TRUEPEAK_OVERSAMPLE", 4)
    QC_OVERRIDE_DEV: bool = _bool_env("QC_OVERRIDE_DEV", False)
    HQ_ENABLED: bool = _bool_env("HQ_ENABLED", True)

    # thresholds (defaults aligned with brief)
    TARGET_LUFS: float = float(os.getenv("TARGET_LUFS", "-16.0"))
    LUFS_TOLERANCE: float = float(os.getenv("LUFS_TOLERANCE", "1.0"))
    TRUEPEAK_MAX_DBTP: float = float(os.getenv("TRUEPEAK_MAX_DBTP", "-1.0"))

    # heartbeat
    HEARTBEAT_INTERVAL_S: int = _int_env("HEARTBEAT_INTERVAL_S", 15)
    HEARTBEAT_TTL_S: int = _int_env("HEARTBEAT_TTL_S", 30)

    def sanitize(self) -> None:
        if self.TRUEPEAK_OVERSAMPLE not in _OVERSAMPLE_ALLOWED:
            self.TRUEPEAK_OVERSAMPLE = 4


settings = Settings()
settings.sanitize()
settings.LUFS_TOL = settings.LUFS_TOLERANCE


def log_effective_settings() -> None:
    hq_str = "true" if settings.HQ_ENABLED else "false"
    logging.getLogger("worker").info(
        "settings: HQ=%s OVERSAMPLE=%dx TARGET_LUFS=%.2f±%.2f TRUEPEAK_MAX=%.2f dBTP",
        hq_str,
        settings.TRUEPEAK_OVERSAMPLE,
        settings.TARGET_LUFS,
        settings.LUFS_TOLERANCE,
        settings.TRUEPEAK_MAX_DBTP,
    )


__all__ = ["settings", "Settings", "log_effective_settings"]
