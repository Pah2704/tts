# ADR-0009: REST + SSE (WS tuỳ chọn)
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Cần CRUD/command qua HTTP và cập nhật realtime.

## Quyết định
**REST** cho command/query; **SSE** cho progress; **WebSocket** chỉ dùng khi cần full-duplex điều khiển.

## Hệ quả
- ✅ Nhanh đạt MVP, dễ quan sát.
- ⚠️ Hai cơ chế nếu bật WS sau này.

## Lựa chọn khác & Trade-off
- GraphQL Subscriptions — mạnh nhưng tăng độ phức tạp triển khai.
