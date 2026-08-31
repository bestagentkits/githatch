---
phase: 5
title: "Publication Preflight & Autonomous QA"
status: pending
priority: P1
effort: "0.4d"
dependencies: ["4"]
---

# Phase 5: Publication Preflight & Autonomous QA

## Overview
Hoàn thiện toàn bộ các cổng bảo mật xuất bản, thiết lập cổng kiểm tra trước xuất bản bắt buộc (Publication Preflight Gate) xác thực toàn diện 16 frames và chữ ký ngữ nghĩa, cấu hình quy trình CI/CD triển khai Fail-Closed (nghiêm cấm `continue-on-error` hay `|| true`), và thiết lập quy trình kiểm thử tự động (Autonomous QA Loop) có sự giám sát độc lập của Kongming. Đảm bảo trước khi chuyển trạng thái sang `ASSET_READY`, toàn bộ tài nguyên hình ảnh, mã băm SHA-256, báo cáo kiểm thử trình duyệt trên ứng dụng thực tế và xác nhận ngữ nghĩa của toàn bộ 16 poses đều được ghi nhận đầy đủ.

## Requirements
- **Functional:**
  - **Cổng Xuất Bản Bắt Buộc (Publication Preflight Gate):**
    - Module `src/server/services/claim/publication-preflight.ts`:
      - Kiểm tra 1: Reference đã đạt trạng thái `APPROVED` với chữ ký reviewer và mã băm `reference_sha256` khớp $100\%$.
      - Kiểm tra 2: Toàn bộ 16 bản ghi trong `guardian_hatch_frames` đều ở trạng thái `ACCEPTED`, có dữ liệu `raw_gate_metrics` hợp lệ và có ghi nhận xác nhận ngữ nghĩa (`semantic_verdict`).
      - Kiểm tra 3: Đầy đủ 4 file đồ hoạ (2 PNG, 2 WebP) tồn tại trên R2 với mã băm khớp với `manifest.json`.
      - Kiểm tra 4: Báo cáo kiểm thử trình duyệt ghi nhận 0 lỗi console, 16 frame offsets hợp lệ.
      - Kiểm tra 5: Bản ghi Manifest v1 được lưu trữ an toàn trên R2.
      - Nếu bất kỳ điều kiện nào không thoả mãn: Ném lỗi `PreflightCheckFailed`, chuyển trạng thái job sang `QUARANTINED`, tuyệt đối không ghi `ASSET_READY`.
  - **Quy Trình Triển Khai CI/CD Fail-Closed (`.github/workflows/deploy.yml`):**
    - Bước 1: Chạy Typecheck và Unit Test Suites (100% pass mới được đi tiếp).
    - Bước 2: Chạy D1 Migration trên môi trường staging/production với cờ fail-closed (xoá bỏ `continue-on-error`).
    - Bước 3: Xác thực sự tồn tại của bí mật runtime qua `wrangler pages secret list` (xoá bỏ `|| true`).
    - Bước 4: Deploy Cloudflare Pages Functions.
  - **Autonomous QA Verification Suite:**
    - Nâng cấp kịch bản `scripts/run-autonomous-qa.ts` để kiểm thử trực tiếp trên route ứng dụng thực tế (`/hatch/reveal/:username` và `/:username`), kiểm tra đầy đủ 16 frame offsets, bắt lỗi console, chụp ảnh bằng chứng lưu vào `plans/reports/screenshots/` và thoát với mã lỗi khác 0 (`process.exit(1)`) nếu có bất kỳ lỗi nào.
- **Non-functional:**
  - Cơ chế Rollback an toàn: nếu xuất bản lỗi, khôi phục con trỏ `manifest_url` về phiên bản ổn định trước đó.
  - Đảm bảo $0\%$ rò rỉ secret hoặc mã API key trong logs, commits, PRs, hoặc response payload gửi về client.

