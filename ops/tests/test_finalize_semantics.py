# --- stub adapters to avoid heavy deps in this test ---
import sys
import types

sys.modules.setdefault("adapters", types.ModuleType("adapters"))
stub = types.ModuleType("adapters.piper_adapter")
stub.synthesize_piper = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("not used in finalize test"))
sys.modules["adapters.piper_adapter"] = stub
# ------------------------------------------------------

from apps.worker.config import settings
from apps.worker.handlers.block_job import _finalize_status


def _qc(lufs=None, tp=None, clip=0, warnings=None, passed=False):
    return {
        "lufsIntegrated": lufs,
        "truePeakDbtp": tp,
        "clippingCount": clip,
        "oversampleFactor": 4,
        "penalties": {"penLUFS": 0.0, "penTP": 0.0, "penClip": 0.0},
        "score": 0.0,
        "warnings": list(warnings or []),
        "pass": passed,
    }


def test_case1_rows_ok_hq_off(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", False)
    qc = _qc(warnings=["HQ disabled"], passed=False)
    status, reason = _finalize_status(qc, rows_fail=0)
    assert (status, reason) == ("done", "hq_disabled")
    assert any("HQ disabled" in w for w in qc.get("warnings", []))


def test_case2_rows_ok_hq_on_qc_bad_override(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", True)
    monkeypatch.setattr(settings, "QC_OVERRIDE_DEV", True)
    qc = _qc(lufs=-12.0, tp=-0.3, clip=0, warnings=[])
    status, reason = _finalize_status(qc, rows_fail=0)
    assert (status, reason) == ("done", "qc_override_dev")
    assert any("QC overridden in DEV mode" == w for w in qc.get("warnings", []))


def test_case3_rows_fail_any(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", True)
    monkeypatch.setattr(settings, "QC_OVERRIDE_DEV", False)
    qc = _qc(lufs=-16.0, tp=-2.0, clip=0, passed=True)
    status, reason = _finalize_status(qc, rows_fail=1)
    assert (status, reason) == ("error", "rows_fail>0")
