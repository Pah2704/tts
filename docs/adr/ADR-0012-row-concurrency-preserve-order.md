# ADR-0012: Vi đồng thời theo Row; bảo toàn thứ tự ghép
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Cần throughput tốt nhưng xuất cuối phải đúng trật tự logic.

## Quyết định
Worker xử lý **nhiều Row đồng thời** theo tài nguyên, lưu **index thứ tự**, và **ghép** giữ nguyên thứ tự.

## Hệ quả
- ✅ Tăng tốc tổng thể, vẫn đảm bảo tính đúng.
- ⚠️ Phức tạp scheduler/merger.

## Lựa chọn khác & Trade-off
- Xử lý tuần tự — đơn giản nhưng chậm đáng kể.
