from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from redis import Redis

from adapters.piper_adapter import synthesize_piper
from mix.manifest import (
    add_row,
    init_manifest,
    save_manifest,
    set_merged,
    set_qc_summary,
)
from mix.merge import tail_merge
from qc import analyze_wav, evaluate
from qc.normalize import normalize_lufs_inplace
from qc.quality_control import Thresholds, thresholds_from_env


SNAPSHOT_TTL_SEC = int(os.getenv("SNAPSHOT_TTL_SEC", "900"))
QC_ENABLED = os.getenv("QC_ENABLE", "0").lower() not in {"0", "false", "off"}
MERGE_ENABLED = os.getenv("TTS_TAIL_MERGE", "0").lower() not in {"0", "false", "off"}
MERGE_GAP_MS = int(os.getenv("TTS_GAP_MS", "0"))
MERGE_FADE_MS = int(os.getenv("TTS_FADE_MS", "0"))
THRESHOLDS: Thresholds = thresholds_from_env()
logger = logging.getLogger(__name__)


def process_block_job(job: dict):
    block_id = job.get("blockId")
    rows = job.get("rows")
    if block_id is None:
        raise KeyError("blockId")
    if not isinstance(rows, list) or not rows:
        raise KeyError("rows")

    engine = job.get("engine", "piper")
    voice_id = os.getenv("PIPER_VOICE_ID", "en_US")
    root = os.getenv("STORAGE_ROOT", "/data/storage")
    job_id = job["jobId"]
    total = len(rows)

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    rpub = Redis.from_url(redis_url)
    channel = f"progress:{job_id}"

    manifest = init_manifest(block_id, engine, voice_id)
    row_results: List[Dict[str, Any]] = []

    current_index = None
    try:
        for i, row in enumerate(rows):
            current_index = i
            emit(rpub, channel, {"type": "row", "state": "running", "rowIndex": i, "total": total})

            rel_key = f"blocks/{block_id}/rows/{i:03d}_{row['rowId']}.wav"
            out_wav = os.path.join(root, rel_key)
            meta = synthesize_piper(row["text"], out_wav)

            if os.getenv("QC_AUTONORMALIZE", "0") == "1":
                norm = normalize_lufs_inplace(
                    out_wav,
                    lufs_target=float(os.getenv("QC_NORM_LUFS_TARGET", "-16")),
                    tp_max_db=float(os.getenv("QC_NORM_TRUEPEAK_DB_MAX", "-1.0")),
                    safety_db=float(os.getenv("QC_TRUEPEAK_SAFETY_DB", "0.3")),
                )
            else:
                norm = None
            if norm:
                logger.info("[qc][job %s row %s] norm=%s", job_id, i, norm)

            raw_metrics = analyze_wav(out_wav)
            passed, warnings, score = evaluate(raw_metrics, THRESHOLDS)
            metrics_payload = _format_metrics(raw_metrics, warnings, score)
            if norm:
                metrics_payload.setdefault("warnings", [])
                if norm.get("warnings"):
                    metrics_payload["warnings"].extend(norm["warnings"])
                metrics_payload.setdefault("normalizer", {})["appliedGainDb"] = round(norm.get("appliedGainDb", 0.0), 2)
                metrics_payload["normalizer"]["postTruePeakDb"] = round(norm.get("postTruePeakDb", 0.0), 2)
                metrics_payload["normalizer"]["postLufs"] = round(norm.get("postLufs", 0.0), 2)
            logger.info("[qc][job %s row %s] metrics=%s", job_id, i, metrics_payload)
            result = {
                "index": i,
                "rowId": row["rowId"],
                "fileKey": rel_key,
                "bytes": meta["bytes"],
                "durationMs": meta["durationMs"],
                "metrics": {**raw_metrics, "warnings": warnings, "score": score},
                "passed": passed,
            }
            row_results.append(result)

            add_row(
                manifest,
                i,
                row["rowId"],
                rel_key,
                meta["bytes"],
                meta["durationMs"],
                metrics_payload,
            )

            emit(
                rpub,
                channel,
                {
                    "type": "row",
                    "state": "done",
                    "rowIndex": i,
                    "total": total,
                    "fileKey": rel_key,
                    "bytes": meta["bytes"],
                    "durationMs": meta["durationMs"],
                    "metrics": metrics_payload,
                },
            )

            if QC_ENABLED and not passed:
                error_msg = _format_qc_error(warnings, score)
                emit(
                    rpub,
                    channel,
                    {
                        "type": "final",
                        "state": "error",
                        "error": error_msg,
                        "atRow": i,
                    },
                )
                raise RuntimeError(error_msg)

        merged_info = None
        merged_key = None
        if MERGE_ENABLED:
            wav_paths = [os.path.join(root, row['fileKey']) for row in row_results]
            merged_rel = f"blocks/{block_id}/merged.wav"
            merged_path = os.path.join(root, merged_rel)
            merge_stats = tail_merge(wav_paths, MERGE_GAP_MS, MERGE_FADE_MS, merged_path)
            merged_metrics = analyze_wav(merged_path)
            merged_passed, merged_warnings, merged_score = evaluate(merged_metrics, THRESHOLDS)
            merged_metrics.update({
                "warnings": merged_warnings,
                "score": round(merged_score, 3),
            })
            merged_info = {
                "fileKey": merged_rel,
                "bytes": merge_stats["bytes"],
                "durationMs": merge_stats["durationMs"],
                "metrics": merged_metrics,
            }
            if QC_ENABLED and not merged_passed:
                error_msg = _format_qc_error(merged_warnings, merged_score, prefix="merged")
                emit(
                    rpub,
                    channel,
                    {
                        "type": "final",
                        "state": "error",
                        "error": error_msg,
                    },
                )
                raise RuntimeError(error_msg)
            set_merged(
                manifest,
                merged_rel,
                merge_stats["bytes"],
                merge_stats["durationMs"],
                _format_metrics(merged_metrics, merged_warnings, merged_score),
            )

        qc_summary = _build_summary(row_results)
        set_qc_summary(
            manifest,
            qc_summary["rowsPass"],
            qc_summary["rowsFail"],
            qc_summary.get("blockLufs"),
            qc_summary.get("blockTruePeakDb"),
            qc_summary.get("blockClippingPct"),
        )

        save_manifest(manifest, root)

        final_payload: Dict[str, Any] = {
            "type": "final",
            "state": "done",
            "manifestKey": f"blocks/{block_id}/manifest.json",
            "qcSummary": qc_summary,
        }
        if merged_info is not None:
            final_payload["mergedKey"] = merged_info["fileKey"]
        emit(rpub, channel, final_payload)
    except Exception as exc:  # noqa: BLE001
        if not _is_final_error_published(rpub, channel):
            error_payload = {
                "type": "final",
                "state": "error",
                "error": str(exc),
            }
            if current_index is not None:
                error_payload["atRow"] = current_index
            emit(rpub, channel, error_payload)
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
    except Exception:  # noqa: BLE001 - snapshot best-effort
        pass


