# ADR-0014: CUDA opportunistic (tận dụng GPU khi có)
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Hạ tầng dev/prod có thể không đồng nhất về GPU.

## Quyết định
Worker tự phát hiện GPU và tối ưu; nếu không có GPU vẫn chạy CPU (cảnh báo hiệu năng).

## Hệ quả
- ✅ Tối ưu tài nguyên linh hoạt.
- ⚠️ Hai nhánh hiệu năng khác nhau cần testing riêng.

## Lựa chọn khác & Trade-off
- Bắt buộc GPU — hiệu năng tốt nhưng giảm khả năng triển khai linh hoạt.
