---
phase: 3
title: "Nano Banana 2 Async Queue (16 Poses)"
status: pending
priority: P1
effort: "1.0d"
dependencies: ["1", "2"]
---

# Phase 3: Nano Banana 2 Async Queue (16 Poses)

## Overview
Xây dựng hệ thống hàng đợi sinh ảnh bất đồng bộ 16 poses độc lập bằng Gemini Nano Banana 2 trên Cloudflare Queue Worker (`githoot-ai-queue`). Tích hợp cơ chế **lưu vết từng khung hình (Per-Pose Frame Checkpointing)** vào bảng D1 `guardian_hatch_frames` và kho R2 `guardians/{id}/frames/f{NN}_{sha256}.png`. Khi một job bị retry do chạm ngưỡng thời gian 15 phút hoặc rate-limit, worker tự động bỏ qua các frame đã được chấp nhận trước đó, đảm bảo $100\%$ không bị tính phí lặp lại (True Zero Duplicate Billing). Sau khi đủ 16 frames hợp lệ, hệ thống ghép thành Spritesheet 4x4 (1024²) và Animation Strip (4096x256), xuất bản đồng thời cả PNG và WebP lên Cloudflare R2 CDN.

## Requirements
- **Functional:**
  - **Queue Payload & Idempotency:**
    - Payload hàng đợi: `{ jobId, guardianId, requestFingerprint, modelId }`. Worker tải `spec` và `reference_sha256` trực tiếp từ D1/R2.
    - Truy vấn bảng `guardian_hatch_frames`: tải danh sách các frames đã hoàn thành (`state = 'ACCEPTED'`). Nếu frame đã tồn tại hợp lệ, tái sử dụng ngay lập tức mà không gọi API Gemini.
  - **16 Single-Pose Generation Loop & Checkpointing:**
    - Lấy danh sách 16 poses từ `POSE_SET` (`hover` -> `hero_stance`).
    - Gửi request trực tiếp tới Gemini Endpoint (`nano-banana-pro-preview` / `gemini-3-pro-image`), đính kèm ảnh reference inline với header xác thực `x-goog-api-key`.
    - Giới hạn tối đa 3 lần thử / pose nếu dính lỗi chất lượng.
    - Chạy bộ lọc viền xanh và cổng hình học `validateFrame({ stage: 'raw' })`: loại bỏ ảnh collage (>4 vùng), ảnh đa nhân vật (vùng 2 > 30%), subject quá nhỏ (<6%) hoặc tỷ lệ sai.
    - Dò contour alpha toàn ảnh `contourBBox()`, cắt và căn giữa vào khung $256 \times 256\text{ px}$.
    - **Lưu Vết Frame Ngay Lập Tức:** Lưu file `guardians/{id}/frames/f{NN}_{sha256}.png` lên R2 và ghi bản ghi vào D1 `guardian_hatch_frames` (`state = 'ACCEPTED'`, lưu `raw_gate_metrics`). Cập nhật `frames_completed` trong `guardian_hatch_jobs`.
  - **Deterministic Composition & Dual-Format Output:**
    - Sau khi đủ 16 frames trong D1: Ghép thành 4x4 Spritesheet ($1024 \times 1024\text{ px}$) và 16-Frame Strip ($4096 \times 256\text{ px}$).
    - Sử dụng Edge-compatible WASM WebP Encoder (`@silvia-odwyer/photon` hoặc pure WASM libwebp) để xuất bản song song cả file `.png` và `.webp`.
    - Upload R2: `guardians/{id}/landing16-sheet.png`, `.webp`, `landing16-strip.png`, `.webp`, và `manifest.json`.
- **Non-functional:**
  - Tiêu thụ bộ nhớ của Worker < 128MB.
  - Tự động dừng và reschedule an toàn nếu gặp lỗi rate-limit HTTP 429 từ Google Gemini API.

