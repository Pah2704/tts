from __future__ import annotations

import json
import logging
import os
import shutil
from typing import Any, Dict, List, Optional, Tuple

from redis import Redis

from adapters.piper_adapter import synthesize_piper
from apps.worker.config import settings
from apps.worker.mix.manifest import init_manifest
from apps.worker.mix.merge import tail_merge
from apps.worker.qc.aggregate import compute_qc_block, within_threshold
from apps.worker.qc.normalize import normalize_lufs_inplace
from apps.worker.qc.quality_control import Thresholds, analyze_wav, evaluate, thresholds_from_env
from apps.worker.storage import put_object_bytes, put_object_json

logger = logging.getLogger(__name__)

SNAPSHOT_TTL_SEC = int(os.getenv("SNAPSHOT_TTL_SEC", "900"))
QC_ENABLED = os.getenv("QC_ENABLE", "0").lower() not in {"0", "false", "off"}
MERGE_ENABLED = os.getenv("TTS_TAIL_MERGE", "0").lower() not in {"0", "false", "off"}
MERGE_GAP_MS = int(os.getenv("TTS_GAP_MS", "0"))
MERGE_FADE_MS = int(os.getenv("TTS_FADE_MS", "0"))
THRESHOLDS: Thresholds = thresholds_from_env()

OVERRIDE_MSG_EXACT = "QC overridden in DEV mode"
OVERRIDE_MSG_SUB = "QC override in DEV mode"
HQ_DISABLED_MSG = "HQ disabled"


def process_block_job(job: dict):
    block_id = job.get("blockId")
    rows = job.get("rows")
    if not block_id:
        raise KeyError("blockId")
    if not isinstance(rows, list) or not rows:
        raise KeyError("rows")

    root = os.getenv("STORAGE_ROOT", "/data/storage")
    job_id = job.get("jobId") or ''

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    rpub = Redis.from_url(redis_url)
    channel = f"progress:{job_id}" if job_id else None

    manifest = init_manifest(block_id)
    manifest_rows = manifest.setdefault("rows", [])

    row_results: List[Dict[str, Any]] = []
    mix_key = f"blocks/{block_id}/merged.wav"
    mix_path = os.path.join(root, mix_key)
    current_index: Optional[int] = None

    try:
        for idx, row in enumerate(rows):
            current_index = idx
            if channel:
                emit(rpub, channel, {"type": "row", "state": "running", "rowIndex": idx, "total": len(rows)})

            rel_key = f"blocks/{block_id}/rows/{idx:03d}_{row['rowId']}.wav"
            audio_path = os.path.join(root, rel_key)
            meta = synthesize_piper(row.get("text", ""), audio_path)

            manifest_rows.append({"rowId": row["rowId"], "text": row.get("text", "")})

            if os.getenv("QC_AUTONORMALIZE", "0") == "1":
                try:
                    normalize_lufs_inplace(
                        audio_path,
                        lufs_target=float(os.getenv("QC_NORM_LUFS_TARGET", "-16")),
                        tp_max_db=float(os.getenv("QC_NORM_TRUEPEAK_DB_MAX", "-1.0")),
                        safety_db=float(os.getenv("QC_TRUEPEAK_SAFETY_DB", "0.3")),
                    )
                except Exception:  # pragma: no cover
                    logger.exception("[qc][job %s row %s] normalization failed", job_id, idx)

            with open(audio_path, "rb") as fh:
                put_object_bytes(rel_key, fh.read(), "audio/wav")

            metrics_raw = analyze_wav(audio_path)
            passed, warnings, score = evaluate(metrics_raw, THRESHOLDS)
            row_results.append({
                "index": idx,
                "rowId": row["rowId"],
                "fileKey": rel_key,
                "bytes": meta["bytes"],
                "durationMs": meta["durationMs"],
                "metrics": {**metrics_raw, "warnings": warnings, "score": score},
                "passed": passed,
            })

            if channel:
                emit(rpub, channel, {
                    "type": "row",
                    "state": "done",
                    "rowIndex": idx,
                    "total": len(rows),
                    "fileKey": rel_key,
                    "bytes": meta["bytes"],
                    "durationMs": meta["durationMs"],
                    "metrics": {
                        "lufsIntegrated": metrics_raw.get("lufsIntegrated"),
                        "truePeakDb": metrics_raw.get("truePeakDb"),
                        "clippingPct": metrics_raw.get("clippingPct"),
                        "score": score,
                        "warnings": warnings,
                    },
                })

        merged_path: Optional[str]
        if row_results:
            first_path = os.path.join(root, row_results[0]["fileKey"])
            os.makedirs(os.path.dirname(mix_path), exist_ok=True)
            shutil.copyfile(first_path, mix_path)
            merged_path = mix_path
            if MERGE_ENABLED and len(row_results) > 1:
                tail_merge(
                    [os.path.join(root, row["fileKey"]) for row in row_results],
                    MERGE_GAP_MS,
                    MERGE_FADE_MS,
                    mix_path,
                )
        else:
            merged_path = None

        if merged_path:
            with open(merged_path, "rb") as fh:
                put_object_bytes(mix_key, fh.read(), "audio/wav")
        else:
            mix_key = None

        qc_key = f"qc/block-{block_id}.json"
        if merged_path and settings.HQ_ENABLED:
            qc = compute_qc_block(
                mix_path=merged_path,
                oversample_factor=settings.TRUEPEAK_OVERSAMPLE,
                target_lufs=settings.TARGET_LUFS,
                lufs_tol=settings.LUFS_TOL,
                truepeak_max_db=settings.TRUEPEAK_MAX_DBTP,
            )
        else:
            warnings = []
            if not settings.HQ_ENABLED:
                warnings.append(HQ_DISABLED_MSG)
            if not merged_path:
                warnings.append("Mix unavailable")
            qc = {
                "lufsIntegrated": None,
                "truePeakDbtp": None,
                "clippingCount": 0,
                "oversampleFactor": settings.TRUEPEAK_OVERSAMPLE,
                "penalties": {"penLUFS": 0.0, "penTP": 0.0, "penClip": 0.0},
                "score": 0.0,
                "warnings": warnings,
                "pass": False,
            }

        summary = _build_summary(row_results)
        rows_ok = summary["rowsPass"]
        rows_fail = summary["rowsFail"]
        status, reason = _finalize_status(qc, rows_fail)
        put_object_json(qc_key, qc)

        if mix_key:
            manifest["mixKey"] = mix_key
        else:
            manifest.pop("mixKey", None)

        manifest.update({
            "qcKey": qc_key,
            "qcBlock": qc,
            "qcSummary": summary,
        })

        manifest_key = f"blocks/{block_id}/manifest.json"
        put_object_json(manifest_key, manifest)

        if status == "done":
            print(f"final.done jobId={job_id} blockId={block_id} rowsOk={rows_ok} rowsFail={rows_fail} mixKey={mix_key} qcKey={qc_key}")
        else:
            print(f"final.error jobId={job_id} blockId={block_id} rowsOk={rows_ok} rowsFail={rows_fail} reason={reason}")

        if channel:
            emit(rpub, channel, {
                "type": "final",
                "state": status,
                "manifestKey": manifest_key,
                "qcBlock": qc,
                "qcKey": qc_key,
                "qcSummary": summary,
                "mixKey": mix_key,
                "rowsOk": rows_ok,
                "rowsFail": rows_fail,
                "reason": reason,
            })

        if status == "error":
            raise RuntimeError(f"block QC failed: {reason}")
    except Exception as exc:
        if channel and not _is_final_error_published(rpub, channel):
            emit(rpub, channel, {
                "type": "final",
                "state": "error",
                "error": str(exc),
                "atRow": current_index,
            })
        raise
    finally:
        try:
            rpub.close()
        except Exception:
            pass


