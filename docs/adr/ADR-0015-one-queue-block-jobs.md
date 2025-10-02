# ADR-0015: Một queue cho Block-jobs
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
MVP cần đơn giản hoá vận hành và trace.

## Quyết định
Dùng một queue `block_jobs` (DLQ `block_jobs:failed`); optional tách `mix_jobs` về sau.

## Hệ quả
- ✅ Dễ vận hành/giám sát.
- ⚠️ Chưa tối ưu hoá theo class tài nguyên/độ ưu tiên.

## Lựa chọn khác & Trade-off
- Nhiều queue — tinh chỉnh tốt hơn nhưng tăng độ phức tạp.