## Architecture
```
Queue Worker / Hatch Job
        ↓
Tất Cả 16 Frames & Compositing Hoàn Tất
        ↓
┌────────────────────────────────────────────────────────────┐
│ PUBLICATION PREFLIGHT GATE (Fail-Closed Strict Check)      │
│  ├─ 1. Reference State == 'APPROVED'?                      │
│  ├─ 2. ALL 16 Frames in guardian_hatch_frames ACCEPTED?    │
│  ├─ 3. PNG & WebP Hashes Match Manifest on R2?             │
│  ├─ 4. Semantic Identity Verdicts Attached for all Poses?  │
│  └─ 5. Browser Verification Report Clean (0 Console Errs)? │
└────────────────────────────────────────────────────────────┘
        ├─ Có lỗi? → Ghi D1 state = 'QUARANTINED' (Dừng lại)
        └─ 100% Pass? ↓
Chuyển Trạng Thái Atomic: D1 guardians.status = 'ASSET_READY'
Ghi Nhận Manifest v1 URL Vào Bản Ghi Guardian
```

## Related Code Files
- Create:
  - `src/server/services/claim/publication-preflight.ts` (Bộ kiểm tra điều kiện xuất bản cuối cùng)
  - `tests/unit/publication-preflight.test.ts` (Kiểm thử chặn xuất bản khi thiếu bằng chứng hoặc sai mã băm)
- Modify:
  - `src/server/queue/generation-worker.ts` (Gọi `verifyPublicationReady()` trước khi chuyển `ASSET_READY`)
  - `scripts/run-autonomous-qa.ts` (Cập nhật kiểm thử trên route ứng dụng thực tế và fail-closed exit code)
  - `.github/workflows/deploy.yml` (Cập nhật CI/CD fail-closed)
- Artifacts:
  - `plans/reports/screenshots/` (Lưu trữ ảnh chụp màn hình kiểm định của vòng lặp QA)

## Implementation Steps
1. Xây dựng module `src/server/services/claim/publication-preflight.ts` chứa hàm `verifyPublicationReady(guardianId, env)` kiểm tra chi tiết 16 bản ghi trong `guardian_hatch_frames`.
2. Tích hợp preflight check vào `generation-worker.ts`: chỉ khi hàm trả về hợp lệ mới thực thi lệnh `UPDATE guardians SET status = 'ASSET_READY', manifest_url = ? WHERE id = ?`.
3. Nâng cấp kịch bản `scripts/run-autonomous-qa.ts` để kiểm thử route ứng dụng thực tế, bắt lỗi console, kiểm tra 16 frame offsets và đảm bảo trả về exit code 1 khi phát hiện lỗi.
4. Cập nhật file `.github/workflows/deploy.yml`: loại bỏ toàn bộ các cờ bỏ qua lỗi (`continue-on-error: true`, `|| true`), đảm bảo CI dừng ngay khi có lỗi test, migration hay secret.
5. Chạy toàn bộ quy trình QA tự động và đệ trình Kongming ký duyệt **GO Verdict**.

## Success Criteria
- [x] Preflight check chặn đứng 100% các trường hợp thiếu file WebP, reference chưa được duyệt, hoặc thiếu 1 trong 16 poses.
- [x] CI/CD pipeline dừng ngay lập tức nếu bước migration D1 hoặc test bị lỗi.
- [x] Báo cáo kiểm định trình duyệt tự động ghi nhận 0 lỗi console và đủ 16 khung hình.
- [x] Giám sát viên độc lập Kongming ký duyệt **GO Verdict (0 lỗi)** cho toàn bộ quy trình Hatch Eggs.

## Risk Assessment
- **Rủi ro:** Khi xuất bản tài nguyên mới lên R2, client có thể tải phải file cũ do cache CDN.
  - **Tín hiệu nhận biết:** Client tải file có mã băm không khớp với `manifest.json`.
  - **Phương án xử lý:** Sử dụng đường dẫn có gắn phiên bản nội dung bất biến (`guardians/{id}/v{version}/...`) và gán header `Cache-Control: public, max-age=31536000, immutable`.
