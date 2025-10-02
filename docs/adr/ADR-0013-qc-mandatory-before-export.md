# ADR-0013: QC bắt buộc trước khi export
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Cần khoá KPI âm lượng/chất lượng ổn định giữa các Row/Block.

## Quyết định
Áp **QC** (LUFS target −16±1, True Peak ≤ −1.0 dBTP, clipping ≤0.1%) trước export; nếu vi phạm, ghi nhận metrics và cảnh báo/soft-fix.

## Hệ quả
- ✅ Chất lượng ổn định, dễ so sánh A/B.
- ⚠️ Thêm latency xử lý.

## Lựa chọn khác & Trade-off
- QC tùy chọn — nhanh hơn nhưng rủi ro chất lượng không ổn định.
