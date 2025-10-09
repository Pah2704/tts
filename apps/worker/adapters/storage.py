"""Facade selecting storage adapter based on STORAGE_KIND."""

from __future__ import annotations

import os

if os.getenv("STORAGE_KIND", "fs").lower() == "s3":
    from .storage_s3 import exists, get_bytes, put_bytes, put_json
else:  # default filesystem
    from .storage_fs import exists, get_bytes, put_bytes, put_json

__all__ = ["put_bytes", "put_json", "get_bytes", "exists"]

