# ADR-0018: Orchestration bằng Docker Compose (Phase 1)
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Đội nhỏ/MVP cần khởi chạy nhanh, ít vận hành.

## Quyết định
Dùng **docker-compose**: services `frontend`, `api`, `worker`, `redis`, `minio` (tuỳ chọn), `nginx`. Healthchecks cơ bản.

## Hệ quả
- ✅ Nhanh dựng môi trường, phù hợp solo/micro-team.
- ⚠️ Scale/HA hạn chế; có lộ trình nâng lên K8s sau.

## Lựa chọn khác & Trade-off
- K8s ngay từ đầu — mạnh nhưng quá tải chi phí ban đầu.
