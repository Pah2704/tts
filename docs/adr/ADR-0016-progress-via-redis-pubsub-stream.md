# ADR-0016: Progress qua Redis PubSub/Stream
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Cần kênh trung gian giữa Worker và API để fan-out tới nhiều FE subscriber.

## Quyết định
Worker publish progress vào `progress:{jobId}`; API làm gateway đẩy ra SSE/WS.

## Hệ quả
- ✅ Tách concerns, tăng linh hoạt.
- ⚠️ Thêm hop và độ trễ nhỏ.

## Lựa chọn khác & Trade-off
- Worker → FE trực tiếp — ràng buộc topology, khó bảo trì.
