# ADR-0004: Block-first UI & Một Workspace
**Status:** Proposed  
**Date:** 2025-10-01  
**Deciders:** Product, FE Lead, BE Lead

## Bối cảnh
Người dùng thao tác trên khối văn bản (Block) thống nhất cho đơn thoại/hội thoại. Cần một không gian làm việc duy nhất để giảm chuyển ngữ cảnh.

## Quyết định
Thiết kế giao diện **Block-first** trong **một Workspace**: tạo Block, chỉnh tham số/giọng, dựng hàng đợi job theo Block; Row (câu) là đơn vị quan sát tiến độ.

## Hệ quả
- ✅ UX mạch lạc, giảm số view/phức tạp điều hướng.
- ⚠️ Cần hiển thị đánh dấu hội thoại/turn và công cụ gộp/chia câu.

## Lựa chọn khác & Trade-off
- "Nhiều màn hình" (Blocks/Dialogs tách) — giàu tính năng nhưng tăng phức tạp và chi phí bảo trì.
