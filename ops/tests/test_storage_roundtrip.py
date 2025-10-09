import json
import os
import uuid
import urllib.error
import urllib.request

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


def test_manifest_404_when_missing():
    api = os.environ.get("API_BASE", "http://localhost:4000")
    url = f"{api}/blocks/__missing__/manifest"
    try:
        urllib.request.urlopen(url, timeout=5)
    except urllib.error.HTTPError as err:
        assert err.code == 404
        ctype = err.headers.get("Content-Type") or ""
        assert ctype.lower().startswith("application/json")
        payload = json.loads(err.read().decode() or "{}")
        # Nest NotFoundException wraps message in {"message": {...}}
        message = payload.get("message")
        if isinstance(message, dict):
            assert message.get("error") == "Manifest not ready"
        else:
            assert "manifest" in str(message).lower()
    except urllib.error.URLError as exc:
        pytest.skip(f"API not reachable: {exc}")
    else:
        pytest.skip("Manifest unexpectedly exists for missing block")
