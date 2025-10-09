import importlib, os, sys, types, pytest

def _reload_settings():
    if "apps.worker.config" in sys.modules:
        sys.modules.pop("apps.worker.config")
    m = importlib.import_module("apps.worker.config")
    importlib.reload(m)
    return m.settings

def test_oversample_ok(monkeypatch):
    monkeypatch.setenv("TRUEPEAK_OVERSAMPLE", "8")
    s = _reload_settings()
    assert s.TRUEPEAK_OVERSAMPLE == 8

def test_oversample_bad_fallback4(monkeypatch):
    monkeypatch.setenv("TRUEPEAK_OVERSAMPLE", "7")
    s = _reload_settings()
    assert s.TRUEPEAK_OVERSAMPLE == 4
