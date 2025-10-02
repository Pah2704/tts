# TTS‑VTN – Đặc tả chức năng (Giai đoạn 1, Block‑first, Phi kỹ thuật)

**Trạng thái:** Bản nháp v0.2 (đã khoá các quyết định 1–4)  
**Chủ sở hữu:** Phan Anh Huy  
**Phạm vi:** Giai đoạn 1 (Local / một người dùng), TTS tiếng Anh; mặc định **Piper**, có công tắc **Chất lượng cao (XTTS)**.  
**Nguyên tắc:** Workspace theo **Block‑first** · Xử lý **bất đồng bộ** · UI đơn giản, dễ đoán · Chất lượng âm do **mặc định hợp lý**, tránh tham số quá chuyên sâu cho người dùng cuối.

---

## 1) Mục tiêu, người dùng, nội dung
- **Mục tiêu chính:** Sản xuất âm thanh thật phục vụ giảng dạy (tiếng Anh) nhanh và ổn định.
- **Nhân vật người dùng:** Giảng viên tự sử dụng ứng dụng (không có tài khoản sinh viên).
- **Miền nội dung đầu vào:** Tiếng Anh + viết tắt + emoji + một ít ký hiệu kỹ thuật (số, đơn vị, ngày tháng).
- **Ngoài phạm vi (GĐ1):** Cộng tác nhiều người dùng, import/export định dạng nội dung (ngoại trừ dán văn bản), timeline/waveform nâng cao.

---

## 2) Mô hình Workspace
**Project → Blocks → Rows (câu/từ)**
- Ứng dụng có **2 trang riêng**: **Trang Nhập Văn Bản** (tối giản) và **Trang Xử Lý (Workspace)**.
- **Trang Nhập Văn Bản:** có 2 tab **Đơn thoại** / **Hội thoại** (tô màu & gán tên nhân vật ngay ở đây).
- **Workspace:** tập trung điều khiển Block/Row; có nút **“Nhập thêm nội dung”** để mở **Giao diện Nhập nhanh** (overlay) dùng **cùng quy tắc tách** như Trang Nhập.

**Đối tượng chính:**
- **Project**: metadata, thiết lập chung, FX, trạng thái công tắc Chất lượng cao, ánh xạ nhân vật→giọng.
- **Block**: một đoạn văn bản liền mạch; sở hữu Voice/Style/Speed/Pitch/Pause/Variability; nghe thử theo Block.
- **Row**: một câu (hoặc đơn vị tách); có thể nghe thử và (khi HQ bật) mở “Hiệu chỉnh nâng cao” cho câu.

---

## 3) Dán & Tách (Paste & Split)
**Áp dụng cho _Trang Nhập Văn Bản_; trong _Workspace_, nút “Nhập thêm nội dung” sẽ mở _Giao diện Nhập nhanh_ (overlay) với cùng luồng & quy tắc tách.**

**Giao diện dán có 2 tab:**

