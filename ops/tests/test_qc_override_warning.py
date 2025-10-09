import pytest
from apps.worker.handlers import block_job
from apps.worker.config import settings

def _qc(lufs=-12.0, tp=-0.3, clip=0, oversample=4):
    return {
        "lufsIntegrated": lufs,
        "truePeakDbtp": tp,
        "clippingCount": clip,
        "oversampleFactor": oversample,
        "penalties": {"penLUFS": 0, "penTP": 0, "penClip": 0},
        "score": 100.0,
        "pass": False,
        "warnings": [],
    }

def test_override_adds_warning(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", True)
    monkeypatch.setattr(settings, "QC_OVERRIDE_DEV", True)
    qc = _qc(lufs=-12.0, tp=-0.3)
    status, reason = block_job._finalize_status(qc, rows_fail=0)
    assert (status, reason) == ("done", "qc_override_dev")
    assert any("override" in w.lower() for w in qc.get("warnings", []))
