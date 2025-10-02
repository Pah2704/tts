(1) Mục tiêu đo được (KPI)

Tốc độ gen Piper: ≤0.6× real-time (1′ văn bản ≤36s); XTTS (HQ) CPU: ≤2.5× RT; có CUDA: ≤1.0× RT.

TTFB nghe câu đầu: Piper ≤5s; XTTS-CPU ≤12s; có CUDA ≤6s.

Tỷ lệ job hoàn tất thành công ≥99%; crash ≤0.5%; retry ≤1 lần/job.

QC pass ≥95% câu đạt −16±1 LUFS; True Peak ≤ −1.0 dBTP; clipping ≤0.1% samples.

Độ chính xác tách câu ≥98% (viết tắt/ký hiệu không tách sai); ghép đúng thứ tự 100%.

UX async: 100% thao tác khác không bị chặn khi job chạy; hiển thị tiến độ theo câu (Row) 100% thời gian.

(2) Non-goal

Streaming TTS theo thời gian thực; multi-user/collab; marketplace giọng; voice cloning; xử lý video; tìm kiếm lịch sử nâng cao; SSML cho Piper (chỉ XTTS mới có).

(3) Phạm vi MVP

Luồng Block-first: Đơn thoại → đoạn=Block; Hội thoại → [Nhân vật]:=Block; auto tách câu; progress per-Row.

Engine: Piper mặc định; toggle “Âm thanh chất lượng cao” → XTTS; tự dùng CUDA nếu có; không có CUDA vẫn chạy XTTS (cảnh báo nhẹ).

SSML: mở khi bật HQ (XTTS); whitelist <break>, <emphasis>, <prosody>, say-as.

QC & hậu kỳ: Normalize/Limit per-Row → ghép Block → Normalize tổng thể; LUFS/Peak/Clipping/Score; level-matching giữa nhân vật.

Background FX (auto-ducking, fade); nghe thử per-Row/Block; A/B; Xuất file (WAV/MP3).

Đối tượng: solo creator/nhóm nhỏ (1–5 người), tiếng Việt trước; văn bản ngắn-vừa (≤3.000 từ/lần).

Stack đề xuất: FE React; BE API (Node/Nest) + worker Python (Piper/XTTS); Redis queue; Docker Compose; lưu file cục bộ/S3-compatible. (phù hợp nguyên tắc async/job cấp Block).

(4) Rủi ro & giả định

Hiệu năng XTTS trên CPU chậm (rủi ro trung bình); giả định có thể bật CUDA trên 30–50% máy.

Tách câu sai với viết tắt/ký hiệu đặc thù (rủi ro thấp → đã có danh mục ngoại lệ).

Không hỗ trợ SSML ở Piper có thể giảm linh hoạt (rủi ro thấp).

Quản lý im lặng/nhịp thở và level-matching hội thoại không đạt KPI QC lần đầu (rủi ro trung bình).

Giả định phạm vi chỉ desktop web nội bộ; chưa có đa người dùng/role.

(5) Milestone theo tuần

W1 (Tuần 1): Khung FE/BE + Workspace skeleton; parser & tạo Block; auto tách câu; cảnh báo cú pháp hội thoại. (≥20 test case tách câu)

W2: Job cấp Block (async), tiến độ per-Row; tích hợp Piper (nghe thử/Export cơ bản). (≥50 job/ngày ổn định)

W3: Auto Processing + QC (LUFS/Peak/Clipping/Score); Normalize tổng thể; A/B playback. (QC pass ≥80% bản đầu)

W4: Toggle HQ → XTTS (CPU/GPU); SSML Editor (whitelist); cảnh báo không CUDA. (TTFB XTTS-CPU ≤15s)

W5: Background FX (auto-ducking, fade); level-matching hội thoại; tối ưu ghép/đệm im lặng. (Clipping ≤0.2%)

W6: Đóng KPI (Piper ≤0.6× RT; QC pass ≥95%); hardening, telemetry tối thiểu, tài liệu & handoff. (bug P1=0)