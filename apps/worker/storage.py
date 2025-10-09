"""Storage helpers with FS/S3 awareness and JSON utilities."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional

CONTENT_TYPE_JSON = "application/json; charset=utf-8"


def _storage_kind() -> str:
    return os.getenv("STORAGE_KIND", "fs").lower()


def _fs_base() -> str:
    return os.getenv("FS_BASE", os.getenv("STORAGE_ROOT", "/data/storage"))


def _fs_path(key: str) -> str:
    key = key.lstrip("/")
    return os.path.join(_fs_base(), key)


@lru_cache(maxsize=1)
def _s3_client():  # pragma: no cover - thin wrapper
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT"),
        region_name=os.getenv("S3_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
        config=Config(connect_timeout=3, read_timeout=10, retries={"max_attempts": 3, "mode": "standard"}),
    )


def put_object_bytes(key: str, data: bytes, content_type: Optional[str] = None) -> Dict[str, str]:
    key = key.lstrip("/")
    if _storage_kind() == "fs":
        dest = _fs_path(key)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        tmp_path = dest + ".tmp"
        with open(tmp_path, "wb") as fh:
            fh.write(data)
        os.replace(tmp_path, dest)
        return {"key": key}

    client = _s3_client()
    bucket = os.getenv("S3_BUCKET", "tts-vtn")
    client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
    return {"key": key}


def put_object_json(key: str, data: Dict[str, Any]) -> Dict[str, str]:
    body = (json.dumps(data, ensure_ascii=False) + "\n").encode("utf-8")
    return put_object_bytes(key, body, CONTENT_TYPE_JSON)


def get_object_bytes(key: str) -> Optional[bytes]:
    key = key.lstrip("/")
    if _storage_kind() == "fs":
        path = _fs_path(key)
        if not os.path.exists(path):
            return None
        with open(path, "rb") as fh:
            return fh.read()

    client = _s3_client()
    bucket = os.getenv("S3_BUCKET", "tts-vtn")
    try:
        obj = client.get_object(Bucket=bucket, Key=key)
    except Exception:  # pragma: no cover - propagate None on miss
        return None
    return obj["Body"].read()


def get_object_json(key: str) -> Optional[Dict[str, Any]]:
    raw = get_object_bytes(key)
    if raw is None:
        return None
    return json.loads(raw.decode("utf-8"))


def object_exists(key: str) -> bool:
    key = key.lstrip("/")
    if _storage_kind() == "fs":
        return os.path.exists(_fs_path(key))

    client = _s3_client()
    bucket = os.getenv("S3_BUCKET", "tts-vtn")
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


__all__ = [
    "put_object_bytes",
    "put_object_json",
    "get_object_bytes",
    "get_object_json",
    "object_exists",
]
