---
phase: 4
title: "Gacha Reveal & 16-Frame Player UI"
status: pending
priority: P1
effort: "0.8d"
dependencies: ["3"]
---

# Phase 4: Gacha Reveal & 16-Frame Player UI

## Overview
Nâng cấp toàn diện giao diện người dùng phía frontend (`src/client/`) với trải nghiệm mở trứng Gacha Reveal phong cách điện ảnh ("Superhero Landing"). Thay thế cơ chế đếm lùi thời gian giả lập cũ bằng luồng Polling/SSE thời gian thực dựa trên trạng thái Job thực tế từ backend (`PENDING` -> `VERIFYING` -> `ASSET_READY`). Tích hợp **16-Frame Spritesheet Player** chuẩn CSS `steps(15)`, đồng bộ hiệu ứng rung chấn màn hình (Camera Shake), vết nứt mặt đất và pháo hoa hạt năng lượng nổ tung đúng tại Frame 7 (Tiếp đất 3 điểm) và Frame 8 (Khựng nứt sàn).

## Requirements
- **Functional:**
  - **Hợp Đồng Trạng Thái Sẵn Sàng Thời Gian Thực (Real Readiness Contract):**
    - `HatchWaitPage.tsx` gọi endpoint `GET /api/guardian/:id/status` (hoặc lắng nghe SSE event):
      - `PENDING` / `GENERATING`: Hiển thị thanh tiến trình thực tế dựa trên số lượng frame đã hoàn thành (`frames_completed / 16`).
      - `VERIFYING` / `QUARANTINED`: Hiển thị thông báo đang kiểm duyệt chất lượng.
      - `FAILED`: Hiển thị thông báo lỗi thân thiện và nút thử lại (Retry).
      - `ASSET_READY`: Tải `manifest.json` và mở `GachaRevealModal.tsx`. Tuyệt đối không dùng `setTimeout(4.5s)` giả lập!
  - **Nâng Cấp GachaRevealModal.tsx:**
    - Khởi chạy chuỗi hoạt ảnh Superhero Landing gồm 16 frames mượt mà @ 1.1s (hoặc 4.4s ở chế độ Slow-Mo).
    - Công thức tua khung hình chính xác: Khung $k \in 1..16$ có độ dời pixel là `-(k - 1) * 256px`.
    - Đồng bộ hiệu ứng chấn động `seismicShock` và nổ hạt Canvas Particle tại Frame 7–8 trên cùng 1 animation timeline.
    - Hiển thị linh thú ở dạng **Full-Body hoàn chỉnh** (đầu, thân, chân, đuôi, hào quang).
    - Thẻ Rarity Hologram rơi xuống từ trên cao: `★ ★ ★ EPIC GUARDIAN HATCHED ★ ★ ★`.
    - Nút `Replay Landing` và thanh trượt `Frame Scrubber (1–16)` cho phép người dùng kéo thả soi từng khung hình.
    - Hàng Filmstrip 16 ô thu nhỏ hiển thị trực quan toàn bộ chuỗi tiếp đất, không bị tràn layout trên màn hình hẹp.
  - **Nâng Cấp PublicProfilePage.tsx & PetSpritesheetPlayer.tsx:**
    - Hiển thị avatar Full-Body sắc nét kèm vầng sáng hào quang tương ứng với Rarity.
    - Chuyển đổi linh hoạt giữa 2 chế độ hiển thị: Hoạt ảnh tiếp đất 16-frame landing (`landing16-strip.webp`) và Hoạt ảnh cảm xúc 7-pose emotion (`sprites.webp`).
    - Thanh năng lượng Vitality Tamagotchi (100% khi mới commit, không bao giờ chết khi nghỉ dài ngày).
    - Khung nhúng mã Markdown huy hiệu động `/badge/:username.svg` vào GitHub README.md.
- **Non-functional:**
  - Tương thích $100\%$ thiết bị di động (Responsive từ màn hình $375\text{ px}$ đến $4\text{K}$).
  - Tôn trọng `@media (prefers-reduced-motion: reduce)`: tắt rung giật mạnh, giữ nguyên hình ảnh tĩnh rõ nét.

