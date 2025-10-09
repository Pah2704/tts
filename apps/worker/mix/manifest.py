"""Manifest helpers for block-level metadata."""

from __future__ import annotations

from typing import Any, Dict


def init_manifest(block_id: str) -> Dict[str, Any]:
    return {
        "blockId": block_id,
        "rows": [],
        "mixKey": None,
        "qcKey": None,
        "qcBlock": None,
    }


def add_row(manifest: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
    manifest.setdefault("rows", []).append(row)
    return manifest


def set_merged(manifest: Dict[str, Any], mix_key: str) -> Dict[str, Any]:
    manifest["mixKey"] = mix_key
    return manifest


def set_qc_summary(manifest: Dict[str, Any], qc_key: str, qc_block: Dict[str, Any]) -> Dict[str, Any]:
    manifest["qcKey"] = qc_key
    manifest["qcBlock"] = qc_block
    return manifest


__all__ = ["init_manifest", "add_row", "set_merged", "set_qc_summary"]
