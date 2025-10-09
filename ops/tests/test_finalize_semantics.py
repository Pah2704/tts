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
from apps.worker.qc.aggregate import within_threshold


def _qc(lufs, tp, clip=0, warnings=None, oversample=4, set_pass=None):
    qc = {
        "lufsIntegrated": lufs,
        "truePeakDbtp": tp,
        "clippingCount": clip,
        "oversampleFactor": oversample,
        "warnings": list(warnings or []),
    }
    if set_pass is not None:
        qc["pass"] = set_pass
    return qc


def test_case_rows_ok_hq_off(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", False)
    qc = _qc(lufs=-16.0, tp=-1.0, clip=0, warnings=["HQ disabled"], set_pass=False)
    status, reason = _finalize_status(qc, rows_fail=0)
    assert (status, reason) == ("done", "hq_disabled")
    assert any("HQ disabled" in w for w in qc.get("warnings", []))


def test_case_rows_ok_hq_on_qc_override(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", True)
    monkeypatch.setattr(settings, "QC_OVERRIDE_DEV", True)
    qc = _qc(lufs=-12.0, tp=-0.3, clip=0, warnings=[], set_pass=False)
    status, reason = _finalize_status(qc, rows_fail=0)
    assert (status, reason) == ("done", "qc_override_dev")
    assert any("override" in w.lower() for w in qc.get("warnings", []))


def test_case_rows_fail_any(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", True)
    monkeypatch.setattr(settings, "QC_OVERRIDE_DEV", False)
    qc = _qc(lufs=-16.0, tp=-2.0, clip=0, warnings=[], set_pass=True)
    status, reason = _finalize_status(qc, rows_fail=1)
    assert (status, reason) == ("error", "rows_fail>0")


def test_case_qc_ok_via_within_threshold(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", True)
    monkeypatch.setattr(settings, "QC_OVERRIDE_DEV", False)
    qc = _qc(lufs=-16.0, tp=-1.0, clip=0, warnings=[])
    assert within_threshold(qc, settings.TARGET_LUFS, settings.LUFS_TOL, settings.TRUEPEAK_MAX_DBTP)
    status, reason = _finalize_status(qc, rows_fail=0)
    assert (status, reason) == ("done", "qc_ok")
    assert not any("override" in w.lower() for w in qc.get("warnings", []))
    assert qc.get("pass") is True


def test_case_qc_threshold_failed_no_override(monkeypatch):
    monkeypatch.setattr(settings, "HQ_ENABLED", True)
    monkeypatch.setattr(settings, "QC_OVERRIDE_DEV", False)
    qc = _qc(lufs=-12.0, tp=-0.3, clip=0, warnings=[])
    assert not within_threshold(qc, settings.TARGET_LUFS, settings.LUFS_TOL, settings.TRUEPEAK_MAX_DBTP)
    status, reason = _finalize_status(qc, rows_fail=0)
    assert (status, reason) == ("error", "qc_threshold_failed")
    assert not any("override" in w.lower() for w in qc.get("warnings", []))
