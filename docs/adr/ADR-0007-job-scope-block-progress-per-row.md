# ADR-0007: Job cấp Block, progress theo Row
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
MVP cần async-by-default, hiển thị tiến độ mịn và ghép xuất theo Block.

## Quyết định
Tạo **job ở cấp Block**; Worker fan-out xử lý từng **Row** và phát progress per-Row; cuối cùng ghép Block.

## Hệ quả
- ✅ Tối ưu UX/quan sát, ghép xuất nhất quán.
- ⚠️ Cần mapping thứ tự khi ghép và manifest kết quả.

## Lựa chọn khác & Trade-off
- Job per-Row — đơn giản hoá Worker nhưng phức tạp orchestration/UX.