def _format_metrics(raw: Dict[str, Any], warnings: List[str], score: float) -> Dict[str, Any]:
    lufs = raw.get("lufsIntegrated")
    if lufs in (None, float('-inf'), float('inf')):
        lufs_value = lufs
    else:
        lufs_value = round(lufs, 2)
    true_peak = raw.get("truePeakDb")
    if true_peak in (None, float('-inf'), float('inf')):
        peak_value = true_peak
    else:
        peak_value = round(true_peak, 2)
    return {
        "lufsIntegrated": lufs_value,
        "truePeakDb": peak_value,
        "clippingPct": round(raw.get("clippingPct", 0.0), 2),
        "score": round(score, 3),
        "warnings": warnings,
    }


def _format_qc_error(warnings: List[str], score: float, prefix: Optional[str] = None) -> str:
    parts = warnings[:] if warnings else []
    if not parts:
        parts.append(f"score {score:.2f} < min {THRESHOLDS.score_min:.2f}")
    reason = "; ".join(parts)
    if prefix:
        return f"{prefix} QC threshold failed: {reason}"
    return f"QC threshold failed: {reason}"


def _build_summary(row_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows_pass = sum(1 for row in row_results if row.get("passed"))
    rows_fail = len(row_results) - rows_pass
    total_duration = sum(row["durationMs"] for row in row_results) or 0.0

    block_lufs = None
    block_clipping = None
    block_true_peak = None
    if total_duration > 0:
        lufs_sum = 0.0
        lufs_weight = 0.0
        clipping_sum = 0.0
        peak = float('-inf')
        for row in row_results:
            metrics = row["metrics"]
            duration = row["durationMs"]
            lufs = metrics.get("lufsIntegrated")
            if lufs not in (None, float('-inf'), float('inf')):
                lufs_sum += lufs * duration
                lufs_weight += duration
            clipping_sum += metrics.get("clippingPct", 0.0) * duration
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