- **Đơn thoại:** 1 vùng nhập lớn kèm hướng dẫn *“Dán đoạn văn cần chuyển đổi vào đây”*. Khi nhấn **Tiếp tục**:
  - Mỗi **đoạn** (ngăn bởi dòng trống) → **1 Block**.
  - Bên trong từng Block, hệ thống **tự tách theo câu** với cơ chế bảo vệ viết tắt/emoji/ký hiệu phổ biến.
  - **Bảo vệ ẩn câu quá dài:** nếu 1 câu vượt ngưỡng (**>40 từ** hoặc **>240 ký tự**), engine sẽ **tách nội bộ theo dấu phẩy/;/** để bảo đảm nhịp thở và độ mượt, **nhưng UI vẫn hiển thị 1 Row**.

- **Hội thoại:** 1 vùng nhập lớn kèm hướng dẫn *“Mỗi lượt thoại bắt đầu bằng tên nhân vật, theo định dạng `[Name]: nội dung`; xuống dòng khi đổi nhân vật.”* Trong ô nhập:
  - Hệ thống tự nhận diện **nhân vật** và **tô màu** theo từng tên để người dùng dễ soát lỗi.
  - Khi nhấn **Tiếp tục**:
    - Mỗi **lượt thoại** của một nhân vật → **1 Block**.
    - Bên trong Block **tự tách theo câu** như trên.
  - Nếu phát hiện lỗi định dạng (thiếu ngoặc vuông, dòng không có dấu `:`, tên trống, ký tự không hợp lệ, hoặc tên không nhất quán), hiển thị hộp thoại cảnh báo:
    - **Thông báo:** *“Phát hiện lỗi trong kịch bản hội thoại.”*
    - **Tuỳ chọn:** **Quay lại chỉnh sửa** · **Tiếp tục vào Workspace** (vẫn tạo Block/Row theo mức nhận diện hiện có).

- **Tự tách:** **Bật** mặc định và áp dụng cho cả Đơn thoại & Hội thoại.
- **Không hỗ trợ SSML khi dán:** nếu người dùng dán chuỗi có dạng thẻ (ví dụ `<prosody>`), hệ thống coi là **text thường**.
- **Nhận diện nhân vật:** **chỉ** hỗ trợ định dạng `[Name]:`; người dùng có thể thay đổi mapping sau khi vào Workspace.
- **Từ điển có thể chỉnh:** người dùng thêm/sửa **Protected patterns** (viết tắt/emoji/đơn vị). **Seed v1** (bảo vệ khỏi tách/mở rộng):

  **Viết tắt & danh xưng:** Mr., Mrs., Ms., Mx., Dr., Prof., St., Jr., Sr., vs., etc., e.g., i.e., cf., No., Fig., Eq., U.S., U.K., U.N., a.m., p.m.  
  **Tháng:** Jan., Feb., Mar., Apr., Jun., Jul., Aug., Sep., Sept., Oct., Nov., Dec.  
  **Thứ trong tuần:** Mon., Tue., Tues., Wed., Thu., Thur., Fri., Sat., Sun.  
  **Đơn vị & ký hiệu:** %, °C, °F, km, m, cm, mm, km/h, mph, kg, g, mg, L, mL, s, sec, min, hr, h, kHz, MHz, GHz, $, €, £, ¥, 1st, 2nd, 3rd, 4th.  
  **Emoji (ví dụ):** 🙂, 😉, 😂, 😀, 😅, ❤️, 👍, 👎, ✅, ❌, ⭐, 🔥.

**AC:**  
- **Đơn thoại:** văn bản có nhiều đoạn → số **Block** đúng bằng số đoạn; trong mỗi Block, tách câu chính xác và tôn trọng protected patterns; câu quá dài **vẫn hiển thị 1 Row** nhưng phát mượt nhờ tách ẩn.  
- **Hội thoại:** mỗi lượt `[Name]:` → **1 Block**, màu nhân vật đúng ≥95%; khi có lỗi, xuất hiện cảnh báo với 2 lựa chọn *Quay lại chỉnh sửa* / *Tiếp tục vào Workspace*; sau khi **Tiếp tục**, người dùng vẫn có thể chỉnh trong Workspace.  
- **SSML trong input:** luôn hiển thị như text, không bị xử lý.

---

## 4) Thao tác cấp Block
- Điều khiển: **Voice, Style, Speed %, Pitch %, Add Pause, Variability, Emphasis, ▶ Nghe, … (Nhân bản / Di chuyển / Xoá)**
- Chỉnh cấu trúc: **Tách/Gộp/Nhân bản Block**; kéo thả để đổi thứ tự.
- Mặc định: xem §20.

**AC:** Mọi chỉnh sửa **Undo** được; nghe thử phản ánh cấu hình mới ngay.

---

## 5) Thao tác cấp Câu (Row)
- Điều khiển: **Text, ▶ Nghe, Tách, Gộp, …**  
- Khi **Chất lượng cao (HQ)** **bật**: dùng **Hiệu chỉnh nâng cao** ở cấp Row.  
- **Không hiển thị** thời lượng từng câu (giữ UI gọn ở GĐ1).

**AC:** Tách/Gộp giữ nguyên thừa kế giọng/style từ Block; Hiệu chỉnh nâng cao chỉ áp khi HQ bật.

---

## 6) Ánh xạ Nhân vật → Giọng
- Văn bản có `[Name]:` sẽ tự ánh xạ nhân vật→giọng (giữ giọng theo lần xuất hiện đầu).  
- Người dùng có thể thay đổi tại Block sau đó.

**AC:** ≥95% dòng có `[Name]:` được map đúng theo luật đơn giản; ghi đè của người dùng được lưu.

---

## 7) Thư viện giọng (Piper, tích hợp sẵn)
**Cung cấp 6–8 giọng EN (không import giọng tuỳ biến ở GĐ1):**
- **Natalie (F, ấm)** – thuyết minh lớp học rõ ràng
- **Ava (F, trung tính)** – mục đích chung
- **Grace (F, sáng)** – giải thích giàu năng lượng
- **Liam (M, trung tính)** – cân bằng, hàng ngày
- **James (M, trầm)** – giọng giảng đường quyền lực
- **Ethan (M, rõ ràng)** – gọn, sắc nét
- **Noah (M, bình tĩnh)** – kể chuyện thư thái

**AC:** Trình chọn giọng có ≥6 mục kèm avatar & mô tả ngắn; đổi giọng cập nhật nghe thử ngay.

---

## 8) Style (macro) & Độ mượt ghép
- Style dạng chip: **Conversational · Newscast · Storytelling · Promo · Calm · Excited · Whisper · Narration**
- **Triết lý Macro:** người dùng chọn style; ứng dụng tinh chỉnh nhẹ Speed/Pitch/Pause ở hậu trường.  
- **Hậu kỳ:** hệ thống tự tối ưu **độ mượt** khi ghép câu/đoạn (không cần nút chỉnh tay).

**AC:** Đổi style tạo khác biệt rõ ràng về sắc thái/nhịp nhưng **vẫn mượt** khi nối.

---

## 9) Công tắc Chất lượng cao (XTTS)
- **Mặc định:** **Tắt** (Piper).  
- **Hành vi:** Nếu phát hiện **CUDA** → dùng GPU; nếu **không** → chạy CPU.
- **Thông điệp:**  
  - **Có GPU:** Toast — *“High‑Quality đang dùng tăng tốc GPU.”*  
  - **Không CUDA (ngắn):** Toast — *“High‑Quality chạy không có GPU. Thời gian tạo có thể lâu hơn.”*  
  - **Không CUDA (lần đầu – dialog):**  
    **Tiêu đề:** *High‑Quality trên CPU*  
    **Nội dung:** *Không phát hiện GPU NVIDIA (CUDA) tương thích. High‑Quality vẫn hoạt động nhưng có thể chậm hơn. Bạn có thể tiếp tục hoặc chuyển về Chế độ Chuẩn (Piper) bất cứ lúc nào.*  
    **Nút:** **Tiếp tục bằng CPU** (chính) · **Dùng chế độ Chuẩn** (phụ) · [ ] *Đừng hiện lại*
- **Ràng buộc phạm vi:** HQ **chỉ** nâng chất lượng; **không** mở thêm tính năng ngoài những mục đã nêu.  
- **UI:** Công tắc ở header + huy hiệu **HQ** trên các Block đang dùng.

**AC:** HQ chạy được cả khi không có CUDA; hiện đúng thông điệp; tắt HQ quay về Piper ngay.

---

## 10) SSML (chỉ khi HQ)

- **Không nhận SSML thô từ người dùng.** Ứng dụng **không** hiển thị/chỉnh hoặc phân tích thẻ SSML do người dùng dán vào; mọi nội dung nhập được coi là **plain text**.
- **Phạm vi:** **chỉ áp ở Câu (Row)**; mỗi Câu có nút **“Hiệu chỉnh nâng cao”** (chỉ hiển thị khi **High‑Quality** bật). Khi bấm **Generate**, các tham số UI ở cấp Câu sẽ được áp ngầm vào văn bản gửi engine.
- **Cơ chế áp dụng:** Người dùng chỉ điều chỉnh qua **UI nhấn nhá** (thanh trượt Pitch/Rate/Volume/Break). Khi bấm **Generate**, hệ thống **mới** chuyển các tham số UI thành chỉ thị SSML **ngầm** và gửi cho engine xử lý.
- **Whitelist (ở tầng engine, nội bộ):** `<break>`, `<prosody rate|pitch|volume>`, `<emphasis>`, `<say-as …>` — không hiển thị ra UI.
- **Kiểm tra:** nếu tham số UI vượt ngưỡng hợp lệ, hiển thị lỗi inline và không render cho tới khi chỉnh lại.
- **Lưu dữ liệu:** trong file project chỉ lưu **tham số UI** (không lưu chuỗi SSML).

**AC:**
- Văn bản dán có chứa ký tự giống thẻ (ví dụ `<break>`) vẫn hiển thị như **plain text**, không bị xử lý.
- Bấm Generate: audio phản ánh đúng thay đổi từ UI; không có hiện tượng sinh thẻ trùng/chéo.

---

## 11) Hiệu chỉnh nâng cao cho Câu (HQ)

- **Cách mở:** Ở mỗi Câu (Row) có nút **Hiệu chỉnh nâng cao** (hiện khi HQ bật).

- **Khung làm việc (2 cột):**
  - **Trái: Văn bản câu** (plain text) với khả năng chọn vùng:
    - **Nhấp kép** để chọn **từ**; **kéo** để chọn **cụm**; **Shift+Mũi tên** mở rộng/thu hẹp; **Ctrl/Cmd+Nhấp** chọn nhiều vùng rời.
    - Vùng đã chọn được **highlight**; có **Clear selection**; **Tab** nhảy tới vùng đã chỉnh tiếp theo.
  - **Phải: Bảng điều khiển** (UI duy nhất, không hiển thị thẻ):
    1) **Nhịp & sắc thái (Prosody)**  
       - **Tốc độ (Rate):** −20% … +20% (bước 5%).  
       - **Cao độ (Pitch):** −5 … +5 (bước 1) — đơn vị tương đối (≈ bán âm).  
       - **Âm lượng (Volume):** −6 dB … +6 dB (bước 1 dB).  
    2) **Ngắt nghỉ (Breaks)**  
       - **Trước** và **Sau** vùng chọn: 0–400 ms (bước 50 ms).  
       - Chip nhanh: **Short 100 ms · Medium 200 ms · Long 300 ms**.  
    3) **Mức nhấn (Emphasis)**  
       - Chip: **None · Light · Medium · Strong** (áp cho vùng chọn).  
    4) **Cách đọc (Say‑as)**  
       - Chip: **Characters · Spell‑out · Ordinal · Cardinal · Date · Time · Unit**.  
       - Khi chọn **Date/Time/Unit**, hiển thị tùy chọn gợi ý (định dạng ngày, AM/PM, đơn vị viết tắt) — mặc định theo locale Project.  
    5) **Phạm vi áp dụng**  
       - **Apply to:** **Vùng đã chọn** · **Toàn câu**.  
       - **Apply to all occurrences:** **mặc định trong Block**; có checkbox **“Cũng áp dụng toàn Project”** (mặc định tắt).  
    6) **Xem trước & hoàn tác**  
       - **Không auto‑preview**: thay đổi sẽ hiển thị huy hiệu *“Cần xem trước”*.  
       - Nút **Xem trước vùng chọn** và **Xem trước cả câu** để render lại audio.  
       - **Reset vùng chọn** · **Reset cả câu**.  

- **Hành vi & ràng buộc:**
  - UI là **nguồn dữ liệu duy nhất**; hệ thống ánh xạ ngầm sang chỉ thị khi render, **không tạo trùng lặp** trên cùng phạm vi.
  - Nếu thiết lập vượt ngưỡng/không phù hợp (ví dụ Break > 400 ms), hiển thị cảnh báo **inline** và vô hiệu **Generate** cho câu đó tới khi sửa.
  - Câu quá dài vẫn tuân thủ **tách ẩn** theo quy tắc ở §3; mọi điều chỉnh áp dụng nhất quán lên các phân mảnh ẩn.

- **Tiêu chí chấp nhận:**
  - Mở panel từ nút **Hiệu chỉnh nâng cao** và thao tác chọn vùng hoạt động mượt (nhấp kép/kéo/Shift/Ctrl‑Cmd).
  - Thay đổi slider/chip → hiển thị *Cần xem trước*; khi bấm **Xem trước** thì audio phản ánh đúng thay đổi.  
  - Đóng panel, quay lại Workspace: highlight còn nguyên; bấm **Generate** cho Project/Block/Câu cho ra audio đúng hiệu ứng.

### Wording cụ thể cho Panel (VI/EN)

**Thanh trượt / Sliders**
- **Tốc độ (Rate)** — *Chậm* ↔ *Nhanh*  
  EN: **Rate** — *Slower* ↔ *Faster*  
  Tooltip VI: “Điều chỉnh nhịp đọc của vùng chọn (−20% đến +20%, bước 5%).”  
  Tooltip EN: “Adjust speaking rate for the selection (−20% to +20%, step 5%).”
- **Cao độ (Pitch)** — *Thấp* ↔ *Cao*  
  EN: **Pitch** — *Lower* ↔ *Higher*  
  Tooltip VI: “Điều chỉnh cao độ tương đối (−5 đến +5, bước 1).”  
  Tooltip EN: “Adjust relative pitch (−5 to +5, step 1).”
- **Âm lượng (Volume)** — *Nhẹ* ↔ *Mạnh*  
  EN: **Volume** — *Softer* ↔ *Louder*  
  Tooltip VI: “Điều chỉnh mức âm lượng của vùng chọn (−6 dB đến +6 dB, bước 1 dB).”  
  Tooltip EN: “Adjust loudness of the selection (−6 dB to +6 dB, step 1 dB).”
- **Ngắt ngắn (Break)** — *Không* ↔ *+400 ms*  
  EN: **Break** — *None* ↔ *+400 ms*  
  Tooltip VI: “Chèn ngắt trước/sau vùng chọn. Dùng chip nhanh để chọn 100/200/300 ms.”  
  Tooltip EN: “Insert pause before/after the selection. Use quick chips for 100/200/300 ms.”

**Chip nhanh / Quick chips**
- **Ngắt trước / Break before** · **Ngắt sau / Break after**  
  EN: **Break before** · **Break after**
- **Short 100 ms** · **Medium 200 ms** · **Long 300 ms** (VI/EN giữ nguyên số đo)
- **Mức nhấn (Emphasis)**: **None · Light · Medium · Strong** (VI/EN giống nhau)
- **Cách đọc (Say‑as)**: **Characters · Spell‑out · Ordinal · Cardinal · Date · Time · Unit** (VI: **Ký tự** · **Đánh vần** · **Số thứ tự** · **Số đếm** · **Ngày** · **Giờ** · **Đơn vị**)

**Nút & hành động / Buttons & actions**
- **Áp dụng cho vùng chọn**  
  EN: **Apply to selection**
- **Áp dụng cho toàn câu**  
  EN: **Apply to sentence**
- **Áp dụng cho tất cả lần xuất hiện (trong Block)**  
  EN: **Apply to all occurrences (in Block)**
- **Cũng áp dụng toàn Project** *(checkbox)*  
  EN: **Also apply across Project** *(checkbox)*
- **Xem trước vùng chọn** · **Xem trước cả câu**  
  EN: **Preview selection** · **Preview sentence**
- **Đặt lại vùng chọn** · **Đặt lại cả câu**  
  EN: **Reset selection** · **Reset sentence**
- **Đóng** / **Lưu** *(tuỳ chọn nếu cần lưu cục bộ mà chưa Generate)*  
  EN: **Close** / **Save**

**Tooltip chọn vùng / Selection tips**
- VI: “Nhấp kép để chọn từ. Kéo chuột để chọn cụm. Shift + Mũi tên để mở rộng. Ctrl/Cmd + Nhấp để chọn nhiều vùng.”  
  EN: “Double‑click to select a word. Drag to select a phrase. Shift + Arrows to expand. Ctrl/Cmd + Click to multi‑select.”

**Thông báo trạng thái / Status toasts**
- VI: “Đã áp dụng cho 4 lần xuất hiện (trong Block).” · “Không có vùng chọn.” · “Đã đặt lại về mặc định.”  
  EN: “Applied to 4 occurrences (in Block).” · “No selection.” · “Reset to defaults.”

**Cảnh báo / Validation**
- VI: “Giá trị vượt ngưỡng cho phép.” · “Hãy chọn vùng trước khi áp dụng.” · “Bật High‑Quality để sử dụng Hiệu chỉnh nâng cao.”  
  EN: “Value out of allowed range.” · “Select a region before applying.” · “Turn on High‑Quality to use Advanced adjustments.”

---

## 12) Chuẩn hoá văn bản & Protected patterns
- Chuẩn hoá đọc **số, đơn vị, tiền tệ, ngày giờ**.  
- **Protected patterns:** danh sách người dùng tự chỉnh để **không** bị tách/mở rộng.  
- Mặc định: Chuẩn hoá **Bật**.

**AC:** “3kg” → “three kilograms”; các token được bảo vệ giữ nguyên.

---

## 13) Nhạc nền (FX) & Ducking
- Cung cấp **5 track mẫu** (vòng lặp 8–12s, trung tính, placeholder hợp lệ bản quyền):
  1. **Soft Ambient Pad** — nền synth thoáng, không trống, trung tính.
  2. **Light Corporate Bed** — piano/guitar nhẹ nhàng, chuyển động tối thiểu.
  3. **Classroom Calm Piano** — piano êm, cảm giác phòng học ấm.
  4. **Neutral Low Drone** — nền tần số thấp ấm, tránh che giọng.
  5. **Clean Tick Bed** — tiếng tick nhẹ để giữ nhịp (không kick/snare).
- **Auto‑ducking:** **Bật** khi bật FX.
- **Phạm vi:** áp ở **Project** hoặc **Block** (bỏ cấp Row ở GĐ1 để UI gọn).

**AC:** Bật FX vẫn nghe lời rõ; đổi track không làm sai thời lượng; vòng lặp mượt trong ≥3 phút phát liên tục.

---

## 14) Kiểm soát chất lượng âm (QC)
- **Mục tiêu:** **−16 LUFS (stereo)**, **true peak −1.0 dBTP**.  
- Sau khi render: đo và **Auto‑normalize & Limit** (mặc định **Bật**).  
- Hiển thị cảnh báo QC (nguy cơ clipping, LUFS lệch); nút **“Sửa (Fix)”** áp normalizer.

**AC:** File xuất nằm trong ±0.5 LUFS quanh −16; true peak ≤ −1.0 dBTP; có cảnh báo khi vượt ngưỡng.

---

## 15) Nghe thử
- Nghe theo **Row**, **Block**, **Project**.  
- **Không** có waveform/loop/scrub ở GĐ1.

**AC:** Play toàn project theo đúng thứ tự block, không giật khi chuyển.

---

## 16) Xuất tệp
- **Định dạng:** **WAV (24‑bit 48 kHz)** và **MP3 (192/256/320 kbps)**.  
- **Phạm vi:** Xuất theo **Row**, **Block**, hoặc **Project**; nhiều file → **ZIP**.  
- **Tên file (tối ưu cache, ngắn):** `p-{proj}_b{B}_r{R}_spk{S}_m{mode}.{ext}`  
  - `mode`: `p` = Piper, `x` = XTTS.

**AC:** Xuất được ở mọi phạm vi; tên file ngắn và ổn định cho cache.

---

## 17) Jobs bất đồng bộ & Độ bền
- Trạng thái: **Queued · Processing · Done · Error**.  
- Hiển thị tiến độ theo Row (**x/y**) ở cấp Block & Project.  
- Điều khiển: **Cancel, Pause, Resume, Retry**.  
- **Tự retry:** tối đa **2 lần/Row** với lỗi tạm thời.  
- Khi một số Row lỗi: tiếp tục các Row khác; hiển thị Retry riêng cho Row lỗi.

**AC:** Render dài không khoá UI; Row lỗi có thể retry riêng; auto‑retry có log số lần.

---

## 18) Lịch sử & Ảnh chụp (Snapshot)
- Lịch sử đơn giản theo Block; **Undo/Redo** cho các thao tác chính.  
- **Snapshot Project** trước khi render hàng loạt.

**AC:** Phục hồi snapshot khôi phục giọng, style, text, FX, trạng thái HQ.

---

## 19) Quản lý Project
- **CRUD** project; lưu/mở file `.vtnproj`.  
- **Metadata lưu:** language=EN, voice/style mặc định, mapping nhân vật, protected patterns, lựa chọn FX, trạng thái HQ.

**AC:** Mở lại project khôi phục đúng trạng thái lần trước.

---

## 20) Mặc định (GĐ1)
- **Speed:** 0% (1.0×)  
- **Pitch:** 0%  
- **Variability:** 5% (chỉ hiện khi HQ)  
- **Pause:** dấu phẩy 120 ms · dấu chấm 300 ms · xuống dòng 500 ms  
- **Tự tách câu:** **Bật**

**Macro style (độ lệch gợi ý):**
- Conversational: Speed +2%, Pitch +1%, Pause +5%
- Newscast: Speed +6%, Pitch −1%, Pause −10%
- Storytelling: Speed −4%, Pitch −1%, Pause +15%
- Promo: Speed +8%, Pitch +2%, Pause −15%
- Calm: Speed −6%, Pitch −2%, Pause +10%
- Excited: Speed +10%, Pitch +3%, Pause −5%
- Whisper: Volume −6 dB, Speed −2%, Pause +8%
- Narration: Speed 0%, Pitch 0%, Pause +5%

**AC:** Macro tạo khác biệt vừa phải; ghép vẫn mượt.

---

## 21) Phím tắt
`Space` Play/Pause · `J/K` Câu trước/Sau · `S` Tách · `M` Gộp · `H` Bật/Tắt HQ · `E` Xuất · `R` Retry lỗi · `N` Thêm Block · `Ctrl/Cmd+Z` Hoàn tác · `Ctrl/Cmd+Y` Làm lại

**AC:** Hoạt động trên Windows/Mac; tooltip hiển thị mapping.

---

## 22) Đa ngôn ngữ (i18n)
- **Ngôn ngữ UI:** **EN/VI**, có nút chuyển trên header.  
- Lần đầu theo **ngôn ngữ hệ thống**; các lần sau **nhớ** lựa chọn gần nhất.  
- Chuyển ngôn ngữ **không** làm thay đổi dữ liệu project.

---

## 23) Quyền riêng tư & Lưu trữ cục bộ
- Lưu kết quả trong thư mục của project.  
- Nút **Clear audio cache**.  
- Telemetry: **Tắt** ở GĐ1.

**AC:** Xoá cache **không** xoá các file đã xuất.

---

## 24) Giai đoạn 2 (định hướng)
- Vai trò: **Admin · Editor · Viewer**.  
- Chia sẻ project: **xem + render** (không cho sửa).  
- Hạn mức tài nguyên: nhỏ gọn, mỗi người dùng có 1 hàng đợi với 1 job đồng thời.

---

## 25) Trạng thái mô hình (minh bạch)
- Settings hiển thị **GPU availability: Yes/No**; có huy hiệu nhỏ khi phát hiện CUDA.

---

## 26) Ma trận chấp nhận (tóm tắt)
| Khu vực | Điều kiện cần đạt |
|---|---|
| Dán/Tách | Tách đoạn/câu chính xác; tôn trọng token bảo vệ; `[Name]:` → map nhân vật. |
| Chỉnh Block/Row | Có Undo; giữ thừa kế voice/style; preview tức thời. |
| Công tắc HQ | Hoạt động cả khi có/không CUDA; thông điệp rõ; tắt được ngay. |
| SSML/Hiệu chỉnh Câu | Chỉ khi HQ; tham số UI hợp lệ; sinh chỉ thị ngầm; audio phản ánh đúng. |
| FX & ducking | Giọng rõ ràng; thời lượng không đổi; áp theo Project/Block. |
| QC | Xuất ở −16 LUFS ±0.5; true peak ≤ −1.0 dBTP; Fix hoạt động. |
| Xuất | WAV/MP3; Row/Block/Project; ZIP; tên ngắn dễ cache. |
| Jobs | UI không bị chặn; tiến độ per Row; Cancel/Pause/Resume/Retry; auto‑retry ×2. |
| Lịch sử/Snapshot | Phục hồi đầy đủ thiết lập liên quan. |
| i18n & lưu trữ | EN/VI chuyển đổi; xoá cache an toàn. |

---

## 27) Việc cần chốt tiếp
- Avatar giọng (stock) và mô tả cuối cho từng giọng.
