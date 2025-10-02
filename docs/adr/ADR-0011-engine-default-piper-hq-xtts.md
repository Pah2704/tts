# ADR-0011: Piper mặc định; HQ dùng XTTS
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Cần cân bằng tốc độ/chi phí (Piper) với chất lượng (XTTS) cho nhu cầu cao.

## Quyết định
Mặc định **Piper**; khi bật **High-Quality** thì dùng **XTTS**. FE cảnh báo về hiệu năng/tài nguyên.

## Hệ quả
- ✅ Đáp nhiều bối cảnh, kiểm soát chi phí.
- ⚠️ Trải nghiệm không đồng nhất giữa engine.

## Lựa chọn khác & Trade-off
- Chỉ XTTS — chất lượng cao nhưng chi phí/latency lớn.
