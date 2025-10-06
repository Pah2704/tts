from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional


def init_manifest(block_id: str, engine: str, voice_id: str) -> Dict[str, Any]:
    return {
        "version": "1.1",
        "blockId": block_id,
        "engine": engine,
        "voiceId": voice_id,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rows": [],
    }


def add_row(
    manifest: Dict[str, Any],
    index: int,
    row_id: str,
    file_key: str,
    bytes_size: int,
    duration_ms: int,
    metrics: Optional[Dict[str, Any]] = None,
) -> None:
    manifest.setdefault("rows", []).append(
        {
            "index": index,
            "rowId": row_id,
            "fileKey": file_key,
            "bytes": bytes_size,
            "durationMs": duration_ms,
            "metrics": metrics,
        }
    )


def set_merged(
    manifest: Dict[str, Any],
    file_key: str,
    bytes_size: int,
    duration_ms: int,
    metrics: Optional[Dict[str, Any]] = None,
) -> None:
    manifest["merged"] = {
        "fileKey": file_key,
        "bytes": bytes_size,
        "durationMs": duration_ms,
    }
    if metrics is not None:
        manifest["merged"]["metrics"] = metrics


def set_qc_summary(
    manifest: Dict[str, Any],
    rows_pass: int,
    rows_fail: int,
    block_lufs: Optional[float],
    block_true_peak: Optional[float],
    block_clipping: Optional[float],
) -> None:
    summary: Dict[str, Any] = {
        "rowsPass": rows_pass,
        "rowsFail": rows_fail,
    }
    if block_lufs is not None:
        summary["blockLufs"] = round(block_lufs, 2)
    if block_true_peak is not None and block_true_peak != float('-inf'):
        summary["blockTruePeakDb"] = round(block_true_peak, 2)
    if block_clipping is not None:
        summary["blockClippingPct"] = round(block_clipping, 2)
    manifest["qcSummary"] = summary


def save_manifest(manifest: Dict[str, Any], storage_root: str) -> str:
    path = os.path.join(storage_root, f"blocks/{manifest['blockId']}/manifest.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
    return path