## Architecture
```
Cloudflare Queue Worker (Bước 2: 16-Pose Loop)
        ↓
Tải D1 IdentitySpec & R2 Canonical Reference
        ↓
Truy Vấn D1: guardian_hatch_frames (Đã có frame nào ACCEPTED chưa?)
        ↓
┌────────────────────────────────────────────────────────────┐
│ VÒNG LẶP SINH CÁC FRAME CÒN THIẾU (Tối đa 3 lần thử/pose)  │
│  ├─ Prompt Compiler (Pose + Reference Inline)              │
│  ├─ Gemini Nano Banana 2 Direct API (Header Auth)          │
│  ├─ removeChroma() + Green De-Spill ($g=\min(g,(r+b)/2)$)  │
│  ├─ validateFrame({ stage: 'raw' }) (Gate 4 cổng)          │
│  ├─ contourBBox() → Căn giữa vào Canvas 256x256           │
│  └─ CHECKPOINT: Lưu R2 frame + Ghi D1 guardian_hatch_frames│
└────────────────────────────────────────────────────────────┘
        ↓
Đủ 16 Frames?
        ↓
Ghép Lưới Tất Định Server-Side
  ├─ 4x4 Sheet (1024x1024 PNG + WebP)
  └─ 16-Frame Strip (4096x256 PNG + WebP)
        ↓
Tải Lên R2: /guardians/{id}/landing16-*
        ↓
Ghi Manifest v1 & Chuyển Job State sang VERIFYING
```

## Related Code Files
- Create:
  - `src/server/services/image/edge-webp-encoder.ts` (WASM WebP encoder tương thích Cloudflare Worker runtime)
  - `src/server/services/image/landing-compositor.ts` (Ghép 16 frames thành sheet và strip)
- Modify:
  - `src/server/services/ai/gemini-client.ts` (Nâng cấp client gọi Gemini: xác thực qua header, trích xuất đúng part ảnh inlineData)
  - `src/server/queue/generation-worker.ts` (Cập nhật consumer xử lý 16 poses có checkpointing từng frame vào D1)
  - `src/server/services/image/slicer.ts` (Xoá bỏ hoàn toàn logic crop theo toạ độ cố định cũ)
- Tests:
  - `tests/unit/queue-worker-16poses.test.ts` (Kiểm thử giả lập vòng lặp 16 poses, resume và checkpointing)

## Implementation Steps
1. Xây dựng module `src/server/services/image/edge-webp-encoder.ts` đóng gói thư viện WASM WebP cho Cloudflare Workers.
2. Nâng cấp `src/server/services/ai/gemini-client.ts`: chuyển sang dùng header `x-goog-api-key`, xử lý đính kèm reference image dạng inline data và lọc kết quả an toàn.
3. Xây dựng module `src/server/services/image/landing-compositor.ts` ghép 16 khung hình $256 \times 256\text{ px}$ thành 4x4 sheet và horizontal strip.
4. Cập nhật `src/server/queue/generation-worker.ts`: hiện thực hóa cơ chế checkpointing từng frame vào bảng `guardian_hatch_frames` và R2, ghép ảnh khi đủ 16 frames và ghi `manifest.json`.
5. Viết unit tests kiểm thử cơ chế resume: chạy dở 10 frames, ngắt quãng và chạy tiếp chỉ sinh thêm 6 frames còn lại.

## Success Criteria
- [x] 16 poses được sinh hoàn chỉnh từ đúng 1 model allowlisted mà không bị lặp pose hay gãy hình.
- [x] Cơ chế checkpointing đảm bảo khi job bị retry sẽ không sinh lại các frames đã `ACCEPTED` trước đó.
- [x] Cả 4 tập tin đồ hoạ (2 PNG, 2 WebP) được tạo thành công và đồng bộ mã băm trên R2.
- [x] Bộ nhớ tiêu thụ trong Worker không vượt quá 128MB.

## Risk Assessment
- **Rủi ro:** Khi có nhiều users cùng hatch một lúc, 16 calls/user có thể nhanh chóng làm cạn kiệt quota RPM/TPM của Gemini API.
  - **Tín hiệu nhận biết:** HTTP 429 rate limit.
  - **Phương án xử lý:** Queue consumer đặt `max_concurrency: 1` hoặc `2`, bắt mã lỗi 429 và gọi `message.retry({ delaySeconds: 30 })` để giãn cách thời gian an toàn.
