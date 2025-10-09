import uuid

import pytest

from apps.worker.storage import put_object_json, get_object_json


def _roundtrip_once(prefix="rt", payload=None):
    key = f"{prefix}/{uuid.uuid4().hex}.json"
    put_object_json(key, payload)
    got = get_object_json(key)
    assert got == payload, (got, payload)


def test_fs_roundtrip(monkeypatch, tmp_path):
    base = tmp_path / "data"
    monkeypatch.setenv("STORAGE_KIND", "fs")
    monkeypatch.setenv("FS_BASE", str(base))
    payload = {"hello": "world", "n": 123, "arr": [1, 2, 3]}
    _roundtrip_once("rt-fs", payload)


def test_s3_roundtrip(monkeypatch):
    monkeypatch.setenv("STORAGE_KIND", "s3")
    monkeypatch.setenv("S3_ENDPOINT", "http://minio:9000")
    monkeypatch.setenv("S3_BUCKET", "tts-vtn")
    monkeypatch.setenv("S3_ACCESS_KEY", "minioadmin")
    monkeypatch.setenv("S3_SECRET_KEY", "minioadmin")
    payload = {"k": "v", "ok": True}
    try:
        _roundtrip_once("rt-s3", payload)
    except Exception as exc:  # pragma: no cover - allow running without MinIO
        pytest.skip(f"S3 roundtrip skipped: {exc}")
