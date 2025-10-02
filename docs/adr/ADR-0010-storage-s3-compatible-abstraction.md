# ADR-0010: Abstraction Storage tương thích S3
**Status:** Proposed  
**Date:** 2025-10-01

## Bối cảnh
Dev dùng Local FS; prod dùng MinIO/S3. Cần lớp trừu tượng để không đổi FE.

## Quyết định
Xây **Storage Service** trừu tượng (FS|S3), chuẩn hoá key scheme, cấp link tải (signed/nội bộ).

## Hệ quả
- ✅ Linh hoạt môi trường, không đổi FE.
- ⚠️ Phải đồng bộ quyền/metadata giữa FS và S3.

## Lựa chọn khác & Trade-off
- Cố định S3 — uniform nhưng nặng cho dev.
