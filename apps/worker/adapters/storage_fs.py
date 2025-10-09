"""Filesystem-backed storage adapter used when STORAGE_KIND=fs."""

from __future__ import annotations

import json
import os
from typing import Any

_ROOT = os.getenv("STORAGE_ROOT", "/data/storage")


def _resolve(key: str) -> str:
    key = key.lstrip("/")
    return os.path.join(_ROOT, key)


def put_bytes(key: str, data: bytes, content_type: str | None = None) -> dict[str, str]:
    path = _resolve(key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(data)
    return {"key": key}


def put_json(key: str, obj: Any) -> dict[str, str]:
    data = json.dumps(obj, ensure_ascii=False, indent=None).encode("utf-8")
    return put_bytes(key, data, "application/json")


def get_bytes(key: str) -> bytes:
    path = _resolve(key)
    with open(path, "rb") as fh:
        return fh.read()


def exists(key: str) -> bool:
    return os.path.exists(_resolve(key))