def emit(rpub: Redis, channel: str, payload: dict):
    message = json.dumps(payload)
    rpub.publish(channel, message)
    try:
        rpub.setex(f"{channel}:last", SNAPSHOT_TTL_SEC, message)
    except Exception:
        pass


def _finalize_status(qc_block: Dict[str, Any], rows_fail: int) -> Tuple[str, str]:
    warnings = qc_block.setdefault("warnings", [])

    if rows_fail > 0:
        return "error", "rows_fail>0"

    if not settings.HQ_ENABLED:
        if HQ_DISABLED_MSG not in warnings:
            warnings.append(HQ_DISABLED_MSG)
        return "done", "hq_disabled"

    ok = qc_block.get("pass")
    if ok is None:
        ok = within_threshold(
            qc_block,
            settings.TARGET_LUFS,
            settings.LUFS_TOL,
            settings.TRUEPEAK_MAX_DBTP,
        )
        qc_block["pass"] = ok

    if ok:
        return "done", "qc_ok"

    if settings.QC_OVERRIDE_DEV:
        if OVERRIDE_MSG_EXACT not in warnings:
            warnings.append(OVERRIDE_MSG_EXACT)
        if not any("override" in str(w).lower() for w in warnings):
            warnings.append(OVERRIDE_MSG_SUB)
        return "done", "qc_override_dev"

    return "error", "qc_threshold_failed"


def _build_summary(row_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows_pass = sum(1 for row in row_results if row.get("passed"))
    rows_fail = len(row_results) - rows_pass
    total_duration = sum(row.get("durationMs", 0.0) or 0.0 for row in row_results) or 0.0

    block_lufs = None
    block_clipping = None
    block_true_peak = None
    if total_duration > 0:
        lufs_sum = 0.0
        lufs_weight = 0.0
        clipping_sum = 0.0
        peak = float('-inf')
        for row in row_results:
            metrics = row.get("metrics", {})
            duration = row.get("durationMs", 0.0) or 0.0
            lufs = metrics.get("lufsIntegrated")
            if isinstance(lufs, (int, float)):
                lufs_sum += float(lufs) * duration
                lufs_weight += duration
            clipping_sum += (metrics.get("clippingPct", 0.0) or 0.0) * duration
            peak = max(peak, metrics.get("truePeakDb", float('-inf')))
        if lufs_weight > 0:
            block_lufs = lufs_sum / lufs_weight
        block_clipping = clipping_sum / total_duration
        block_true_peak = peak if peak != float('-inf') else None

    summary: Dict[str, Any] = {
        "rowsPass": rows_pass,
        "rowsFail": rows_fail,
    }
    if block_lufs is not None:
        summary["blockLufs"] = round(block_lufs, 2)
    if block_true_peak is not None:
        summary["blockTruePeakDb"] = round(block_true_peak, 2)
    if block_clipping is not None:
        summary["blockClippingPct"] = round(block_clipping, 2)
    return summary


def _is_final_error_published(rpub: Redis, channel: str) -> bool:
    try:
        snap = rpub.get(f"{channel}:last")
    except Exception:
        return False
    if not snap:
        return False
    try:
        payload = json.loads(snap.decode('utf-8'))
    except json.JSONDecodeError:
        return False
    return payload.get("type") == "final" and payload.get("state") == "error"


__all__ = ["process_block_job", "_finalize_status"]
