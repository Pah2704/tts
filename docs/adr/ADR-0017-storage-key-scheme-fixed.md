# ADR-0017: Key scheme Storage cố định
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Cần thống nhất đường dẫn để truy vết/dọn dẹp/telemetry.

## Quyết định
Chuẩn hoá: `projects/{projectId}/blocks/{blockId}/rows/{rowId}.{wav|mp3}`, `mix/block-{blockId}.wav`, `qc/block-{blockId}.json`.

## Hệ quả
- ✅ Dễ dò/log/thu thập số liệu.
- ⚠️ Đổi scheme sẽ cần migration.

## Lựa chọn khác & Trade-off
- Không chuẩn hoá — linh hoạt nhưng khó vận hành.
