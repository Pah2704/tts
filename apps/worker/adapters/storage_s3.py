"""S3-compatible storage adapter, defaults tuned for MinIO."""

from __future__ import annotations

import json
import os
from typing import Any

import boto3
from botocore.config import Config

_BUCKET = os.getenv("S3_BUCKET", "tts-vtn")
_ENDPOINT = os.getenv("S3_ENDPOINT")  # e.g. http://minio:9000
_REGION = os.getenv("S3_REGION", "us-east-1")
_AK = os.getenv("S3_ACCESS_KEY", "minioadmin")
_SK = os.getenv("S3_SECRET_KEY", "minioadmin")
_FORCE_PATH = os.getenv("S3_FORCE_PATH_STYLE", "1") == "1"

_session = boto3.session.Session()
_s3 = _session.client(
    "s3",
    region_name=_REGION,
    endpoint_url=_ENDPOINT,
    aws_access_key_id=_AK,
    aws_secret_access_key=_SK,
    config=Config(s3={"addressing_style": "path" if _FORCE_PATH else "auto"}, signature_version="s3v4"),
)


def _normalize_key(key: str) -> str:
    return key.lstrip("/")


def put_bytes(key: str, data: bytes, content_type: str | None = None) -> dict[str, str]:
    _s3.put_object(
        Bucket=_BUCKET,
        Key=_normalize_key(key),
        Body=data,
        ContentType=content_type or "application/octet-stream",
    )
    return {"key": key}


def put_json(key: str, obj: Any) -> dict[str, str]:
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    return put_bytes(key, data, "application/json")


def get_bytes(key: str) -> bytes:
    res = _s3.get_object(Bucket=_BUCKET, Key=_normalize_key(key))
    return res["Body"].read()


def exists(key: str) -> bool:
    try:
        _s3.head_object(Bucket=_BUCKET, Key=_normalize_key(key))
        return True
    except Exception:  # pragma: no cover - exact exceptions depend on backend
        return False

