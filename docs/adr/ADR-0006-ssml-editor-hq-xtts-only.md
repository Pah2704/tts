# ADR-0006: SSML Editor chỉ dành cho chế độ HQ/XTTS
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Piper không hỗ trợ SSML; XTTS hỗ trợ các nhãn điều khiển chi tiết.

## Quyết định
Khoá SSML Editor sau công tắc **High-Quality (XTTS)**. Với Piper, hiển thị plain text controls tối giản.

## Hệ quả
- ✅ Tránh hiểu nhầm khả năng engine, UI rõ ràng.
- ⚠️ Trải nghiệm giữa hai engine khác nhau.

## Lựa chọn khác & Trade-off
- Cho phép SSML ở mọi nơi — gây lỗi khi dùng Piper, tăng hỗ trợ.
