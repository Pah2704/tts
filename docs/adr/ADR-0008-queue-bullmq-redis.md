# ADR-0008: BullMQ trên Redis làm hàng đợi
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
BE dùng Node/Nest; cần hàng đợi nhẹ, quen thuộc hệ sinh thái JS.

## Quyết định
Dùng **BullMQ + Redis** cho queue `block_jobs` (attempts=2, backoff=2s, removeOnComplete=true).

## Hệ quả
- ✅ Dễ tích hợp Nest, đủ cho lưu lượng MVP.
- ⚠️ SPOF Redis — cần healthcheck/backup.

## Lựa chọn khác & Trade-off
- RabbitMQ/Kafka — mạnh hơn nhưng quá tải cho MVP.