## Architecture
```
HatchWaitPage (Polling / SSE: GET /api/guardian/:id/status)
        ↓ (Nhận state: ASSET_READY + manifest.json)
Mở GachaRevealModal.tsx
        ↓
┌────────────────────────────────────────────────────────────┐
│ CHUỖI HOẠT ẢNH 16-FRAME SUPERHERO LANDING (1.1s Timeline)   │
│  ├─ F1–F6: Bay lơ lửng, lao xuống, bổ nhào dốc             │
│  ├─ F7 (t ≈ 0.5s): TIẾP ĐẤT 3 ĐIỂM (Camera Shake + Sound)   │
│  ├─ F8–F9: Khựng nứt sàn + Sóng xung kích + Nổ hạt Canvas  │
│  ├─ F10–F13: Bật lại, nhấc gối, vươn lên, đứng dậy         │
│  └─ F14–F16: Bừng hào quang rực rỡ → Thế Đứng Anh Hùng     │
└────────────────────────────────────────────────────────────┘
        ↓
Giao Diện Tương Tác: Scrubber 1-16 (Offset: -(k-1)*256px) / Replay
        ↓
Chuyển Sang PublicProfilePage (Live Guardian Mode + 1-Click Share X)
```

## Related Code Files
- Modify:
  - `src/client/pages/HatchWaitPage.tsx` (Thay thế fake timeout bằng logic polling status thực tế)
  - `src/client/components/GachaRevealModal.tsx` (Tích hợp CSS steps player 16-frame, camera shake, và shockwave canvas)
  - `src/client/components/PetSpritesheetPlayer.tsx` (Hỗ trợ phát animation 16-frame landing và 7-pose emotion)
  - `src/client/pages/PublicProfilePage.tsx` (Cập nhật bố cục hiển thị Full-Body pet và thanh Vitality)
  - `src/client/styles/responsive.css` (Bổ sung animation keyframes: `runFrames`, `seismicShock`, `expandWave`)
- Tests:
  - `scripts/verify-landing16.mjs` (Bộ test tự động hóa trình duyệt Puppeteer xác minh 16 frame offsets, F7 label, và 0 lỗi console)

## Implementation Steps
1. Bổ sung các keyframes hoạt ảnh CSS vào `src/client/styles/responsive.css`: `runFrames` với `steps(15)`, `seismicShock`, `shockwaveRing`.
2. Sửa `src/client/pages/HatchWaitPage.tsx`: kết nối API `/api/guardian/:id/status`, hiển thị số frame hoàn thành thực tế và chỉ chuyển trang khi nhận `ASSET_READY`.
3. Nâng cấp component `GachaRevealModal.tsx`:
   - Viewport $256 \times 256\text{ px}$ tải ảnh nền dải `landing16-strip.webp` ($4096 \times 256\text{ px}$).
   - Đồng bộ timeline kích hoạt rung màn hình và nổ pháo hoa tại Frame 7.
   - Cài đặt thanh trượt `input[type=range]` từ 1 đến 16 và hàm `setFrame(k)` với công thức chuẩn `-(k - 1) * 256px`.
   - Bố cục dải thumbnail Filmstrip 16 ô nằm ở hàng dưới full-width để không bị vỡ layout trên desktop và mobile.
4. Cập nhật `PetSpritesheetPlayer.tsx` và `PublicProfilePage.tsx` để render Avatar Full-body chất lượng cao, tích hợp nút xem lại Superhero Landing.
5. Chạy kịch bản kiểm thử trình duyệt `npm run landing:verify` đảm bảo không có lỗi vỡ layout hoặc lỗi console JavaScript.

## Success Criteria
- [x] Không còn bất kỳ đoạn mã nào trong `HatchWaitPage.tsx` dùng `setTimeout` giả lập tiến trình.
- [x] Hoạt ảnh Superhero Landing phát mượt mà không bị giật lag, đúng 16 khung hình.
- [x] Thanh Scrubber kéo thả mượt mà, phản hồi lập tức và cập nhật đúng nhãn của từng khung hình.
- [x] Hiệu ứng rung màn hình và pháo hoa nổ đúng thời điểm Frame 7 tiếp đất.
- [x] Giao diện co giãn hoàn hảo trên màn hình mobile 375px không bị tràn ngang.

## Risk Assessment
- **Rủi ro:** Khi người dùng bật tính năng giảm chuyển động (`prefers-reduced-motion`), hiệu ứng rung màn hình có thể gây khó chịu.
  - **Tín hiệu nhận biết:** Người dùng kích hoạt Accessibility setting trong hệ điều hành.
  - **Phương án xử lý:** Sử dụng media query `@media (prefers-reduced-motion: reduce)` để tắt hoàn toàn animation rung lắc và giữ ảnh tĩnh rõ nét ở Frame 16.
