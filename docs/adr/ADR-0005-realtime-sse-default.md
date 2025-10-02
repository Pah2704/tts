# ADR-0005: Realtime qua SSE mặc định
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Cần cập nhật tiến độ theo Row để người dùng quan sát. Kênh một chiều là đủ cho MVP.

## Quyết định
Dùng **Server-Sent Events (SSE)** mặc định cho push progress; **WebSocket** là tuỳ chọn nâng cấp sau.

## Hệ quả
- ✅ Triển khai đơn giản, dễ scale đọc nhiều subscriber.
- ⚠️ Không full-duplex; nếu cần điều khiển live phải thêm WS.

## Lựa chọn khác & Trade-off
- WebSocket-only — mạnh mẽ hơn nhưng tăng chi phí triển khai/giám sát với nhu cầu một chiều.
