"""Worker bootstrap helpers: heartbeat + configuration logging."""

from __future__ import annotations

import logging
import os
import socket
import threading
import time

import redis

from apps.worker.config import log_effective_settings, settings

LOGGER = logging.getLogger("worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def heartbeat_loop(r: "redis.Redis") -> None:
    host = socket.gethostname()
    key = f"worker:heartbeat:{host}"
    latest = "worker:heartbeat:latest"
    while True:
        try:
            r.setex(key, settings.HEARTBEAT_TTL_S, "ok")
            r.set(latest, int(time.time() * 1000))
        except Exception as exc:  # pragma: no cover - best-effort logging
            LOGGER.warning("heartbeat SETEX failed: %s", exc)
        time.sleep(settings.HEARTBEAT_INTERVAL_S)


def boot() -> redis.Redis:
    log_effective_settings()
    client = redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=int(os.getenv("REDIS_DB", "0")),
    )
    thread = threading.Thread(target=heartbeat_loop, args=(client,), daemon=True)
    thread.start()
    return client


__all__ = ["boot", "heartbeat_loop"]
